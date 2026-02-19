/**
 * Logic_Eventi.gs
 * Coordina le operazioni CRUD per la tabella eventi con logica di business.
 * ✅ FIX TIMEZONE: Converte date da ora locale a UTC prima di salvare
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
      
      // ═══════════════════════════════════════════════════════════════
      // FIX TIMEZONE: Converti da ora locale a UTC
      // ═══════════════════════════════════════════════════════════════
      fine_prenotazione: convertiDataLocaleInUTC(payload.fine_prenotazione),
      inizio_checkin: convertiDataLocaleInUTC(payload.inizio_checkin),
      fine_checkin: convertiDataLocaleInUTC(payload.fine_checkin),
      
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
 * NUOVA FUNZIONE HELPER: Converte data/ora locale in UTC
 * Input: "2026-02-19T09:03" (ora locale italiana, senza timezone)
 * Output: "2026-02-19T08:03:00.000Z" (UTC)
 */
function convertiDataLocaleInUTC(dataLocale) {
  if (!dataLocale) return null;
  
  try {
    // La data arriva dal form HTML nel formato: "2026-02-19T09:03"
    // Questo è interpretato come ORA LOCALE del browser (UTC+1 per l'Italia)
    
    // Creiamo un oggetto Date che interpreta la stringa come ora locale
    const dataLocal = new Date(dataLocale);
    
    // Verifichiamo che sia valida
    if (isNaN(dataLocal.getTime())) {
      Logger.log('⚠️ Data non valida: ' + dataLocale);
      return null;
    }
    
    // Convertiamo in ISO string (automaticamente UTC)
    const dataUTC = dataLocal.toISOString();
    
    // Per debug (rimuovi in produzione se vuoi)
    Logger.log('Conversione: ' + dataLocale + ' (locale) → ' + dataUTC + ' (UTC)');
    
    return dataUTC;
    
  } catch (e) {
    Logger.log('Errore conversione data: ' + e.message);
    return null;
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

/**
 * TEST: Verifica conversione timezone
 */
function testConversioneTimezone() {
  Logger.log("=== TEST CONVERSIONE TIMEZONE ===");
  
  const test1 = "2026-02-19T09:03";
  const test2 = "2026-02-19T17:30";
  const test3 = "2026-02-20T00:15";
  
  Logger.log("Input 1: " + test1);
  Logger.log("Output: " + convertiDataLocaleInUTC(test1));
  Logger.log("");
  
  Logger.log("Input 2: " + test2);
  Logger.log("Output: " + convertiDataLocaleInUTC(test2));
  Logger.log("");
  
  Logger.log("Input 3: " + test3);
  Logger.log("Output: " + convertiDataLocaleInUTC(test3));
  Logger.log("");
  
  Logger.log("=================================");
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
  const eventoCreato = lista.find(e => e.codice_evento === "TEST_99");
  if(eventoCreato) {
    const resDel = eliminaEvento(eventoCreato.id, "TEST_99");
    Logger.log("Eliminazione (senza prenotazioni): " + JSON.stringify(resDel));
  }
  
  Logger.log("--- FINE TEST ---");
}