/**
 * Funzione principale chiamata dal form HTML
 */
function checkLoginStaff(nickname, pin) {
  try {
    // Chiamata alla funzione in Database.gs
    const staff = dbGetStaffByLogin(nickname, pin);
    
    if (staff) {
      if (staff.attivo === false || String(staff.attivo) === "false") {
        return { success: false, msg: "Account disattivato. Contatta l'amministratore." };
      }
      
      // Restituiamo i dati per la sessione client
      return {
        success: true,
        user: {
          id: staff.id,
          nome: staff.nome,
          nickname: staff.nickname,
          is_admin: staff.is_admin === true || String(staff.is_admin) === "true"
        }
      };
    }
    
    return { success: false, msg: "Nickname o PIN non corretti." };
  } catch (e) {
    console.error("Errore login: " + e.message);
    return { success: false, msg: "Errore tecnico durante l'accesso." };
  }
}

/**
 * Funzione di Logout (opzionale, utile per pulire lato server se necessario)
 */
function logoutStaff() {
  // Al momento gestiamo tutto via localStorage, ma qui potresti loggare l'uscita
  return true;
}
function testLoginManuale() {
  const nick = "PuntaVida";
  const pin = "2303";
  
  try {
    const risultato = checkLoginStaff(nick, pin);
    console.log("ESITO TEST:", JSON.stringify(risultato));
  } catch (e) {
    console.error("ERRORE RILEVATO:", e.message);
  }
}
