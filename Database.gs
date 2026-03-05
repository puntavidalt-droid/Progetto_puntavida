/**
 * DATABASE.GS
 * Gestisce le comunicazioni con Supabase usando le costanti di config.gs
 * ✅ TIMESTAMP SEMPRE IN ORA LOCALE ITALIANA
 */

// ═══════════════════════════════════════════════════════════════
// HELPER TIMESTAMP - ORA LOCALE ITALIANA
// ═══════════════════════════════════════════════════════════════

/**
 * Restituisce timestamp in formato ora locale italiana
 * Formato: "2026-02-19 10:30:45" (YYYY-MM-DD HH:MM:SS)
 * IMPORTANTE: Questo sarà l'UNICO formato usato per salvare timestamp
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
 * Annulla prenotazione logicamente
 * ✅ CORRETTO: Usa timestamp ora locale + pulisce riattivata_il
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
        annullata_il: getTimestampLocale(),  // ← CORRETTO: ora locale
        annullata_da: origine,
        riattivata_il: null  // ← CORRETTO: pulisce timestamp vecchio
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
 * Riattiva prenotazione annullata
 * ✅ CORRETTO: Usa timestamp ora locale + pulisce annullata_il/da
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
        riattivata_il: getTimestampLocale(),  // ← CORRETTO: ora locale
        annullata_il: null,                    // ← CORRETTO: pulisce timestamp vecchio
        annullata_da: null                     // ← CORRETTO: pulisce origine vecchia
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
 * Recupera prenotazione per email e evento
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
 * Recupera prenotazione da cancel token
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

/**
 * Aggiorna il record segnando l'ingresso effettuato
 * ⚠️ NOTA: Riceve dataIngressoISO da Logic_Scanner.gs
 * Logic_Scanner.gs deve essere aggiornato per passare timestamp locale
 */
function dbUpdateIngresso(id, dataIngressoLocale, staffId) {
  // Recupera nickname staff da UUID
  let nicknameStaff = null;
  
  if (staffId && staffId !== 'DASHBOARD_MANUAL') {
    const staff = dbGetStaffById(staffId);
    nicknameStaff = staff ? staff.nickname : null;
  } else if (staffId === 'DASHBOARD_MANUAL') {
    nicknameStaff = 'DASHBOARD_MANUAL';
  }
  
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
      ora_ingresso: dataIngressoLocale,
      scansionato_da: staffId,
      nickname_staff: nicknameStaff,  // ← NUOVO
      stato: 'ATTIVA'
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
 * Conta prenotazioni ATTIVE (esclude annullate)
 */
function dbGetConteggioPrenotazioni(eventoId) {
  const url = SB_URL + 
              '/rest/v1/prenotazioni?evento_id=eq.' + eventoId + 
              '&stato=eq.ATTIVA' +
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
 * Verifica email esistente tra prenotazioni ATTIVE
 */
function dbVerificaEmailEsistente(email, eventoId) {
  const emailSicura = encodeURIComponent(email.trim());
  const url = SB_URL + '/rest/v1/prenotazioni?cliente_email=eq.' + emailSicura + 
              '&evento_id=eq.' + eventoId + 
              '&stato=eq.ATTIVA' +
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
 * Conta check-in effettuati (solo ATTIVE)
 */
function dbGetConteggioCheckin(eventoId) {
  const url = SB_URL + '/rest/v1/prenotazioni?evento_id=eq.' + eventoId + 
              '&entrato=eq.true' +
              '&stato=eq.ATTIVA' +
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
  const oggi = new Date().toISOString().split('T')[0];  // ← Questo è OK, serve solo data
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

// MODIFICATO: legge URL da Config_Secure.gs (non più hardcoded)
function getAppUrl() {
  return getConfig().NETLIFY_URL;
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
 * Recupera prenotazioni live per evento
 * Include campo stato
 */
function dbGetPrenotazioniLive(eventoId) {
  if (!eventoId) return [];
  
  const query = "select=*,pr(nickname)";
  const url = SB_URL + "/rest/v1/prenotazioni?evento_id=eq." + eventoId + "&" + query;
  
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
      pr_id: p.pr_id || null,
      entrato: p.entrato === true || String(p.entrato) === "true",
      stato: p.stato || 'ATTIVA',
      ora_ingresso: p.ora_ingresso || null,  // ← AGGIUNGI QUESTA
            // ← AGGIUNGI QUESTE 3 RIGHE
      codice_evento: p.codice_evento || 'N/A',
      nickname_pr: p.nickname_pr || ((p.pr && p.pr.nickname) ? p.pr.nickname : 'Generico'),
      nickname_staff: p.nickname_staff || null ,
      // Dentro il return map, dopo nickname_staff:
      include_pasto: p.include_pasto || false,  // ← AGGIUNGI QUESTA RIGA
    }));
  } catch (e) {
    console.error("Errore dbGetPrenotazioniLive: " + e.message);
    return [];
  }
}

/**
 * Verifica le credenziali dello Staff per il Login
 */
function dbGetStaffByLogin(nickname, pin) {
  try {
    const url = SB_URL + "/rest/v1/staff?nickname=eq." + encodeURIComponent(nickname) + 
                "&codice_pin=eq." + encodeURIComponent(pin) + "&select=*";
    
    const res = UrlFetchApp.fetch(url, { 
      headers: { 
        "apikey": SB_KEY, 
        "Authorization": "Bearer " + SB_KEY 
      },
      "muteHttpExceptions": true 
    });
    
    if (res.getResponseCode() !== 200) {
      console.error("Errore risposta Supabase: " + res.getContentText());
      return null;
    }
    
    const data = JSON.parse(res.getContentText());
    return (data && data.length > 0) ? data[0] : null;

  } catch (e) {
    console.error("Errore dentro dbGetStaffByLogin: " + e.message);
    throw e; 
  }
}

// --- DEBUG & TEST ---

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

function debugVerificaCancelToken() {
  const email = "test-ann-01@fake.com";
  const eventoId = dbGetEventoIdByCodice("LOCA2");
  
  const prenotazione = dbGetPrenotazionePerEmailEvento(email, eventoId);
  
  if (prenotazione) {
    Logger.log("=== PRENOTAZIONE TROVATA ===");
    Logger.log("ID: " + prenotazione.id);
    Logger.log("Email: " + prenotazione.cliente_email);
    Logger.log("QR Token: " + prenotazione.qr_token);
    Logger.log("Cancel Token: " + prenotazione.cancel_token);
    Logger.log("Stato: " + prenotazione.stato);
    Logger.log("============================");
    
    if (!prenotazione.cancel_token) {
      Logger.log("⚠️ PROBLEMA: cancel_token è NULL!");
      Logger.log("Soluzione: Esegui UPDATE su Supabase");
    } else {
      const linkAnnulla = getAppUrl() + "?page=annulla&token=" + prenotazione.cancel_token;
      Logger.log("✅ Link annullamento corretto:");
      Logger.log(linkAnnulla);
    }
  } else {
    Logger.log("❌ Prenotazione non trovata");
  }
}

function debugStatoPrenotazione() {
  const email = "test-ann-01@fake.com";
  const eventoId = dbGetEventoIdByCodice("LOCA2");
  
  const prenotazione = dbGetPrenotazionePerEmailEvento(email, eventoId);
  
  if (prenotazione) {
    Logger.log("=== STATO PRENOTAZIONE ===");
    Logger.log("Email: " + prenotazione.cliente_email);
    Logger.log("Stato: " + prenotazione.stato);
    Logger.log("Annullata il: " + prenotazione.annullata_il);
    Logger.log("Annullata da: " + prenotazione.annullata_da);
    Logger.log("Riattivata il: " + prenotazione.riattivata_il);
    Logger.log("========================");
  } else {
    Logger.log("Prenotazione non trovata");
  }
}

/**
 * TEST: Verifica che getTimestampLocale() funzioni
 */
function testTimestampLocale() {
  Logger.log("=== TEST TIMESTAMP LOCALE ===");
  Logger.log("Ora attuale (locale): " + getTimestampLocale());
  Logger.log("Formato atteso: YYYY-MM-DD HH:MM:SS");
  Logger.log("=============================");
}
/**
 * NUOVA: Recupera staff da UUID
 */
function dbGetStaffById(staffId) {
  if (!staffId) return null;
  
  try {
    const url = SB_URL + "/rest/v1/staff?id=eq." + staffId + "&select=*";
    const res = UrlFetchApp.fetch(url, { 
      headers: { 
        "apikey": SB_KEY, 
        "Authorization": "Bearer " + SB_KEY 
      }
    });
    const data = JSON.parse(res.getContentText());
    return data.length > 0 ? data[0] : null;
  } catch (e) {
    Logger.log('Errore dbGetStaffById: ' + e.message);
    return null;
  }
}
// ═══════════════════════════════════════════════════════════════
// AGGIUNGI QUESTE FUNZIONI IN FONDO A Database.gs
// (dopo tutte le funzioni esistenti)
// ═══════════════════════════════════════════════════════════════

/**
 * Statistiche posti LIVE (totale + pasto in 1 query)
 */
function dbGetStatistichePostiLive(eventoId) {
  try {
    const url = SB_URL + "/rest/v1/prenotazioni?" +
                "evento_id=eq." + eventoId + 
                "&stato=eq.ATTIVA" +
                "&select=include_pasto";
    
    const res = UrlFetchApp.fetch(url, {
      headers: { 
        "apikey": SB_KEY, 
        "Authorization": "Bearer " + SB_KEY 
      }
    });
    
    const prenotazioni = JSON.parse(res.getContentText());
    const totale = prenotazioni.length;
    const conPasto = prenotazioni.filter(p => p.include_pasto === true).length;
    
    return {
      totale: totale,
      conPasto: conPasto,
      soloDanza: totale - conPasto
    };
    
  } catch (e) {
    Logger.log('Errore dbGetStatistichePostiLive: ' + e.message);
    return { totale: 0, conPasto: 0, soloDanza: 0 };
  }
}

/**
 * Admin: Aggiungi/Rimuovi cena a prenotazione esistente
 */
function dbAdminModificaPasto(prenotazioneId, includePasto) {
  try {
    const url = SB_URL + '/rest/v1/prenotazioni?id=eq.' + prenotazioneId;
    
    const options = {
      method: 'patch',
      contentType: 'application/json',
      headers: {
        "apikey": SB_KEY,
        "Authorization": "Bearer " + SB_KEY
      },
      payload: JSON.stringify({
        include_pasto: includePasto
      })
    };
    
    const res = UrlFetchApp.fetch(url, options);
    return res.getResponseCode() === 204 || res.getResponseCode() === 200;
    
  } catch (e) {
    Logger.log('Errore dbAdminModificaPasto: ' + e.message);
    return false;
  }
}

/**
 * Admin: Cambia il PR associato a una prenotazione
 * Aggiorna pr_id nella tabella prenotazioni
 */
function dbCambiaPR(prenotazioneId, nuovoPrId) {
  try {
    const url = SB_URL + '/rest/v1/prenotazioni?id=eq.' + prenotazioneId;
    
    const options = {
      method: 'patch',
      contentType: 'application/json',
      headers: {
        "apikey": SB_KEY,
        "Authorization": "Bearer " + SB_KEY
      },
      payload: JSON.stringify({
        pr_id: nuovoPrId
      })
    };
    
    const res = UrlFetchApp.fetch(url, options);
    return res.getResponseCode() === 204 || res.getResponseCode() === 200;
    
  } catch (e) {
    Logger.log('Errore dbCambiaPR: ' + e.message);
    return false;
  }
}

// ============================================================
// NUOVO: Keep Alive Supabase
// Query leggera per prevenire pausa inattività Supabase free tier
// Da schedulare con trigger GAS ogni 5 giorni
// ============================================================
function keepAliveSupabase() {
  try {
    const url = getSupabaseUrl() + '/rest/v1/eventi?select=id&limit=1';
    const response = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: {
        'apikey': getSupabaseKey(),
        'Authorization': 'Bearer ' + getSupabaseKey()
      },
      muteHttpExceptions: true
    });
    Logger.log('keepAliveSupabase: HTTP ' + response.getResponseCode());
  } catch (e) {
    Logger.log('Errore keepAliveSupabase: ' + e.message);
  }
}