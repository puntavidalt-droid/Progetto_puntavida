/**
 * LOGIC_PRENOTAZIONI.GS
 * Gestisce le operazioni specifiche del modulo Gestione Prenotazioni.

 /**
 * Recupera i dati per la pagina di gestione (Sostituisci la vecchia con questa)
 */
/**
 * Recupera i dati e verifica se il check-in è aperto
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
    
    // Altrimenti cerchiamo il PR nel database tramite la tua funzione
    const listaPR = dbGetAllPR();
    const prTrovato = listaPR.find(p => p.nickname === prNickname);
    
    return (prTrovato && prTrovato.email) ? prTrovato.email : Session.getActiveUser().getEmail();
  } catch (e) {
    return Session.getActiveUser().getEmail();
  }
}

/**
 * Azione Check-in Manuale: usa la tua funzione dbUpdateIngresso (già esistente)
 */
function azioneCheckInManuale(id) {
  try {
    const oraISO = new Date().toISOString();
    const staffId = "MANUALE_DASHBOARD"; 
    return dbUpdateIngresso(id, oraISO, staffId);
  } catch (e) {
    return false;
  }
}

/**
 * NUOVA: Azione Check-in Manuale che usa la tua funzione dello scanner
 */
function azioneCheckInManuale(id) {
  try {
    const oraISO = new Date().toISOString();
    const staffId = "MANUALE"; // Identifichiamo che l'ingresso è stato forzato dalla dashboard
    
    // Usiamo la tua funzione originale!
    return dbUpdateIngresso(id, oraISO, staffId);
  } catch (e) {
    console.error("Errore check-in manuale: " + e.message);
    return false;
  }
}
/**
 * Azione: Reinvia QR Code a un cliente specifico
 */
function azioneReinviaQR(id) {
  try {
    return homeReinviaQR(id); // Riutilizziamo la logica in Logic_home
  } catch (e) {
    return false;
  }
}

/**
 * Azione: Annulla/Elimina prenotazione
 */
function azioneAnnullaPrenotazione(id) {
  try {
    return dbDeletePrenotazione(id);
  } catch (e) {
    console.error("Errore azioneAnnullaPrenotazione: " + e.message);
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
    let csvString = "Nome;Cognome;Email;PR;Stato\n";
    filtrati.forEach(p => {
      csvString += `${p.cliente_nome};${p.cliente_cognome};${p.cliente_email};${p.pr_nickname};${p.entrato ? 'Entrato' : 'In attesa'}\n`;
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