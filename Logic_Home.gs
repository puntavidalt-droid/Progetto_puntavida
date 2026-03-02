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
/**
 * 4. Recupera i dati storici per il grafico — 3 serie: party, pasto, totale
 * MODIFICATO: aggiunto include_pasto nella select per split
 */
function homeGetDatiGrafico(eventoId) {
  if (!eventoId) return { labels: [], party: [], pasto: [], totale: [] };

  try {
    const url = SB_URL + "/rest/v1/prenotazioni?evento_id=eq." + eventoId + 
                "&select=created_at,include_pasto&order=created_at.asc";
    const res = UrlFetchApp.fetch(url, { 
      headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY }
    });
    const prenotazioni = JSON.parse(res.getContentText());

    const statsParty = {};
    const statsPasto = {};
    const statsTotale = {};
    
    prenotazioni.forEach(p => {
      const data = new Date(p.created_at).toLocaleDateString('it-IT');
      statsTotale[data] = (statsTotale[data] || 0) + 1;
      
      if (p.include_pasto === true) {
        statsPasto[data] = (statsPasto[data] || 0) + 1;
      } else {
        statsParty[data] = (statsParty[data] || 0) + 1;
      }
    });

    // Tutte le date presenti (per allineare le serie)
    const labels = Object.keys(statsTotale);

    return {
      labels: labels,
      party: labels.map(d => statsParty[d] || 0),
      pasto: labels.map(d => statsPasto[d] || 0),
      totale: labels.map(d => statsTotale[d] || 0)
    };
  } catch (e) {
    console.error("Errore grafico: " + e.message);
    return { labels: [], party: [], pasto: [], totale: [] };
  }
}

/**
 * 5. Statistiche rapide per la Home (Espandibile)
 */
function homeGetQuickStats() {
  // Implementazione futura per widget aggiuntivi
}