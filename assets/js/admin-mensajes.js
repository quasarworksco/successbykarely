/* ==========================================================================
   Panel admin · Mensajes
   Bandeja en tiempo real de chats/{uid} con no leídos destacados y
   conversación con envío como "admin".
   ========================================================================== */
import { $, escaparHTML, toast, fechaLocal } from './util.js';
import { t, registrarTextos } from './i18n.js';
import { estado, fs, col, ref, ahora, relativo, ms, normalizar, estadoVacio, nombreAdmin } from './admin-nucleo.js';

let chats = [];
let desuscribirChats = null;
let desuscribirMensajes = null;
let abierto = null;
let vistaActual = null;
let ponerContadorMenu = null;
let filtro = '';

function escucharBandeja() {
  if (desuscribirChats) return;
  desuscribirChats = fs().onSnapshot(col('chats'), (snap) => {
    chats = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))
      .sort((a, b) => ms(b.updatedAt) - ms(a.updatedAt));
    ponerContadorMenu?.('mensajes', chats.reduce((s, c) => s + (Number(c.unreadByAdmin) || 0), 0));
    pintarBandeja();
  }, (error) => console.warn('[mensajes] Bandeja:', error.message));
}

function pintarBandeja() {
  const lista = $('#bandeja');
  if (!lista) return;
  const q = normalizar(filtro);
  const visibles = chats.filter((c) => !q || normalizar(`${c.clientName} ${c.lastMessage}`).includes(q));
  lista.innerHTML = visibles.length ? visibles.map((c) => `
    <li><a href="#mensajes/${encodeURIComponent(c.id)}" class="hilo${c.id === abierto ? ' activo' : ''}${c.unreadByAdmin ? ' sin-leer' : ''}"${c.id === abierto ? ' aria-current="true"' : ''}>
      <span class="avatar">${escaparHTML((c.clientName || '?').trim()[0] || '?')}</span>
      <span class="hilo-texto"><strong>${escaparHTML(c.clientName || c.id)}</strong><span>${escaparHTML(c.lastMessage || t('msj.sinMensajes'))}</span></span>
      <span class="hilo-meta"><time>${escaparHTML(relativo(c.updatedAt))}</time>${c.unreadByAdmin ? `<span class="contador">${c.unreadByAdmin}</span>` : ''}</span>
    </a></li>`).join('') : `<li class="lista-vacia" style="padding:16px">${escaparHTML(t('msj.vacio'))}</li>`;
}

function abrirConversacion(uid) {
  desuscribirMensajes?.();
  desuscribirMensajes = null;
  abierto = uid;
  pintarBandeja();
  const zona = $('#conversacion');
  $('.bandeja-layout')?.classList.toggle('con-conversacion', Boolean(uid));
  if (!uid) { zona.innerHTML = estadoVacio(t('msj.elige'), t('msj.eligeD')); return; }
  const chat = chats.find((c) => c.id === uid);
  zona.innerHTML = `
    <div class="chat panel chat-admin">
      <header class="chat-cabecera">
        <a class="btn-icono volver-bandeja" href="#mensajes" aria-label="${escaparHTML(t('msj.volver'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></a>
        <span class="avatar">${escaparHTML((chat?.clientName || '?').trim()[0] || '?')}</span>
        <div><h2>${escaparHTML(chat?.clientName || uid)}</h2><a class="texto-suave-app" href="#clientes/${encodeURIComponent(uid)}">${escaparHTML(t('msj.verFicha'))}</a></div>
      </header>
      <div class="chat-mensajes" id="admin-mensajes" role="log" aria-live="polite" tabindex="0"></div>
      <form class="chat-form" id="admin-chat-form">
        <label class="solo-lectores" for="admin-chat-texto">${escaparHTML(t('msj.responder'))}</label>
        <textarea id="admin-chat-texto" rows="1" maxlength="2000" placeholder="${escaparHTML(t('msj.responderPh'))}"></textarea>
        <button type="submit" class="btn-enviar" aria-label="${escaparHTML(t('chat.enviar'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 4l-6 16-3-7Z"/><path d="m11 13 9-9"/></svg></button>
      </form>
    </div>`;

  const consulta = fs().query(col('chats', uid, 'messages'), fs().orderBy('createdAt', 'asc'), fs().limitToLast(200));
  desuscribirMensajes = fs().onSnapshot(consulta, (snap) => {
    const mensajes = snap.docs.map((d) => d.data({ serverTimestamps: 'estimate' }));
    pintarMensajes(mensajes);
    if (chats.find((c) => c.id === uid)?.unreadByAdmin) fs().updateDoc(ref('chats', uid), { unreadByAdmin: 0 }).catch(() => {});
  }, (error) => console.warn('[mensajes] Conversación:', error.message));

  const form = $('#admin-chat-form');
  const area = $('#admin-chat-texto');
  const ajustar = () => { area.style.height = 'auto'; area.style.height = `${Math.min(area.scrollHeight, 160)}px`; };
  area.addEventListener('input', ajustar);
  area.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = area.value.trim().slice(0, 2000);
    if (!texto) return;
    area.value = ''; ajustar();
    try {
      await fs().addDoc(col('chats', uid, 'messages'), { text: texto, from: 'admin', authorName: nombreAdmin().slice(0, 120), createdAt: ahora() });
      await fs().updateDoc(ref('chats', uid), { lastMessage: texto.slice(0, 140), updatedAt: ahora(), unreadByClient: fs().increment(1), unreadByAdmin: 0 });
    } catch (error) {
      console.error(error);
      area.value = texto;
      toast(t('chat.errEnvio'), { tipo: 'error' });
    }
  });
  setTimeout(() => area.focus(), 50);
}

function pintarMensajes(mensajes) {
  const zona = $('#admin-mensajes');
  if (!zona) return;
  if (!mensajes.length) { zona.innerHTML = `<div class="chat-vacio"><p>${escaparHTML(t('msj.sinMensajesD'))}</p></div>`; return; }
  let dia = '';
  zona.innerHTML = mensajes.map((m) => {
    const f = m.createdAt?.toDate ? m.createdAt.toDate() : new Date();
    const d = fechaLocal(f);
    const sep = d !== dia ? `<p class="chat-dia"><span>${escaparHTML(new Intl.DateTimeFormat(estado.idioma === 'en' ? 'en-US' : 'es-US', { weekday: 'long', day: 'numeric', month: 'long' }).format(f))}</span></p>` : '';
    dia = d;
    const propio = m.from === 'admin';
    return `${sep}<div class="burbuja-chat ${propio ? 'mia' : 'equipo'}">
      <span class="burbuja-autor">${escaparHTML(m.authorName || '')}</span>
      <p>${escaparHTML(m.text).replace(/\n/g, '<br>')}</p>
      <time>${escaparHTML(new Intl.DateTimeFormat(estado.idioma === 'en' ? 'en-US' : 'es-US', { hour: 'numeric', minute: '2-digit' }).format(f))}</time>
    </div>`;
  }).join('');
  zona.scrollTop = zona.scrollHeight;
}

function montar(vista, params) {
  vistaActual = vista;
  if (!vista.querySelector('#bandeja')) {
    vista.innerHTML = `
      <div class="bandeja-layout">
        <div class="panel bandeja-panel">
          <input type="search" class="campo-buscar" id="buscar-chat" placeholder="${escaparHTML(t('msj.buscar'))}" aria-label="${escaparHTML(t('msj.buscar'))}">
          <ul class="bandeja" id="bandeja"></ul>
        </div>
        <div class="conversacion" id="conversacion"></div>
      </div>`;
    $('#buscar-chat').addEventListener('input', (e) => { filtro = e.target.value; pintarBandeja(); });
    escucharBandeja();
    pintarBandeja();
  }
  abrirConversacion(params[0] || null);
}

export default {
  id: 'mensajes',
  icono: 'mensajes',
  clave: 'msj.menu',
  acceso: 'staff',
  montar,
  desmontar: () => { desuscribirMensajes?.(); desuscribirMensajes = null; abierto = null; },
  repintar: () => { if (vistaActual) { vistaActual.innerHTML = ''; montar(vistaActual, abierto ? [abierto] : []); } },
  alIniciarSesion: ({ ponerContador }) => { ponerContadorMenu = ponerContador; escucharBandeja(); },
  alCerrarSesion: () => { desuscribirChats?.(); desuscribirChats = null; desuscribirMensajes?.(); desuscribirMensajes = null; chats = []; },
  buscar: async (q) => {
    const n = normalizar(q);
    return chats.filter((c) => normalizar(`${c.clientName} ${c.lastMessage}`).includes(n))
      .map((c) => ({ titulo: c.clientName || c.id, sub: c.lastMessage || '', href: `#mensajes/${encodeURIComponent(c.id)}` }));
  },
};

registrarTextos({
  es: {
    'msj.menu': 'Mensajes',
    'msj.buscar': 'Buscar conversación',
    'msj.vacio': 'Aún no hay conversaciones.',
    'msj.sinMensajes': 'Sin mensajes todavía',
    'msj.sinMensajesD': 'Aún no hay mensajes en esta conversación. Escribe el primero.',
    'msj.elige': 'Elige una conversación',
    'msj.eligeD': 'Las conversaciones con mensajes sin leer aparecen destacadas a la izquierda.',
    'msj.volver': 'Volver a la bandeja',
    'msj.verFicha': 'Ver ficha del cliente',
    'msj.responder': 'Responder',
    'msj.responderPh': 'Escribe tu respuesta…',
  },
  en: {
    'msj.menu': 'Messages',
    'msj.buscar': 'Search conversation',
    'msj.vacio': 'No conversations yet.',
    'msj.sinMensajes': 'No messages yet',
    'msj.sinMensajesD': 'No messages in this conversation yet. Write the first one.',
    'msj.elige': 'Choose a conversation',
    'msj.eligeD': 'Conversations with unread messages are highlighted on the left.',
    'msj.volver': 'Back to inbox',
    'msj.verFicha': 'View client profile',
    'msj.responder': 'Reply',
    'msj.responderPh': 'Write your reply…',
  },
});
