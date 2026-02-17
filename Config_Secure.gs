/**
 * CONFIG_SECURE.GS
 * Sistema di configurazione sicuro
 */

function setupConfig() {
  const props = PropertiesService.getScriptProperties();
  
  props.setProperties({
    'SUPABASE_URL': 'https://dzqhjifxtgeynsqlxahw.supabase.co',
    'SUPABASE_KEY': 'sb_publishable_m_bsnHy62AaeoYpiD4ycnw_6ED4sgQz',
    'NETLIFY_URL': 'https://comfy-tartufo-500ca9.netlify.app',
    'EMAIL_QUEUE_SHEET_ID': ''
  });
  
  Logger.log('✅ Configurazione salvata!');
}

function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    SB_URL: props.getProperty('SUPABASE_URL'),
    SB_KEY: props.getProperty('SUPABASE_KEY'),
    NETLIFY_URL: props.getProperty('NETLIFY_URL'),
    EMAIL_QUEUE_SHEET_ID: props.getProperty('EMAIL_QUEUE_SHEET_ID')
  };
}

function getSB_URL() {
  return getConfig().SB_URL;
}

function getSB_KEY() {
  return getConfig().SB_KEY;
}

var SB_URL = getSB_URL();
var SB_KEY = getSB_KEY();

function testConfig() {
  const config = getConfig();
  
  if (!config.SB_URL || !config.SB_KEY) {
    Logger.log('❌ Configurazione mancante!');
    return false;
  }
  
  Logger.log('✅ Test configurazione riuscito!');
  Logger.log('URL Supabase: ' + config.SB_URL);
  Logger.log('API Key presente: Sì');
  Logger.log('Netlify URL: ' + config.NETLIFY_URL);
  return true;
}

function updateConfigProperty(key, value) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(key, value);
  Logger.log('✅ Aggiornato ' + key);
}
function updateEmailQueueId() {
  updateConfigProperty('EMAIL_QUEUE_SHEET_ID', '1l_b_pEEAkCML2qqf3ruEb2kCu9moCOfoAUYbEo9MQYA');
}