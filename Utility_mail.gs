/**
 * ================================================================
 * Utility_mail.gs - Versione Funzionante (approccio originale)
 * QR via URL diretto API (Gmail lo carica quando apre email)
 * ================================================================
 */

function inviaEmailConQR(email, nome, nomeEvento, qrToken, cancelToken) {
  try {
    const baseUrl = getAppUrl();
    
    // URL diretto API QR (Gmail lo carica all'apertura email)
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrToken)}`;
    
    // Link annullamento
    const linkAnnulla = cancelToken ? 
      baseUrl + '?page=annulla&token=' + cancelToken : '';
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <tr>
                  <td style="background-color: #000000; padding: 30px; text-align: center;">
                    <h1 style="color: #1ed760; margin: 0; font-size: 32px; font-weight: bold;">
                      ★ PUNTA VIDA
                    </h1>
                    <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 14px; opacity: 0.8;">
                      ${nomeEvento}
                    </p>
                  </td>
                </tr>
                
                <!-- Contenuto -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="color: #000000; margin: 0 0 10px 0; font-size: 24px;">
                      Ciao ${nome}! 🎉
                    </h2>
                    
                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      La tua prenotazione è <strong>confermata</strong>.<br>
                      Mostra questo QR Code all'ingresso:
                    </p>
                    
                    <!-- QR Code (caricato da API quando Gmail apre l'email) -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 20px; background-color: #fafafa; border-radius: 8px;">
                          <img src="${qrUrl}" 
                               alt="QR Code" 
                               width="250" 
                               height="250" 
                               style="display: block; border: 4px solid #000000; border-radius: 8px;">
                          <p style="color: #666666; font-size: 11px; margin: 15px 0 0 0; font-family: monospace; word-break: break-all; max-width: 280px;">
                            ${qrToken}
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0; padding: 15px; background-color: #f9f9f9; border-left: 4px solid #1ed760; border-radius: 4px;">
                      💡 <strong>Consiglio:</strong> Salva questa email o fai uno screenshot del QR code.
                    </p>
                  </td>
                </tr>
                
                ${cancelToken ? `
                <!-- Sezione Annullamento -->
                <tr>
                  <td style="padding: 0 30px 30px 30px;">
                    <div style="border-top: 1px solid #eeeeee; padding-top: 20px;">
                      <p style="color: #999999; font-size: 13px; margin: 0 0 10px 0;">
                        Hai bisogno di annullare?
                      </p>
                      <a href="${linkAnnulla}" 
                         style="color: #dc3545; 
                                text-decoration: none; 
                                font-size: 13px;
                                display: inline-block;
                                padding: 8px 16px;
                                border: 1px solid #dc3545;
                                border-radius: 6px;">
                        Annulla prenotazione →
                      </a>
                    </div>
                  </td>
                </tr>
                ` : ''}
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #fafafa; padding: 20px 30px; text-align: center; border-top: 1px solid #eeeeee;">
                    <p style="color: #999999; font-size: 12px; margin: 0;">
                      Punta Vida Events &copy; ${new Date().getFullYear()}
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
    
    MailApp.sendEmail({
      to: email,
      subject: '🎉 Prenotazione Confermata - ' + nomeEvento,
      htmlBody: htmlBody
    });
    
    Logger.log('✅ Email inviata a: ' + email);
    return true;
    
  } catch (error) {
    Logger.log('❌ Errore invio email: ' + error.message);
    throw error;
  }
}

/**
 * Reinvia email esistente
 */
function reinviaEmailQRId(prenotazioneId) {
  const p = dbGetPrenotazionePerId(prenotazioneId);
  if (!p) return false;
  
  const evento = dbGetEventoInfoById(p.evento_id);
  if (!evento) return false;
  
  inviaEmailConQR(p.cliente_email, p.cliente_nome, evento.nome_evento, p.qr_token, p.cancel_token);
  return true;
}

/**
 * Test email
 */
function testEmailConQR() {
  const testEmail = Session.getActiveUser().getEmail();
  const testNome = "Test Utente";
  const testEvento = "PROVA EVENTO";
  const testQR = Utilities.getUuid();
  const testCancel = Utilities.getUuid();
  
  inviaEmailConQR(testEmail, testNome, testEvento, testQR, testCancel);
  
  Logger.log('✅ Email di test inviata a: ' + testEmail);
}
