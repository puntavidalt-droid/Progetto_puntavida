/**
 * ================================================================
 * Logic_Annullamento.gs - NUOVO FILE
 * Gestisce l'annullamento prenotazione lato cliente
 * ================================================================
 */

/**
 * Render della pagina di annullamento (accessibile dal link email)
 */
function renderAnnullamento(e) {
  const cancelToken = e.parameter.token || "";
  
  if (!cancelToken) {
    return HtmlService.createHtmlOutput(
      '<div style="padding:50px;text-align:center;font-family:sans-serif;background:#000;color:#fff;min-height:100vh;">' +
      '<h2 style="color:#dc3545;">⚠️ Link Non Valido</h2>' +
      '<p>Il link di annullamento non è valido o è scaduto.</p>' +
      '<p>Se hai bisogno di assistenza, contatta l\'organizzatore.</p>' +
      '</div>'
    ).setTitle("Errore - Link Non Valido");
  }
  
  const prenotazione = dbGetPrenotazioneDaCancelToken(cancelToken);
  
  if (!prenotazione) {
    return HtmlService.createHtmlOutput(
      '<div style="padding:50px;text-align:center;font-family:sans-serif;background:#000;color:#fff;min-height:100vh;">' +
      '<h2 style="color:#dc3545;">❌ Prenotazione Non Trovata</h2>' +
      '<p>Questa prenotazione non esiste o è già stata annullata.</p>' +
      '</div>'
    ).setTitle("Prenotazione Non Trovata");
  }
  
  if (prenotazione.stato === 'ANNULLATA') {
    return HtmlService.createHtmlOutput(
      '<div style="padding:50px;text-align:center;font-family:sans-serif;background:#000;color:#fff;min-height:100vh;">' +
      '<h2 style="color:#ffc107;">⚠️ Già Annullata</h2>' +
      '<p>Questa prenotazione è già stata annullata in precedenza.</p>' +
      '<p style="margin-top:30px;">Puoi ri-registrarti usando il link originale dell\'evento.</p>' +
      '</div>'
    ).setTitle("Prenotazione Già Annullata");
  }
  
  // Recupera info evento per mostrare dettagli
  const evento = dbGetEventoInfoById(prenotazione.evento_id);
  
  const template = HtmlService.createTemplateFromFile('annulla_prenotazione');
  template.prenotazione = {
    id: prenotazione.id,
    nome: prenotazione.cliente_nome,
    email: prenotazione.cliente_email,
    cancelToken: cancelToken
  };
  template.evento = {
    nome: evento ? evento.nome_evento : "Evento",
    data: evento ? evento.data_evento : ""
  };
  
  return template.evaluate()
    .setTitle("Annulla Prenotazione")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Esegue l'annullamento effettivo quando il cliente conferma
 */
function confermaAnnullamento(cancelToken) {
  try {
    if (!cancelToken) {
      return {
        success: false,
        msg: "Token di annullamento mancante."
      };
    }
    
    const prenotazione = dbGetPrenotazioneDaCancelToken(cancelToken);
    
    if (!prenotazione) {
      return {
        success: false,
        msg: "Prenotazione non trovata."
      };
    }
    
    if (prenotazione.stato === 'ANNULLATA') {
      return {
        success: false,
        msg: "Questa prenotazione è già stata annullata."
      };
    }
    
    // Esegui annullamento
    const risultato = dbAnnullaPrenotazione(prenotazione.id, 'CLIENTE');
    
    if (risultato) {
      Logger.log('✅ Prenotazione annullata da cliente: ' + prenotazione.cliente_email);
      return {
        success: true,
        msg: "Prenotazione annullata con successo. Puoi ri-registrarti in qualsiasi momento."
      };
    } else {
      return {
        success: false,
        msg: "Errore durante l'annullamento. Riprova o contatta l'organizzatore."
      };
    }
    
  } catch (error) {
    Logger.log('❌ Errore confermaAnnullamento: ' + error.message);
    return {
      success: false,
      msg: "Errore del sistema. Riprova più tardi."
    };
  }
}

