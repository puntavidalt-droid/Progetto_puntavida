/**
 * LOGIC_PRENOTAZIONI.GS
 * Gestisce le operazioni specifiche del modulo Gestione Prenotazioni.
 * ✅ TIMESTAMP ORA LOCALE
 */

/**
 * Recupera i dati per la gestione e verifica l'orario di apertura
 */
function getDatiGestionePrenotazioni(eventoId) {
  try {
    const eventi = dbGetAllEventi();
    const pr = dbGetAllPR();
    const oraAttuale = new Date();
    
    let idDaCaricare = eventoId;

    // Fallback sull'evento più vicino se non specificato
    if (!idDaCaricare) {
      const listaOrdinata = eventi.sort((a, b) => new Date(a.data_evento) - new Date(b.data_evento));
      const prossimo = listaOrdinata.find(e => new Date(e.data_evento).setHours(23,59,59) >= oraAttuale);
      idDaCaricare = prossimo ? prossimo.id : (listaOrdinata.length > 0 ? listaOrdinata[0].id : null);
    }
    
    const prenotazioni = dbGetPrenotazioniLive(idDaCaricare);
    const eventoInfo = eventi.find(e => e.id == idDaCaricare);

    // CONTROLLO ORARIO: Abilitiamo il check-in solo se l'ora attuale >= inizio_checkin
    let checkInAperto = false;
    if (eventoInfo && eventoInfo.inizio_checkin) {
      const dataInizio = new Date(eventoInfo.inizio_checkin);
      if (oraAttuale >= dataInizio) {
        checkInAperto = true;
      }
    }
    
    return {
      prenotazioni: prenotazioni,
      evento: eventoInfo,
      listaEventi: eventi,
      listaPR: pr,
      idSelezionato: idDaCaricare,
      checkInAperto: checkInAperto 
    };
  } catch (e) {
    console.error("Errore getDatiGestionePrenotazioni: " + e.message);
    return null;
  }
}

/**
 * Recupera l'email del destinatario per il report
 */
function getEmailPerReport(prNickname) {
  try {
    // Se il filtro è su "Tutti", usiamo l'email dell'admin/staff loggato
    if (!prNickname || prNickname === "ALL") {
      return Session.getActiveUser().getEmail();
    }
    
    // Altrimenti cerchiamo il PR nel database
    const listaPR = dbGetAllPR();
    const prTrovato = listaPR.find(p => p.nickname === prNickname);
    
    return (prTrovato && prTrovato.email) ? prTrovato.email : Session.getActiveUser().getEmail();
  } catch (e) {
    return Session.getActiveUser().getEmail();
  }
}

/**
 * Azione Check-in Manuale dalla dashboard
 * ✅ CORRETTO: Usa timestamp ora locale
 */
function azioneCheckInManuale(id) {
  try {
    // ✅ Usa helper per timestamp ora locale
    const timestampLocale = getTimestampLocale();
    const staffId = "DASHBOARD_MANUAL"; // Identifica check-in manuale da dashboard
    
    return dbUpdateIngresso(id, timestampLocale, staffId);
  } catch (e) {
    console.error("Errore check-in manuale: " + e.message);
    return false;
  }
}

/**
 * Helper timestamp ora locale (duplicato per comodità)
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
 * Azione: Reinvia QR Code a un cliente specifico
 */
function azioneReinviaQR(id) {
  try {
    return homeReinviaQR(id); // Riutilizza logica in Logic_Home.gs
  } catch (e) {
    console.error("Errore reinvio QR: " + e.message);
    return false;
  }
}

/**
 * Azione: Annulla prenotazione (logico, non delete fisico)
 */
function azioneAnnullaPrenotazione(id) {
  try {
    // dbDeletePrenotazione è deprecata e chiama dbAnnullaPrenotazione
    return dbDeletePrenotazione(id);
  } catch (e) {
    console.error("Errore annullamento: " + e.message);
    return false;
  }
}

/**
 * NUOVA: Azione Riattiva prenotazione annullata (per admin)
 */
function azioneRiattivaPrenotazione(id) {
  try {
    // Recupera prenotazione per ottenere QR token originale
    const prenotazione = dbGetPrenotazionePerId(id);
    if (!prenotazione) return false;
    
    // Riattiva mantenendo stesso QR token
    return dbRiattivaPrenotazione(id, prenotazione.qr_token);
  } catch (e) {
    console.error("Errore riattivazione: " + e.message);
    return false;
  }
}

/**
 * Genera e invia il report CSV via email
 */
function homeInviaReport(eventoId, prNickname, emailDestino) {
  try {
    const prenotazioni = dbGetPrenotazioniLive(eventoId);
    
    // Filtro per PR se specificato
    let filtrati = (prNickname && prNickname !== "ALL") 
      ? prenotazioni.filter(p => p.pr_nickname === prNickname)
      : prenotazioni;

    if (filtrati.length === 0) return "Nessun dato da inviare.";

    // Creazione del contenuto CSV
    let csvString = "Nome;Cognome;Email;PR;Stato;Check-in\n";
    filtrati.forEach(p => {
      const stato = p.stato === 'ANNULLATA' ? 'Annullata' : (p.entrato ? 'Entrato' : 'In attesa');
      const checkin = p.entrato ? 'Sì' : 'No';
      csvString += `${p.cliente_nome};${p.cliente_cognome || ''};${p.cliente_email};${p.pr_nickname};${stato};${checkin}\n`;
    });

    const blob = Utilities.newBlob(csvString, 'text/csv', 'Report_PuntaVida.csv');

    MailApp.sendEmail({
      to: emailDestino,
      subject: "PuntaVida - Report " + (prNickname || "Globale"),
      body: "In allegato trovi il report richiesto per l'evento.",
      attachments: [blob]
    });

    return "Report inviato correttamente a " + emailDestino;
  } catch (e) {
    console.error("Errore report: " + e.message);
    return "Errore: " + e.message;
  }
}
