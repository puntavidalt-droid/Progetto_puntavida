/**
 * Logic_PR.gs
 * Gestisce la logica di business per l'anagrafica dei PR
 */

/**
 * Recupera la lista PR
 */
function getListaPR() {
  try {
    const listaPr = dbGetAllPR();
    
    // Filtriamo o arricchiamo i dati se necessario
    // Assicuriamoci che restituisca un array vuoto invece di null se la tabella è vuota
    return listaPr || [];
  } catch (e) {
    console.error("Errore in getListaPR: " + e.message);
    return [];
  }
}

/**
 * Salva o aggiorna un PR
 * Il payload arriva dal form nel file gestione_pr.html
 */
function salvaPR(payload) {
  try {
    // Prepariamo il record mappando correttamente i campi per Supabase
    const record = {
      nickname: payload.nickname.trim(),
      nome_reale: payload.nome_reale,
      cognome: payload.cognome,
      email: payload.email,     // <--- MODIFICA: Campo email aggiunto
      cellulare: payload.cellulare,
      attivo: payload.attivo === "true" || payload.attivo === true
    };

    if (payload.id) {
      // Caso AGGIORNAMENTO
      const esito = dbUpdatePR(payload.id, record);
      return { success: esito, msg: esito ? "PR aggiornato correttamente" : "Errore durante l'aggiornamento" };
    } else {
      // Caso NUOVO INSERIMENTO
      const esito = dbInsertPR(record);
      return { success: esito, msg: esito ? "Nuovo PR inserito" : "Errore durante l'inserimento" };
    }
  } catch (e) {
    return { success: false, msg: "Errore lato server: " + e.message };
  }
}

/**
 * TEST SISTEMA PR
 * Eseguire questa funzione dall'editor per verificare se il database risponde
 */
function TEST_SISTEMA_PR() {
  Logger.log("--- INIZIO TEST PR ---");
  
  try {
    // 1. Test Inserimento (con email di prova)
    const nuovoPR = {
      nickname: "TEST_PR_" + Math.floor(Math.random() * 100),
      nome_reale: "Mario",
      cognome: "Rossi",
      email: "mario.test@example.com",
      cellulare: "3331234567",
      attivo: true
    };
    
    Logger.log("Provando inserimento PR...");
    const resIns = salvaPR(nuovoPR);
    Logger.log("Risultato Inserimento: " + JSON.stringify(resIns));

    // 2. Test Lettura
    Logger.log("Provando lettura lista PR...");
    const lista = getListaPR();
    Logger.log("Numero PR trovati nel DB: " + (lista ? lista.length : "ERRORE"));
    
    if (lista && lista.length > 0) {
      Logger.log("Dati ultimo PR caricato: " + JSON.stringify(lista[lista.length - 1]));
    }

  } catch (e) {
    Logger.log("ERRORE CRITICO DURANTE IL TEST: " + e.toString());
  }
  
  Logger.log("--- FINE TEST PR ---");
}