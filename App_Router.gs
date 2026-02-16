/**
 * App_router.gs
 * Punto di ingresso unico per la Web App con gestione Mobile PWA.
 */
function doGet(e) {
  try {
    SpreadsheetApp.getActiveSpreadsheet();
    const page = e.parameter.page;

    // --- 1. PAGINE PUBBLICHE (Senza Login) ---
    
    if (page === 'registrazione' || !page) {
      return renderRegistrazione(e);
    }

    if (page === 'login') {
      return creaOutput('login', "Punta Vida | Login Staff");
    }

    // --- 2. PAGINE PROTETTE ---
    
    if (page === 'dashboard' || page === 'admin') {
      const template = HtmlService.createTemplateFromFile('dashboard');
      template.dashboardContext = true; 
      return setupMobileMeta(template, "Admin Dashboard");
    }
    
    if (page === 'home') return renderHomeLive(e);
    if (page === 'scanner') return renderScanner(e); 
    if (page === 'gestione_eventi') return renderGestioneEventi(e);
    if (page === 'gestione_pr') return renderGestionePR(e);
    if (page === 'gestione_staff') return renderGestioneStaff(e);
    if (page === 'gestione_prenotazioni') return renderGestionePrenotazioni(e);

    return renderRegistrazione(e);

  } catch (err) {
    console.error("Errore doGet: " + err.toString());
    return HtmlService.createHtmlOutput(
      "<div style='font-family:sans-serif; padding:50px; text-align:center; background:#121212; color:white;'>" +
      "<h2>Errore di Sistema</h2>" +
      "<p>Dettaglio tecnico: " + err.toString() + "</p></div>"
    );
  }
}

/**
 * Helper per configurare i meta tag mobile/PWA su ogni pagina.
 * NOTA: apple-mobile-web-app deve essere inserito manualmente nell'HTML
 * per evitare l'errore "Meta tag non consentito".
 */
function setupMobileMeta(template, titolo) {
  return template.evaluate()
    .setTitle(titolo)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Funzioni di rendering semplificate
 */
function creaOutput(file, titolo) {
  const template = HtmlService.createTemplateFromFile(file);
  return setupMobileMeta(template, titolo);
}

function renderGestionePrenotazioni(e) { return creaOutput('gestione_prenotazioni', "Admin - Dettaglio Prenotazioni"); }
function renderGestioneEventi(e) { return creaOutput('gestione_eventi', "Admin - Gestione Eventi"); }
function renderGestionePR(e) { return creaOutput('gestione_pr', "Admin - Gestione PR"); }
function renderGestioneStaff(e) { return creaOutput('gestione_staff', "Admin - Gestione Staff"); }
function renderHomeLive(e) { return creaOutput('home_live', "Admin - Live Monitor"); }

function renderScanner(e) {
  const template = HtmlService.createTemplateFromFile('scanner');
  template.eventoCodice = e.parameter.evento || "";
  template.nicknameStaff = e.parameter.staff || "";
  return setupMobileMeta(template, "Staff - Scanner");
}

function renderRegistrazione(e) {
  const template = HtmlService.createTemplateFromFile('registrazione');
  template.eventoParam = e.parameter.evento || "";
  template.prParam = e.parameter.pr || "";
  return setupMobileMeta(template, "Registrazione Evento");
}

/**
 * Recupero moduli via JS (Dashboard dinamica)
 */
function getModuloHTML(modulo) {
  const mapping = {
    'home': 'home_live',
    'eventi': 'gestione_eventi',
    'pr': 'gestione_pr',
    'staff': 'gestione_staff',
    'links': 'link_generator',
    'gestione_prenotazioni': 'gestione_prenotazioni'
  };
  
  const fileName = mapping[modulo];
  if (!fileName) return "Modulo non trovato";
  
  try {
    const template = HtmlService.createTemplateFromFile(fileName);
    template.dashboardContext = true; 
    return template.evaluate().getContent();
  } catch (err) {
    return "Errore caricamento modulo: " + err.message;
  }
}

function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (err) {
    return "";
  }
}

function getTuttiIDati() {
  return {
    eventi: dbGetAllEventi(),
    pr: dbGetAllPR(),
    staff: dbGetAllStaff()
  };
}