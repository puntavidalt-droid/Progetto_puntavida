/**
 * LOGIC_REGISTRAZIONE.GS - Versione con Gestione Pasto + Sold Out Split
 * Performance migliorate, race condition eliminata, riattivazione automatica
 * ✅ SOLD OUT: separato party/pasto con 6 stati
 * ✅ MESSAGGI: dinamici pranzo/cena
 * ✅ RIATTIVAZIONE: check posti prima di riattivare
 * ✅ DEADLINE PASTO: verificata al caricamento pagina
 */

// ═══════════════════════════════════════════════════════════════
// HELPER: Label pasto dinamica
// ═══════════════════════════════════════════════════════════════
function getLabelPasto(tipoEvento) {
  if (tipoEvento === 'CON_PRANZO') return 'pranzo';
  if (tipoEvento === 'CON_CENA') return 'cena';
  return 'pasto';
}

function renderRegistrazione(e) {
  let codiceEvento = e.parameter.evento;
  const nicknamePR = e.parameter.pr || "Staff";
  
  // *** OLD: invariato — Se non c'è parametro evento, usa il prossimo disponibile ***
  if (!codiceEvento) {
    const eventi = dbGetAllEventi();
    
    if (eventi.length === 0) {
      return HtmlService.createHtmlOutput(
        '<div style="padding:50px;text-align:center;font-family:sans-serif;">' +
        '<h2>⚠️ Nessun Evento Disponibile</h2>' +
        '<p>Al momento non ci sono eventi aperti.</p>' +
        '<p>Contatta l\'organizzatore per maggiori informazioni.</p>' +
        '</div>'
      ).setTitle("Nessun Evento");
    }
    
    const oraAttuale = new Date();
    const eventiOrdinati = eventi.sort((a, b) => 
      new Date(a.data_evento) - new Date(b.data_evento)
    );
    
    const prossimoEvento = eventiOrdinati.find(ev => 
      new Date(ev.data_evento) >= oraAttuale
    );
    
    codiceEvento = prossimoEvento 
      ? prossimoEvento.codice_evento 
      : eventiOrdinati[eventiOrdinati.length - 1].codice_evento;
  }
  
  // *** OLD: invariato — Recupero evento ***
  const evento = dbGetEventoInfo(codiceEvento);
  if (!evento) {
    return HtmlService.createHtmlOutput(
      '<div style="padding:50px;text-align:center;font-family:sans-serif;">' +
      '<h2>⚠️ Evento Non Trovato</h2>' +
      '<p>Il codice evento "' + codiceEvento + '" non è valido.</p>' +
      '<p>Controlla il link ricevuto o contatta l\'organizzatore.</p>' +
      '</div>'
    ).setTitle("Errore - Evento Non Trovato");
  }

  // ═══════════════════════════════════════════════════════════════
  // NUOVO: Calcolo stato con split party/pasto
  // ═══════════════════════════════════════════════════════════════
  const oraAttuale = new Date();
  const finePrenotazione = new Date(evento.fine_prenotazione);
  const tipoEvento = evento.tipo_evento || 'SOLO_DANZA';
  const haPasto = tipoEvento !== 'SOLO_DANZA';
  const labelPasto = getLabelPasto(tipoEvento);
  
  // Statistiche live
  const stats = dbGetStatistichePostiLive(evento.id);
  const capienzaParty = evento.max_partecipanti || 0;
  const capienzaPasto = evento.max_partecipanti_pasto || 0;
  const partyPieno = capienzaParty > 0 && stats.soloDanza >= capienzaParty;
  const pastoPieno = capienzaPasto > 0 && stats.conPasto >= capienzaPasto;
  
  // Deadline pasto scaduta?
  let deadlinePastoScaduta = false;
  if (haPasto && evento.fine_prenotazione_pasto) {
    deadlinePastoScaduta = oraAttuale > new Date(evento.fine_prenotazione_pasto);
  }
  
  // Pasto non disponibile = pieno OPPURE deadline scaduta
  const pastoNonDisponibile = pastoPieno || deadlinePastoScaduta;
  
  // ═══════════════════════════════════════════════════════════════
  // DETERMINAZIONE STATO — 6 possibilità
  // ═══════════════════════════════════════════════════════════════
  let stato = 'APERTO';
  
  if (oraAttuale > finePrenotazione) {
    stato = 'CHIUSO';
  } else if (!haPasto) {
    // SOLO_DANZA: sold out se party pieno
    stato = partyPieno ? 'SOLDOUT_TOTALE' : 'APERTO';
  } else if (evento.pasto_obbligatorio) {
    // PASTO OBBLIGATORIO: sold out se pasto non disponibile
    stato = pastoNonDisponibile ? 'SOLDOUT_TOTALE' : 'APERTO';
  } else {
    // PASTO FACOLTATIVO: combinazioni party/pasto
    if (partyPieno && pastoNonDisponibile) {
      stato = 'SOLDOUT_TOTALE';
    } else if (partyPieno && !pastoNonDisponibile) {
      stato = 'SOLDOUT_PARTY';
    } else if (!partyPieno && pastoNonDisponibile) {
      stato = 'SOLDOUT_PASTO';
    } else {
      stato = 'APERTO';
    }
  }

  const template = HtmlService.createTemplateFromFile('registrazione');
  
  // ═══════════════════════════════════════════════════════════════
  // OGGETTO eventoInfo — MODIFICATO: nuovi stati + label pasto
  // ═══════════════════════════════════════════════════════════════
  template.eventoInfo = {
    // Campi originali
    id: evento.id,
    nome: evento.nome_evento,
    codice: codiceEvento,
    stato: stato,
    logoUrl: dbGetLogoUrl(),
    dataEvento: evento.data_evento,
    
    // NUOVO: posti disponibili separati
    postiParty: Math.max(0, capienzaParty - stats.soloDanza),
    postiPasto: Math.max(0, capienzaPasto - stats.conPasto),
    
    // Campi pasto
    tipo_evento: tipoEvento,
    labelPasto: labelPasto,
    pasto_obbligatorio: evento.pasto_obbligatorio || false,
    prezzo_solo_danza: evento.prezzo_solo_danza || null,
    prezzo_con_pasto: evento.prezzo_con_pasto || null,
    max_partecipanti_pasto: capienzaPasto,
    fine_prenotazione_pasto: evento.fine_prenotazione_pasto || null,
    messaggio_post_registrazione: evento.messaggio_post_registrazione || null,
    visualizza_prezzo_danza: evento.visualizza_prezzo_danza || false,
    messaggio_prezzo_danza: evento.messaggio_prezzo_danza || null
  };
  
  template.prNickname = nicknamePR;

  return template.evaluate()
    .setTitle("Registrazione - " + evento.nome_evento)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function salvaPrenotazione(payload) {
  const startTime = Date.now();
  
  try {
    // ═══════════════════════════════════════════════════════════════
    // VALIDAZIONI BASE — *** OLD: invariato ***
    // ═══════════════════════════════════════════════════════════════
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!payload.email || !emailRegex.test(payload.email)) {
      return { 
        success: false, 
        msg: "L'indirizzo email inserito non è valido." 
      };
    }

    if (!payload.nome || payload.nome.trim().length < 2) {
      return { 
        success: false, 
        msg: "Il nome deve contenere almeno 2 caratteri." 
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // RECUPERO EVENTO — *** OLD: invariato ***
    // ═══════════════════════════════════════════════════════════════
    
    const evento = dbGetEventoInfo(payload.evento);
    if (!evento) {
      return { 
        success: false, 
        msg: "Evento non trovato. Controlla il link ricevuto." 
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // CONTROLLO ORARIO — *** OLD: invariato ***
    // ═══════════════════════════════════════════════════════════════
    
    const oraAttuale = new Date();
    const finePrenotazione = new Date(evento.fine_prenotazione);
    
    if (oraAttuale > finePrenotazione) {
      return { 
        success: false, 
        msg: "Le prenotazioni per questo evento sono chiuse." 
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // LOGICA GESTIONE PASTO — MODIFICATO: messaggi dinamici
    // ═══════════════════════════════════════════════════════════════
    
    const tipoEvento = evento.tipo_evento || 'SOLO_DANZA';
    const labelPasto = getLabelPasto(tipoEvento);
    let includePasto = false;
    
    if (tipoEvento !== 'SOLO_DANZA') {
      
      if (evento.pasto_obbligatorio) {
        // Pasto OBBLIGATORIO - tutti devono averlo
        includePasto = true;
        
      } else if (payload.include_pasto) {
        // Pasto FACOLTATIVO - cliente ha scelto di aggiungerlo
        
        // Check 1: Deadline pasto — MODIFICATO: messaggio dinamico
        if (evento.fine_prenotazione_pasto) {
          const finePrenotazionePasto = new Date(evento.fine_prenotazione_pasto);
          
          if (oraAttuale > finePrenotazionePasto) {
            return {
              success: false,
              msg: "🍽️ Le prenotazioni per il " + labelPasto + " sono chiuse! Ma la pista ti aspetta — registrati per il party!",
              alternativa: 'SOLO_PARTY'
            };
          }
        }
        
        // Check 2: Posti pasto disponibili — MODIFICATO: messaggio dinamico
        if (evento.max_partecipanti_pasto) {
          const stats = dbGetStatistichePostiLive(evento.id);
          
          if (stats.conPasto >= evento.max_partecipanti_pasto) {
            return {
              success: false,
              msg: "🍽️ I posti " + labelPasto + " sono volati! Vuoi unirti comunque al party?",
              alternativa: 'SOLO_PARTY'
            };
          }
        }
        
        includePasto = true;
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // CONTROLLO PRENOTAZIONE ESISTENTE (annullamento/riattivazione)
    // MODIFICATO: aggiunto check posti prima di riattivare
    // ═══════════════════════════════════════════════════════════════
    
    const emailPulita = payload.email.toLowerCase().trim();
    const prenotazioneEsistente = dbGetPrenotazionePerEmailEvento(emailPulita, evento.id);

    if (prenotazioneEsistente) {
      // CASO 1: Prenotazione ANNULLATA → Riattiva mantenendo stesso QR
      if (prenotazioneEsistente.stato === 'ANNULLATA') {
        Logger.log('📝 Riattivazione prenotazione annullata per: ' + emailPulita);
        
        // ═══════════════════════════════════════════════════════════
        // NUOVO: Check posti disponibili prima di riattivare
        // ═══════════════════════════════════════════════════════════
        const stats = dbGetStatistichePostiLive(evento.id);
        
        if (includePasto) {
          // Riattivazione con pasto: controlla posti pasto
          if (evento.max_partecipanti_pasto && stats.conPasto >= evento.max_partecipanti_pasto) {
            return {
              success: false,
              msg: "🍽️ I posti " + labelPasto + " sono esauriti! Vuoi riprovare solo per il party?",
              alternativa: 'SOLO_PARTY'
            };
          }
        } else {
          // Riattivazione solo party: controlla posti party
          if (evento.max_partecipanti > 0 && stats.soloDanza >= evento.max_partecipanti) {
            return {
              success: false,
              msg: "🎉 Il party è al completo! Non ci sono più posti disponibili."
            };
          }
        }
        
        // *** OLD: invariato — Riattivazione effettiva ***
        const qrTokenOriginale = prenotazioneEsistente.qr_token;
        const cancelTokenOriginale = prenotazioneEsistente.cancel_token || Utilities.getUuid();
        
        const riattivata = dbRiattivaPrenotazione(prenotazioneEsistente.id, qrTokenOriginale);
        
        if (!riattivata) {
          return {
            success: false,
            msg: "Errore durante la riattivazione. Riprova o contatta l'organizzatore."
          };
        }
        
        // *** OLD: invariato — Reinvia email ***
        try {
          inviaEmailConQR(
            emailPulita, 
            payload.nome, 
            evento.nome_evento, 
            qrTokenOriginale,
            cancelTokenOriginale,
            evento,
            includePasto
          );
          Logger.log('✅ Email riattivazione inviata a: ' + emailPulita);
        } catch (emailError) {
          Logger.log('⚠️ Errore invio email riattivazione: ' + emailError.message);
          try {
            accodaInvioEmail({
              email: emailPulita,
              nome: payload.nome,
              nomeEvento: evento.nome_evento,
              qrToken: qrTokenOriginale,
              cancelToken: cancelTokenOriginale
            });
          } catch (queueError) {
            Logger.log('❌ Accodamento fallito: ' + queueError.message);
          }
        }
        
        const executionTime = Date.now() - startTime;
        Logger.log('✅ Prenotazione riattivata in ' + executionTime + 'ms');
        
        return {
          success: true,
          token: qrTokenOriginale,
          message: "🎉 Prenotazione riattivata! Ti abbiamo reinviato il tuo QR code via email. Check anche lo spam! 📱",
          messaggio_custom: evento.messaggio_post_registrazione,
          executionTime: executionTime
        };
      }
      
      // CASO 2: Prenotazione già ATTIVA → Errore duplicato — *** OLD: invariato ***
      if (prenotazioneEsistente.stato === 'ATTIVA') {
        return {
          success: false,
          msg: "Sei già registrato per questo evento con questa email."
        };
      }
      
      // CASO 3: Stato COMPLETATA o altro → blocca — *** OLD: invariato ***
      return {
        success: false,
        msg: "Esiste già una prenotazione per questa email."
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // NUOVA REGISTRAZIONE — *** OLD: invariato ***
    // ═══════════════════════════════════════════════════════════════
    
    const prId = dbGetPrIdByNickname(payload.pr);
    const qrToken = Utilities.getUuid();
    const cancelToken = Utilities.getUuid();
    
    const record = {
      cliente_nome: payload.nome.trim(),
      cliente_cognome: (payload.cognome || "").trim(),
      cliente_email: emailPulita,
      evento_id: evento.id,
      pr_id: prId,
      qr_token: qrToken,
      cancel_token: cancelToken,
      codice_evento: evento.codice_evento,
      nickname_pr: payload.pr || 'Generico',
      stato: 'ATTIVA',
      created_at: getTimestampLocale(),
      include_pasto: includePasto
    };

    // ═══════════════════════════════════════════════════════════════
    // CONTROLLO POSTI DISPONIBILI — MODIFICATO: split party/pasto
    // ═══════════════════════════════════════════════════════════════
    
    const statsPreInsert = dbGetStatistichePostiLive(evento.id);
    
    if (includePasto) {
      // Registrazione con pasto: controlla posti pasto
      if (evento.max_partecipanti_pasto && statsPreInsert.conPasto >= evento.max_partecipanti_pasto) {
        return { 
          success: false, 
          msg: "🍽️ I posti " + labelPasto + " sono appena terminati! Vuoi riprovare solo per il party?",
          alternativa: 'SOLO_PARTY'
        };
      }
    } else {
      // Registrazione solo party: controlla posti party
      if (evento.max_partecipanti > 0 && statsPreInsert.soloDanza >= evento.max_partecipanti) {
        if (tipoEvento !== 'SOLO_DANZA' && evento.max_partecipanti_pasto && statsPreInsert.conPasto < evento.max_partecipanti_pasto) {
          // Party pieno ma pasti disponibili
          return { 
            success: false, 
            msg: "🎉 Il party è sold out! Ma puoi ancora prenotare il " + labelPasto + " + party!",
            alternativa: 'CON_PASTO'
          };
        }
        return { 
          success: false, 
          msg: "🎉 Il party è al completo! Non ci sono più posti disponibili." 
        };
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // INSERIMENTO DATABASE — *** OLD: invariato ***
    // ═══════════════════════════════════════════════════════════════
    
    try {
      const inserted = dbInsertPrenotazione(record);
      
      if (!inserted) {
        return { 
          success: false, 
          msg: "Errore durante il salvataggio. Riprova tra qualche secondo." 
        };
      }
      
      Logger.log('✅ Nuova prenotazione salvata per: ' + emailPulita);
      
    } catch (dbError) {
      const errorMsg = dbError.message || dbError.toString();
      
      // Email duplicata (race condition) — *** OLD: invariato ***
      if (errorMsg.includes('unique_email_per_evento') || 
          errorMsg.includes('duplicate key')) {
        return { 
          success: false, 
          msg: "Sei già registrato per questo evento con questa email." 
        };
      }
      
      // Sold out (race condition) — *** OLD: invariato ***
      if (errorMsg.includes('sold out') || 
          errorMsg.includes('posti terminati') ||
          errorMsg.includes('max_partecipanti')) {
        return { 
          success: false, 
          msg: "I posti sono terminati proprio ora! Riprova tra qualche secondo." 
        };
      }
      
      Logger.log('❌ Errore database: ' + errorMsg);
      return { 
        success: false, 
        msg: "Errore tecnico durante la prenotazione. Contatta l'assistenza." 
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // INVIO EMAIL — *** OLD: invariato ***
    // ═══════════════════════════════════════════════════════════════
    
    try {
      inviaEmailConQR(
        emailPulita, 
        payload.nome, 
        evento.nome_evento, 
        qrToken, 
        cancelToken,
        evento,
        includePasto
      );
      Logger.log('✅ Email inviata immediatamente a: ' + emailPulita);
    } catch (emailError) {
      Logger.log('⚠️ Invio immediato fallito, uso coda: ' + emailError.message);
      try {
        accodaInvioEmail({
          email: emailPulita,
          nome: payload.nome,
          nomeEvento: evento.nome_evento,
          qrToken: qrToken,
          cancelToken: cancelToken
        });
        Logger.log('📧 Email accodata per retry automatico');
      } catch (queueError) {
        Logger.log('❌ Anche accodamento fallito: ' + queueError.message);
      }
    }

    const executionTime = Date.now() - startTime;
    Logger.log('✅ Prenotazione completata in ' + executionTime + 'ms');
    
    return { 
      success: true, 
      token: qrToken,
      message: "🔥 Sei dentro! Ti mandiamo l'email con il QR tra 1-2 min. Check anche lo spam! 📱",
      messaggio_custom: evento.messaggio_post_registrazione,
      executionTime: executionTime
    };

  } catch (e) {
    Logger.log('❌ Errore generale salvaPrenotazione: ' + e.message);
    Logger.log(e.stack);
    
    return { 
      success: false, 
      msg: "Errore imprevisto. Riprova o contatta l'assistenza." 
    };
  }
}

/**
 * Test function per debug — *** OLD: invariato ***
 */
function testRegistrazioneDebug() {
  const risultato = salvaPrenotazione({
    nome: 'Test',
    cognome: 'Debug',
    email: 'test-' + Date.now() + '@example.com',
    evento: 'LOCA2',
    pr: 'Staff'
  });
  
  Logger.log('=== RISULTATO TEST ===');
  Logger.log(JSON.stringify(risultato, null, 2));
  Logger.log('=====================');
}

/**
 * Test riattivazione — *** OLD: invariato ***
 */
function testRiattivazioneDebug() {
  const emailTest = 'test-riattivazione@example.com';
  
  Logger.log('=== TEST RIATTIVAZIONE ===');
  Logger.log('1. Prima registrazione...');
  const prima = salvaPrenotazione({
    nome: 'Test',
    email: emailTest,
    evento: 'LOCA2',
    pr: 'Staff'
  });
  Logger.log('Risultato prima registrazione: ' + JSON.stringify(prima, null, 2));
  
  if (prima.success) {
    Logger.log('2. Annullamento manuale...');
    const prenotazione = dbGetPrenotazionePerEmailEvento(emailTest, dbGetEventoIdByCodice('LOCA2'));
    if (prenotazione) {
      dbAnnullaPrenotazione(prenotazione.id, 'ADMIN');
      Logger.log('Prenotazione annullata');
      
      Logger.log('3. Tentativo ri-registrazione...');
      const seconda = salvaPrenotazione({
        nome: 'Test',
        email: emailTest,
        evento: 'LOCA2',
        pr: 'Staff'
      });
      Logger.log('Risultato riattivazione: ' + JSON.stringify(seconda, null, 2));
    }
  }
  
  Logger.log('=========================');
}

// getTimestampLocale() → unica versione in Database.gs
