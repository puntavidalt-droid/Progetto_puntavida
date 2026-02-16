function testMail() {
  // SOSTITUISCI con la tua vera mail per vedere se arriva!
  const miaEmail = "puntavida.lt@gmail.com"; 
  
  inviaEmailConQR(miaEmail, "Marco", "Evento Prova Black & White", "TOKEN_TEST_123");
  
  console.log("Mail inviata! Controlla la casella postale (anche lo spam).");
}