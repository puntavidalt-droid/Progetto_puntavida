/**
 * LOGIC_PRENOTAZIONI.GS
 * Gestisce le operazioni specifiche del modulo Gestione Prenotazioni.
 * ✅ TIMESTAMP ORA LOCALE
 * ✅ INTEGRAZIONE PASTO: check-in aperto da inizio pasto, toggle admin, CSV con pasto
 */

/**
 * Recupera i dati per la gestione e verifica l'orario di apertura
 * ✅ MODIFICATO: per eventi con pasto, check-in si sblocca da inizio_checkin_pasto
 */
function getDatiGestionePrenotazioni(eventoId) {
  try {
    const eventi = dbGetAllEventi();
    const pr = dbGetAllPR();
    const oraAttuale = new Date();
    
    let idDaCaricare = eventoId;

    // Fallback sull'evento più vicino se non specificato
    // *** OLD: invariato ***
    if (!idDaCaricare) {
      const listaOrdinata = eventi.sort((a, b) => new Date(a.data_evento) - new Date(b.data_evento));
      const prossimo = listaOrdinata.find(e => new Date(e.data_evento).setHours(23,59,59) >= oraAttuale);
      idDaCaricare = prossimo ? prossimo.id : (listaOrdinata.length > 0 ? listaOrdinata[0].id : null);
    }
    
    const prenotazioni = dbGetPrenotazioniLive(idDaCaricare);
    const eventoInfo = eventi.find(e => e.id == idDaCaricare);

    // ═══════════════════════════════════════════════════════════════
    // CONTROLLO ORARIO CHECK-IN
    // MODIFICATO: per eventi con pasto, si sblocca da inizio_checkin_pasto
    // Per SOLO_DANZA: logica OLD invariata (inizio_checkin dance)
    // ═══════════════════════════════════════════════════════════════
    let checkInAperto = false;
    if (eventoInfo) {
      const haPasto = eventoInfo.tipo_evento && eventoInfo.tipo_evento !== 'SOLO_DANZA';
      
      if (haPasto && eventoInfo.inizio_checkin_pasto) {
        // Evento con pasto: check-in abilitato da inizio pasto
        const dataInizioPasto = new Date(eventoInfo.inizio_checkin_pasto);
        if (oraAttuale >= dataInizioPasto) {
          checkInAperto = true;
        }
      } else if (eventoInfo.inizio_checkin) {
        // SOLO_DANZA o evento senza campi pasto: logica OLD
        const dataInizio = new Date(eventoInfo.inizio_checkin);
        if (oraAttuale >= dataInizio) {
          checkInAperto = true;
        }
      }
      
      // Chiusura: dopo fine_checkin (dance) → chiuso per tutti
      if (eventoInfo.fine_checkin) {
        const dataFine = new Date(eventoInfo.fine_checkin);
        if (oraAttuale > dataFine) {
          checkInAperto = false;
        }
      }
    }
    
    return {
      prenotazioni: prenotazioni,
      evento: eventoInfo,       // ← il frontend riceve l'oggetto evento completo
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
 * *** OLD: invariato ***
 */
function getEmailPerReport(prNickname) {
  try {
    if (!prNickname || prNickname === "ALL") {
      return Session.getActiveUser().getEmail();
    }
    
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
 * *** OLD: invariato — il pasto non influisce sul check-in ***
 */
function azioneCheckInManuale(id) {
  try {
    const timestampLocale = getTimestampLocale();
    const staffId = "DASHBOARD_MANUAL";
    
    return dbUpdateIngresso(id, timestampLocale, staffId);
  } catch (e) {
    console.error("Errore check-in manuale: " + e.message);
    return false;
  }
}

/**
 * Helper timestamp ora locale (duplicato per comodità)
 * *** OLD: invariato ***
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
 * *** OLD: invariato ***
 */
function azioneReinviaQR(id) {
  try {
    return homeReinviaQR(id);
  } catch (e) {
    console.error("Errore reinvio QR: " + e.message);
    return false;
  }
}

/**
 * Azione: Annulla prenotazione (logico, non delete fisico)
 * *** OLD: invariato ***
 */
function azioneAnnullaPrenotazione(id) {
  try {
    return dbDeletePrenotazione(id);
  } catch (e) {
    console.error("Errore annullamento: " + e.message);
    return false;
  }
}

/**
 * Azione Riattiva prenotazione annullata (per admin)
 * *** OLD: invariato ***
 */
function azioneRiattivaPrenotazione(id) {
  try {
    const prenotazione = dbGetPrenotazionePerId(id);
    if (!prenotazione) return false;
    
    return dbRiattivaPrenotazione(id, prenotazione.qr_token);
  } catch (e) {
    console.error("Errore riattivazione: " + e.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// NUOVO: Toggle pasto admin
// ═══════════════════════════════════════════════════════════════

/**
 * Admin: Aggiunge o rimuove il pasto a una prenotazione esistente
 * Wrapper per dbAdminModificaPasto() in Database.gs
 */
function azioneTogglePasto(prenotazioneId, includePasto) {
  try {
    return dbAdminModificaPasto(prenotazioneId, includePasto);
  } catch (e) {
    console.error("Errore toggle pasto: " + e.message);
    return false;
  }
}

/**
 * Genera e invia il report CSV via email
 * ✅ MODIFICATO: aggiunta colonna Pasto nel CSV
 */
function homeInviaReport(eventoId, prNickname, emailDestino) {
  try {
    const prenotazioni = dbGetPrenotazioniLive(eventoId);
    
    let filtrati = (prNickname && prNickname !== "ALL") 
      ? prenotazioni.filter(p => p.pr_nickname === prNickname)
      : prenotazioni;

    if (filtrati.length === 0) return "Nessun dato da inviare.";

    // ═══════════════════════════════════════════════════════════════
    // CSV con colonna Pasto aggiunta
    // ═══════════════════════════════════════════════════════════════
    let csvString = "Nome;Cognome;Email;Evento;PR;Staff;Pasto;Stato;Check-in;Ora Ingresso\n";
    filtrati.forEach(p => {
      const stato = p.stato === 'ANNULLATA' ? 'Annullata' : (p.entrato ? 'Entrato' : 'In attesa');
      const checkin = p.entrato ? 'Sì' : 'No';
      const pasto = p.include_pasto ? 'Sì' : 'No';
      csvString += `${p.cliente_nome};` +
                   `${p.cliente_cognome || ''};` +
                   `${p.cliente_email};` +
                   `${p.codice_evento};` +
                   `${p.nickname_pr};` +
                   `${p.nickname_staff || 'N/A'};` +
                   `${pasto};` +
                   `${stato};` +
                   `${checkin};` +
                   `${p.ora_ingresso || ''}\n`;
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
