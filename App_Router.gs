/**
 * APP_ROUTER.GS - Versione Ottimizzata
 * Router unificato SENZA duplicazioni
 */

function doGet(e) {
  try {
    const page = e.parameter.page || 'registrazione';
    
    Logger.log('Richiesta pagina: ' + page);

    // PAGINE PUBBLICHE
    if (page === 'registrazione' || !page) {
      return renderRegistrazione(e);
    }
        // Pagina Annullamento Prenotazione (dal link email)
    if (page === 'annulla') {
      return renderAnnullamento(e);
    }
    
    if (page === 'login') {
      return createPageOutput('login', "Punta Vida | Login Staff");
    }

    // PAGINE PROTETTE
    if (page === 'dashboard' || page === 'admin') {
      const template = HtmlService.createTemplateFromFile('dashboard');
      template.dashboardContext = true;
      return setupMobileMeta(template, "Admin Dashboard");
    }
    
    if (page === 'home') {
      return createPageOutput('home_live', "Admin - Live Monitor");
    }

    if (page === 'scanner') {
      return renderScanner(e);
    }
    
    if (page === 'gestione_eventi') {
      return createPageOutput('gestione_eventi', "Admin - Gestione Eventi");
    }
    
    if (page === 'gestione_pr') {
      return createPageOutput('gestione_pr', "Admin - Gestione PR");
    }
    
    if (page === 'gestione_staff') {
      return createPageOutput('gestione_staff', "Admin - Gestione Staff");
    }
    
    if (page === 'gestione_prenotazioni') {
      return createPageOutput('gestione_prenotazioni', "Admin - Dettaglio Prenotazioni");
    }

    // FALLBACK
    Logger.log('Pagina non riconosciuta: ' + page);
    return renderRegistrazione(e);

  } catch (err) {
    console.error("Errore doGet: " + err.toString());
    
    return HtmlService.createHtmlOutput(
      '<div style="font-family:sans-serif;padding:50px;text-align:center;background:#667eea;color:white;">' +
      '<h2>⚠️ Errore di Sistema</h2>' +
      '<p>Si è verificato un problema.</p>' +
      '<p style="font-size:0.9em;opacity:0.8;">Dettaglio: ' + err.toString() + '</p>' +
      '<button onclick="window.location.href=window.location.origin" style="margin-top:20px;padding:12px 24px;background:white;color:#667eea;border:none;border-radius:8px;cursor:pointer;font-weight:bold;">Torna alla Home</button>' +
      '</div>'
    ).setTitle("Errore - Punta Vida");
  }
}

function setupMobileMeta(template, titolo) {
  return template.evaluate()
    .setTitle(titolo)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function createPageOutput(fileName, titolo) {
  const template = HtmlService.createTemplateFromFile(fileName);
  return setupMobileMeta(template, titolo);
}

// renderScanner() → in Logic_Scanner.gs (unica versione)
// renderRegistrazione() → in Logic_Registrazione.gs (unica versione)

function getModuloHTML(modulo) {
  const mapping = {
    'home': 'home_live',
    'eventi': 'gestione_eventi',
    'pr': 'gestione_pr',
    'staff': 'gestione_staff',
    'links': 'link_generator',
    'developer': 'console_developer',
    'estrazione': 'estrazione_dati',
    'gestione_prenotazioni': 'gestione_prenotazioni'
  };
  
  const fileName = mapping[modulo];
  
  if (!fileName) {
    Logger.log('Modulo non trovato: ' + modulo);
    return "<div style='padding:20px;text-align:center;'>Modulo non trovato</div>";
  }
  
  try {
    const template = HtmlService.createTemplateFromFile(fileName);
    template.dashboardContext = true;
    return template.evaluate().getContent();
  } catch (err) {
    Logger.log('Errore caricamento modulo ' + fileName + ': ' + err.message);
    return "<div style='padding:20px;color:red;'>Errore: " + err.message + "</div>";
  }
}

function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (err) {
    Logger.log('File non trovato: ' + filename);
    return "";
  }
}

function getTuttiIDati() {
  try {
    return {
      eventi: dbGetAllEventi(),
      pr: dbGetAllPR(),
      staff: dbGetAllStaff(),
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    Logger.log('Errore getTuttiIDati: ' + e.message);
    return {
      eventi: [],
      pr: [],
      staff: [],
      error: e.message
    };
  }
}