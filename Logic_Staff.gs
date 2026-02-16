/**
 * Recupera la lista completa dello staff chiamando il database
 */
function getListaStaff() {
  try {
    return dbGetAllStaff() || [];
  } catch (e) {
    console.error("Errore in getListaStaff: " + e.message);
    return [];
  }
}

/**
 * Gestisce il salvataggio o l'aggiornamento di un membro dello staff
 * Integrato con i nuovi campi is_admin e codice_pin
 */
function salvaStaff(payload) {
  try {
    // Prepariamo l'oggetto record con i nomi esatti delle colonne di Supabase
    const record = {
      nickname: payload.nickname ? payload.nickname.trim() : "",
      nome: payload.nome,
      cognome: payload.cognome,
      email: payload.email,
      cellulare: payload.cellulare,
      codice_pin: payload.codice_pin, // Il PIN usato per scanner e login
      // Gestione del flag amministratore
      is_admin: payload.is_admin === "true" || payload.is_admin === true,
      attivo: payload.attivo === "true" || payload.attivo === true
    };

    // Validazione minima
    if (!record.nickname || !record.codice_pin) {
      return { success: false, msg: "Nickname e PIN sono obbligatori per l'accesso." };
    }

    if (payload.id) {
      // Aggiornamento record esistente
      const esito = dbUpdateStaff(payload.id, record);
      return { success: esito, msg: esito ? "Staff aggiornato con successo" : "Errore durante l'aggiornamento" };
    } else {
      // Inserimento nuovo membro
      const esito = dbInsertStaff(record);
      return { success: esito, msg: esito ? "Nuovo membro Staff inserito" : "Errore durante l'inserimento" };
    }
  } catch (e) {
    console.error("Errore in salvaStaff: " + e.message);
    return { success: false, msg: "Errore di sistema: " + e.message };
  }
}