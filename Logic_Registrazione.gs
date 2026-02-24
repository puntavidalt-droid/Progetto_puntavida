/**
 * LOGIC_REGISTRAZIONE.GS - Versione con Gestione Pasto
 * Performance migliorate, race condition eliminata, riattivazione automatica
 * MODIFICHE: Aggiunto supporto pranzo/cena mantenendo logica esistente
 */

function renderRegistrazione(e) {
  let codiceEvento = e.parameter.evento;
  const nicknamePR = e.parameter.pr || "Staff";
  
  // Se non c'è parametro evento, usa il prossimo evento disponibile
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
    
    // Trova il prossimo evento futuro, oppure il più recente
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

  const nPrenotati = dbGetConteggioPrenotazioni(evento.id);
  const oraAttuale = new Date();
  const finePrenotazione = new Date(evento.fine_prenotazione);
  
  const stato = (oraAttuale > finePrenotazione) ? "CHIUSO" : 
                (nPrenotati >= evento.max_partecipanti) ? "SOLDOUT" : "APERTO";

  const template = HtmlService.createTemplateFromFile('registrazione');
  
  // ═══════════════════════════════════════════════════════════════
  // OGGETTO eventoInfo - MODIFICATO per includere campi pasto
  // ═══════════════════════════════════════════════════════════════
  template.eventoInfo = {
    // Campi originali
    id: evento.id,
    nome: evento.nome_evento,
    codice: codiceEvento,
    stato: stato,
    logoUrl: dbGetLogoUrl(),
    dataEvento: evento.data_evento,
    maxPartecipanti: evento.max_partecipanti,
    postiDisponibili: Math.max(0, evento.max_partecipanti - nPrenotati),
    
    // ═══════════════════════════════════════════════════════════════
    // CAMPI PASTO AGGIUNTI (nuovi)
    // ═══════════════════════════════════════════════════════════════
    tipo_evento: evento.tipo_evento || 'SOLO_DANZA',
    pasto_obbligatorio: evento.pasto_obbligatorio || false,
    prezzo_solo_danza: evento.prezzo_solo_danza || null,
    prezzo_con_pasto: evento.prezzo_con_pasto || null,
    max_partecipanti_pasto: evento.max_partecipanti_pasto || null,
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
    // VALIDAZIONI BASE
    // ═══════════════════════════════════════════════════════════════
    
    // VALIDAZIONE EMAIL
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!payload.email || !emailRegex.test(payload.email)) {
      return { 
        success: false, 
        msg: "L'indirizzo email inserito non è valido." 
      };
    }

    // VALIDAZIONE NOME
    if (!payload.nome || payload.nome.trim().length < 2) {
      return { 
        success: false, 
        msg: "Il nome deve contenere almeno 2 caratteri." 
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // RECUPERO EVENTO
    // ═══════════════════════════════════════════════════════════════
    
    const evento = dbGetEventoInfo(payload.evento);
    if (!evento) {
      return { 
        success: false, 
        msg: "Evento non trovato. Controlla il link ricevuto." 
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // CONTROLLO ORARIO
    // ═══════════════════════════════════════════════════════════════
    
    const oraAttuale = new Date();
    const finePrenotazione = new Date(evento.fine_prenotazione);
    
    if (oraAttuale > finePrenotazione) {
      return { 
        success: false, 
        msg: "Spiacenti, le prenotazioni per questo evento sono chiuse." 
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // LOGICA GESTIONE PASTO (NUOVA)
    // ═══════════════════════════════════════════════════════════════
    
    let includePasto = false;
    
    if (evento.tipo_evento !== 'SOLO_DANZA') {
      
      if (evento.pasto_obbligatorio) {
        // Pasto OBBLIGATORIO - tutti devono averlo
        includePasto = true;
        
      } else if (payload.include_pasto) {
        // Pasto FACOLTATIVO - cliente ha scelto di aggiungerlo
        
        // Check 1: Deadline pasto
        if (evento.fine_prenotazione_pasto) {
          const finePrenotazionePasto = new Date(evento.fine_prenotazione_pasto);
          
          if (oraAttuale > finePrenotazionePasto) {
            return {
              success: false,
              msg: "Le prenotazioni per la cena sono chiuse. Vuoi registrarti solo per la serata danzante?",
              alternativa: 'SOLO_DANZA'
            };
          }
        }
        
        // Check 2: Posti pasto disponibili (LIVE)
        if (evento.max_partecipanti_pasto) {
          const stats = dbGetStatistichePostiLive(evento.id);
          
          if (stats.conPasto >= evento.max_partecipanti_pasto) {
            return {
              success: false,
              msg: "I posti per la cena sono esauriti. Vuoi registrarti solo per la serata danzante?",
              alternativa: 'SOLO_DANZA'
            };
          }
        }
        
        includePasto = true;
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // CONTROLLO PRENOTAZIONE ESISTENTE (annullamento/riattivazione)
    // ═══════════════════════════════════════════════════════════════
    
    const emailPulita = payload.email.toLowerCase().trim();
    const prenotazioneEsistente = dbGetPrenotazionePerEmailEvento(emailPulita, evento.id);

    if (prenotazioneEsistente) {
      // CASO 1: Prenotazione ANNULLATA → Riattiva mantenendo stesso QR
      if (prenotazioneEsistente.stato === 'ANNULLATA') {
        Logger.log('📝 Riattivazione prenotazione annullata per: ' + emailPulita);
        
        // Mantiene lo stesso QR code originale (evita confusione con vecchi screenshot)
        const qrTokenOriginale = prenotazioneEsistente.qr_token;
        const cancelTokenOriginale = prenotazioneEsistente.cancel_token || Utilities.getUuid();
        
        const riattivata = dbRiattivaPrenotazione(prenotazioneEsistente.id, qrTokenOriginale);
        
        if (!riattivata) {
          return {
            success: false,
            msg: "Errore durante la riattivazione. Riprova o contatta l'organizzatore."
          };
        }
        
        // Reinvia email con lo stesso QR code + parametri pasto
        try {
          inviaEmailConQR(
            emailPulita, 
            payload.nome, 
            evento.nome_evento, 
            qrTokenOriginale,      // ← Stesso QR code di prima
            cancelTokenOriginale,
            evento,                 // ← AGGIUNTO per pasto
            includePasto            // ← AGGIUNTO per pasto
          );
          Logger.log('✅ Email riattivazione inviata a: ' + emailPulita);
        } catch (emailError) {
          Logger.log('⚠️ Errore invio email riattivazione: ' + emailError.message);
          // Prenotazione comunque riattivata, email verrà gestita dopo
          try {
            accodaInvioEmail({
              email: emailPulita,
              nome: payload.nome,
              nomeEvento: evento.nome_evento,
              qrToken: qrTokenOriginale,  // ← Stesso QR code di prima
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
          token: qrTokenOriginale,  // ← Stesso QR code di prima
          message: "🎉 Prenotazione riattivata! Ti abbiamo reinviato il tuo QR code via email. Check anche lo spam! 📱",
          messaggio_custom: evento.messaggio_post_registrazione,  // ← AGGIUNTO
          executionTime: executionTime
        };
      }
      
      // CASO 2: Prenotazione già ATTIVA → Errore duplicato
      if (prenotazioneEsistente.stato === 'ATTIVA') {
        return {
          success: false,
          msg: "Sei già registrato per questo evento con questa email."
        };
      }
      
      // CASO 3: Stato COMPLETATA o altro → blocca
      return {
        success: false,
        msg: "Esiste già una prenotazione per questa email."
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // NUOVA REGISTRAZIONE (email non esistente)
    // ═══════════════════════════════════════════════════════════════
    
    const prId = dbGetPrIdByNickname(payload.pr);
    const qrToken = Utilities.getUuid();
    const cancelToken = Utilities.getUuid();  // Token per annullamento cliente
    
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
      include_pasto: includePasto  // ← CAMPO NUOVO
    };

    // ═══════════════════════════════════════════════════════════════
    // CONTROLLO POSTI DISPONIBILI (prima di inserire)
    // ═══════════════════════════════════════════════════════════════
    
    const nPrenotati = dbGetConteggioPrenotazioni(evento.id);
    if (nPrenotati >= evento.max_partecipanti) {
      return { 
        success: false, 
        msg: "Spiacenti, l'evento ha raggiunto il numero massimo di partecipanti." 
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // INSERIMENTO DATABASE
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
      
      // Email duplicata (race condition)
      if (errorMsg.includes('unique_email_per_evento') || 
          errorMsg.includes('duplicate key')) {
        return { 
          success: false, 
          msg: "Sei già registrato per questo evento con questa email." 
        };
      }
      
      // Sold out (race condition)
      if (errorMsg.includes('sold out') || 
          errorMsg.includes('posti terminati') ||
          errorMsg.includes('max_partecipanti')) {
        return { 
          success: false, 
          msg: "Spiacenti, i posti sono terminati proprio ora!" 
        };
      }
      
      Logger.log('❌ Errore database: ' + errorMsg);
      return { 
        success: false, 
        msg: "Errore tecnico durante la prenotazione. Contatta l'assistenza." 
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // INVIO EMAIL CON QR CODE + LINK ANNULLAMENTO
    // ═══════════════════════════════════════════════════════════════
    
    try {
      // Tentativo di invio immediato (con parametri pasto)
      inviaEmailConQR(
        emailPulita, 
        payload.nome, 
        evento.nome_evento, 
        qrToken, 
        cancelToken,
        evento,          // ← AGGIUNTO per pasto
        includePasto     // ← AGGIUNTO per pasto
      );
      Logger.log('✅ Email inviata immediatamente a: ' + emailPulita);
    } catch (emailError) {
      // Se invio immediato fallisce, mette in coda per retry automatico
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
        // Prenotazione è comunque salvata, email verrà gestita manualmente
      }
    }

    const executionTime = Date.now() - startTime;
    Logger.log('✅ Prenotazione completata in ' + executionTime + 'ms');
    
    return { 
      success: true, 
      token: qrToken,
      message: "🔥 Sei dentro! Ti mandiamo l'email con il QR tra 1-2 min. Check anche lo spam! 📱",
      messaggio_custom: evento.messaggio_post_registrazione,  // ← AGGIUNTO
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
 * Test function per debug
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
 * Test riattivazione - simula cliente che ri-registra dopo annullamento
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

/**
 * ═══════════════════════════════════════════════════════════════
 * Utility timestamp locale (duplicata da Database.gs per comodità)
 * ═══════════════════════════════════════════════════════════════
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
