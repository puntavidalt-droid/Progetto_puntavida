/**
 * UTILITY_MAIL.GS
 * Invia l'email di conferma con il QR Code e gestisce l'invio dei report CSV.
 */

/**
 * 1. Invia l'email di conferma originale (Tua funzione esistente)
 */
function inviaEmailConQR(emailDestinatario, nomeCliente, nomeEvento, qrToken) {
  // Utilizziamo l'API per generare l'immagine del QR
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrToken}`;
  
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; text-align: center; border: 1px solid #ddd; padding: 20px; border-radius: 10px; max-width: 500px; margin: auto;">
      <h2 style="color: #121212;">Ciao ${nomeCliente}!</h2>
      <p style="font-size: 16px;">La tua prenotazione per l'evento <strong>${nomeEvento}</strong> è confermata.</p>
      <p>Mostra questo codice all'ingresso per accedere:</p>
      <div style="margin: 20px 0;">
        <img src="${qrUrl}" alt="QR Code" style="border: 5px solid #fff; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
      </div>
      <p style="font-size: 12px; color: #666;">Codice identificativo: ${qrToken}</p>
      <p style="font-size: 11px; color: #999; margin-top: 20px;">Ti aspettiamo!</p>
    </div>
  `;
  
  MailApp.sendEmail({
    to: emailDestinatario,
    subject: `Conferma Prenotazione: ${nomeEvento}`,
    htmlBody: htmlBody
  });
}

/**
 * 2. NUOVA: Reinvia l'email con QR partendo dall'ID prenotazione
 */
function reinviaEmailQRId(prenotazioneId) {
  const p = dbGetPrenotazionePerId(prenotazioneId);
  if (!p) return false;
  
  const evento = dbGetEventoInfoById(p.evento_id);
  if (!evento) return false;
  
  inviaEmailConQR(p.cliente_email, p.cliente_nome, evento.nome_evento, p.qr_token);
  return true;
}

/**
 * 3. NUOVA: Genera un CSV e lo invia via email (Report Puntavida o PR)
 */
function inviaEmailListaPrenotati(destinatario, nomeEvento, datiPrenotazioni, nomePR = null) {
  const titoloReport = nomePR ? `Lista Prenotazioni PR: ${nomePR}` : `Lista Prenotazioni COMPLETA`;
  
  // Intestazione del CSV
  let csvContent = "Data Prenotazione;Nome;Cognome;Email;PR;Check-in;Ora Ingresso\n";
  
  // Popolamento righe
  datiPrenotazioni.forEach(p => {
    const dataPren = new Date(p.created_at).toLocaleString('it-IT');
    const checkin = (p.entrato === true || String(p.entrato) === "true") ? "SI" : "NO";
    const oraIngresso = p.ora_ingresso ? new Date(p.ora_ingresso).toLocaleString('it-IT') : "-";
    
    csvContent += `${dataPren};${p.cliente_nome};${p.cliente_cognome};${p.cliente_email};${p.pr_nickname};${checkin};${oraIngresso}\n`;
  });

  // Creazione del file allegato
  const fileName = `Report_${nomeEvento.replace(/\s+/g, '_')}_${nomePR || 'Full'}.csv`;
  const blob = Utilities.newBlob(csvContent, 'text/csv', fileName);

  MailApp.sendEmail({
    to: destinatario,
    subject: `${titoloReport} - ${nomeEvento}`,
    body: `In allegato il report aggiornato per l'evento: ${nomeEvento}.\n\nTotale record: ${datiPrenotazioni.length}`,
    attachments: [blob]
  });
  
  return true;
}