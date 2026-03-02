// ═══════════════════════════════════════════════════════════════
// Utility_mail.gs - GESTIONE EMAIL CON QR CODE
// ═══════════════════════════════════════════════════════════════

/**
 * Helper: estrae HH:MM direttamente dalla stringa timestamp DB
 * Input: "2026-03-06 23:30:00+00" o "2026-03-06 23:30:00"
 * Output: "23:30"
 * NON usa new Date() per evitare conversioni di fuso orario
 */
function estraiOraMinuti(timestampStr) {
  if (!timestampStr) return '';
  const str = String(timestampStr);
  // Cerca il pattern HH:MM dopo lo spazio (o dopo la T)
  const match = str.match(/[\sT](\d{2}):(\d{2})/);
  if (match) return match[1] + ':' + match[2];
  return '';
}

/**
 * Invia email con QR code
 * ✅ Colori brand verde PuntaVida
 * ✅ Messaggi dinamici pranzo/cena
 * ✅ Data evento + orario check-in
 */
function inviaEmailConQR(email, nome, nomeEvento, qrToken, cancelToken, evento, includePasto) {
  
  // Generazione QR code
  const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=" + 
                encodeURIComponent(qrToken);
  
  // Link gestione prenotazione — *** OLD: invariato ***
  let linkGestione = getAppUrl() + "?page=annulla&token=" + cancelToken;
  let testoLink = "Annulla prenotazione";
  
  if (evento.tipo_evento !== 'SOLO_DANZA' && !evento.pasto_obbligatorio) {
    linkGestione = getAppUrl() + "?page=modifica&token=" + cancelToken;
    testoLink = "Gestisci prenotazione";
  }
  
  // Logo URL — *** OLD: invariato ***
  const logoUrl = dbGetLogoUrl ? dbGetLogoUrl() : "https://via.placeholder.com/150x50?text=PuntaVida";
  
  // ═══════════════════════════════════════════════════════════════
  // HELPER: Label pasto dinamica
  // ═══════════════════════════════════════════════════════════════
  const tipoEvento = evento.tipo_evento || 'SOLO_DANZA';
  let labelPasto = 'pasto';
  if (tipoEvento === 'CON_PRANZO') labelPasto = 'pranzo';
  if (tipoEvento === 'CON_CENA') labelPasto = 'cena';
  const labelPastoUpper = labelPasto.charAt(0).toUpperCase() + labelPasto.slice(1);
  
  // ═══════════════════════════════════════════════════════════════
  // NUOVO: Data evento formattata
  // ═══════════════════════════════════════════════════════════════
  let dataEventoStr = '';
  if (evento.data_evento) {
    const d = new Date(evento.data_evento);
    dataEventoStr = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    // Prima lettera maiuscola
    dataEventoStr = dataEventoStr.charAt(0).toUpperCase() + dataEventoStr.slice(1);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // NUOVO: Orario check-in — ESTRAZIONE DIRETTA dalla stringa DB
  // I timestamp sono già in ora locale, NON convertire con new Date()
  // Formato DB: "2026-03-06 23:30:00+00" → estrarre "23:30"
  // ═══════════════════════════════════════════════════════════════
  let orarioCheckin = '';
  
  if (includePasto && evento.inizio_checkin_pasto) {
    const oraPasto = estraiOraMinuti(evento.inizio_checkin_pasto);
    orarioCheckin = oraPasto;
    
    if (evento.inizio_checkin) {
      const oraParty = estraiOraMinuti(evento.inizio_checkin);
      if (oraParty !== oraPasto) {
        orarioCheckin = oraPasto + ' (' + labelPasto + ') / ' + oraParty + ' (party)';
      }
    }
  } else if (evento.inizio_checkin) {
    orarioCheckin = estraiOraMinuti(evento.inizio_checkin);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // NUOVO: Sezione info evento (data + orario)
  // ═══════════════════════════════════════════════════════════════
  let sezioneInfo = '';
  if (dataEventoStr || orarioCheckin) {
    sezioneInfo = `
      <div style="background:#e8f5e9; padding:15px 20px; border-left:4px solid #1db954; margin:0 0 25px 0; border-radius:4px;">
        ${dataEventoStr ? '<p style="margin:0 0 5px 0; font-size:15px; color:#333;">📅 <strong>' + dataEventoStr + '</strong></p>' : ''}
        ${orarioCheckin ? '<p style="margin:0; font-size:15px; color:#333;">🕐 Check-in dalle <strong>' + orarioCheckin + '</strong></p>' : ''}
      </div>
    `;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // SEZIONE PREZZO — MODIFICATO: colori brand + label dinamica
  // ═══════════════════════════════════════════════════════════════
  let sezionePrezzo = "";
  
  if (includePasto) {
    // Ha pasto — box giallo (coerente col codice colore pasto)
    sezionePrezzo = `
      <div style="background:#fff8e1; padding:20px; border-left:4px solid #FFC107; margin:0 0 25px 0; border-radius:4px;">
        <p style="margin:0 0 10px 0; font-size:14px; color:#333;">
          <strong>Dettaglio prenotazione:</strong>
        </p>
        <p style="margin:0 0 5px 0; font-size:16px; color:#333;">
          🍽️ <strong>${labelPastoUpper} incluso</strong>
        </p>
        <p style="margin:0; font-size:18px; color:#333; font-weight:bold;">
          💰 Prezzo: €${evento.prezzo_con_pasto ? evento.prezzo_con_pasto.toFixed(2) : '0.00'}
        </p>
      </div>
    `;
  } else if (evento.visualizza_prezzo_danza && evento.prezzo_solo_danza) {
    // Solo party — box verde brand
    sezionePrezzo = `
      <div style="background:#e8f5e9; padding:20px; border-left:4px solid #1db954; margin:0 0 25px 0; border-radius:4px;">
        <p style="margin:0 0 10px 0; font-size:18px; color:#333; font-weight:bold;">
          🎉 Ingresso Party: €${evento.prezzo_solo_danza.toFixed(2)}
        </p>
    `;
    
    if (evento.messaggio_prezzo_danza) {
      sezionePrezzo += `
        <p style="margin:10px 0 0 0; font-size:14px; color:#555;">
          ${evento.messaggio_prezzo_danza}
        </p>
      `;
    }
    
    sezionePrezzo += `</div>`;
  }
  
  // Messaggio custom — *** OLD: invariato ***
  let sezioneMessaggio = "";
  
  if (evento.messaggio_post_registrazione) {
    sezioneMessaggio = `
      <div style="background:#e3f2fd; border-left:4px solid #2196F3; padding:15px; margin:0 0 25px 0; border-radius:4px;">
        <p style="margin:0; font-size:14px; color:#0277bd;">
          ℹ️ <strong>Importante:</strong><br>
          ${evento.messaggio_post_registrazione}
        </p>
      </div>
    `;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // Template HTML — MODIFICATO: colori verde brand + sezione info
  // ═══════════════════════════════════════════════════════════════
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0; padding:0; background:#f5f5f5; font-family:Arial,sans-serif;">
      
      <div style="max-width:600px; margin:0 auto; background:#fff; padding:0;">
        
        <!-- Header logo -->
        <div style="background:#1a1a1a; padding:40px; text-align:center;">
          <img src="${logoUrl}" alt="PuntaVida" style="width:150px;">
        </div>
        
        <!-- Contenuto -->
        <div style="padding:40px; color:#333;">
          
          <h1 style="color:#1db954; margin:0 0 20px 0;">
            🎉 Sei dentro, ${nome}!
          </h1>
          
          <p style="font-size:16px; line-height:1.6; margin:0 0 20px 0; color:#333;">
            La tua prenotazione per <strong>${nomeEvento}</strong> è confermata!
          </p>
          
          ${sezioneInfo}
          
          ${sezionePrezzo}
          
          <!-- QR Code -->
          <div style="background:#fff; border:2px solid #1db954; padding:30px; text-align:center; margin:0 0 25px 0; border-radius:8px;">
            <p style="margin:0 0 15px 0; font-size:14px; color:#666;">
              <strong>Il tuo QR Code:</strong>
            </p>
            <img src="${qrUrl}" alt="QR Code" style="width:250px; height:250px;">
            <p style="margin:15px 0 0 0; font-size:12px; color:#999;">
              Mostra questo codice all'ingresso
            </p>
          </div>
          
          ${sezioneMessaggio}
          
          <!-- Link gestione -->
          <div style="border-top:1px solid #ddd; padding:20px 0; margin:20px 0 0 0; text-align:center;">
            <p style="margin:0 0 15px 0; font-size:14px; color:#666;">
              Hai bisogno di modificare o annullare?
            </p>
            <a href="${linkGestione}" 
               style="display:inline-block; background:#dc3545; color:#fff; 
                      padding:12px 30px; text-decoration:none; border-radius:5px; 
                      font-size:14px; font-weight:bold;">
              ${testoLink}
            </a>
          </div>
          
        </div>
        
        <!-- Footer -->
        <div style="background:#f5f5f5; padding:30px; text-align:center; color:#999; font-size:12px;">
          <p style="margin:0 0 10px 0;">
            PuntaVida Events<br>
            www.puntavida.com
          </p>
          <p style="margin:0;">
            Questa è una email automatica, non rispondere.
          </p>
        </div>
        
      </div>
      
    </body>
    </html>
  `;
  
  // Invio email — *** OLD: invariato ***
  try {
    MailApp.sendEmail({
      to: email,
      subject: "🎉 Sei dentro per " + nomeEvento + "!",
      htmlBody: htmlBody
    });
    
    Logger.log('✅ Email inviata a: ' + email);
    return true;
    
  } catch (e) {
    Logger.log('❌ Errore invio email: ' + e.message);
    throw e;
  }
}

/**
 * Reinvia email con QR code a cliente esistente
 */
function reinviaEmailQRId(prenotazioneId) {
  const p = dbGetPrenotazionePerId(prenotazioneId);
  if (!p) return false;
  
  const evento = dbGetEventoInfoById(p.evento_id);
  if (!p) return false;
  
  inviaEmailConQR(
    p.cliente_email, 
    p.cliente_nome, 
    evento.nome_evento, 
    p.qr_token, 
    p.cancel_token,
    evento,           // ← AGGIUNTO
    p.include_pasto   // ← AGGIUNTO
  );
  return true;
}

/**
 * Aggiungi email a coda retry (per Gmail quota exceeded)
 */
function aggiungiEmailCoda(email, nome, nomeEvento, qrToken, cancelToken) {
  try {
    const ss = SpreadsheetApp.openById('1l_b_pEEAkCML2qqf3ruEb2kCu9moCOfoAUYbEo9MQYA');
    const sheet = ss.getSheetByName('Email Queue') || ss.insertSheet('Email Queue');
    
    sheet.appendRow([
      new Date(),           // Timestamp
      email,
      nome,
      nomeEvento,
      qrToken,
      cancelToken,
      'PENDING'             // Status
    ]);
    
    Logger.log('📧 Email aggiunta a coda: ' + email);
    
  } catch (e) {
    Logger.log('❌ Errore aggiungiEmailCoda: ' + e.message);
  }
}

/**
 * Processa coda email (chiamare con trigger temporizzato)
 */
function processaEmailCoda() {
  try {
    const ss = SpreadsheetApp.openById('1l_b_pEEAkCML2qqf3ruEb2kCu9moCOfoAUYbEo9MQYA');
    const sheet = ss.getSheetByName('Email Queue');
    
    if (!sheet) {
      Logger.log('ℹ️ Nessuna coda email');
      return;
    }
    
    const data = sheet.getDataRange().getValues();
    
    // Salta header (riga 1)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const status = row[6];
      
      if (status === 'PENDING') {
        const email = row[1];
        const nome = row[2];
        const qrToken = row[4];
        
        try {
          // Recupera dati completi dalla prenotazione
          const prenotazione = dbGetPrenotazioneDaToken(qrToken);
          
          if (!prenotazione) {
            sheet.getRange(i + 1, 7).setValue('ERROR_NOT_FOUND');
            continue;
          }
          
          const evento = dbGetEventoInfoById(prenotazione.evento_id);
          
          // Invia email con dati completi
          inviaEmailConQR(
            email,
            nome,
            evento.nome_evento,
            prenotazione.qr_token,
            prenotazione.cancel_token,
            evento,
            prenotazione.include_pasto  // ← IMPORTANTE
          );
          
          // Marca come inviata
          sheet.getRange(i + 1, 7).setValue('SENT');
          Logger.log('✅ Email coda inviata: ' + email);
          
        } catch (e) {
          Logger.log('❌ Errore invio email coda: ' + e.message);
          sheet.getRange(i + 1, 7).setValue('ERROR');
        }
        
        // Pausa per evitare quota Gmail
        Utilities.sleep(2000);
      }
    }
    
  } catch (e) {
    Logger.log('❌ Errore processaEmailCoda: ' + e.message);
  }
}
