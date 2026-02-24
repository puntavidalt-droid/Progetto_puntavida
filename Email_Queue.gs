/**
 * EMAIL_QUEUE.GS
 * Sistema coda email asincrono con retry (CON SUPPORTO PASTO)
 */

function setupEmailQueue() {
  try {
    const ss = SpreadsheetApp.create('PuntaVida - Email Queue');
    const sheet = ss.getSheets()[0];
    sheet.setName('EmailQueue');
    
    sheet.appendRow([
      'Timestamp',
      'Email',
      'Nome',
      'Evento',
      'QR Token',
      'Cancel Token',
      'Stato',
      'Tentativi',
      'Ultimo Errore',
      'Inviato Il'
    ]);
    
    sheet.getRange(1, 1, 1, 10)
      .setFontWeight('bold')
      .setBackground('#667eea')
      .setFontColor('white');
    sheet.setFrozenRows(1);
    
    const spreadsheetId = ss.getId();
    const spreadsheetUrl = ss.getUrl();
    
    Logger.log('✅ Spreadsheet creato!');
    Logger.log('📋 ID: ' + spreadsheetId);
    Logger.log('🔗 URL: ' + spreadsheetUrl);
    Logger.log('');
    Logger.log('⚠️ COPIA QUESTO ID:');
    Logger.log(spreadsheetId);
    Logger.log('');
    Logger.log('POI ESEGUI:');
    Logger.log('updateConfigProperty("EMAIL_QUEUE_SHEET_ID", "' + spreadsheetId + '")');
    
    return spreadsheetId;
    
  } catch (e) {
    Logger.log('❌ Errore: ' + e.message);
    return null;
  }
}

function setupTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'processaCodeEmail') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  ScriptApp.newTrigger('processaCodeEmail')
    .timeBased()
    .everyMinutes(1)
    .create();
  
  Logger.log('✅ Trigger configurato: ogni 1 minuti');
}

/**
 * Processa coda email (chiamata da trigger ogni minuto)
 */
function processaCodeEmail() {
  const startTime = Date.now();
  
  try {
    const config = getConfig();  // ✅ Questo OK - è per EMAIL_QUEUE_SHEET_ID
    const emailQueueSheetId = config.EMAIL_QUEUE_SHEET_ID;
    
    if (!emailQueueSheetId) {
      Logger.log('⚠️ EMAIL_QUEUE_SHEET_ID non configurato');
      return;
    }
    
    const ss = SpreadsheetApp.openById(emailQueueSheetId);
    const sheet = ss.getSheetByName('EmailQueue');
    
    if (!sheet) {
      Logger.log('❌ Foglio EmailQueue non trovato');
      return;
    }
    
    const data = sheet.getDataRange().getValues();
    let processed = 0;
    let sent = 0;
    let failed = 0;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const stato = row[6];
      const tentativi = row[7] || 0;
      
      if (stato === 'PENDING' && tentativi < 3) {
        processed++;
        
        const email = row[1];
        const nome = row[2];
        const qrToken = row[4];
        const cancelToken = row[5];
        
        try {
          // Recupera dati completi
          const prenotazione = dbGetPrenotazioneDaToken(qrToken);
          
          if (!prenotazione) {
            throw new Error('Prenotazione non trovata');
          }
          
          const evento = dbGetEventoInfoById(prenotazione.evento_id);
          
          if (!evento) {
            throw new Error('Evento non trovato');
          }
          
          // Invia email
          inviaEmailConQR(
            email, 
            nome, 
            evento.nome_evento,
            qrToken,
            cancelToken,
            evento,
            prenotazione.include_pasto
          );
          
          // Marca come inviata
          sheet.getRange(i + 1, 7).setValue('SENT');
          sheet.getRange(i + 1, 8).setValue(tentativi + 1);
          sheet.getRange(i + 1, 10).setValue(new Date());
          
          sent++;
          Logger.log('✅ Email coda inviata a ' + email);
          
        } catch (emailError) {
          sheet.getRange(i + 1, 8).setValue(tentativi + 1);
          sheet.getRange(i + 1, 9).setValue(emailError.message);
          
          if (tentativi + 1 >= 3) {
            sheet.getRange(i + 1, 7).setValue('FAILED');
            failed++;
            Logger.log('❌ Email fallita dopo 3 tentativi: ' + email);
          } else {
            Logger.log('⚠️ Errore (tentativo ' + (tentativi + 1) + '/3): ' + email);
          }
        }
        
        Utilities.sleep(1000);
      }
    }
    
    const executionTime = Date.now() - startTime;
    Logger.log('=== CODA EMAIL ===');
    Logger.log('Processate: ' + processed + ' | Inviate: ' + sent + ' | Fallite: ' + failed);
    Logger.log('Tempo: ' + executionTime + 'ms');
    
  } catch (e) {
    Logger.log('❌ Errore processaCodeEmail: ' + e.message);
  }
}

/**
 * Accoda invio email per retry
 */
function accodaInvioEmail(dati) {
  try {
    const config = getConfig();  // ✅ Questo OK - è per EMAIL_QUEUE_SHEET_ID
    const emailQueueSheetId = config.EMAIL_QUEUE_SHEET_ID;
    
    if (!emailQueueSheetId) {
      Logger.log('⚠️ Coda non configurata, invio immediato');
      
      const prenotazione = dbGetPrenotazioneDaToken(dati.qrToken);
      const evento = dbGetEventoInfoById(prenotazione.evento_id);
      
      inviaEmailConQR(
        dati.email, 
        dati.nome, 
        evento.nome_evento,
        dati.qrToken,
        dati.cancelToken || prenotazione.cancel_token,
        evento,
        prenotazione.include_pasto
      );
      return;
    }
    
    const ss = SpreadsheetApp.openById(emailQueueSheetId);
    let sheet = ss.getSheetByName('EmailQueue');
    
    if (!sheet) {
      sheet = ss.insertSheet('EmailQueue');
      sheet.appendRow([
        'Timestamp', 'Email', 'Nome', 'Evento', 'QR Token', 'Cancel Token',
        'Stato', 'Tentativi', 'Ultimo Errore', 'Inviato Il'
      ]);
    }
    
    sheet.appendRow([
      new Date(),
      dati.email,
      dati.nome,
      dati.nomeEvento,
      dati.qrToken,
      dati.cancelToken,
      'PENDING',
      0,
      '',
      ''
    ]);
    
    Logger.log('📧 Email accodata per: ' + dati.email);
    
  } catch (e) {
    Logger.log('❌ Errore accodamento: ' + e.message);
    
    try {
      const prenotazione = dbGetPrenotazioneDaToken(dati.qrToken);
      const evento = dbGetEventoInfoById(prenotazione.evento_id);
      
      inviaEmailConQR(
        dati.email, 
        dati.nome, 
        evento.nome_evento,
        dati.qrToken,
        dati.cancelToken || prenotazione.cancel_token,
        evento,
        prenotazione.include_pasto
      );
    } catch (fallbackError) {
      Logger.log('❌ Anche fallback fallito: ' + fallbackError.message);
    }
  }
}

function getStatisticheCoda() {
  try {
    const config = getConfig();
    const emailQueueSheetId = config.EMAIL_QUEUE_SHEET_ID;
    
    if (!emailQueueSheetId) {
      return { error: 'Coda non configurata' };
    }
    
    const ss = SpreadsheetApp.openById(emailQueueSheetId);
    const sheet = ss.getSheetByName('EmailQueue');
    const data = sheet.getDataRange().getValues();
    
    const stats = {
      totale: data.length - 1,
      pending: 0,
      sent: 0,
      failed: 0
    };
    
    for (let i = 1; i < data.length; i++) {
      const stato = data[i][6];
      if (stato === 'PENDING') stats.pending++;
      else if (stato === 'SENT') stats.sent++;
      else if (stato === 'FAILED') stats.failed++;
    }
    
    Logger.log('=== STATISTICHE CODA ===');
    Logger.log('Totale: ' + stats.totale);
    Logger.log('Pending: ' + stats.pending);
    Logger.log('Sent: ' + stats.sent);
    Logger.log('Failed: ' + stats.failed);
    
    return stats;
    
  } catch (e) {
    Logger.log('❌ Errore: ' + e.message);
    return { error: e.message };
  }
}

function testEmailQueue() {
  Logger.log('=== TEST EMAIL QUEUE ===');
  
  accodaInvioEmail({
    email: 'test@example.com',
    nome: 'Test',
    nomeEvento: 'Evento Test',
    qrToken: 'TEST-' + Utilities.getUuid(),
    cancelToken: 'CANCEL-' + Utilities.getUuid()
  });
  
  Logger.log('Test accodamento completato');
  Logger.log('Controlla lo spreadsheet Email Queue');
}