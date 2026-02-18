/**
 * DATABASE.GS
 * Gestisce le comunicazioni con Supabase usando le costanti di config.gs
 */

// --- SEZIONE EVENTI ---

/** * 1. Recupera le informazioni di un evento specifico */
function dbGetEventoInfo(codiceEvento) {
  const url = SB_URL + "/rest/v1/eventi?codice_evento=eq." + encodeURIComponent(codiceEvento) + "&select=*";
  const res = UrlFetchApp.fetch(url, { 
    headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY }
  });
  const data = JSON.parse(res.getContentText());
  return data.length > 0 ? data[0] : null;
}

/** * 2. Recupera TUTTI gli eventi per la Dashboard */
function dbGetAllEventi() {
  const url = SB_URL + "/rest/v1/eventi?select=*&order=data_evento.asc";
  const res = UrlFetchApp.fetch(url, { 
    headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY }
  });
  return JSON.parse(res.getContentText());
}

/** * 3. Inserisce un nuovo evento dalla Dashboard */
function dbInsertEvento(record) {
  const options = {
    method: "post",
    contentType: "application/json",
    headers: { 
      "apikey": SB_KEY, 
      "Authorization": "Bearer " + SB_KEY, 
      "Prefer": "return=representation" 
    },
    payload: JSON.stringify(record)
  };
  const res = UrlFetchApp.fetch(SB_URL + "/rest/v1/eventi", options);
  const data = JSON.parse(res.getContentText());
  return data.length > 0 ? data[0] : null;
}

/** * 4. Aggiorna un evento esistente */
function dbUpdateEvento(id, record) {
  const options = {
    method: "patch",
    contentType: "application/json",
    headers: { 
      "apikey": SB_KEY, 
      "Authorization": "Bearer " + SB_KEY,
      "Prefer": "return=representation"
    },
    payload: JSON.stringify(record)
  };
  const url = SB_URL + "/rest/v1/eventi?id=eq." + id;
  const res = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(res.getContentText());
  return data.length > 0 ? data[0] : null;
}

/** * 5. Elimina fisicamente un evento dal database */
function dbDeleteEvento(id) {
  const options = {
    method: "delete",
    headers: { 
      "apikey": SB_KEY, 
      "Authorization": "Bearer " + SB_KEY 
    }
  };
  const url = SB_URL + "/rest/v1/eventi?id=eq." + id;
  const res = UrlFetchApp.fetch(url, options);
  return res.getResponseCode() === 204 || res.getResponseCode() === 200;
}

/** * NUOVA: Recupera info evento tramite UUID (ID interno) */
function dbGetEventoInfoById(id) {
  const url = SB_URL + "/rest/v1/eventi?id=eq." + id + "&select=*";
  const res = UrlFetchApp.fetch(url, { 
    headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY }
  });
  const data = JSON.parse(res.getContentText());
  return data.length > 0 ? data[0] : null;
}

// --- SEZIONE PRENOTAZIONI & CHECK-IN ---

/** * 6. Inserisce un nuovo record nella tabella prenotazioni */
function dbInsertPrenotazione(record) {
  const options = {
    method: "post",
    contentType: "application/json",
    headers: { 
      "apikey": SB_KEY, 
      "Authorization": "Bearer " + SB_KEY, 
      "Prefer": "return=representation" 
    },
    payload: JSON.stringify(record)
  };
  const res = UrlFetchApp.fetch(SB_URL + "/rest/v1/prenotazioni", options);
  const data = JSON.parse(res.getContentText());
  return data.length > 0 ? data[0] : null;
}

/** * 7. Cerca una prenotazione tramite il token */
function dbGetPrenotazioneDaToken(qrToken) {
  if (!qrToken) return null;
  try {
    const tokenPulito = qrToken.toString().trim();
    const url = SB_URL + "/rest/v1/prenotazioni?qr_token=eq." + encodeURIComponent(tokenPulito) + "&select=*";
    const options = {
      "method": "get",
      "headers": { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY },
      "muteHttpExceptions": true
    };
    const res = UrlFetchApp.fetch(url, options);
    if (res.getResponseCode() !== 200) return null;
    const data = JSON.parse(res.getContentText());
    return (data && data.length > 0) ? data[0] : null;
  } catch (e) {
    return null;
  }
}

/** * NUOVA: Recupera una singola prenotazione tramite ID (per reinvio QR) */
function dbGetPrenotazionePerId(id) {
  const url = SB_URL + "/rest/v1/prenotazioni?id=eq." + id + "&select=*";
  const res = UrlFetchApp.fetch(url, { 
    headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY }
  });
  const data = JSON.parse(res.getContentText());
  return data.length > 0 ? data[0] : null;
}

 /* Annulla prenotazione LOGICAMENTE (non cancella dal database)
 */
function dbDeletePrenotazione(id) {
  Logger.log('⚠️ dbDeletePrenotazione deprecata, uso annullamento logico');
  return dbAnnullaPrenotazione(id, 'ADMIN');
}
/**
 * NUOVA FUNZIONE - Annulla prenotazione logicamente
 * Aggiungi DOPO dbDeletePrenotazione
 */
function dbAnnullaPrenotazione(id, origine = 'ADMIN') {
  try {
    const url = SB_URL + '/rest/v1/prenotazioni?id=eq.' + id;
    
    const options = {
      method: 'patch',
      contentType: 'application/json',
      headers: {
        "apikey": SB_KEY,
        "Authorization": "Bearer " + SB_KEY
      },
      payload: JSON.stringify({
        stato: 'ANNULLATA',
        annullata_il: new Date().toISOString(),
        annullata_da: origine
      })
    };
    
    const res = UrlFetchApp.fetch(url, options);
    return res.getResponseCode() === 204 || res.getResponseCode() === 200;
    
  } catch (e) {
    Logger.log('Errore dbAnnullaPrenotazione: ' + e.message);
    return false;
  }
}

/**
 * NUOVA FUNZIONE - Riattiva prenotazione annullata
 * Aggiungi DOPO dbAnnullaPrenotazione
 */
function dbRiattivaPrenotazione(id, nuovoQrToken) {
  try {
    const url = SB_URL + '/rest/v1/prenotazioni?id=eq.' + id;
    
    const options = {
      method: 'patch',
      contentType: 'application/json',
      headers: {
        "apikey": SB_KEY,
        "Authorization": "Bearer " + SB_KEY
      },
      payload: JSON.stringify({
        stato: 'ATTIVA',
        qr_token: nuovoQrToken,
        riattivata_il: new Date().toISOString(),
        annullata_il: null,
        annullata_da: null
      })
    };
    
    const res = UrlFetchApp.fetch(url, options);
    return res.getResponseCode() === 204 || res.getResponseCode() === 200;
    
  } catch (e) {
    Logger.log('Errore dbRiattivaPrenotazione: ' + e.message);
    return false;
  }
}

/**
 * NUOVA FUNZIONE - Recupera prenotazione per email e evento
 * Aggiungi DOPO dbRiattivaPrenotazione
 */
function dbGetPrenotazionePerEmailEvento(email, eventoId) {
  try {
    const url = SB_URL + '/rest/v1/prenotazioni?cliente_email=eq.' + 
                encodeURIComponent(email) + 
                '&evento_id=eq.' + eventoId + 
                '&select=*';
    
    const res = UrlFetchApp.fetch(url, {
      headers: {
        "apikey": SB_KEY,
        "Authorization": "Bearer " + SB_KEY
      }
    });
    
    const data = JSON.parse(res.getContentText());
    return data.length > 0 ? data[0] : null;
    
  } catch (e) {
    Logger.log('Errore dbGetPrenotazionePerEmailEvento: ' + e.message);
    return null;
  }
}

/**
 * NUOVA FUNZIONE - Recupera prenotazione da cancel token
 * Aggiungi DOPO dbGetPrenotazionePerEmailEvento
 */
function dbGetPrenotazioneDaCancelToken(cancelToken) {
  if (!cancelToken) return null;
  
  try {
    const url = SB_URL + '/rest/v1/prenotazioni?cancel_token=eq.' + 
                encodeURIComponent(cancelToken) + '&select=*';
    
    const res = UrlFetchApp.fetch(url, {
      headers: { 
        "apikey": SB_KEY, 
        "Authorization": "Bearer " + SB_KEY 
      }
    });
    
    const data = JSON.parse(res.getContentText());
    return data.length > 0 ? data[0] : null;
    
  } catch (e) {
    Logger.log('Errore dbGetPrenotazioneDaCancelToken: ' + e.message);
    return null;
  }
}

/** * 8. Aggiorna il record segnando l'ingresso effettuato */
function dbUpdateIngresso(id, dataIngressoISO, staffId) {
  const options = {
    method: "patch",
    contentType: "application/json",
    headers: { 
      "apikey": SB_KEY, 
      "Authorization": "Bearer " + SB_KEY,
      "Prefer": "return=minimal"
    },
    payload: JSON.stringify({ 
      entrato: true, 
      ora_ingresso: dataIngressoISO,
      scansionato_da: staffId 
    })
  };
  const url = SB_URL + "/rest/v1/prenotazioni?id=eq." + id;
  const res = UrlFetchApp.fetch(url, options);
  return res.getResponseCode() === 204 || res.getResponseCode() === 200;
}

// --- SEZIONE ANAGRAFICHE (PR & STAFF) ---

/** * 9. Inserisce o aggiorna un PR nell'anagrafica */
function dbUpsertPR(record) {
  const options = {
    method: "post",
    contentType: "application/json",
    headers: { 
      "apikey": SB_KEY, 
      "Authorization": "Bearer " + SB_KEY, 
      "Prefer": "resolution=merge-duplicates" 
    },
    payload: JSON.stringify(record)
  };
  const res = UrlFetchApp.fetch(SB_URL + "/rest/v1/pr", options);
  const data = JSON.parse(res.getContentText());
  return data.length > 0 ? data[0] : null;
}

/** * 10. Inserisce o aggiorna un membro dello STAFF nell'anagrafica */
function dbUpsertStaff(record) {
  const options = {
    method: "post",
    contentType: "application/json",
    headers: { 
      "apikey": SB_KEY, 
      "Authorization": "Bearer " + SB_KEY, 
      "Prefer": "resolution=merge-duplicates"
    },
    payload: JSON.stringify(record)
  };
  const res = UrlFetchApp.fetch(SB_URL + "/rest/v1/staff", options);
  const data = JSON.parse(res.getContentText());
  return data.length > 0 ? data[0] : null;
}

// --- SEZIONE UTILITY & DEBUG ---

function dbCheckPrenotazioniPerId(eventoIdUUID) {
  const url = SB_URL + "/rest/v1/prenotazioni?evento_id=eq." + encodeURIComponent(eventoIdUUID) + "&select=id&limit=1";
  const res = UrlFetchApp.fetch(url, { 
    headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY }
  });
  const data = JSON.parse(res.getContentText());
  return data.length > 0;
}

/**
 * MODIFICA FUNZIONE ESISTENTE - dbGetConteggioPrenotazioni
 * Trova questa funzione (circa riga 215) e SOSTITUISCI con questa versione
 * che conta SOLO le prenotazioni ATTIVE (esclude annullate)
 */
function dbGetConteggioPrenotazioni(eventoId) {
  const url = SB_URL + 
              '/rest/v1/prenotazioni?evento_id=eq.' + eventoId + 
              '&stato=eq.ATTIVA' +  // ← MODIFICATO: conta solo ATTIVE
              '&select=id';
  
  const res = UrlFetchApp.fetch(url, {
    headers: {
      "apikey": SB_KEY,
      "Authorization": "Bearer " + SB_KEY,
      "Prefer": "count=exact"
    }
  });
  
  return JSON.parse(res.getContentText()).length;
}

/**
 * MODIFICA FUNZIONE ESISTENTE - dbVerificaEmailEsistente
 * Trova questa funzione (circa riga 235) e SOSTITUISCI
 * Deve verificare solo tra le prenotazioni ATTIVE
 */
function dbVerificaEmailEsistente(email, eventoId) {
  const emailSicura = encodeURIComponent(email.trim());
  const url = SB_URL + '/rest/v1/prenotazioni?cliente_email=eq.' + emailSicura + 
              '&evento_id=eq.' + eventoId + 
              '&stato=eq.ATTIVA' +  // ← MODIFICATO: verifica solo ATTIVE
              '&select=id';
  const res = UrlFetchApp.fetch(url, { 
    headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY }
  });
  return JSON.parse(res.getContentText()).length > 0;
}

function dbGetStaffIdByNickname(nickname) {
  if (!nickname) return null;
  const url = SB_URL + "/rest/v1/staff?nickname=eq." + encodeURIComponent(nickname) + "&select=id";
  const res = UrlFetchApp.fetch(url, { 
    headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY }
  });
  const data = JSON.parse(res.getContentText());
  return data.length > 0 ? data[0].id : null;
}

function dbGetLogoUrl() {
  const PROJECT_ID = "dzqhjifxtgeynsqlxahw";
  const BUCKET = "LOGO";
  const FILE_NAME = "Logo.png";
  return `https://${PROJECT_ID}.supabase.co/storage/v1/object/public/${BUCKET}/${FILE_NAME}`;
}

/**
 * MODIFICA FUNZIONE ESISTENTE - dbGetConteggioCheckin
 * Trova questa funzione (circa riga 281) e SOSTITUISCI con questa versione
 */
function dbGetConteggioCheckin(eventoId) {
  const url = SB_URL + '/rest/v1/prenotazioni?evento_id=eq.' + eventoId + 
              '&entrato=eq.true' +
              '&stato=eq.ATTIVA' +  // ← MODIFICATO: conta solo ATTIVE
              '&select=id';
  const res = UrlFetchApp.fetch(url, { 
    headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY }
  });
  return JSON.parse(res.getContentText()).length;
}

function dbGetAllPR() {
  const url = SB_URL + "/rest/v1/pr?select=*&order=nickname.asc";
  const options = {
    method: "get",
    headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY }
  };
  const response = UrlFetchApp.fetch(url, options);
  return JSON.parse(response.getContentText());
}

function dbInsertPR(record) {
  const url = SB_URL + "/rest/v1/pr";
  const options = {
    method: "post",
    contentType: "application/json",
    headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY, "Prefer": "return=representation" },
    payload: JSON.stringify(record)
  };
  const response = UrlFetchApp.fetch(url, options);
  return response.getResponseCode() === 201 || response.getResponseCode() === 200;
}

function dbUpdatePR(id, record) {
  const url = SB_URL + "/rest/v1/pr?id=eq." + id;
  const options = {
    method: "patch",
    contentType: "application/json",
    headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY },
    payload: JSON.stringify(record)
  };
  const response = UrlFetchApp.fetch(url, options);
  return response.getResponseCode() === 204 || response.getResponseCode() === 200;
}

function dbGetAllStaff() {
  const url = SB_URL + "/rest/v1/staff?select=*&order=nickname.asc";
  const res = UrlFetchApp.fetch(url, {
    headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY }
  });
  return JSON.parse(res.getContentText());
}

function dbInsertStaff(record) {
  const options = {
    method: "post",
    contentType: "application/json",
    headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY, "Prefer": "return=representation" },
    payload: JSON.stringify(record)
  };
  const res = UrlFetchApp.fetch(SB_URL + "/rest/v1/staff", options);
  return res.getResponseCode() === 201 || res.getResponseCode() === 200;
}

function dbUpdateStaff(id, record) {
  const options = {
    method: "patch",
    contentType: "application/json",
    headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY },
    payload: JSON.stringify(record)
  };
  const url = SB_URL + "/rest/v1/staff?id=eq." + id;
  const res = UrlFetchApp.fetch(url, options);
  return res.getResponseCode() === 204 || res.getResponseCode() === 200;
}

function dbGetProssimoEvento() {
  const oggi = new Date().toISOString().split('T')[0];
  const url = `${SB_URL}/rest/v1/eventi?data_evento=gte.${oggi}&order=data_evento.asc&limit=1`;
  const options = {
    "method": "get",
    "headers": { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY }
  };
  try {
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    return data.length > 0 ? data[0] : null;
  } catch (e) {
    return null;
  }
}

function getDashboardIniziale() {
  const data = {
    prossimoEvento: dbGetProssimoEvento(),
    totalePR: 0,
    totaleStaff: 0,
    eventiAttivi: []
  };
  const eventi = dbGetAllEventi();
  const pr = dbGetAllPR();
  const staff = dbGetAllStaff();
  data.eventiAttivi = eventi;
  data.totalePR = pr.length;
  data.totaleStaff = staff.length;
  return data;
}

function dbGetStatisticheRapide(eventoId) {
  return {
    totale: dbGetConteggioPrenotazioni(eventoId),
    entrati: dbGetConteggioCheckin(eventoId)
  };
}

function dbSaveLink(record) {
  const options = {
    method: "post",
    contentType: "application/json",
    headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY, "Prefer": "return=minimal" },
    payload: JSON.stringify(record)
  };
  try {
    UrlFetchApp.fetch(SB_URL + "/rest/v1/link_archiviati", options);
    return true;
  } catch (e) {
    return false;
  }
}

function dbGetArchivioLinks() {
  const query = "select=*,eventi(nome_evento),pr(nickname),staff(nickname)&order=created_at.desc&limit=15";
  const url = SB_URL + "/rest/v1/link_archiviati?" + query;
  const options = {
    method: "get",
    headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY }
  };
  try {
    const response = UrlFetchApp.fetch(url, options);
    return JSON.parse(response.getContentText());
  } catch (e) {
    return [];
  }
}

function getAppUrl() {
  const NETLIFY_URL = "https://comfy-tartufo-500ca9.netlify.app";
  return NETLIFY_URL;
}

function generateAppLink(page, params = {}) {
  const baseUrl = getAppUrl();
  const allParams = { page, ...params };
  const queryString = Object.keys(allParams)
    .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(allParams[key]))
    .join('&');
  return baseUrl + '/?' + queryString;
}

function dbGetPrIdByNickname(nickname) {
  if (!nickname || nickname === "Staff") return null;
  const url = SB_URL + "/rest/v1/pr?nickname=eq." + encodeURIComponent(nickname) + "&select=id";
  try {
    const res = UrlFetchApp.fetch(url, { headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY } });
    const data = JSON.parse(res.getContentText());
    return data.length > 0 ? data[0].id : null;
  } catch (e) {
    return null;
  }
}

function dbGetEventoIdByCodice(codice) {
  if (!codice) return null;
  const url = SB_URL + "/rest/v1/eventi?codice_evento=eq." + encodeURIComponent(codice) + "&select=id";
  try {
    const res = UrlFetchApp.fetch(url, { headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY } });
    const data = JSON.parse(res.getContentText());
    return data.length > 0 ? data[0].id : null;
  } catch (e) {
    return null;
  }
}

/**
 * MODIFICA FUNZIONE ESISTENTE - dbGetPrenotazioniLive
 * Trova questa funzione (circa riga 470) e SOSTITUISCI completamente
 */
function dbGetPrenotazioniLive(eventoId) {
  if (!eventoId) return [];
  
  // ← MODIFICATO: aggiunto filtro &stato=neq.ANNULLATA
  const query = "select=*,pr(nickname)";
  const url = SB_URL + "/rest/v1/prenotazioni?evento_id=eq." + eventoId + 
              "&stato=neq.ANNULLATA" +  // Esclude annullate
              "&" + query;
  
  const options = {
    "method": "get",
    "headers": { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY },
    "muteHttpExceptions": true
  };

  try {
    const res = UrlFetchApp.fetch(url, options);
    if (res.getResponseCode() !== 200) return [];
    
    const data = JSON.parse(res.getContentText());
    
    return data.map(p => ({
      id: p.id,
      created_at: p.created_at,
      cliente_nome: p.cliente_nome,
      cliente_cognome: p.cliente_cognome || "",
      cliente_email: p.cliente_email || "",
      qr_token: p.qr_token,
      evento_id: p.evento_id,
      pr_nickname: (p.pr && p.pr.nickname) ? p.pr.nickname : "Generico",
      entrato: p.entrato === true || String(p.entrato) === "true"
    }));
  } catch (e) {
    console.error("Errore dbGetPrenotazioniLive: " + e.message);
    return [];
  }
}
/**
 * Verifica le credenziali dello Staff per il Login
 * Coerente con lo stile del resto del database.gs
 */
function dbGetStaffByLogin(nickname, pin) {
  try {
    // 1. Costruiamo l'URL seguendo il tuo standard
    const url = SB_URL + "/rest/v1/staff?nickname=eq." + encodeURIComponent(nickname) + 
                "&codice_pin=eq." + encodeURIComponent(pin) + "&select=*";
    
    // 2. Eseguiamo la chiamata diretta come nelle tue altre funzioni
    const res = UrlFetchApp.fetch(url, { 
      headers: { 
        "apikey": SB_KEY, 
        "Authorization": "Bearer " + SB_KEY 
      },
      "muteHttpExceptions": true 
    });
    
    // 3. Verifichiamo la risposta
    if (res.getResponseCode() !== 200) {
      console.error("Errore risposta Supabase: " + res.getContentText());
      return null;
    }
    
    const data = JSON.parse(res.getContentText());
    
    // 4. Se trova un record, restituisce lo staff, altrimenti null
    return (data && data.length > 0) ? data[0] : null;

  } catch (e) {
    console.error("Errore dentro dbGetStaffByLogin: " + e.message);
    throw e; 
  }
}
function testGenerateAppLink() {
  Logger.log('=== TEST LINK GENERATION ===');
  
  const linkRegistrazione = generateAppLink('registrazione', {
    evento: 'LOCA2',
    pr: 'BuenaHola'
  });
  Logger.log('Registrazione: ' + linkRegistrazione);
  
  const linkScanner = generateAppLink('scanner', {
    evento: 'LOCA2',
    staff: 'Nena1'
  });
  Logger.log('Scanner: ' + linkScanner);
  
  Logger.log('Base URL: ' + getAppUrl());
}