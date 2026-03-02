/**
 * Logic_Eventi.gs
 * Coordina le operazioni CRUD per la tabella eventi con logica di business.
 * ✅ TIMESTAMP ORA LOCALE: Date salvate in formato ora italiana
 * ✅ INTEGRAZIONE PASTO: Gestisce campi pranzo/cena
 * ✅ CONTEGGI SEPARATI: party vs pasto per card dashboard
 */

/**
 * 1. Recupera la lista di tutti gli eventi
 * MODIFICATO: aggiunge conteggio_party e conteggio_pasto per eventi con pasto
 */
function getListaEventi() {
  try {
    const eventi = dbGetAllEventi();
    
    return eventi.map(evt => {
      // *** OLD: invariato ***
      evt.conteggio = dbGetConteggioPrenotazioni(evt.id); 
      evt.checkin_effettuati = dbGetConteggioCheckin(evt.id);
      
      // ═══════════════════════════════════════════════════════════════
      // NUOVO: conteggi separati party/pasto
      // Per SOLO_DANZA: party = tutto, pasto = 0
      // Per eventi con pasto: usa dbGetStatistichePostiLive()
      // ═══════════════════════════════════════════════════════════════
      if (evt.tipo_evento && evt.tipo_evento !== 'SOLO_DANZA') {
        const stats = dbGetStatistichePostiLive(evt.id);
        evt.conteggio_party = stats.soloDanza || 0;
        evt.conteggio_pasto = stats.conPasto || 0;
      } else {
        evt.conteggio_party = evt.conteggio;
        evt.conteggio_pasto = 0;
      }
      
      return evt;
    });
  } catch (e) {
    Logger.log("Errore in getListaEventi: " + e.toString());
    return [];
  }
}

/**
 * 2. Gestisce il salvataggio (Nuovo o Modifica)
 * *** OLD: invariato ***
 */
function salvaEvento(payload) {
  try {
    const record = {
      codice_evento: payload.codice_evento.trim().toUpperCase(),
      nome_evento: payload.nome_evento,
      data_evento: payload.data_evento,
      attivo: payload.attivo === "true" || payload.attivo === true,
      max_partecipanti: parseInt(payload.max_partecipanti) || 0,
      
      fine_prenotazione: convertiDataLocalePerSupabase(payload.fine_prenotazione),
      inizio_checkin: convertiDataLocalePerSupabase(payload.inizio_checkin),
      fine_checkin: convertiDataLocalePerSupabase(payload.fine_checkin),
      
      descrizione: payload.descrizione || "",
      
      tipo_evento: payload.tipo_evento || 'SOLO_DANZA',
      pasto_obbligatorio: payload.pasto_obbligatorio === "true" || payload.pasto_obbligatorio === true,
      prezzo_solo_danza: payload.prezzo_solo_danza ? parseFloat(payload.prezzo_solo_danza) : null,
      prezzo_con_pasto: payload.prezzo_con_pasto ? parseFloat(payload.prezzo_con_pasto) : null,
      visualizza_prezzo_danza: payload.visualizza_prezzo_danza === "true" || payload.visualizza_prezzo_danza === true,
      max_partecipanti_pasto: payload.max_partecipanti_pasto ? parseInt(payload.max_partecipanti_pasto) : null,
      
      fine_prenotazione_pasto: convertiDataLocalePerSupabase(payload.fine_prenotazione_pasto),
      inizio_checkin_pasto: convertiDataLocalePerSupabase(payload.inizio_checkin_pasto),
      fine_checkin_pasto: convertiDataLocalePerSupabase(payload.fine_checkin_pasto),
      
      messaggio_post_registrazione: payload.messaggio_post_registrazione || null,
      messaggio_prezzo_danza: payload.messaggio_prezzo_danza || null
    };

    let result;
    
    if (payload.id) {
      result = dbUpdateEvento(payload.id, record);
    } else {
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
 * *** OLD: invariato ***
 */
function convertiDataLocalePerSupabase(dataHtml) {
  if (!dataHtml) return null;
  
  try {
    const data = new Date(dataHtml);
    
    if (isNaN(data.getTime())) {
      Logger.log('⚠️ Data non valida: ' + dataHtml);
      return null;
    }
    
    const year = data.getFullYear();
    const month = String(data.getMonth() + 1).padStart(2, '0');
    const day = String(data.getDate()).padStart(2, '0');
    const hours = String(data.getHours()).padStart(2, '0');
    const minutes = String(data.getMinutes()).padStart(2, '0');
    const seconds = String(data.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    
  } catch (e) {
    Logger.log('Errore conversione data: ' + e.message);
    return null;
  }
}

/**
 * 3. Elimina un evento con controllo di sicurezza (Safe Mode)
 * *** OLD: invariato ***
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
 * *** OLD: invariato ***
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

/**
 * TEST: Verifica salvataggio evento con pasto
 * *** OLD: invariato ***
 */
function testSalvaEventoConPasto() {
  Logger.log("=== TEST SALVATAGGIO EVENTO CON PASTO ===");
  
  const eventoTest = {
    codice_evento: "TEST-PRANZO",
    nome_evento: "Test Evento Pranzo",
    data_evento: "2026-04-15",
    attivo: true,
    max_partecipanti: 100,
    fine_prenotazione: "2026-04-14T22:00",
    inizio_checkin: "2026-04-15T11:00",
    fine_checkin: "2026-04-15T18:00",
    
    tipo_evento: "CON_PRANZO",
    pasto_obbligatorio: false,
    prezzo_solo_danza: 20.00,
    prezzo_con_pasto: 50.00,
    visualizza_prezzo_danza: true,
    max_partecipanti_pasto: 80,
    fine_prenotazione_pasto: "2026-04-13T20:00",
    inizio_checkin_pasto: "2026-04-15T12:00",
    fine_checkin_pasto: "2026-04-15T14:00",
    messaggio_post_registrazione: "Porta documento valido",
    messaggio_prezzo_danza: "Gratis ragazze fino 23:00"
  };
  
  const risultato = salvaEvento(eventoTest);
  Logger.log("Risultato: " + JSON.stringify(risultato));
  
  if (risultato.success) {
    Logger.log("✅ Evento salvato correttamente!");
    Logger.log("Verifica nel database che tutti i campi siano presenti");
  } else {
    Logger.log("❌ Errore: " + risultato.msg);
  }
  
  Logger.log("==========================================");
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
