/**
 * LOGIC REGISTRAZIONE - Versione Ottimizzata per Velocità
 * Gestisce la logica di visualizzazione e salvataggio delle prenotazioni.
 */

// 1. Funzione che prepara la pagina
function renderRegistrazione(e) {
  const codiceEvento = e.parameter.evento || "default";
  const nicknamePR = e.parameter.pr || "Staff";
  
  const evento = dbGetEventoInfo(codiceEvento);
  if (!evento) {
    return HtmlService.createHtmlOutput("Errore: Evento non trovato nel database.");
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
    // MODIFICA CENTRALIZZATA: Il logo arriva ora dal Database.gs
    logoUrl: dbGetLogoUrl() 
  };
  template.prNickname = nicknamePR;

  return template.evaluate()
    .setTitle("Registrazione - " + evento.nome_evento)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// 2. Funzione di Salvataggio VELOCE
function salvaPrenotazione(payload) {
  try {
    // A. Validazione Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.email)) {
      return { success: false, msg: "L'indirizzo email inserito non è valido." };
    }

    // B. Recupero Evento
    const evento = dbGetEventoInfo(payload.evento);
    if (!evento) return { success: false, msg: "Evento non trovato." };

    // C. Controllo Orario e D. Sold Out (Controlli immediati)
    const oraAttuale = new Date();
    if (oraAttuale > new Date(evento.fine_prenotazione)) {
      return { success: false, msg: "Spiacenti, le prenotazioni sono appena scadute." };
    }

    const nPrenotati = dbGetConteggioPrenotazioni(evento.id);
    if (nPrenotati >= evento.max_partecipanti) {
      return { success: false, msg: "Spiacenti, i posti sono terminati proprio ora!" };
    }

    // E. Controllo Duplicati
    const esisteGia = dbVerificaEmailEsistente(payload.email, evento.id);
    if (esisteGia) {
      return { success: false, msg: "Sei già registrato per questo evento con questa email." };
    }

    // F. Preparazione Dati
    const prId = dbGetPrIdByNickname(payload.pr);
    const qrToken = Utilities.getUuid();
    
    const record = {
      cliente_nome: payload.nome,
      cliente_cognome: payload.cognome,
      cliente_email: payload.email,
      evento_id: evento.id,
      pr_id: prId,
      qr_token: qrToken
    };

    // G. Inserimento nel DB (Operazione Prioritaria)
    dbInsertPrenotazione(record);

    /**
     * H. INVIO EMAIL (Operazione "Pesante")
     */
    try {
      inviaEmailConQR(payload.email, payload.nome, evento.nome_evento, qrToken);
    } catch (errMail) {
      console.error("Errore invio mail: " + errMail.message);
    }

    // L. Ritorno immediato al frontend
    return { success: true, token: qrToken };

  } catch (e) {
    console.error("Errore generale: " + e.message);
    return { success: false, msg: "Errore tecnico: " + e.message };
  }
}