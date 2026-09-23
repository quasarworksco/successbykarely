/* ==========================================================================
   Success by Karely — Cloud Functions v2 (avisos por Telegram)
   --------------------------------------------------------------------------
   Secretos (nunca en el código ni en el navegador):
     firebase functions:secrets:set TELEGRAM_TOKEN
     firebase functions:secrets:set TELEGRAM_CHAT_ID
     firebase functions:secrets:set TELEGRAM_WEBHOOK_SECRET   (solo si usas responder desde Telegram)
   Avisos:
     - Nuevo lead ............ 🆕  (leads, source "landing")
     - Nuevo suscriptor ...... 📰  (leads, source "blog-newsletter")
     - Nuevo registro ........ 👤  (users)
     - Mensaje de cliente .... 💬  (chats/{uid}/messages, from "client")
     - Documento del cliente . 📎  (users/{uid}/documents, uploadedBy "client")
   Opcional: responder a un aviso 💬 en Telegram envía la respuesta al chat
   del cliente en el portal (función telegramWebhook).
   ========================================================================== */
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { logger, setGlobalOptions } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 5 });

const TELEGRAM_TOKEN = defineSecret('TELEGRAM_TOKEN');
const TELEGRAM_CHAT_ID = defineSecret('TELEGRAM_CHAT_ID');
const TELEGRAM_WEBHOOK_SECRET = defineSecret('TELEGRAM_WEBHOOK_SECRET');
// Dirección pública del sitio (para los enlaces al panel). Se pregunta al desplegar.
const URL_SITIO = defineString('URL_SITIO', { default: 'https://successbykarely.dgp-link.com' });

const SERVICIOS = {
  universidad: 'Universidad, becas y FAFSA',
  carrera: 'Carrera y currículum',
  equivalencia: 'Equivalencia y traducciones',
  credito_personal: 'Crédito personal',
  credito_empresa: 'Crédito empresarial',
  empresa: 'Abrir negocio (LLC)',
  toolkits: 'Toolkits 6SGS',
};

/* Telegram con parse_mode HTML: todo texto de usuario se escapa */
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const corto = (v, n = 600) => { const s = String(v ?? '').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const panel = (hash) => `${URL_SITIO.value().replace(/\/$/, '')}/admin/${hash}`;

async function enviarTelegram(texto, extra = {}) {
  const token = TELEGRAM_TOKEN.value();
  const chatId = TELEGRAM_CHAT_ID.value();
  if (!token || !chatId) { logger.warn('Telegram sin configurar: faltan secretos'); return; }
  const respuesta = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'HTML', disable_web_page_preview: true, ...extra }),
  });
  if (!respuesta.ok) logger.error('Telegram respondió con error', respuesta.status, await respuesta.text());
}

const opciones = (documento) => ({ document: documento, secrets: [TELEGRAM_TOKEN, TELEGRAM_CHAT_ID] });

/* ---------- Leads y suscriptores ---------- */
export const avisoLead = onDocumentCreated(opciones('leads/{leadId}'), async (evento) => {
  const l = evento.data?.data();
  if (!l) return;
  if (l.source === 'blog-newsletter') {
    await enviarTelegram(`📰 <b>Nuevo suscriptor del blog</b>\n${esc(l.email)}\n\n<a href="${panel('#leads')}">Ver en el panel</a>`);
    return;
  }
  const servicios = (l.services || []).map((s) => SERVICIOS[s] || s).join(', ') || '—';
  const lineas = [
    '🆕 <b>Nuevo lead</b>',
    `<b>Nombre:</b> ${esc(`${l.firstName || ''} ${l.lastName || ''}`.trim() || '—')}`,
    `<b>Correo:</b> ${esc(l.email)}`,
    `<b>Teléfono:</b> ${esc(l.phone || '—')}`,
    `<b>Servicios:</b> ${esc(servicios)}`,
    l.country || l.state ? `<b>Origen / estado:</b> ${esc([l.country, l.state].filter(Boolean).join(' · '))}` : '',
    l.message ? `<b>Mensaje:</b> ${esc(corto(l.message))}` : '',
    '',
    `<a href="${panel('#leads')}">Abrir en el panel</a>`,
  ].filter((x) => x !== '');
  await enviarTelegram(lineas.join('\n'));
});

/* ---------- Registros en el portal ---------- */
export const avisoRegistro = onDocumentCreated(opciones('users/{uid}'), async (evento) => {
  const u = evento.data?.data();
  if (!u) return;
  const servicios = (u.services || []).map((s) => SERVICIOS[s] || s).join(', ') || '—';
  await enviarTelegram([
    '👤 <b>Nuevo registro en el portal</b>',
    `<b>Nombre:</b> ${esc(`${u.firstName || ''} ${u.lastName || ''}`.trim())}`,
    `<b>Correo:</b> ${esc(u.email)}`,
    `<b>Teléfono:</b> ${esc(u.phone || '—')}`,
    `<b>Servicios:</b> ${esc(servicios)}`,
    '',
    `<a href="${panel(`#clientes/${encodeURIComponent(evento.params.uid)}`)}">Ver ficha</a>`,
  ].join('\n'));
});

/* ---------- Mensajes de clientes ---------- */
export const avisoMensaje = onDocumentCreated(opciones('chats/{uid}/messages/{msgId}'), async (evento) => {
  const m = evento.data?.data();
  if (!m || m.from !== 'client') return;
  const { uid } = evento.params;
  // La etiqueta #uid permite responder desde Telegram (función telegramWebhook)
  await enviarTelegram([
    `💬 <b>Mensaje de ${esc(m.authorName || 'un cliente')}</b>`,
    esc(corto(m.text, 1500)),
    '',
    `<a href="${panel(`#mensajes/${encodeURIComponent(uid)}`)}">Responder en el panel</a>`,
    `<code>#uid:${esc(uid)}</code>`,
  ].join('\n'));
});

/* ---------- Documentos subidos por clientes ---------- */
export const avisoDocumento = onDocumentCreated(opciones('users/{uid}/documents/{docId}'), async (evento) => {
  const d = evento.data?.data();
  if (!d || d.uploadedBy !== 'client') return;
  const { uid } = evento.params;
  const perfil = (await getFirestore().doc(`users/${uid}`).get()).data() || {};
  await enviarTelegram([
    '📎 <b>Nuevo documento</b>',
    `<b>Cliente:</b> ${esc(`${perfil.firstName || ''} ${perfil.lastName || ''}`.trim() || perfil.email || uid)}`,
    `<b>Archivo:</b> ${esc(d.name)}`,
    '',
    `<a href="${panel(`#clientes/${encodeURIComponent(uid)}`)}">Revisar en el panel</a>`,
  ].join('\n'));
});

/* ==========================================================================
   Opcional: responder al chat desde Telegram
   1) firebase functions:secrets:set TELEGRAM_WEBHOOK_SECRET  (una clave larga al azar)
   2) Despliega y registra el webhook (ver README, sección Telegram).
   Solo acepta respuestas ("Responder") a un aviso 💬 dentro del chat configurado.
   ========================================================================== */
export const telegramWebhook = onRequest({ secrets: [TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_WEBHOOK_SECRET] }, async (req, res) => {
  if (req.method !== 'POST' || req.get('X-Telegram-Bot-Api-Secret-Token') !== TELEGRAM_WEBHOOK_SECRET.value()) {
    res.status(403).send('forbidden');
    return;
  }
  const mensaje = req.body?.message;
  res.status(200).send('ok'); // Telegram solo necesita saber que llegó
  try {
    if (!mensaje?.text || String(mensaje.chat?.id) !== String(TELEGRAM_CHAT_ID.value())) return;
    const original = mensaje.reply_to_message?.text || '';
    const uid = original.match(/#uid:([A-Za-z0-9_-]{6,128})/)?.[1];
    if (!uid) return;
    const db = getFirestore();
    const chat = db.doc(`chats/${uid}`);
    if (!(await chat.get()).exists) return;
    const texto = mensaje.text.slice(0, 2000);
    const autor = [mensaje.from?.first_name, mensaje.from?.last_name].filter(Boolean).join(' ') || 'Equipo Success by Karely';
    await chat.collection('messages').add({ text: texto, from: 'admin', authorName: autor, createdAt: FieldValue.serverTimestamp() });
    await chat.set({ lastMessage: texto.slice(0, 140), updatedAt: FieldValue.serverTimestamp(), unreadByClient: FieldValue.increment(1), unreadByAdmin: 0 }, { merge: true });
    await enviarTelegram('✅ Respuesta enviada al portal.', { reply_to_message_id: mensaje.message_id });
  } catch (error) {
    logger.error('No se pudo procesar la respuesta de Telegram', error);
  }
});
