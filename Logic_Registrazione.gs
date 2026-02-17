/**
 * LOGIC_REGISTRAZIONE.GS - Versione Ottimizzata
 * Performance migliorate, race condition eliminata
 */

function renderRegistrazione(e) {
  const codiceEvento = e.parameter.evento || "default";
  const nicknamePR = e.parameter.pr || "Staff";
  
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
  template.eventoInfo = {
    id: evento.id,
    nome: evento.nome_evento,
    codice: codiceEvento,
    stato: stato,
    logoUrl: dbGetLogoUrl(),
    dataEvento: evento.data_evento,
    maxPartecipanti: evento.max_partecipanti,
    postiDisponibili: Math.max(0, evento.max_partecipanti - nPrenotati)
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

    // RECUPERO EVENTO
    const evento = dbGetEventoInfo(payload.evento);
    if (!evento) {
      return { 
        success: false, 
        msg: "Evento non trovato. Controlla il link ricevuto." 
      };
    }

    // CONTROLLO ORARIO
    const oraAttuale = new Date();
    const finePrenotazione = new Date(evento.fine_prenotazione);
    
    if (oraAttuale > finePrenotazione) {
      return { 
        success: false, 
        msg: "Spiacenti, le prenotazioni per questo evento sono chiuse." 
      };
    }

    // PREPARAZIONE RECORD
    const prId = dbGetPrIdByNickname(payload.pr);
    const qrToken = Utilities.getUuid();
    
    const record = {
      cliente_nome: payload.nome.trim(),
      cliente_cognome: (payload.cognome || "").trim(),
      cliente_email: payload.email.toLowerCase().trim(),
      evento_id: evento.id,
      pr_id: prId,
      qr_token: qrToken,
      created_at: new Date().toISOString()
    };

    // INSERIMENTO DATABASE
    // Il database gestirà sold-out e duplicati con constraints
    try {
      const inserted = dbInsertPrenotazione(record);
      
      if (!inserted) {
        return { 
          success: false, 
          msg: "Errore durante il salvataggio. Riprova tra qualche secondo." 
        };
      }
      
    } catch (dbError) {
      const errorMsg = dbError.message || dbError.toString();
      
      // Email duplicata
      if (errorMsg.includes('unique_email_per_evento') || 
          errorMsg.includes('duplicate key')) {
        return { 
          success: false, 
          msg: "Sei già registrato per questo evento con questa email." 
        };
      }
      
      // Sold out
      if (errorMsg.includes('sold out') || 
          errorMsg.includes('posti terminati') ||
          errorMsg.includes('max_partecipanti')) {
        return { 
          success: false, 
          msg: "Spiacenti, i posti sono terminati proprio ora!" 
        };
      }
      
      Logger.log('Errore database: ' + errorMsg);
      return { 
        success: false, 
        msg: "Errore tecnico durante la prenotazione. Contatta l'assistenza." 
      };
    }

// EMAIL: Invio immediato + coda come backup
    try {
      // Tentativo di invio immediato
      inviaEmailConQR(payload.email, payload.nome, evento.nome_evento, qrToken);
      Logger.log('✅ Email inviata immediatamente a: ' + payload.email);
    } catch (emailError) {
      // Se invio immediato fallisce, mette in coda per retry automatico
      Logger.log('⚠️ Invio immediato fallito, uso coda: ' + emailError.message);
      try {
        accodaInvioEmail({
          email: payload.email,
          nome: payload.nome,
          nomeEvento: evento.nome_evento,
          qrToken: qrToken
        });
        Logger.log('📧 Email accodata per retry automatico');
      } catch (queueError) {
        Logger.log('❌ Anche accodamento fallito: ' + queueError.message);
        // Prenotazione è comunque salvata, email verrà gestita manualmente
      }
    }

    const executionTime = Date.now() - startTime;
    Logger.log('Prenotazione salvata in ' + executionTime + 'ms');
    
   return { 
  success: true, 
  token: qrToken,
  message: "🔥 Sei dentro! Ti mandiamo l'email con il QR tra 1-2 min. Check anche lo spam! 📱",
  executionTime: executionTime
};

  } catch (e) {
    Logger.log('Errore generale: ' + e.message);
    
    return { 
      success: false, 
      msg: "Errore imprevisto. Riprova o contatta l'assistenza." 
    };
  }
}
function testRegistrazioneDebug() {
  const risultato = salvaPrenotazione({
    nome: 'Test',
    cognome: 'Debug',
    email: 'test-' + Date.now() + '@example.com', // Email sempre diversa
    evento: 'LOCA2', // Usa il codice del tuo evento
    pr: 'Staff'
  });
  
  Logger.log('=== RISULTATO TEST ===');
  Logger.log(JSON.stringify(risultato, null, 2));
  Logger.log('=====================');
}
