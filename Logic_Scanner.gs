/**
 * LOGIC SCANNER
 * Gestisce la convalida dei QR Code e la sicurezza degli accessi staff.
 * ✅ OTTIMIZZATO: Cache per ridurre query ripetute
 * ✅ INTEGRAZIONE PASTO: Supporto finestre temporali pasto + dance
 */

// ═══════════════════════════════════════════════════════════════
// CACHE per ridurre query ripetute durante sessione scanner
// *** OLD: invariato ***
// ═══════════════════════════════════════════════════════════════
let CACHE_EVENTO = null;
let CACHE_STAFF = null;

// *** OLD: invariato ***
function renderScanner(e) {
  const template = HtmlService.createTemplateFromFile('scanner');
  template.eventoCodice = e.parameter.evento || "";
  template.nicknameStaff = e.parameter.staff || "";
  return setupMobileMeta(template, "Staff - Scanner QR");
}

// ═══════════════════════════════════════════════════════════════
// NUOVO: Helper per determinare la finestra temporale attiva
// Centralizzato qui perché serve sia a verificaAccessoScanner
// che a convalidaIngresso — stesso calcolo, una sola funzione
// ═══════════════════════════════════════════════════════════════
/**
 * Determina in quale finestra temporale ci troviamo
 * @param {Object} evento - record evento dal DB
 * @returns {Object} { attiva: bool, modalita: 'PASTO'|'DANCE'|null, msg: string }
 * 
 * Per SOLO_DANZA: usa solo inizio_checkin/fine_checkin (logica OLD)
 * Per CON_PASTO:  valuta prima la finestra pasto, poi cade sulla dance
 */
function determinaFinestraTemporale(evento) {
  const ora = new Date();
  const haPasto = evento.tipo_evento && evento.tipo_evento !== 'SOLO_DANZA';
  
  // ═══════════════════════════════════════════════════════════════
  // RAMO PASTO: solo se l'evento ha pasto E i campi sono valorizzati
  // ═══════════════════════════════════════════════════════════════
  if (haPasto && evento.inizio_checkin_pasto && evento.fine_checkin_pasto) {
    
    const inizioPasto = new Date(evento.inizio_checkin_pasto);
    const finePasto = new Date(evento.fine_checkin_pasto);
    const inizioDance = evento.inizio_checkin ? new Date(evento.inizio_checkin) : null;
    const fineDance = evento.fine_checkin ? new Date(evento.fine_checkin) : null;
    
    // STATO 1: Prima dell'apertura pasto
    if (ora < inizioPasto) {
      return {
        attiva: false,
        modalita: null,
        msg: "CHECK-IN PASTO APRE ALLE " + inizioPasto.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})
      };
    }
    
    // STATO 2: Finestra pasto attiva
    if (ora >= inizioPasto && ora <= finePasto) {
      return {
        attiva: true,
        modalita: 'PASTO',
        msg: "CHECK-IN PASTO ATTIVO"
      };
    }
    
    // STATO 3: Tra pasto e dance
    if (inizioDance && ora > finePasto && ora < inizioDance) {
      return {
        attiva: false,
        modalita: null,
        msg: "CHECK-IN PARTY APRE ALLE " + inizioDance.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})
      };
    }
    
    // STATO 4: Finestra dance attiva
    if (inizioDance && fineDance && ora >= inizioDance && ora <= fineDance) {
      return {
        attiva: true,
        modalita: 'DANCE',
        msg: "CHECK-IN PARTY ATTIVO"
      };
    }
    
    // STATO 5: Dopo chiusura dance
    if (fineDance && ora > fineDance) {
      return {
        attiva: false,
        modalita: null,
        msg: "CHECK-IN CHIUSO"
      };
    }
    
    // Fallback: se mancano i campi dance, pasto è chiuso → chiuso
    return { attiva: false, modalita: null, msg: "CHECK-IN CHIUSO" };
  }
  
  // ═══════════════════════════════════════════════════════════════
  // TRONCO PARTY: logica OLD identica per SOLO_DANZA
  // (oppure evento con pasto ma senza campi pasto valorizzati)
  // ═══════════════════════════════════════════════════════════════
  const inizio = evento.inizio_checkin ? new Date(evento.inizio_checkin) : null;
  const fine = evento.fine_checkin ? new Date(evento.fine_checkin) : null;
  
  if (inizio && ora < inizio) {
    return {
      attiva: false,
      modalita: null,
      msg: "CHECK-IN APRE ALLE " + inizio.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})
    };
  }
  
  if (fine && ora > fine) {
    return { attiva: false, modalita: null, msg: "CHECK-IN CHIUSO" };
  }
  
  // Scanner attivo — per SOLO_DANZA modalita resta 'DANCE'
  return {
    attiva: true,
    modalita: 'DANCE',
    msg: "CHECK-IN ATTIVO"
  };
}

/**
 * Verifica l'accesso, l'orario e recupera il LOGO tramite DATABASE.gs
 * ✅ USA CACHE per evento e staff
 * ✅ MODIFICATO: usa determinaFinestraTemporale() per 5 stati
 */
function verificaAccessoScanner(codiceEvento, nicknameStaff) {
  try {
    // ═══════════════════════════════════════════════════════════════
    // USA CACHE STAFF *** OLD: invariato ***
    // ═══════════════════════════════════════════════════════════════
    let staffId;
    if (!CACHE_STAFF || CACHE_STAFF.nickname !== nicknameStaff) {
      staffId = dbGetStaffIdByNickname(nicknameStaff);
      CACHE_STAFF = { nickname: nicknameStaff, id: staffId };
    } else {
      staffId = CACHE_STAFF.id;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // USA CACHE EVENTO *** OLD: invariato ***
    // ═══════════════════════════════════════════════════════════════
    let evento;
    if (!CACHE_EVENTO || CACHE_EVENTO.codice_evento !== codiceEvento) {
      CACHE_EVENTO = dbGetEventoInfo(codiceEvento);
    }
    evento = CACHE_EVENTO;
    
    // *** OLD: invariato ***
    if (!staffId) return { authorized: false, msg: "STAFF NON RICONOSCIUTO" };
    if (!evento) return { authorized: false, msg: "EVENTO NON TROVATO" };

    // ═══════════════════════════════════════════════════════════════
    // NUOVO: Usa helper centralizzato per determinare finestra
    // Sostituisce il blocco OLD che faceva solo inizio/fine_checkin
    // ═══════════════════════════════════════════════════════════════
    const finestra = determinaFinestraTemporale(evento);
    
    if (!finestra.attiva) {
      // Finestra non attiva → messaggio di attesa o chiusura
      // Per il frontend: troppoPresto=true se il messaggio contiene "APRE"
      // (lo scanner non si apre, mostra messaggio con bottone "VERIFICA ORA")
      const isAttesa = finestra.msg.includes("APRE");
      
      if (isAttesa) {
        // Estraiamo l'ora dal messaggio per compatibilità con campo oraApertura OLD
        const oraMatch = finestra.msg.match(/\d{2}:\d{2}/);
        return {
          authorized: true,       // ← authorized=true perché staff+evento sono OK
          troppoPresto: true,     // ← ma scanner non si attiva ancora
          oraApertura: oraMatch ? oraMatch[0] : "",
          msgAttesa: finestra.msg, // ← NUOVO: messaggio completo per il frontend
          nomeEvento: (evento.nome_evento || evento.nome || "EVENTO").toUpperCase(),
          nomeStaff: nicknameStaff.toUpperCase(),
          logoUrl: dbGetLogoUrl(),
          modalita: finestra.modalita,
          tipo_evento: evento.tipo_evento || 'SOLO_DANZA'
        };
      } else {
        // CHECK-IN CHIUSO
        return { authorized: false, msg: finestra.msg };
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Finestra attiva → scanner si apre
    // *** OLD: stessa struttura di risposta, con campi NUOVI aggiunti ***
    // ═══════════════════════════════════════════════════════════════
    return { 
      authorized: true, 
      troppoPresto: false,
      oraApertura: "",
      nomeEvento: (evento.nome_evento || evento.nome || "EVENTO").toUpperCase(),
      nomeStaff: nicknameStaff.toUpperCase(),
      logoUrl: dbGetLogoUrl(),
      modalita: finestra.modalita,           // NUOVO: 'PASTO' o 'DANCE'
      tipo_evento: evento.tipo_evento || 'SOLO_DANZA'  // NUOVO: per il frontend
    };
  } catch (e) {
    // *** OLD: invariato ***
    return { authorized: false, msg: "ERRORE CONNESSIONE DB" };
  }
}

/**
 * Valida il QR Code durante la scansione
 * ✅ MODIFICATO: gate ingresso (finestra) + catena validazione OLD + gate uscita (pasto/dance)
 */
function convalidaIngresso(qrToken, codiceEvento, nicknameStaff) {
  try {
    // ═══════════════════════════════════════════════════════════════
    // CATENA VALIDAZIONE BASE *** OLD: invariata ***
    // ═══════════════════════════════════════════════════════════════
    if (!qrToken) return { success: false, msg: "QR VUOTO" };

    const staffId = dbGetStaffIdByNickname(nicknameStaff);
    if (!staffId) return { success: false, msg: "ERRORE STAFF" };

    const evento = dbGetEventoInfo(codiceEvento);
    if (!evento) return { success: false, msg: "ERRORE EVENTO" };

    // ═══════════════════════════════════════════════════════════════
    // GATE INGRESSO: verifica finestra temporale
    // NUOVO: sostituisce il vecchio controllo inizio/fine_checkin
    // ═══════════════════════════════════════════════════════════════
    const finestra = determinaFinestraTemporale(evento);
    
    if (!finestra.attiva) {
      return { success: false, msg: finestra.msg };
    }
    
    // ═══════════════════════════════════════════════════════════════
    // CATENA VALIDAZIONE PRENOTAZIONE *** OLD: invariata ***
    // ═══════════════════════════════════════════════════════════════
    const prenotazione = dbGetPrenotazioneDaToken(qrToken);
    if (!prenotazione) return { success: false, msg: "QR NON VALIDO" };

    // Helper nome cliente (usato in tutti i return)
    const nomeCliente = (prenotazione.cliente_nome + (prenotazione.cliente_cognome ? " " + prenotazione.cliente_cognome : "")).toUpperCase();

    // Controllo stato ANNULLATA *** OLD: invariato + include_pasto dalla NEW ***
    if (prenotazione.stato === 'ANNULLATA') {
      return { 
        success: false, 
        msg: "PRENOTAZIONE ANNULLATA",
        cliente: nomeCliente,
        include_pasto: prenotazione.include_pasto || false
      };
    }

    // Controllo GIÀ ENTRATO *** OLD: invariato + include_pasto dalla NEW ***
    if (prenotazione.entrato) {
      const oraGiaEntrato = new Date(prenotazione.ora_ingresso).toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});
      return { 
        success: false, 
        msg: "GIÀ ENTRATO ALLE " + oraGiaEntrato,
        cliente: nomeCliente,
        include_pasto: prenotazione.include_pasto || false
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // GATE USCITA: decisione basata su finestra + include_pasto
    // NUOVO: qui si differenzia il comportamento pasto vs dance
    // MODIFICATO: messaggi dinamici pranzo/cena, DANCE → PARTY
    // ═══════════════════════════════════════════════════════════════
    
    // Helper label pasto dinamica
    const tipoEvento = evento.tipo_evento || 'SOLO_DANZA';
    let labelPasto = 'pasto';
    if (tipoEvento === 'CON_PRANZO') labelPasto = 'pranzo';
    if (tipoEvento === 'CON_CENA') labelPasto = 'cena';
    const labelPastoUpper = labelPasto.charAt(0).toUpperCase() + labelPasto.slice(1);
    
    if (finestra.modalita === 'PASTO') {
      // --- FINESTRA PASTO ---
      
      if (prenotazione.include_pasto) {
        // ✅ Ha pasto → entra (stessa dbUpdateIngresso della OLD)
        const timestampLocale = getTimestampLocale();
        const ok = dbUpdateIngresso(prenotazione.id, timestampLocale, staffId);
        if (!ok) throw new Error("Update fallito");
        
        return {
          success: true,
          msg: labelPastoUpper + " + PARTY OK",
          cliente: nomeCliente,
          include_pasto: true
        };
        
      } else {
        // ❌ NON ha pasto → non entra, ma NON è un errore del QR
        // Nessun dbUpdateIngresso — il cliente è valido, non è il suo turno
        const inizioDance = evento.inizio_checkin ? 
          new Date(evento.inizio_checkin).toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'}) : 
          "più tardi";
        
        return {
          success: false,
          msg: "Spiacente, il tuo ingresso è previsto alle " + inizioDance + " per il party",
          cliente: nomeCliente,
          include_pasto: false,
          nonAncoraOra: true  // ← flag per il frontend: messaggio gentile, non errore
        };
      }
    }
    
    // --- FINESTRA PARTY (o SOLO_DANZA) ---
    // *** OLD: stessa logica di update, solo messaggi differenziati ***
    
    const timestampLocale = getTimestampLocale();
    const ok = dbUpdateIngresso(prenotazione.id, timestampLocale, staffId);
    if (!ok) throw new Error("Update fallito");

    // Messaggio differenziato
    let messaggio = "PARTY OK";
    if (prenotazione.include_pasto) {
      messaggio = "PARTY OK (" + labelPastoUpper + " saltato)";
    }
    
    return { 
      success: true, 
      msg: messaggio, 
      cliente: nomeCliente,
      include_pasto: prenotazione.include_pasto || false
    };

  } catch (e) {
    // *** OLD: invariato ***
    Logger.log('Errore convalidaIngresso: ' + e.message);
    return { success: false, msg: "ERRORE SERVER" };
  }
}

// ═══════════════════════════════════════════════════════════════
// *** OLD: invariato da qui in poi ***
// ═══════════════════════════════════════════════════════════════

// getTimestampLocale() → unica versione in Database.gs

/**
 * DEBUG: Verifica orari check-in
 */
function debugOrariCheckIn() {
  const codiceEvento = "LOCA2";
  
  Logger.log("=== DEBUG ORARI CHECK-IN ===");
  
  const evento = dbGetEventoInfo(codiceEvento);
  
  if (!evento) {
    Logger.log("❌ Evento non trovato");
    return;
  }
  
  Logger.log("Evento: " + evento.nome_evento);
  Logger.log("");
  
  const oraAttuale = new Date();
  Logger.log("⏰ ORA ATTUALE (server):");
  Logger.log("  - Data/ora: " + oraAttuale.toISOString());
  Logger.log("  - Locale IT: " + oraAttuale.toLocaleString('it-IT'));
  Logger.log("");
  
  Logger.log("📅 INIZIO CHECK-IN (database):");
  Logger.log("  - Valore raw: " + evento.inizio_checkin);
  if (evento.inizio_checkin) {
    const inizio = new Date(evento.inizio_checkin);
    Logger.log("  - Data/ora: " + inizio.toISOString());
    Logger.log("  - Locale IT: " + inizio.toLocaleString('it-IT'));
    Logger.log("");
    
    const diff = oraAttuale - inizio;
    const diffMinuti = Math.floor(diff / 60000);
    
    Logger.log("⏱️ DIFFERENZA:");
    Logger.log("  - Millisecondi: " + diff);
    Logger.log("  - Minuti: " + diffMinuti);
    Logger.log("");
    
    if (oraAttuale < inizio) {
      Logger.log("❌ TROPPO PRESTO!");
      Logger.log("   Il check-in apre tra " + Math.abs(diffMinuti) + " minuti");
    } else {
      Logger.log("✅ CHECK-IN APERTO!");
      Logger.log("   Aperto da " + diffMinuti + " minuti");
    }
  } else {
    Logger.log("  - ⚠️ NON IMPOSTATO (null)");
  }
  
  Logger.log("");
  Logger.log("📅 FINE CHECK-IN (database):");
  Logger.log("  - Valore raw: " + evento.fine_checkin);
  if (evento.fine_checkin) {
    const fine = new Date(evento.fine_checkin);
    Logger.log("  - Data/ora: " + fine.toISOString());
    Logger.log("  - Locale IT: " + fine.toLocaleString('it-IT'));
  } else {
    Logger.log("  - ⚠️ NON IMPOSTATO (null)");
  }
  
  Logger.log("");
  Logger.log("============================");
}
