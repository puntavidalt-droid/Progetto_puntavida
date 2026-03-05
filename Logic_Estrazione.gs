/**
 * LOGIC_ESTRAZIONE.GS
 * Estrazione dati prenotazioni per analisi in Google Sheets
 * SOLO LETTURA — nessuna operazione di scrittura su Supabase
 */

/**
 * Recupera le liste per popolare i filtri della pagina estrazione
 */
function getFiltersEstrazione() {
  try {
    const eventi = dbGetAllEventi();
    const pr = dbGetAllPR();
    return {
      eventi: eventi.map(e => ({ id: e.id, nome: e.nome_evento, data: e.data_evento }))
                     .sort((a, b) => new Date(b.data) - new Date(a.data)),
      pr: pr.map(p => ({ id: p.id, nickname: p.nickname }))
             .sort((a, b) => a.nickname.localeCompare(b.nickname, 'it'))
    };
  } catch (e) {
    Logger.log('Errore getFiltersEstrazione: ' + e.message);
    return { eventi: [], pr: [] };
  }
}

/**
 * Esegue l'estrazione dati e crea un nuovo Google Sheet
 * @param {Object} filtri - { eventoId, prNickname, dataInizio, dataFine, stato }
 * @returns {Object} - { success, url, righe } oppure { success: false, errore }
 */
function eseguiEstrazione(filtri) {
  try {
    const startTime = Date.now();
    
    // 1. Recupera tutti gli eventi (per il join nomi)
    const tuttiEventi = dbGetAllEventi();
    const mapEventi = {};
    tuttiEventi.forEach(e => {
      mapEventi[e.id] = {
        nome: e.nome_evento,
        data: e.data_evento,
        tipo: e.tipo_evento || 'SOLO_DANZA'
      };
    });

    // 2. Determina quali eventi interrogare
    let eventiDaEstrarre = [];
    
    if (filtri.eventoId && filtri.eventoId !== 'TUTTI') {
      eventiDaEstrarre = [filtri.eventoId];
    } else {
      // Filtra per arco temporale se specificato
      eventiDaEstrarre = tuttiEventi
        .filter(e => {
          if (filtri.dataInizio) {
            const dataEvento = new Date(e.data_evento);
            const inizio = new Date(filtri.dataInizio);
            if (dataEvento < inizio) return false;
          }
          if (filtri.dataFine) {
            const dataEvento = new Date(e.data_evento);
            const fine = new Date(filtri.dataFine);
            fine.setHours(23, 59, 59);
            if (dataEvento > fine) return false;
          }
          return true;
        })
        .map(e => e.id);
    }

    if (eventiDaEstrarre.length === 0) {
      return { success: false, errore: 'Nessun evento trovato con i filtri selezionati.' };
    }

    // 3. Recupera prenotazioni per ogni evento
    let tuttePrenotazioni = [];
    
    eventiDaEstrarre.forEach(eventoId => {
      const prenotazioni = dbGetPrenotazioniLive(eventoId);
      prenotazioni.forEach(p => {
        tuttePrenotazioni.push({
          ...p,
          evento_nome: mapEventi[eventoId] ? mapEventi[eventoId].nome : 'N/A',
          evento_data: mapEventi[eventoId] ? mapEventi[eventoId].data : '',
          evento_tipo: mapEventi[eventoId] ? mapEventi[eventoId].tipo : ''
        });
      });
    });

    // 4. Applica filtro PR
    if (filtri.prNickname && filtri.prNickname !== 'TUTTI') {
      tuttePrenotazioni = tuttePrenotazioni.filter(p => 
        p.pr_nickname && p.pr_nickname.toLowerCase() === filtri.prNickname.toLowerCase()
      );
    }

    // 5. Applica filtro stato
    if (filtri.stato && filtri.stato !== 'TUTTI') {
      tuttePrenotazioni = tuttePrenotazioni.filter(p => {
        switch (filtri.stato) {
          case 'ATTIVE': return p.stato !== 'ANNULLATA';
          case 'ENTRATI': return p.entrato === true;
          case 'ATTESA': return !p.entrato && p.stato !== 'ANNULLATA';
          case 'ANNULLATE': return p.stato === 'ANNULLATA';
          default: return true;
        }
      });
    }

    if (tuttePrenotazioni.length === 0) {
      return { success: false, errore: 'Nessuna prenotazione trovata con i filtri selezionati.' };
    }

    // 6. Ordinamento per data evento → cognome → nome
    tuttePrenotazioni.sort((a, b) => {
      const dataA = new Date(a.evento_data || 0);
      const dataB = new Date(b.evento_data || 0);
      if (dataA.getTime() !== dataB.getTime()) return dataA - dataB;
      const cognA = (a.cliente_cognome || '').toLowerCase();
      const cognB = (b.cliente_cognome || '').toLowerCase();
      if (cognA !== cognB) return cognA.localeCompare(cognB, 'it');
      return (a.cliente_nome || '').localeCompare(b.cliente_nome || '', 'it');
    });

    // 7. Crea Google Sheet
    const now = new Date();
    const timestamp = Utilities.formatDate(now, 'Europe/Rome', 'yyyy-MM-dd_HH-mm');
    const nomeFile = 'PuntaVida_Estrazione_' + timestamp;
    
    const ss = SpreadsheetApp.create(nomeFile);
    const sheet = ss.getSheets()[0];
    sheet.setName('Prenotazioni');

    // 8. Intestazioni
    const headers = [
      'Nome', 'Cognome', 'Email', 'Evento', 'Data Evento', 
      'PR', 'Con Pasto', 'Stato', 'Entrato', 'Ora Ingresso'
    ];
    sheet.appendRow(headers);
    
    // Stile intestazione
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#1DB954');
    headerRange.setFontColor('#FFFFFF');
    headerRange.setHorizontalAlignment('center');
    sheet.setFrozenRows(1);

    // 9. Scrivi dati
    const righe = tuttePrenotazioni.map(p => {
      // Formatta data evento leggibile
      let dataEventoFormattata = '';
      if (p.evento_data) {
        try {
          const d = new Date(p.evento_data);
          dataEventoFormattata = Utilities.formatDate(d, 'Europe/Rome', 'dd/MM/yyyy');
        } catch (e) {
          dataEventoFormattata = String(p.evento_data);
        }
      }
      
      // Formatta ora ingresso leggibile (regex, NO new Date)
      let oraIngressoFormattata = '';
      if (p.ora_ingresso) {
        const match = String(p.ora_ingresso).match(/(\d{2}:\d{2})/);
        oraIngressoFormattata = match ? match[1] : String(p.ora_ingresso);
      }

      return [
        p.cliente_nome || '',
        p.cliente_cognome || '',
        p.cliente_email || '',
        p.evento_nome || '',
        dataEventoFormattata,
        p.pr_nickname || '',
        p.include_pasto ? 'Sì' : 'No',
        p.stato === 'ANNULLATA' ? 'Annullata' : 'Attiva',
        p.entrato ? 'Sì' : 'No',
        oraIngressoFormattata
      ];
    });

    if (righe.length > 0) {
      sheet.getRange(2, 1, righe.length, headers.length).setValues(righe);
    }

    // 10. Formattazione colonne
    sheet.autoResizeColumns(1, headers.length);
    
    // Colonna Data Evento centrata
    sheet.getRange(2, 5, righe.length, 1).setHorizontalAlignment('center');
    // Colonne Con Pasto, Stato, Entrato centrate
    sheet.getRange(2, 7, righe.length, 3).setHorizontalAlignment('center');
    // Colonna Ora Ingresso centrata
    sheet.getRange(2, 10, righe.length, 1).setHorizontalAlignment('center');

    // 11. Foglio riepilogo filtri
    const sheetInfo = ss.insertSheet('Info Estrazione');
    sheetInfo.appendRow(['Parametro', 'Valore']);
    sheetInfo.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#1DB954').setFontColor('#FFFFFF');
    sheetInfo.appendRow(['Data Estrazione', Utilities.formatDate(now, 'Europe/Rome', 'dd/MM/yyyy HH:mm:ss')]);
    sheetInfo.appendRow(['Evento', filtri.eventoId === 'TUTTI' ? 'Tutti' : (mapEventi[filtri.eventoId] ? mapEventi[filtri.eventoId].nome : filtri.eventoId)]);
    sheetInfo.appendRow(['PR', filtri.prNickname === 'TUTTI' ? 'Tutti' : '@' + filtri.prNickname]);
    sheetInfo.appendRow(['Periodo Da', filtri.dataInizio || 'Inizio']);
    sheetInfo.appendRow(['Periodo A', filtri.dataFine || 'Fine']);
    sheetInfo.appendRow(['Stato', filtri.stato === 'TUTTI' ? 'Tutti' : filtri.stato]);
    sheetInfo.appendRow(['Righe Estratte', righe.length]);
    sheetInfo.autoResizeColumns(1, 2);
    
    // Torna al primo foglio
    ss.setActiveSheet(sheet);

    const executionTime = Date.now() - startTime;
    Logger.log('✅ Estrazione completata: ' + righe.length + ' righe in ' + executionTime + 'ms');
    Logger.log('📄 Sheet: ' + ss.getUrl());

    return {
      success: true,
      url: ss.getUrl(),
      righe: righe.length,
      nomeFile: nomeFile
    };

  } catch (e) {
    Logger.log('❌ Errore eseguiEstrazione: ' + e.message);
    return { success: false, errore: e.message };
  }
}
