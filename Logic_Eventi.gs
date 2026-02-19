/**
 * Logic_Eventi.gs
 * Coordina le operazioni CRUD per la tabella eventi con logica di business.
 * ✅ TIMESTAMP ORA LOCALE: Date salvate in formato ora italiana
 */

/**
 * 1. Recupera la lista di tutti gli eventi
 */
function getListaEventi() {
  try {
    const eventi = dbGetAllEventi();
    
    // Per ogni evento, arricchiamo i dati con i conteggi reali
    return eventi.map(evt => {
      evt.conteggio = dbGetConteggioPrenotazioni(evt.id); 
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
      // TIMESTAMP ORA LOCALE: Formato per Supabase mantenendo ora italiana
      // ═══════════════════════════════════════════════════════════════
      fine_prenotazione: convertiDataLocalePerSupabase(payload.fine_prenotazione),
      inizio_checkin: convertiDataLocalePerSupabase(payload.inizio_checkin),
      fine_checkin: convertiDataLocalePerSupabase(payload.fine_checkin),
      
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
 * Converte datetime-local HTML in formato timestamp ora locale per Supabase
 * Input: "2026-02-19T09:03" (dal form HTML, ora locale)
 * Output: "2026-02-19 09:03:00" (formato Supabase, STESSA ora locale)
 * 
 * IMPORTANTE: Non converte in UTC, mantiene l'ora italiana
 */
function convertiDataLocalePerSupabase(dataHtml) {
  if (!dataHtml) return null;
  
  try {
    // Il form HTML restituisce: "2026-02-19T09:03"
    const data = new Date(dataHtml);
    
    // Verifica validità
    if (isNaN(data.getTime())) {
      Logger.log('⚠️ Data non valida: ' + dataHtml);
      return null;
    }
    
    // Estrai componenti in ora LOCALE (non UTC)
    const year = data.getFullYear();
    const month = String(data.getMonth() + 1).padStart(2, '0');
    const day = String(data.getDate()).padStart(2, '0');
    const hours = String(data.getHours()).padStart(2, '0');
    const minutes = String(data.getMinutes()).padStart(2, '0');
    const seconds = String(data.getSeconds()).padStart(2, '0');
    
    // Formato: "YYYY-MM-DD HH:MM:SS" (ora locale)
    const timestampLocale = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    
    // Debug (rimuovi se vuoi)
    Logger.log('Conversione: ' + dataHtml + ' → ' + timestampLocale + ' (ora locale)');
    
    return timestampLocale;
    
  } catch (e) {
    Logger.log('Errore conversione data: ' + e.message);
    return null;
  }
}

/**
 * 3. Elimina un evento con controllo di sicurezza (Safe Mode)
 */
function eliminaEvento(id, codice) {
  try {
    const haPrenotazioni = dbCheckPrenotazioniPerId(id);

    if (haPrenotazioni) {
      return { 
        success: false, 
        msg: "⛔ AZIONE BLOCCATA: Esistono prenotazioni attive per l'evento " + codice + ". Se vuoi nasconderlo, impostalo come 'NON ATTIVO' nella modifica." 
      };
    }

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
 * TEST: Verifica conversione timestamp ora locale
 */
function testConversioneTimestampLocale() {
  Logger.log("=== TEST CONVERSIONE ORA LOCALE ===");
  
  const test1 = "2026-02-19T09:03";
  const test2 = "2026-02-19T17:30";
  const test3 = "2026-02-20T00:15";
  
  Logger.log("Input 1: " + test1);
  Logger.log("Output: " + convertiDataLocalePerSupabase(test1));
  Logger.log("✅ Atteso: 2026-02-19 09:03:00");
  Logger.log("");
  
  Logger.log("Input 2: " + test2);
  Logger.log("Output: " + convertiDataLocalePerSupabase(test2));
  Logger.log("✅ Atteso: 2026-02-19 17:30:00");
  Logger.log("");
  
  Logger.log("Input 3: " + test3);
  Logger.log("Output: " + convertiDataLocalePerSupabase(test3));
  Logger.log("✅ Atteso: 2026-02-20 00:15:00");
  Logger.log("");
  
  Logger.log("===================================");
}

function TEST_SISTEMA_EVENTI() {
  Logger.log("--- INIZIO TEST EVENTI ---");
  
  const nuovoEvento = {
    codice_evento: "TEST_99",
    nome_evento: "Evento di Prova",
    data_evento: "2026-12-31",
    attivo: "true",
    max_partecipanti: 50
  };
  const resIns = salvaEvento(nuovoEvento);
  Logger.log("Inserimento: " + JSON.stringify(resIns));

  const lista = getListaEventi();
  Logger.log("Numero eventi in DB: " + lista.length);

  const eventoCreato = lista.find(e => e.codice_evento === "TEST_99");
  if(eventoCreato) {
    const resDel = eliminaEvento(eventoCreato.id, "TEST_99");
    Logger.log("Eliminazione: " + JSON.stringify(resDel));
  }
  
  Logger.log("--- FINE TEST ---");
}
