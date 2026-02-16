/**
 * Logic_Eventi.gs
 * Coordina le operazioni CRUD per la tabella eventi con logica di business.
 */

/**
 * 1. Recupera la lista di tutti gli eventi
 */
function getListaEventi() {
  try {
    const eventi = dbGetAllEventi();
    
    // Per ogni evento, arricchiamo i dati con i conteggi reali
    return eventi.map(evt => {
      // Usiamo le utility che abbiamo già nel Database.gs
      evt.conteggio = dbGetConteggioPrenotazioni(evt.id); 
      
      // Aggiungiamo il conteggio dei check-in effettuati
      evt.checkin_effettuati = dbGetConteggioCheckin(evt.id);
      
      return evt;
    });
  } catch (e) {
    Logger.log("Errore in getListaEventi: " + e.toString());
    return [];
  }
}

/**
 * 2. Gestisce il salvataggio (Nuovo o Modifica)
 * @param {Object} payload - Dati provenienti dal form HTML
 */
function salvaEvento(payload) {
  try {
    // Prepariamo l'oggetto pulito per Supabase
    const record = {
      codice_evento: payload.codice_evento.trim().toUpperCase(),
      nome_evento: payload.nome_evento,
      data_evento: payload.data_evento,
      attivo: payload.attivo === "true" || payload.attivo === true,
      max_partecipanti: parseInt(payload.max_partecipanti) || 0,
      fine_prenotazione: payload.fine_prenotazione || null,
      inizio_checkin: payload.inizio_checkin || null,
      fine_checkin: payload.fine_checkin || null,
      descrizione: payload.descrizione || ""
    };

    let result;
    
    if (payload.id) {
      // Caso: MODIFICA
      result = dbUpdateEvento(payload.id, record);
    } else {
      // Caso: NUOVO
      result = dbInsertEvento(record);
    }

    if (result) {
      return { success: true, msg: "Evento salvato con successo!" };
    } else {
      return { success: false, msg: "Errore durante il salvataggio nel database." };
    }
    
  } catch (e) {
    console.error("Errore in salvaEvento: ", e);
    return { success: false, msg: "Errore di sistema: " + e.toString() };
  }
}

/**
 * 3. Elimina un evento con controllo di sicurezza (Safe Mode)
 * @param {string} id - UUID dell'evento
 * @param {string} codice - Codice testuale (es. SERATA_01)
 */
function eliminaEvento(id, codice) {
  try {
    // STEP 1: Controllo orfani (Safe Mode)
    // Usiamo la funzione utility che abbiamo aggiunto in Database.gs
    const haPrenotazioni = dbCheckPrenotazioniPerId(id);

    if (haPrenotazioni) {
      return { 
        success: false, 
        msg: "⛔ AZIONE BLOCCATA: Esistono prenotazioni attive per l'evento " + codice + ". Se vuoi nasconderlo, impostalo come 'NON ATTIVO' nella modifica." 
      };
    }

    // STEP 2: Se non ci sono prenotazioni, eliminiamo fisicamente
    const esito = dbDeleteEvento(id);
    
    if (esito) {
      return { success: true, msg: "Evento eliminato definitivamente." };
    } else {
      return { success: false, msg: "Errore durante l'eliminazione." };
    }

  } catch (e) {
    console.error("Errore in eliminaEvento: ", e);
    return { success: false, msg: "Errore critico durante l'eliminazione." };
  }
}
function TEST_SISTEMA_EVENTI() {
  Logger.log("--- INIZIO TEST EVENTI ---");
  
  // 1. Test Inserimento
  const nuovoEvento = {
    codice_evento: "TEST_99",
    nome_evento: "Evento di Prova",
    data_evento: "2026-12-31",
    attivo: "true",
    max_partecipanti: 50
  };
  const resIns = salvaEvento(nuovoEvento);
  Logger.log("Inserimento: " + JSON.stringify(resIns));

  // 2. Test Lettura
  const lista = getListaEventi();
  Logger.log("Numero eventi in DB: " + lista.length);

  // 3. Test Safe Mode (Eliminazione)
  // Cerchiamo l'ID dell'evento appena creato
  const eventoCreato = lista.find(e => e.codice_evento === "TEST_99");
  if(eventoCreato) {
    const resDel = eliminaEvento(eventoCreato.id, "TEST_99");
    Logger.log("Eliminazione (senza prenotazioni): " + JSON.stringify(resDel));
  }
  
  Logger.log("--- FINE TEST ---");
}