/**
 * Success by Karely — Avisos a Telegram SIN plan Blaze (Google Apps Script)
 * ---------------------------------------------------------------------------
 * 1. Entra a https://script.google.com, crea un proyecto y pega este archivo.
 * 2. Configuración del proyecto > Propiedades del script: agrega
 *      TELEGRAM_TOKEN   = token que te dio @BotFather
 *      TELEGRAM_CHAT_ID = id del chat o grupo
 *    (así el token nunca aparece en el sitio ni en GitHub).
 * 3. Implementar > Nueva implementación > Tipo "Aplicación web":
 *      Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario.
 * 4. Copia la URL (https://script.google.com/macros/s/…/exec) en
 *    assets/js/config.js > integraciones.appsScriptTelegram.
 *
 * Limitación: la URL es pública; el script filtra y recorta los datos,
 * pero alguien podría enviarle avisos falsos. Cloud Functions es más seguro.
 */
const SERVICIOS = {
  universidad: 'Universidad, becas y FAFSA', carrera: 'Carrera y currículum', equivalencia: 'Equivalencia y traducciones',
  credito_personal: 'Crédito personal', credito_empresa: 'Crédito empresarial', empresa: 'Abrir negocio (LLC)', toolkits: 'Toolkits 6SGS',
};

function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 1500); }

function doPost(e) {
  let d = {};
  try { d = JSON.parse(e.postData.contents || '{}'); } catch (err) { return ContentService.createTextOutput('ok'); }
  // Límite simple anti-abuso: máximo 30 avisos por hora
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get('avisos') || 0);
  if (n > 30) return ContentService.createTextOutput('ok');
  cache.put('avisos', String(n + 1), 3600);

  const servicios = (d.services || []).map(function (s) { return SERVICIOS[s] || s; }).join(', ') || '—';
  const nombre = esc(((d.firstName || '') + ' ' + (d.lastName || '')).trim() || '—');
  const textos = {
    lead: '🆕 <b>Nuevo lead</b>\n<b>Nombre:</b> ' + nombre + '\n<b>Correo:</b> ' + esc(d.email) + '\n<b>Teléfono:</b> ' + esc(d.phone || '—') + '\n<b>Servicios:</b> ' + esc(servicios) + (d.message ? '\n<b>Mensaje:</b> ' + esc(d.message) : ''),
    suscriptor: '📰 <b>Nuevo suscriptor del blog</b>\n' + esc(d.email),
    registro: '👤 <b>Nuevo registro en el portal</b>\n<b>Nombre:</b> ' + nombre + '\n<b>Correo:</b> ' + esc(d.email),
    mensaje: '💬 <b>Mensaje de ' + esc(d.authorName || 'un cliente') + '</b>\n' + esc(d.text),
    documento: '📎 <b>Nuevo documento</b>\n' + esc(d.name) + (d.email ? ' · ' + esc(d.email) : ''),
  };
  const texto = textos[d.tipo];
  if (!texto) return ContentService.createTextOutput('ok');
  const props = PropertiesService.getScriptProperties();
  UrlFetchApp.fetch('https://api.telegram.org/bot' + props.getProperty('TELEGRAM_TOKEN') + '/sendMessage', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ chat_id: props.getProperty('TELEGRAM_CHAT_ID'), text: texto, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  return ContentService.createTextOutput('ok');
}
