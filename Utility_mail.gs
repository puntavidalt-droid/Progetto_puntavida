/**
 * ================================================================
 * MODIFICA COMPLETA: Utility_mail.gs
 * Sostituisci l'intera funzione inviaEmailConQR con questa versione
 * ================================================================
 */

function inviaEmailConQR(email, nome, nomeEvento, qrToken, cancelToken) {
  try {
    const baseUrl = getAppUrl(); // Usa la funzione già esistente nel progetto
    
    const linkQR = baseUrl + '?page=mostra_qr&token=' + qrToken;
    const linkAnnulla = cancelToken ? 
      baseUrl + '?page=annulla&token=' + cancelToken : '';
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #000000;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 16px; overflow: hidden;">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #1ed760 0%, #18b34d 100%); padding: 30px; text-align: center;">
                    <h1 style="color: #000000; margin: 0; font-size: 28px; font-weight: bold;">
                      ★ PUNTA VIDA
                    </h1>
                  </td>
                </tr>
                
                <!-- Contenuto principale -->
                <tr>
                  <td style="padding: 40px 30px; color: #ffffff;">
                    <h2 style="color: #1ed760; margin: 0 0 20px 0; font-size: 24px;">
                      🎉 Prenotazione Confermata!
                    </h2>
                    
                    <p style="font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
                      Ciao <strong style="color: #1ed760;">${nome}</strong>,
                    </p>
                    
                    <p style="font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      La tua prenotazione per <strong style="color: #1ed760;">${nomeEvento}</strong> è confermata!
                    </p>
                    
                    <!-- Box QR Code -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0d0d0d; border: 2px solid #1ed760; border-radius: 12px; margin-bottom: 30px;">
                      <tr>
                        <td style="padding: 25px; text-align: center;">
                          <p style="color: #1ed760; font-size: 14px; font-weight: bold; margin: 0 0 15px 0;">
                            IL TUO QR CODE
                          </p>
                          <p style="color: #ffffff; font-size: 20px; font-family: 'Courier New', monospace; margin: 0 0 20px 0; word-break: break-all;">
                            ${qrToken}
                          </p>
                          <a href="${linkQR}" 
                             style="display: inline-block; 
                                    background: linear-gradient(135deg, #1ed760 0%, #18b34d 100%); 
                                    color: #000000; 
                                    padding: 14px 32px; 
                                    text-decoration: none; 
                                    border-radius: 25px; 
                                    font-weight: bold;
                                    font-size: 16px;">
                            📱 Visualizza QR Code
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="font-size: 14px; color: #999999; line-height: 1.6; margin: 0 0 20px 0;">
                      💡 <strong>Consiglio:</strong> Salva questa email o fai uno screenshot del QR code. 
                      Ti servirà all'ingresso dell'evento.
                    </p>
                  </td>
                </tr>
                
                ${cancelToken ? `
                <!-- Sezione Annullamento -->
                <tr>
                  <td style="padding: 0 30px 30px 30px;">
                    <div style="border-top: 1px solid #333333; padding-top: 25px;">
                      <p style="color: #999999; font-size: 13px; margin: 0 0 10px 0;">
                        <strong>Hai bisogno di annullare?</strong>
                      </p>
                      <p style="color: #999999; font-size: 13px; margin: 0 0 15px 0;">
                        Non ti preoccupare, potrai sempre ri-registrarti successivamente.
                      </p>
                      <a href="${linkAnnulla}" 
                         style="color: #dc3545; 
                                text-decoration: underline; 
                                font-size: 13px;">
                        Clicca qui per annullare la prenotazione →
                      </a>
                    </div>
                  </td>
                </tr>
                ` : ''}
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #0d0d0d; padding: 20px 30px; text-align: center; border-top: 1px solid #333333;">
                    <p style="color: #666666; font-size: 12px; margin: 0;">
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
    throw error; // Rilancia per gestione upstream
  }
}
