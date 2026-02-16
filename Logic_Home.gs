/**
 * LOGIC_HOME.GS
 * Logica specifica per il monitoraggio in tempo reale e gestione prenotazioni.
 */

/**
 * 1. Recupera i dati delle prenotazioni filtrati per l'evento selezionato.
 */
function homeGetDatiLive(eventoId) {
  if (!eventoId) return [];
  
  try {
    // Chiama la funzione aggiornata in DATABASE.GS (che ora include email, id, etc.)
    const prenotazioni = dbGetPrenotazioniLive(eventoId);
    return prenotazioni;
  } catch (e) {
    console.error("Errore in homeGetDatiLive: " + e.message);
    return [];
  }
}

/**
 * 2. NUOVA: Gestisce l'invio del Report CSV (Completo o per PR)
 * Viene chiamata dal tasto "Invia Report" nella pagina gestione_prenotazioni
 */
function homeInviaReport(eventoId, nomePR = null) {
  const mailDestinatario = "puntavida@tuaemail.com"; // <-- Inserisci qui l'indirizzo reale
  
  try {
    const evento = dbGetEventoInfoById(eventoId);
    let prenotazioni = dbGetPrenotazioniLive(eventoId);
    
    // Se è specificato un PR, filtriamo la lista
    if (nomePR) {
      prenotazioni = prenotazioni.filter(p => p.pr_nickname === nomePR);
    }
    
    if (prenotazioni.length === 0) return "Nessuna prenotazione da inviare.";

    // Chiama la funzione in UTILITY_MAIL.GS
    const esito = inviaEmailListaPrenotati(mailDestinatario, evento.nome_evento, prenotazioni, nomePR);
    
    return esito ? "Report inviato correttamente a " + mailDestinatario : "Errore nell'invio del report.";
  } catch (e) {
    console.error("Errore homeInviaReport: " + e.message);
    return "Errore server: " + e.message;
  }
}

/**
 * 3. NUOVA: Ponte per il reinvio del QR Code (richiamato dal client)
 */
function homeReinviaQR(prenotazioneId) {
  try {
    return reinviaEmailQRId(prenotazioneId);
  } catch (e) {
    console.error("Errore homeReinviaQR: " + e.message);
    return false;
  }
}

/**
 * 4. Recupera i dati storici delle prenotazioni per il grafico
 * Ordinati cronologicamente
 */
function homeGetDatiGrafico(eventoId) {
  if (!eventoId) return { labels: [], values: [] };

  try {
    const url = SB_URL + "/rest/v1/prenotazioni?evento_id=eq." + eventoId + "&select=created_at&order=created_at.asc";
    const res = UrlFetchApp.fetch(url, { 
      headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY }
    });
    const prenotazioni = JSON.parse(res.getContentText());

    const stats = {};
    prenotazioni.forEach(p => {
      // Usiamo ISO date per l'ordinamento delle chiavi dell'oggetto
      const data = new Date(p.created_at).toLocaleDateString('it-IT');
      stats[data] = (stats[data] || 0) + 1;
    });

    return {
      labels: Object.keys(stats),
      values: Object.values(stats)
    };
  } catch (e) {
    console.error("Errore grafico: " + e.message);
    return { labels: [], values: [] };
  }
}

/**
 * 5. Statistiche rapide per la Home (Espandibile)
 */
function homeGetQuickStats() {
  // Implementazione futura per widget aggiuntivi
}