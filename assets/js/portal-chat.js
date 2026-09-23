/* ==========================================================================
   Portal · Mensajes (Fase 4)
   chats/{uid} (resumen y no leídos) + chats/{uid}/messages en tiempo real.
   El cliente escribe con from == "client"; nunca edita mensajes.
   ========================================================================== */
import { $, escaparHTML, toast, formatearFecha, fechaLocal, avisarAppsScript } from './util.js';
import { t } from './i18n.js';

let ctx = null;
let mensajes = [];
let chat = null;
let desuscribirChat = null;
let desuscribirMensajes = null;
let enVista = false;

export const ultimosMensajes = (n = 2) => mensajes.slice(-n);
export const noLeidos = () => Number(chat?.unreadByClient) || 0;

export function escucharChat() {
  const { fb, usuario } = ctx;
  if (!fb || !usuario || desuscribirChat) return;
  const { fs, db } = fb;
  desuscribirChat = fs.onSnapshot(fs.doc(db, 'chats', usuario.uid), (snap) => {
    chat = snap.exists() ? snap.data() : null;
    ctx.alCambiarMensajes();
    if (enVista && noLeidos()) marcarLeido();
  }, (error) => console.warn('[chat] Resumen no disponible:', error.message));

  const consulta = fs.query(fs.collection(db, 'chats', usuario.uid, 'messages'), fs.orderBy('createdAt', 'asc'), fs.limitToLast(150));
  desuscribirMensajes = fs.onSnapshot(consulta, (snap) => {
    mensajes = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
    pintarMensajes();
    ctx.alCambiarMensajes();
  }, (error) => console.warn('[chat] Mensajes no disponibles:', error.message));
}

export function detenerChat() {
  desuscribirChat?.(); desuscribirMensajes?.();
  desuscribirChat = null; desuscribirMensajes = null;
  mensajes = []; chat = null; enVista = false;
}

/* Llamado al entrar o salir de la vista Mensajes */
export function alMostrarMensajes(visible) {
  enVista = visible;
  if (!visible) return;
  pintarMensajes();
  if (noLeidos()) marcarLeido();
  setTimeout(() => $('#chat-texto')?.focus(), 50);
}

async function marcarLeido() {
  try {
    const { fs, db } = ctx.fb;
    await fs.updateDoc(fs.doc(db, 'chats', ctx.usuario.uid), { unreadByClient: 0 });
  } catch (error) {
    console.warn('[chat] No se marcó como leído:', error.message);
  }
}

function etiquetaDia(fecha) {
  const hoy = fechaLocal();
  const ayer = fechaLocal(Date.now() - 86400000);
  const dia = fechaLocal(fecha);
  if (dia === hoy) return t('chat.hoy');
  if (dia === ayer) return t('chat.ayer');
  return formatearFecha(fecha, ctx.idioma, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function pintarMensajes() {
  const zona = $('#chat-mensajes');
  if (!zona) return;
  if (!mensajes.length) {
    zona.innerHTML = `
      <div class="chat-vacio">
        <span class="vacio-icono" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg></span>
        <p>${escaparHTML(t('chat.vacio'))}</p>
      </div>`;
    return;
  }
  let diaAnterior = '';
  zona.innerHTML = mensajes.map((m) => {
    const fecha = m.createdAt?.toDate ? m.createdAt.toDate() : new Date();
    const dia = fechaLocal(fecha);
    const separador = dia !== diaAnterior ? `<p class="chat-dia"><span>${escaparHTML(etiquetaDia(fecha))}</span></p>` : '';
    diaAnterior = dia;
    const mio = m.from === 'client';
    const hora = new Intl.DateTimeFormat(ctx.idioma === 'en' ? 'en-US' : 'es-US', { hour: 'numeric', minute: '2-digit' }).format(fecha);
    return `${separador}
      <div class="burbuja-chat ${mio ? 'mia' : 'equipo'}">
        ${mio ? '' : `<span class="burbuja-autor">${escaparHTML(m.authorName || t('chat.titulo'))}</span>`}
        <p>${escaparHTML(m.text).replace(/\n/g, '<br>')}</p>
        <time>${escaparHTML(hora)}</time>
      </div>`;
  }).join('');
  zona.scrollTop = zona.scrollHeight;
}

async function enviar(texto) {
  const { fb, usuario, perfil } = ctx;
  const { fs, db } = fb;
  const limpio = texto.trim().slice(0, 2000);
  if (!limpio) return;
  const nombre = `${perfil?.firstName || ''} ${perfil?.lastName || ''}`.trim().slice(0, 130) || usuario.email;
  await fs.addDoc(fs.collection(db, 'chats', usuario.uid, 'messages'), {
    text: limpio,
    from: 'client',
    authorName: nombre,
    createdAt: fs.serverTimestamp(),
  });
  avisarAppsScript('mensaje', { authorName: nombre, text: limpio });
  await fs.updateDoc(fs.doc(db, 'chats', usuario.uid), {
    lastMessage: limpio.slice(0, 140),
    updatedAt: fs.serverTimestamp(),
    unreadByAdmin: fs.increment(1),
    clientName: nombre,
  }).catch((error) => console.warn('[chat] Resumen no actualizado:', error.message));
}

export function iniciarChat(contexto) {
  ctx = contexto;
  const form = $('#chat-form');
  const area = $('#chat-texto');
  const ajustarAltura = () => { area.style.height = 'auto'; area.style.height = `${Math.min(area.scrollHeight, 160)}px`; };
  area.addEventListener('input', ajustarAltura);
  area.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = area.value;
    if (!texto.trim()) return;
    area.value = '';
    ajustarAltura();
    try {
      await enviar(texto);
    } catch (error) {
      console.error('[chat] Envío:', error);
      area.value = texto;
      toast(t('chat.errEnvio'), { tipo: 'error' });
    }
  });
}
