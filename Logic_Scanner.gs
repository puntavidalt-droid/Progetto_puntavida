/**
 * LOGIC SCANNER
 * Gestisce la convalida dei QR Code e la sicurezza degli accessi staff.
 */

function renderScanner(e) {
  const template = HtmlService.createTemplateFromFile('scanner');
  template.eventoCodice = e.parameter.evento || "";
  template.nicknameStaff = e.parameter.staff || "";

  return template.evaluate()
    .setTitle("Scanner Ingressi - Staff")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0'); 
}

/**
 * Verifica l'accesso, l'orario e recupera il LOGO tramite DATABASE.gs
 */
function verificaAccessoScanner(codiceEvento, nicknameStaff) {
  try {
    const staffId = dbGetStaffIdByNickname(nicknameStaff);
    const evento = dbGetEventoInfo(codiceEvento);
    
    if (!staffId) return { authorized: false, msg: "STAFF NON RICONOSCIUTO" };
    if (!evento) return { authorized: false, msg: "EVENTO NON TROVATO" };

    const oraAttuale = new Date();
    const inizio = evento.inizio_checkin ? new Date(evento.inizio_checkin) : null;
    const fine = evento.fine_checkin ? new Date(evento.fine_checkin) : null;

    // Controllo Apertura Anticipata
    let troppoPresto = false;
    let oraAperturaTesto = "";
    if (inizio && oraAttuale < inizio) {
      troppoPresto = true;
      oraAperturaTesto = inizio.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});
    }

    // Controllo Chiusura
    if (fine && oraAttuale > fine) {
      return { authorized: false, msg: "CHECK-IN CHIUSO" };
    }

    // Restituiamo i dati necessari
    return { 
      authorized: true, 
      troppoPresto: troppoPresto,
      oraApertura: oraAperturaTesto,
      nomeEvento: (evento.nome_evento || evento.nome || "EVENTO").toUpperCase(),
      nomeStaff: nicknameStaff.toUpperCase(),
      // MODIFICA CENTRALIZZATA: Chiamiamo la funzione del Database
      logoUrl: dbGetLogoUrl() 
    };
  } catch (e) {
    return { authorized: false, msg: "ERRORE CONNESSIONE DB" };
  }
}

/**
 * Valida il QR Code durante la scansione
 */
function convalidaIngresso(qrToken, codiceEvento, nicknameStaff) {
  try {
    if (!qrToken) return { success: false, msg: "QR VUOTO" };

    const staffId = dbGetStaffIdByNickname(nicknameStaff);
    if (!staffId) return { success: false, msg: "ERRORE STAFF" };

    const evento = dbGetEventoInfo(codiceEvento);
    if (!evento) return { success: false, msg: "ERRORE EVENTO" };

    const oraAttuale = new Date();
    
    if (evento.inizio_checkin && oraAttuale < new Date(evento.inizio_checkin)) {
      return { success: false, msg: "CHECK-IN NON ANCORA APERTO" };
    }
    if (evento.fine_checkin && oraAttuale > new Date(evento.fine_checkin)) {
      return { success: false, msg: "CHECK-IN CHIUSO" };
    }

    const prenotazione = dbGetPrenotazioneDaToken(qrToken);
    if (!prenotazione) return { success: false, msg: "QR NON VALIDO" };

    if (prenotazione.entrato) {
      const oraGiaEntrato = new Date(prenotazione.ora_ingresso).toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});
      return { 
        success: false, 
        msg: "GIÀ ENTRATO ALLE " + oraGiaEntrato,
        cliente: (prenotazione.cliente_nome + (prenotazione.cliente_cognome ? " " + prenotazione.cliente_cognome : "")).toUpperCase()
      };
    }

    const ok = dbUpdateIngresso(prenotazione.id, oraAttuale.toISOString(), staffId);
    if (!ok) throw new Error("Update fallito");

    return { 
      success: true, 
      msg: "INGRESSO OK", 
      cliente: (prenotazione.cliente_nome + (prenotazione.cliente_cognome ? " " + prenotazione.cliente_cognome : "")).toUpperCase()
    };

  } catch (e) {
    return { success: false, msg: "ERRORE SERVER" };
  }
}