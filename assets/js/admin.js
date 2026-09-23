/* ==========================================================================
   Panel de administración (admin/index.html)
   Acceso solo si existe admins/{uid}. Menú y acciones según el rol
   (owner, staff, editor). Navegación por hash, búsqueda global y atajos.
   ========================================================================== */
import { cargarAuth, cargarFirestore } from './firebase.js';
import { $, $$, escaparHTML, toast } from './util.js';
import { iniciarI18n, t } from './i18n.js';
import {
  estado, puede, rol, nombreAdmin, icono, confirmarSalida, cerrarCajon, cajonAbierto,
  modalAbierto, cerrarModal, marcarSucio,
} from './admin-nucleo.js';
import resumen from './admin-resumen.js';
import clientes from './admin-clientes.js';
import leads from './admin-leads.js';
import mensajes from './admin-mensajes.js';
import cursos from './admin-cursos.js';
import { testimonios, anuncios } from './admin-contenido.js';
import imagenes from './admin-imagenes.js';
import exportar from './admin-exportar.js';
import { equipo, actividad } from './admin-equipo.js';

document.documentElement.classList.add('js');
estado.idioma = iniciarI18n();

/* Orden del menú. Cada módulo: { id, icono, clave, acceso, montar, desmontar?, buscar?, repintar? } */
const MODULOS = [resumen, clientes, leads, mensajes, cursos, testimonios, anuncios, imagenes, exportar, equipo, actividad];
const blogPendiente = import('./admin-blog.js').then((m) => m.default).catch(() => null);

const permitido = (m) => m.acceso === 'todos' || puede[m.acceso]?.();
let modulos = [];
let actual = null;

/* ---------- Tema ---------- */
const consultaOscuro = window.matchMedia('(prefers-color-scheme: dark)');
function aplicarTema(tema) {
  const html = document.documentElement;
  html.dataset.tema = tema;
  html.dataset.efectivo = tema === 'oscuro' || (tema === 'sistema' && consultaOscuro.matches) ? 'oscuro' : 'claro';
  try { localStorage.setItem('sbk-tema', tema); } catch { /* sin almacenamiento */ }
}
aplicarTema(document.documentElement.dataset.tema || 'sistema');
consultaOscuro.addEventListener('change', () => aplicarTema(document.documentElement.dataset.tema));

/* ---------- Utilidades ---------- */
function ocultarCarga() {
  const c = $('#carga');
  if (!c) return;
  c.classList.add('oculta');
  setTimeout(() => c.remove(), 600);
}
function mostrarAcceso(mensaje = '') {
  $('#app').hidden = true;
  $('#acceso').hidden = false;
  $('#error-acceso').textContent = mensaje;
  const b = $('#btn-acceso');
  b.disabled = false;
  $('span', b).textContent = t('adm.entrar');
  ocultarCarga();
}

/* ---------- Menú lateral ---------- */
export function ponerContador(id, n) {
  const c = $(`#menu-admin a[data-modulo="${id}"] .contador`);
  if (!c) return;
  c.hidden = !n;
  c.textContent = n > 99 ? '99+' : String(n);
}
function pintarMenu() {
  $('#menu-admin').innerHTML = modulos.map((m) => `
    <a href="#${m.id}" data-modulo="${m.id}">${icono(m.icono)}<span>${escaparHTML(t(m.clave))}</span><span class="contador" hidden></span></a>`).join('');
  $('#rol-actual').textContent = t(`adm.rol.${rol()}`);
  $('#admin-nombre').textContent = nombreAdmin();
  $('#admin-correo').textContent = estado.usuario.email;
  $('#admin-avatar').textContent = (nombreAdmin()[0] || 'K').toUpperCase();
}
function abrirLateral(abrir) {
  $('#lateral').classList.toggle('abierto', abrir);
  $('#velo').hidden = !abrir;
  $('#abrir-lateral').setAttribute('aria-expanded', String(abrir));
}

/* ---------- Navegación ---------- */
function partes() {
  return location.hash.replace('#', '').split('/').map((p) => decodeURIComponent(p)).filter(Boolean);
}
let navegando = false;
let hashAnterior = location.hash;
async function navegar() {
  if (navegando) return;
  const [id = modulos[0]?.id, ...params] = partes();
  const destino = modulos.find((m) => m.id === id) || modulos[0];
  if (!destino) return;
  // Sección inexistente o sin permiso para este rol: normalizar el hash
  if (destino.id !== id) history.replaceState(null, '', `#${destino.id}`);
  if (actual && actual !== destino && !confirmarSalida()) { history.replaceState(null, '', hashAnterior); return; }
  if (cajonAbierto()) cerrarCajon(true);
  navegando = true;
  hashAnterior = location.hash;
  try {
    if (actual && actual !== destino) actual.desmontar?.();
    const cambio = actual !== destino;
    actual = destino;
    marcarSucio(false);
    $$('#menu-admin a').forEach((a) => {
      if (a.dataset.modulo === destino.id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    const titulo = $('#titulo-vista');
    titulo.textContent = t(destino.clave);
    document.title = `${t(destino.clave)} | Panel · Success by Karely`;
    abrirLateral(false);
    const vista = $('#vista');
    if (cambio) { vista.innerHTML = ''; vista.classList.remove('vista'); void vista.offsetWidth; vista.classList.add('vista'); }
    await destino.montar(vista, params, { cambio });
    if (cambio) window.scrollTo(0, 0);
  } catch (error) {
    console.error('[admin] Error al abrir la sección:', error);
    toast(t('adm.errCargar'), { tipo: 'error' });
  } finally {
    navegando = false;
  }
}

/* ---------- Búsqueda global ---------- */
let temporizador = 0;
let seleccion = -1;
async function buscarGlobal(q) {
  const caja = $('#resultados-globales');
  const input = $('#buscar-global');
  if (q.trim().length < 2) { caja.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
  const grupos = await Promise.all(modulos.filter((m) => m.buscar).map(async (m) => {
    try { return { m, items: (await m.buscar(q.trim())).slice(0, 5) }; } catch { return { m, items: [] }; }
  }));
  const conResultados = grupos.filter((g) => g.items.length);
  seleccion = -1;
  caja.innerHTML = conResultados.length
    ? conResultados.map(({ m, items }) => `
      <p class="resultado-grupo">${escaparHTML(t(m.clave))}</p>
      ${items.map((r) => `<a class="resultado" role="option" href="${escaparHTML(r.href)}"><strong>${escaparHTML(r.titulo)}</strong><span>${escaparHTML(r.sub || '')}</span></a>`).join('')}`).join('')
    : `<p class="resultado-vacio">${escaparHTML(t('adm.sinResultados', { q }))}</p>`;
  caja.hidden = false;
  input.setAttribute('aria-expanded', 'true');
}
function cerrarBusqueda() {
  $('#resultados-globales').hidden = true;
  $('#buscar-global').setAttribute('aria-expanded', 'false');
}
function iniciarBusqueda() {
  const input = $('#buscar-global');
  const caja = $('#resultados-globales');
  input.addEventListener('input', () => { clearTimeout(temporizador); temporizador = setTimeout(() => buscarGlobal(input.value), 220); });
  input.addEventListener('keydown', (e) => {
    const opciones = $$('.resultado', caja);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!opciones.length) return;
      seleccion = (seleccion + (e.key === 'ArrowDown' ? 1 : -1) + opciones.length) % opciones.length;
      opciones.forEach((o, i) => o.classList.toggle('activo', i === seleccion));
      opciones[seleccion].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && seleccion >= 0) {
      e.preventDefault();
      opciones[seleccion].click();
    }
  });
  caja.addEventListener('click', (e) => { if (e.target.closest('.resultado')) { cerrarBusqueda(); input.value = ''; } });
  document.addEventListener('click', (e) => { if (!e.target.closest('.busqueda-global')) cerrarBusqueda(); });
}

/* ---------- Atajos de teclado ---------- */
function iniciarAtajos() {
  document.addEventListener('keydown', (e) => {
    const enCampo = e.target.closest('input, textarea, select, [contenteditable="true"]');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('admin:guardar'));
      return;
    }
    if (e.key === '/' && !enCampo) { e.preventDefault(); $('#buscar-global').focus(); return; }
    if (e.key === 'Escape') {
      if (modalAbierto()) { cerrarModal(false); return; }
      if (cajonAbierto()) { cerrarCajon(); return; }
      if (!$('#resultados-globales').hidden) { cerrarBusqueda(); return; }
      if ($('#lateral').classList.contains('abierto')) abrirLateral(false);
    }
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-cerrar-cajon]')) cerrarCajon();
    if (e.target.closest('[data-cerrar-modal]')) cerrarModal(false);
  });
}

/* ---------- Sesión ---------- */
async function alCambiarSesion(user) {
  estado.usuario = user;
  if (!user) { estado.admin = null; mostrarAcceso(); return; }
  try {
    const snap = await estado.fb.fs.getDoc(estado.fb.fs.doc(estado.fb.db, 'admins', user.uid));
    if (!snap.exists()) {
      await estado.fb.fa.signOut(estado.fb.auth);
      mostrarAcceso(t('adm.sinAcceso'));
      return;
    }
    estado.admin = { uid: user.uid, ...snap.data() };
  } catch (error) {
    console.error('[admin] Verificación de rol:', error);
    await estado.fb.fa.signOut(estado.fb.auth).catch(() => {});
    mostrarAcceso(t('adm.sinAcceso'));
    return;
  }
  const blog = await blogPendiente;
  const lista = [...MODULOS];
  if (blog) lista.splice(5, 0, blog);
  modulos = lista.filter(permitido);
  pintarMenu();
  $('#acceso').hidden = true;
  $('#app').hidden = false;
  ocultarCarga();
  modulos.forEach((m) => m.alIniciarSesion?.({ ponerContador }));
  if (!location.hash) history.replaceState(null, '', `#${modulos[0].id}`);
  navegar();
}

async function arrancar() {
  iniciarBusqueda();
  iniciarAtajos();
  $('#abrir-lateral').addEventListener('click', () => abrirLateral(true));
  $('#cerrar-lateral').addEventListener('click', () => abrirLateral(false));
  $('#velo').addEventListener('click', () => abrirLateral(false));
  $('#btn-tema').addEventListener('click', () => aplicarTema(document.documentElement.dataset.efectivo === 'oscuro' ? 'claro' : 'oscuro'));
  $('#btn-salir').addEventListener('click', async () => {
    if (!confirmarSalida()) return;
    modulos.forEach((m) => m.alCerrarSesion?.());
    actual?.desmontar?.();
    actual = null;
    await estado.fb.fa.signOut(estado.fb.auth);
    history.replaceState(null, '', location.pathname);
  });
  window.addEventListener('hashchange', navegar);

  $('#form-acceso').addEventListener('submit', async (e) => {
    e.preventDefault();
    const error = $('#error-acceso');
    error.textContent = '';
    if (!estado.fb) { error.textContent = t('acc.sinFirebase'); return; }
    const boton = $('#btn-acceso');
    boton.disabled = true;
    $('span', boton).textContent = t('acc.entrando');
    try {
      await estado.fb.fa.signInWithEmailAndPassword(estado.fb.auth, $('#a-correo').value.trim(), $('#a-contrasena').value);
    } catch (err) {
      const clave = `err.${String(err.code || '').replace('auth/', '').replace(/^(wrong-password|user-not-found)$/, 'invalid-credential')}`;
      error.textContent = t(clave) !== clave ? t(clave) : t('err.generico');
      boton.disabled = false;
      $('span', boton).textContent = t('adm.entrar');
    }
  });

  const [auth, firestore] = await Promise.all([cargarAuth(), cargarFirestore()]);
  if (!auth || !firestore) { mostrarAcceso(t('acc.sinFirebase')); return; }
  estado.fb = { ...auth, ...firestore };
  estado.fb.fa.onAuthStateChanged(estado.fb.auth, alCambiarSesion);
}

/* Al cambiar de idioma: repintar menú y la sección actual */
document.addEventListener('idioma', (e) => {
  estado.idioma = e.detail;
  if (!estado.admin) return;
  pintarMenu();
  modulos.forEach((m) => m.alIniciarSesion && m.refrescarContador?.({ ponerContador }));
  $('#titulo-vista').textContent = actual ? t(actual.clave) : '';
  $$('#menu-admin a').forEach((a) => { if (a.dataset.modulo === actual?.id) a.setAttribute('aria-current', 'page'); });
  if (actual) actual.repintar ? actual.repintar() : navegar();
});

arrancar();
