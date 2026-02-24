/**
 * LOGIC SCANNER
 * Gestisce la convalida dei QR Code e la sicurezza degli accessi staff.
 * ✅ OTTIMIZZATO: Cache per ridurre query ripetute
 * ✅ AGGIUNTO: Supporto visualizzazione badge pasto
 */

// ═══════════════════════════════════════════════════════════════
// CACHE per ridurre query ripetute durante sessione scanner
// ═══════════════════════════════════════════════════════════════
let CACHE_EVENTO = null;
let CACHE_STAFF = null;

function renderScanner(e) {
  const template = HtmlService.createTemplateFromFile('scanner');
  template.eventoCodice = e.parameter.evento || "";
  template.nicknameStaff = e.parameter.staff || "";

  return template.evaluate()
    .setTitle("Scanner Ingressi - Staff")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0'); 
}

/**
 * Verifica l'accesso, l'orario e recupera il LOGO tramite DATABASE.gs
 * ✅ USA CACHE per evento e staff
 */
function verificaAccessoScanner(codiceEvento, nicknameStaff) {
  try {
    // ═══════════════════════════════════════════════════════════════
    // USA CACHE STAFF (evita query ripetute)
    // ═══════════════════════════════════════════════════════════════
    let staffId;
    if (!CACHE_STAFF || CACHE_STAFF.nickname !== nicknameStaff) {
      staffId = dbGetStaffIdByNickname(nicknameStaff);
      CACHE_STAFF = { nickname: nicknameStaff, id: staffId };
    } else {
      staffId = CACHE_STAFF.id;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // USA CACHE EVENTO (evita query ripetute)
    // ═══════════════════════════════════════════════════════════════
    let evento;
    if (!CACHE_EVENTO || CACHE_EVENTO.codice_evento !== codiceEvento) {
      CACHE_EVENTO = dbGetEventoInfo(codiceEvento);
    }
    evento = CACHE_EVENTO;
    
    if (!staffId) return { authorized: false, msg: "STAFF NON RICONOSCIUTO" };
    if (!evento) return { authorized: false, msg: "EVENTO NON TROVATO" };

    const oraAttuale = new Date();
    const inizio = evento.inizio_checkin ? new Date(evento.inizio_checkin) : null;
    const fine = evento.fine_checkin ? new Date(evento.fine_checkin) : null;

    // Controllo Apertura Anticipata
    let troppoPresto = false;
    let oraAperturaTesto = "";
    if (inizio && oraAttuale < inizio) {
      troppoPresto = true;
      oraAperturaTesto = inizio.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});
    }

    // Controllo Chiusura
    if (fine && oraAttuale > fine) {
      return { authorized: false, msg: "CHECK-IN CHIUSO" };
    }

    // Restituiamo i dati necessari
    return { 
      authorized: true, 
      troppoPresto: troppoPresto,
      oraApertura: oraAperturaTesto,
      nomeEvento: (evento.nome_evento || evento.nome || "EVENTO").toUpperCase(),
      nomeStaff: nicknameStaff.toUpperCase(),
      logoUrl: dbGetLogoUrl() 
    };
  } catch (e) {
    return { authorized: false, msg: "ERRORE CONNESSIONE DB" };
  }
}

/**
 * Valida il QR Code durante la scansione
 * ✅ AGGIUNTO: Restituisce anche include_pasto per badge
 */
function convalidaIngresso(qrToken, codiceEvento, nicknameStaff) {
  try {
    if (!qrToken) return { success: false, msg: "QR VUOTO" };

    const staffId = dbGetStaffIdByNickname(nicknameStaff);
    if (!staffId) return { success: false, msg: "ERRORE STAFF" };

    const evento = dbGetEventoInfo(codiceEvento);
    if (!evento) return { success: false, msg: "ERRORE EVENTO" };

    const oraAttuale = new Date();
    
    if (evento.inizio_checkin && oraAttuale < new Date(evento.inizio_checkin)) {
      return { success: false, msg: "CHECK-IN NON ANCORA APERTO" };
    }
    if (evento.fine_checkin && oraAttuale > new Date(evento.fine_checkin)) {
      return { success: false, msg: "CHECK-IN CHIUSO" };
    }

    const prenotazione = dbGetPrenotazioneDaToken(qrToken);
    if (!prenotazione) return { success: false, msg: "QR NON VALIDO" };

    // Controllo stato
    if (prenotazione.stato === 'ANNULLATA') {
      return { 
        success: false, 
        msg: "PRENOTAZIONE ANNULLATA",
        cliente: (prenotazione.cliente_nome + (prenotazione.cliente_cognome ? " " + prenotazione.cliente_cognome : "")).toUpperCase(),
        include_pasto: prenotazione.include_pasto || false  // ✅ AGGIUNTO
      };
    }

    if (prenotazione.entrato) {
      const oraGiaEntrato = new Date(prenotazione.ora_ingresso).toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});
      return { 
        success: false, 
        msg: "GIÀ ENTRATO ALLE " + oraGiaEntrato,
        cliente: (prenotazione.cliente_nome + (prenotazione.cliente_cognome ? " " + prenotazione.cliente_cognome : "")).toUpperCase(),
        include_pasto: prenotazione.include_pasto || false  // ✅ AGGIUNTO
      };
    }

    // Timestamp locale
    const timestampLocale = getTimestampLocale();
    const ok = dbUpdateIngresso(prenotazione.id, timestampLocale, staffId);
    
    if (!ok) throw new Error("Update fallito");

    return { 
      success: true, 
      msg: "INGRESSO OK", 
      cliente: (prenotazione.cliente_nome + (prenotazione.cliente_cognome ? " " + prenotazione.cliente_cognome : "")).toUpperCase(),
      include_pasto: prenotazione.include_pasto || false  // ✅ AGGIUNTO
    };

  } catch (e) {
    Logger.log('Errore convalidaIngresso: ' + e.message);
    return { success: false, msg: "ERRORE SERVER" };
  }
}

/**
 * Helper timestamp ora locale
 */
function getTimestampLocale() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

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
