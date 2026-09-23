/* ==========================================================================
   Portal del cliente (portal/index.html)
   Acceso (login, registro en 2 pasos, recuperación), onboarding, menú
   lateral, vistas, inicio con anillos de progreso, comunidad y perfil.
   ========================================================================== */
import {
  CONFIG, SERVICIOS, ETAPAS, REFERENCIAS, ESTADOS_EEUU, PAISES_SUGERIDOS, esPendiente,
} from './config.js';
import { cargarAuth, cargarFirestore } from './firebase.js';
import {
  $, $$, escaparHTML, toast, formatearFecha, aFecha, campo,
  pintarMarcadores, aplicarMedios, leerCacheMedios, leerMediosFirestore, enlaceWhatsApp,
} from './util.js';
import { iniciarI18n, t, cambiarIdioma } from './i18n.js';

document.documentElement.classList.add('js');
let idioma = iniciarI18n();

/* ---------- Estado ---------- */
let fb = null;          // { auth, fa, db, fs }
let usuario = null;     // usuario de Firebase Auth
let perfil = null;      // documento users/{uid}
let registrando = false;
let anuncios = [];
let medios = { medios: {}, galerias: {} };
let perfilSucio = false;

const VISTAS = ['inicio', 'ruta', 'plan', 'documentos', 'mensajes', 'articulos', 'comunidad', 'perfil'];
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REGEX_TELEFONO = /^\+?[\d\s().-]{7,30}$/;
const SITUACIONES = ['estudiante', 'padre', 'profesional', 'emprendedor', 'otro'];

/* Progreso por etapa: se alimenta con los cursos en la Fase 3 */
let progresoEtapas = { 1: 0, 2: 0, 3: 0, 4: 0 };

const ICONOS = {
  racha: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5Z"/></svg>',
  ruta: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/></svg>',
  paso: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  tareas: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 6 1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17M11 6h9M11 12h9M11 18h9"/></svg>',
  mensajes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  anuncios: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h3l6 4V6L7 10Z"/><path d="M16 9a4 4 0 0 1 0 6"/></svg>',
  telegram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 4 3 11l6 2 2 6 3-4 5 4 2-15Z"/><path d="m9 13 9-6-7 8"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.2-4A8 8 0 1 1 8 18.8Z"/><path d="M9 9.5c.3 1.8 2.7 4.2 4.5 4.5l1.2-1.1 1.8.9c-.2 1.2-1 1.7-2 1.7-3.1 0-6.5-3.4-6.5-6.5 0-1 .5-1.8 1.7-2l.9 1.8Z"/></svg>',
  tienda: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.5 12h-11Z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/></svg>',
};

/* ==========================================================================
   Tema claro / oscuro
   ========================================================================== */
const CLAVE_TEMA = 'sbk-tema';
const consultaOscuro = window.matchMedia('(prefers-color-scheme: dark)');

function temaActual() {
  return document.documentElement.dataset.tema || 'sistema';
}
function aplicarTema(tema) {
  if (!['claro', 'oscuro', 'sistema'].includes(tema)) tema = 'sistema';
  const html = document.documentElement;
  html.dataset.tema = tema;
  const oscuro = tema === 'oscuro' || (tema === 'sistema' && consultaOscuro.matches);
  html.dataset.efectivo = oscuro ? 'oscuro' : 'claro';
  try { localStorage.setItem(CLAVE_TEMA, tema); } catch { /* sin almacenamiento */ }
  const radio = $(`#form-perfil input[name="theme"][value="${tema}"]`);
  if (radio) radio.checked = true;
}
consultaOscuro.addEventListener('change', () => aplicarTema(temaActual()));
aplicarTema(temaActual());

/* ==========================================================================
   Utilidades de la página
   ========================================================================== */
function iniciales(p = perfil) {
  const n = (p?.firstName || usuario?.displayName || 'K').trim();
  const a = (p?.lastName || '').trim();
  return ((n[0] || '') + (a[0] || '')).toUpperCase() || 'K';
}
function mensajeError(error) {
  const codigo = String(error?.code || '').replace('auth/', '');
  const alias = { 'wrong-password': 'invalid-credential', 'user-not-found': 'invalid-credential', 'missing-password': 'invalid-credential' };
  const clave = `err.${alias[codigo] || codigo}`;
  const texto = t(clave);
  if (texto !== clave) return texto;
  if (codigo === 'permission-denied') return t('err.permiso');
  return t('err.generico');
}
function ocultarCarga() {
  const carga = $('#carga');
  if (!carga || carga.classList.contains('oculta')) return;
  carga.classList.add('oculta');
  setTimeout(() => carga.remove(), 600);
}
function botonOcupado(boton, ocupado, claveTexto) {
  boton.disabled = ocupado;
  const span = $('span', boton) || boton;
  if (ocupado) { boton.dataset.textoOriginal = span.dataset.i18n || ''; span.textContent = t(claveTexto); }
  else if (boton.dataset.textoOriginal) span.textContent = t(boton.dataset.textoOriginal);
}
const esURLSegura = (url) => typeof url === 'string' && url.startsWith('https://');

/* ==========================================================================
   Opciones de los formularios (se repintan al cambiar de idioma)
   ========================================================================== */
function opcionesSelect(select, opciones, vacio = t('form.elegir')) {
  if (!select) return;
  const valor = select.value;
  select.innerHTML = `<option value="">${escaparHTML(vacio)}</option>`
    + opciones.map(([v, texto]) => `<option value="${escaparHTML(v)}">${escaparHTML(texto)}</option>`).join('');
  select.value = valor;
}
function chipsServicios(contenedor) {
  if (!contenedor) return;
  const marcados = new Set($$('input:checked', contenedor).map((i) => i.value));
  contenedor.innerHTML = SERVICIOS.map((s) => `
    <label class="chip-opcion"><input type="checkbox" name="services" value="${s.id}"${marcados.has(s.id) ? ' checked' : ''}><span>${escaparHTML(s[idioma] || s.es)}</span></label>`).join('');
}
function llenarOpciones() {
  const estados = [...ESTADOS_EEUU.map((e) => [e, e]), ['Fuera de EE. UU.', t('form.fueraEEUU')]];
  const situaciones = SITUACIONES.map((s) => [s, t(`reg.sit.${s}`)]);
  const referencias = REFERENCIAS.map((r) => [r.id, r[idioma] || r.es]);
  ['#g-estado', '#p-estado'].forEach((s) => opcionesSelect($(s), estados));
  ['#g-situacion', '#p-situacion'].forEach((s) => opcionesSelect($(s), situaciones));
  opcionesSelect($('#g-referencia'), referencias);
  opcionesSelect($('#p-etapa'), ETAPAS.map((e) => [String(e.n), `${e.n}. ${e[idioma]}`]), t('perfil.etapaNinguna'));
  chipsServicios($('#g-servicios'));
  chipsServicios($('#p-servicios'));
  $('#lista-paises').innerHTML = PAISES_SUGERIDOS.map((p) => `<option value="${escaparHTML(p)}">`).join('');
  const hoy = new Date().toISOString().slice(0, 10);
  ['#g-nacimiento', '#p-nacimiento'].forEach((s) => { const i = $(s); if (i) i.max = hoy; });
}

/* ==========================================================================
   ACCESO: pestañas, login, recuperación y registro
   ========================================================================== */
function activarPestana(cual, enfocar = false) {
  const pestanas = $('#pestanas');
  pestanas.dataset.activa = cual;
  const esRegistro = cual === 'registro';
  $('#tab-registro').setAttribute('aria-selected', String(esRegistro));
  $('#tab-entrar').setAttribute('aria-selected', String(!esRegistro));
  $('#tab-registro').tabIndex = esRegistro ? 0 : -1;
  $('#tab-entrar').tabIndex = esRegistro ? -1 : 0;
  $('#panel-registro').hidden = !esRegistro;
  $('#panel-entrar').hidden = esRegistro;
  $('#panel-recuperar').hidden = true;
  if (enfocar) (esRegistro ? $('#tab-registro') : $('#tab-entrar')).focus();
}

function mostrarAcceso() {
  $('#app').hidden = true;
  $('#acceso').hidden = false;
  $('#onboarding').hidden = true;
}

function iniciarAcceso() {
  const params = new URLSearchParams(location.search);
  activarPestana(params.get('registro') === '1' ? 'registro' : 'entrar');

  $('#tab-registro').addEventListener('click', () => activarPestana('registro'));
  $('#tab-entrar').addEventListener('click', () => activarPestana('entrar'));
  $('#pestanas').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    activarPestana($('#pestanas').dataset.activa === 'entrar' ? 'registro' : 'entrar', true);
  });

  // Mostrar / ocultar contraseña
  $$('.ver-contrasena').forEach((boton) => {
    boton.addEventListener('click', () => {
      const input = document.getElementById(boton.dataset.ver);
      const mostrar = input.type === 'password';
      input.type = mostrar ? 'text' : 'password';
      boton.setAttribute('aria-pressed', String(mostrar));
      boton.setAttribute('aria-label', t(mostrar ? 'acc.ocultar' : 'acc.mostrar'));
    });
  });

  // Iniciar sesión
  $('#panel-entrar').addEventListener('submit', async (e) => {
    e.preventDefault();
    const error = $('#error-entrar');
    error.textContent = '';
    const correo = $('#e-correo').value.trim();
    const contrasena = $('#e-contrasena').value;
    if (!REGEX_CORREO.test(correo) || !contrasena) {
      error.textContent = !REGEX_CORREO.test(correo) ? t('err.invalid-email') : t('err.invalid-credential');
      return;
    }
    if (!fb) { error.textContent = t('acc.sinFirebase'); return; }
    const boton = $('#btn-entrar');
    botonOcupado(boton, true, 'acc.entrando');
    try {
      await fb.fa.signInWithEmailAndPassword(fb.auth, correo, contrasena);
    } catch (err) {
      error.textContent = mensajeError(err);
      botonOcupado(boton, false);
    }
  });

  // Recuperar contraseña
  $('#ir-recuperar').addEventListener('click', () => {
    $('#panel-entrar').hidden = true;
    $('#panel-recuperar').hidden = false;
    $('#ok-recuperar').hidden = true;
    $('#r-correo').value = $('#e-correo').value;
    $('#r-correo').focus();
  });
  $('#volver-entrar').addEventListener('click', () => { activarPestana('entrar'); $('#e-correo').focus(); });
  $('#panel-recuperar').addEventListener('submit', async (e) => {
    e.preventDefault();
    const error = $('#error-recuperar');
    error.textContent = '';
    const correo = $('#r-correo').value.trim();
    if (!REGEX_CORREO.test(correo)) { error.textContent = t('err.invalid-email'); return; }
    if (!fb) { error.textContent = t('acc.sinFirebase'); return; }
    const boton = $('#btn-recuperar');
    boton.disabled = true;
    try {
      await fb.fa.sendPasswordResetEmail(fb.auth, correo);
    } catch (err) {
      // Por privacidad no revelamos si el correo existe; solo mostramos errores de red o límite
      if (!['auth/user-not-found', 'auth/invalid-email'].includes(err.code)) { error.textContent = mensajeError(err); boton.disabled = false; return; }
    }
    $('#ok-recuperar').textContent = t('acc.recuperarOk');
    $('#ok-recuperar').hidden = false;
    boton.disabled = false;
  });

  iniciarRegistro();
}

/* ---------- Registro en 2 pasos ---------- */
function nivelContrasena(valor) {
  if (valor.length < 8) return 0;
  let puntos = 1;
  if (valor.length >= 12) puntos++;
  if (/[a-z]/.test(valor) && /[A-Z]/.test(valor)) puntos++;
  if (/\d/.test(valor) && /[^\w\s]/.test(valor)) puntos++;
  else if (/\d/.test(valor) || /[^\w\s]/.test(valor)) puntos += 0.5;
  return Math.min(4, Math.floor(puntos));
}

function irPaso(n) {
  $('#reg-paso-1').hidden = n !== 1;
  $('#reg-paso-2').hidden = n !== 2;
  $('#pasos-relleno').style.width = n === 1 ? '50%' : '100%';
  const texto = $('#pasos-texto');
  texto.dataset.i18n = n === 1 ? 'reg.paso1' : 'reg.paso2';
  texto.textContent = t(texto.dataset.i18n);
  const primero = $(n === 1 ? '#g-nombre' : '#g-pais');
  primero?.focus();
}

function validarPaso1() {
  const completar = $('#form-registro').classList.contains('modo-completar');
  const campos = [
    ['#g-nombre', (v) => v.trim().length > 0, 'form.errRequerido'],
    ['#g-apellido', (v) => v.trim().length > 0, 'form.errRequerido'],
    ['#g-telefono', (v) => REGEX_TELEFONO.test(v.trim()), 'form.errTelefono'],
  ];
  if (!completar) {
    campos.splice(2, 0, ['#g-correo', (v) => REGEX_CORREO.test(v.trim()), 'form.errCorreo']);
    campos.push(['#g-contrasena', (v) => v.length >= 8, 'reg.errContrasena']);
  }
  let primerError = null;
  campos.forEach(([sel, valido, clave]) => {
    const input = $(sel);
    const ok = valido(input.value);
    input.setAttribute('aria-invalid', String(!ok));
    if (!ok && !primerError) primerError = { input, clave };
  });
  $('#error-paso-1').textContent = primerError ? t(primerError.clave) : '';
  primerError?.input.focus();
  return !primerError;
}

function datosPerfilRegistro() {
  const form = $('#form-registro');
  const datos = new FormData(form);
  const texto = (n, max) => String(datos.get(n) || '').trim().slice(0, max);
  return {
    firstName: texto('firstName', 60),
    lastName: texto('lastName', 60),
    phone: texto('phone', 30),
    country: texto('country', 60),
    state: texto('state', 60),
    city: texto('city', 60),
    language: datos.get('language') === 'en' ? 'en' : 'es',
    birthDate: /^\d{4}-\d{2}-\d{2}$/.test(texto('birthDate', 10)) ? texto('birthDate', 10) : '',
    situation: SITUACIONES.includes(datos.get('situation')) ? datos.get('situation') : '',
    services: datos.getAll('services').filter((id) => SERVICIOS.some((s) => s.id === id)),
    referral: texto('referral', 40),
    consentMarketing: $('#g-marketing').checked,
  };
}

/* Crea users/{uid} y chats/{uid} para el usuario autenticado */
async function crearPerfil(user, datos) {
  const { db, fs } = fb;
  const ahora = fs.serverTimestamp();
  const documento = {
    ...datos,
    email: user.email,
    theme: temaActual(),
    onboardingDone: false,
    streak: 0,
    lastStudyDate: '',
    acceptedTermsAt: ahora,
    createdAt: ahora,
    updatedAt: ahora,
    lastActiveAt: ahora,
  };
  await fs.setDoc(fs.doc(db, 'users', user.uid), documento);
  try {
    await fs.setDoc(fs.doc(db, 'chats', user.uid), {
      clientName: `${datos.firstName} ${datos.lastName}`.slice(0, 130),
      lastMessage: '',
      updatedAt: fs.serverTimestamp(),
      unreadByAdmin: 0,
      unreadByClient: 0,
    });
  } catch (error) {
    console.warn('[portal] El chat ya existía o no se pudo crear:', error.message);
  }
  return { ...documento, createdAt: new Date(), acceptedTermsAt: new Date(), updatedAt: new Date(), lastActiveAt: new Date() };
}

function iniciarRegistro() {
  const contrasena = $('#g-contrasena');
  contrasena.addEventListener('input', () => {
    const nivel = nivelContrasena(contrasena.value);
    $('#fuerza').dataset.nivel = String(nivel);
    const texto = $('#fuerza-texto');
    texto.dataset.i18n = `reg.fuerza${nivel}`;
    texto.textContent = t(texto.dataset.i18n);
  });
  $$('#reg-paso-1 input').forEach((input) => input.addEventListener('input', () => {
    if (input.getAttribute('aria-invalid') === 'true') input.setAttribute('aria-invalid', 'false');
  }));

  $('#btn-continuar').addEventListener('click', () => { if (validarPaso1()) irPaso(2); });
  $('#reg-paso-1').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); $('#btn-continuar').click(); }
  });
  $('#btn-atras').addEventListener('click', () => irPaso(1));

  $('#form-registro').addEventListener('submit', async (e) => {
    e.preventDefault();
    if ($('#reg-paso-2').hidden) { $('#btn-continuar').click(); return; }
    const error = $('#error-paso-2');
    error.textContent = '';
    if (!$('#g-terminos').checked) {
      $('#g-terminos').setAttribute('aria-invalid', 'true');
      error.textContent = t('reg.errTerminos');
      $('#g-terminos').focus();
      return;
    }
    if (!fb) { error.textContent = t('acc.sinFirebase'); return; }

    const boton = $('#btn-crear');
    botonOcupado(boton, true, 'reg.creando');
    const datos = datosPerfilRegistro();
    const completar = $('#form-registro').classList.contains('modo-completar');

    try {
      let user = fb.auth.currentUser;
      if (!completar) {
        registrando = true;
        const credencial = await fb.fa.createUserWithEmailAndPassword(fb.auth, $('#g-correo').value.trim(), $('#g-contrasena').value);
        user = credencial.user;
        await fb.fa.updateProfile(user, { displayName: `${datos.firstName} ${datos.lastName}` }).catch(() => {});
        await enviarVerificacion(user, true);
      }
      perfil = await crearPerfil(user, datos);
      usuario = user;
      registrando = false;
      if (datos.language !== idioma) cambiarIdioma(datos.language);
      mostrarApp();
      toast(t('reg.bienvenida'));
      abrirOnboarding();
    } catch (err) {
      registrando = false;
      console.error('[portal] Registro:', err);
      if (err.code === 'auth/email-already-in-use' || err.code === 'auth/invalid-email' || err.code === 'auth/weak-password') {
        irPaso(1);
        $('#error-paso-1').textContent = mensajeError(err);
        const campo = err.code === 'auth/weak-password' ? '#g-contrasena' : '#g-correo';
        $(campo).setAttribute('aria-invalid', 'true');
        $(campo).focus();
      } else if (fb.auth.currentUser) {
        // La cuenta se creó pero el perfil no: se completa en el siguiente intento
        activarModoCompletar(fb.auth.currentUser);
        error.textContent = mensajeError(err);
      } else {
        error.textContent = mensajeError(err);
      }
    } finally {
      botonOcupado(boton, false);
    }
  });
}

/* Usuario autenticado sin perfil: solo completa lo que falta */
function activarModoCompletar(user) {
  mostrarAcceso();
  activarPestana('registro');
  $('#pestanas').classList.add('oculta');
  const form = $('#form-registro');
  form.classList.add('modo-completar');
  $('#g-correo').required = false;
  $('#g-contrasena').required = false;
  const titulo = $('#acceso-titulo');
  titulo.dataset.i18n = 'reg.completar';
  titulo.textContent = t('reg.completar');
  const [nombre, ...resto] = (user.displayName || '').split(' ');
  if (!$('#g-nombre').value) $('#g-nombre').value = nombre || '';
  if (!$('#g-apellido').value) $('#g-apellido').value = resto.join(' ');
  const boton = $('#btn-crear span');
  boton.dataset.i18n = 'reg.guardar';
  boton.textContent = t('reg.guardar');
  irPaso(1);
}

/* ==========================================================================
   Verificación de correo
   ========================================================================== */
async function enviarVerificacion(user, silencioso = false) {
  try {
    fb.auth.languageCode = idioma;
    await fb.fa.sendEmailVerification(user, { url: new URL('./', location.href).href });
    if (!silencioso) toast(t('ver.reenviado'));
  } catch (error) {
    // Si el dominio de retorno no está autorizado, se envía sin enlace de regreso
    if (error.code === 'auth/unauthorized-continue-uri' || error.code === 'auth/invalid-continue-uri') {
      try { await fb.fa.sendEmailVerification(user); if (!silencioso) toast(t('ver.reenviado')); return; } catch (e2) { error = e2; }
    }
    if (!silencioso) toast(mensajeError(error), { tipo: 'error' });
  }
}

function pintarAvisoVerificacion() {
  const aviso = $('#aviso-verificacion');
  const pendiente = usuario && !usuario.emailVerified;
  aviso.hidden = !pendiente;
  if (pendiente) $('#aviso-verificacion-texto').textContent = t('ver.texto', { correo: usuario.email });
  const insignia = $('#perfil-verificado');
  if (insignia && usuario) {
    insignia.textContent = t(usuario.emailVerified ? 'perfil.verificado' : 'perfil.sinVerificar');
    insignia.className = `insignia ${usuario.emailVerified ? 'ok' : 'pendiente'}`;
  }
}

/* ==========================================================================
   APP: navegación y menú lateral
   ========================================================================== */
function abrirLateral(abrir) {
  const lateral = $('#lateral');
  const velo = $('#velo');
  lateral.classList.toggle('abierto', abrir);
  velo.hidden = !abrir;
  $('#abrir-lateral').setAttribute('aria-expanded', String(abrir));
  if (abrir) $('#lateral-nav a[aria-current="page"]')?.focus();
}

function vistaDesdeHash() {
  const nombre = location.hash.replace('#', '').split('?')[0];
  return VISTAS.includes(nombre) ? nombre : 'inicio';
}

function navegar(vista, { enfocar = true } = {}) {
  VISTAS.forEach((v) => { const s = document.getElementById(`vista-${v}`); if (s) s.hidden = v !== vista; });
  $$('#lateral-nav a').forEach((a) => {
    if (a.dataset.vista === vista) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const titulo = $('#titulo-vista');
  titulo.dataset.i18n = `menu.${vista}`;
  titulo.textContent = t(titulo.dataset.i18n);
  document.title = `${t(`menu.${vista}`)} | Success by Karely`;
  abrirLateral(false);
  if (vista === 'ruta') pintarRuta();
  if (enfocar) { window.scrollTo(0, 0); titulo.focus({ preventScroll: true }); }
}

function iniciarApp() {
  $('#abrir-lateral').addEventListener('click', () => abrirLateral(true));
  $('#cerrar-lateral').addEventListener('click', () => { abrirLateral(false); $('#abrir-lateral').focus(); });
  $('#velo').addEventListener('click', () => abrirLateral(false));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#onboarding').hidden) { cerrarOnboarding(false); return; }
    if ($('#lateral').classList.contains('abierto')) { abrirLateral(false); $('#abrir-lateral').focus(); }
  });

  window.addEventListener('hashchange', () => {
    if ($('#app').hidden) return;
    const destino = vistaDesdeHash();
    if (perfilSucio && destino !== 'perfil') {
      if (!window.confirm(t('perfil.salirCambios'))) { history.replaceState(null, '', '#perfil'); return; }
      perfilSucio = false;
      pintarPerfil();
    }
    navegar(destino);
  });
  window.addEventListener('beforeunload', (e) => { if (perfilSucio) { e.preventDefault(); e.returnValue = ''; } });

  $('#btn-tema').addEventListener('click', () => {
    const nuevo = document.documentElement.dataset.efectivo === 'oscuro' ? 'claro' : 'oscuro';
    aplicarTema(nuevo);
    guardarPreferencia({ theme: nuevo });
  });

  $$('[data-salir]').forEach((b) => b.addEventListener('click', salir));
  $('#btn-reenviar').addEventListener('click', () => usuario && enviarVerificacion(usuario));
  $('#btn-ya-confirme').addEventListener('click', async () => {
    if (!usuario) return;
    await usuario.reload().catch(() => {});
    usuario = fb.auth.currentUser;
    if (usuario.emailVerified) toast(t('ver.confirmado'));
    else toast(t('ver.pendiente'), { tipo: 'info', duracion: 6000 });
    pintarAvisoVerificacion();
  });
  $('#btn-cambiar-contrasena').addEventListener('click', async () => {
    try { await fb.fa.sendPasswordResetEmail(fb.auth, usuario.email); toast(t('perfil.contrasenaOk')); }
    catch (err) { toast(mensajeError(err), { tipo: 'error' }); }
  });

  iniciarPerfil();
  iniciarOnboarding();
}

async function salir() {
  if (perfilSucio && !window.confirm(t('perfil.salirCambios'))) return;
  perfilSucio = false;
  await fb?.fa.signOut(fb.auth);
  history.replaceState(null, '', location.pathname);
}

function mostrarApp() {
  $('#acceso').hidden = true;
  $('#app').hidden = false;
  ocultarCarga();
  pintarLateral();
  pintarAvisoVerificacion();
  pintarInicio();
  pintarPerfil();
  pintarComunidad();
  navegar(vistaDesdeHash(), { enfocar: false });
  cargarAnuncios();
}

function pintarLateral() {
  const nombre = `${perfil?.firstName || ''} ${perfil?.lastName || ''}`.trim() || usuario?.displayName || '';
  $('#lateral-nombre').textContent = nombre;
  $('#lateral-correo').textContent = usuario?.email || '';
  $('#lateral-avatar').textContent = iniciales();
  $('#barra-avatar').textContent = iniciales();
  $('#perfil-avatar').textContent = iniciales();
}

/* Guarda una preferencia suelta (tema) sin pasar por el formulario */
async function guardarPreferencia(cambios) {
  if (!fb || !usuario || !perfil) return;
  try {
    await fb.fs.updateDoc(fb.fs.doc(fb.db, 'users', usuario.uid), { ...cambios, updatedAt: fb.fs.serverTimestamp() });
    Object.assign(perfil, cambios);
  } catch (error) {
    console.warn('[portal] No se guardó la preferencia:', error.message);
  }
}

/* ==========================================================================
   INICIO
   ========================================================================== */
function anillo(porcentaje, tam) {
  const p = Math.max(0, Math.min(100, Math.round(porcentaje)));
  return `<div class="anillo anillo-${tam}" data-p="${p}" role="img" aria-label="${p} %">
    <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="anillo-pista" cx="60" cy="60" r="52"/><circle class="anillo-valor" cx="60" cy="60" r="52" pathLength="100"/></svg>
    <span class="anillo-centro" aria-hidden="true">${p}%</span>
  </div>`;
}
/* Anima los anillos desde 0 hasta su valor */
function animarAnillos(raiz) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $$('.anillo', raiz).forEach((a) => { $('.anillo-valor', a).style.setProperty('--p', a.dataset.p); });
  }));
}

function saludo() {
  const hora = new Date().getHours();
  const clave = hora < 12 ? 'ini.manana' : hora < 19 ? 'ini.tarde' : 'ini.noche';
  return t(clave, { nombre: perfil?.firstName || '' });
}

function enlaceAgenda() {
  return esPendiente(CONFIG.contacto.agenda) ? '../#contacto' : CONFIG.contacto.agenda;
}

function pintarInicio() {
  if (!perfil) return;
  $('#saludo-titulo').textContent = saludo();
  const foco = perfil.focusStage || null;
  const global = Math.round(Object.values(progresoEtapas).reduce((a, b) => a + b, 0) / 4);
  const racha = Number(perfil.streak) || 0;
  const agenda = enlaceAgenda();
  const externo = !agenda.startsWith('../');

  const anunciosHTML = anuncios.length
    ? `<ul class="lista-anuncios">${anuncios.slice(0, 3).map(itemAnuncio).join('')}</ul>`
    : `<p class="lista-vacia">${escaparHTML(t('ini.anunciosVacio'))}</p>`;

  $('#rejilla-inicio').innerHTML = `
    <article class="panel tarjeta-progreso ancho-2">
      <div class="progreso-global">
        ${anillo(global, 'grande')}
        <div><h3>${escaparHTML(t('ini.progresoGlobal'))}</h3><p>${escaparHTML(t('ini.progresoDetalle', { n: global }))}</p></div>
      </div>
      <div class="progreso-etapas" role="list" aria-label="${escaparHTML(t('ini.etapas'))}">
        ${ETAPAS.map((e) => `
          <div class="etapa-anillo${foco === e.n ? ' foco' : ''}" role="listitem">
            ${anillo(progresoEtapas[e.n] || 0, 'chico')}
            <span>${escaparHTML(e[idioma])}</span>
            ${foco === e.n ? `<em>${escaparHTML(t('ini.tuEtapa'))}</em>` : ''}
          </div>`).join('')}
      </div>
    </article>

    <article class="panel tarjeta-racha">
      <div class="tarjeta-cabecera"><span class="tarjeta-icono">${ICONOS.racha}</span><h3>${escaparHTML(t('ini.racha'))}</h3></div>
      <p class="racha-numero">${racha}<small>${escaparHTML(racha === 1 ? t('ini.rachaDia').replace(/^1\s*/, '') : t('ini.rachaDias', { n: '' }).trim())}</small></p>
      <p class="racha-texto">${escaparHTML(t(racha ? 'ini.rachaTexto' : 'ini.rachaCero'))}</p>
      <div class="racha-dias" aria-hidden="true">${Array.from({ length: 7 }, (_, i) => `<span class="${i < Math.min(racha, 7) ? 'activo' : ''}"></span>`).join('')}</div>
    </article>

    <article class="panel tarjeta-accion tarjeta-destacada">
      <div class="tarjeta-cabecera"><span class="tarjeta-icono">${ICONOS.ruta}</span><h3>${escaparHTML(t('ini.empezar'))}</h3></div>
      <p>${escaparHTML(t('ini.empezarD'))}</p>
      <div class="acciones"><a class="btn btn-principal btn-sm" href="#ruta">${escaparHTML(t('ini.irRuta'))}</a></div>
    </article>

    <article class="panel tarjeta-accion">
      <div class="tarjeta-cabecera"><span class="tarjeta-icono">${ICONOS.paso}</span><h3>${escaparHTML(t('ini.proximo'))}</h3></div>
      <p>${escaparHTML(t(`ini.paso${foco || 0}`))}</p>
      <div class="acciones">
        ${foco ? '' : `<a class="btn btn-suave btn-sm" href="#perfil">${escaparHTML(t('ini.elegirEtapa'))}</a>`}
        <a class="btn btn-linea-app btn-sm" href="${escaparHTML(agenda)}"${externo ? ' target="_blank" rel="noopener"' : ''}>${escaparHTML(t('ini.agendar'))}</a>
      </div>
    </article>

    <article class="panel">
      <div class="tarjeta-cabecera"><span class="tarjeta-icono">${ICONOS.tareas}</span><h3>${escaparHTML(t('ini.tareas'))}</h3></div>
      <p class="lista-vacia">${escaparHTML(t('ini.tareasVacio'))}</p>
    </article>

    <article class="panel">
      <div class="tarjeta-cabecera"><span class="tarjeta-icono">${ICONOS.mensajes}</span><h3>${escaparHTML(t('ini.mensajes'))}</h3></div>
      <p class="lista-vacia">${escaparHTML(t('ini.mensajesVacio'))}</p>
    </article>

    <article class="panel">
      <div class="tarjeta-cabecera"><span class="tarjeta-icono">${ICONOS.anuncios}</span><h3>${escaparHTML(t('ini.anuncios'))}</h3></div>
      ${anunciosHTML}
    </article>`;
  animarAnillos($('#rejilla-inicio'));
}

function pintarRuta() {
  const foco = perfil?.focusStage;
  const etapa = ETAPAS.find((e) => e.n === foco);
  $('#ruta-etapa').textContent = etapa ? t('vac.rutaEtapa', { n: etapa.n, etapa: etapa[idioma] }) : '';
}

/* ---------- Anuncios ---------- */
function itemAnuncio(a) {
  const titulo = campo(a, 'title', idioma);
  const cuerpo = campo(a, 'body', idioma);
  const fecha = formatearFecha(a.createdAt, idioma, { day: 'numeric', month: 'short' });
  return `<li>
    <strong>${escaparHTML(titulo)}</strong>
    ${cuerpo ? `<p>${escaparHTML(cuerpo)}</p>` : ''}
    ${fecha ? `<time>${escaparHTML(fecha)}</time>` : ''}
    ${esURLSegura(a.link) ? `<a href="${escaparHTML(a.link)}" target="_blank" rel="noopener">${escaparHTML(t('ini.verMas'))}</a>` : ''}
  </li>`;
}

async function cargarAnuncios() {
  if (!fb) return;
  try {
    // Sin orderBy para no requerir índice compuesto: se ordena en el navegador
    const snap = await fb.fs.getDocs(fb.fs.query(fb.fs.collection(fb.db, 'announcements'), fb.fs.where('published', '==', true), fb.fs.limit(20)));
    anuncios = snap.docs.map((d) => d.data())
      .filter((a) => !a.deletedAt && a.title)
      .sort((a, b) => (aFecha(b.createdAt)?.getTime() || 0) - (aFecha(a.createdAt)?.getTime() || 0));
  } catch (error) {
    console.warn('[portal] Anuncios no disponibles:', error.message);
    anuncios = [];
  }
  pintarInicio();
  pintarComunidad();
}

/* ==========================================================================
   COMUNIDAD
   ========================================================================== */
function pintarComunidad() {
  const { contacto, tienda } = CONFIG;
  const tarjetas = [
    ['telegram', 'com.telegramT', 'com.telegramD', esPendiente(contacto.telegram) ? null : contacto.telegram],
    ['whatsapp', 'com.whatsappT', 'com.whatsappD', esPendiente(contacto.whatsapp) ? null : enlaceWhatsApp(t('whatsapp.mensaje'))],
    ['tienda', 'com.tiendaT', 'com.tiendaD', tienda],
  ];
  $('#rejilla-comunidad').innerHTML = tarjetas.map(([icono, titulo, desc, url]) => `
    <article class="panel tarjeta-com">
      <span class="tarjeta-icono">${ICONOS[icono]}</span>
      <h3>${escaparHTML(t(titulo))}</h3>
      <p>${escaparHTML(t(desc))}</p>
      ${url
        ? `<a class="btn btn-suave btn-sm" href="${escaparHTML(url)}" target="_blank" rel="noopener">${escaparHTML(t('com.abrir'))}</a>`
        : `<span class="btn btn-linea-app btn-sm" aria-disabled="true">${escaparHTML(t('com.pronto'))}</span>`}
    </article>`).join('');
  $('#anuncios-comunidad').innerHTML = anuncios.length
    ? anuncios.map(itemAnuncio).join('')
    : `<li class="lista-vacia">${escaparHTML(t('ini.anunciosVacio'))}</li>`;
}

/* ==========================================================================
   PERFIL
   ========================================================================== */
function pintarPerfil() {
  if (!perfil) return;
  const form = $('#form-perfil');
  const valores = {
    firstName: perfil.firstName, lastName: perfil.lastName, phone: perfil.phone, birthDate: perfil.birthDate,
    country: perfil.country, state: perfil.state, city: perfil.city, situation: perfil.situation,
    focusStage: perfil.focusStage ? String(perfil.focusStage) : '',
  };
  Object.entries(valores).forEach(([nombre, valor]) => { const el = form.elements[nombre]; if (el) el.value = valor || ''; });
  $$('#p-servicios input').forEach((i) => { i.checked = (perfil.services || []).includes(i.value); });
  $$('input[name="language"]', form).forEach((r) => { r.checked = r.value === (perfil.language || 'es'); });
  $$('input[name="theme"]', form).forEach((r) => { r.checked = r.value === temaActual(); });
  $('#p-marketing').checked = Boolean(perfil.consentMarketing);
  $('#perfil-nombre').textContent = `${perfil.firstName || ''} ${perfil.lastName || ''}`.trim();
  const desde = formatearFecha(perfil.createdAt, idioma, { month: 'long', year: 'numeric' });
  $('#perfil-desde').textContent = desde ? t('perfil.miembroDesde', { fecha: desde }) : '';
  $('#perfil-correo').textContent = usuario?.email || perfil.email || '';
  $('#error-perfil').textContent = '';
  $$('[aria-invalid]', form).forEach((i) => i.removeAttribute('aria-invalid'));
  pintarAvisoVerificacion();
  perfilSucio = false;
}

function iniciarPerfil() {
  const form = $('#form-perfil');
  form.addEventListener('input', () => { perfilSucio = true; });
  form.addEventListener('change', (e) => {
    perfilSucio = true;
    if (e.target.name === 'theme') aplicarTema(e.target.value); // vista previa inmediata
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const error = $('#error-perfil');
    error.textContent = '';
    const requeridos = [['#p-nombre', (v) => v.trim()], ['#p-apellido', (v) => v.trim()], ['#p-telefono', (v) => REGEX_TELEFONO.test(v.trim())]];
    const invalido = requeridos.find(([sel, ok]) => { const i = $(sel); const valido = ok(i.value); i.setAttribute('aria-invalid', String(!valido)); return !valido; });
    if (invalido) {
      error.textContent = t(invalido[0] === '#p-telefono' ? 'form.errTelefono' : 'form.errRequerido');
      $(invalido[0]).focus();
      return;
    }
    if (!perfilSucio) { toast(t('perfil.sinCambios'), { tipo: 'info' }); return; }

    const datos = new FormData(form);
    const texto = (n, max) => String(datos.get(n) || '').trim().slice(0, max);
    const etapa = Number(datos.get('focusStage'));
    const cambios = {
      firstName: texto('firstName', 60),
      lastName: texto('lastName', 60),
      phone: texto('phone', 30),
      birthDate: /^\d{4}-\d{2}-\d{2}$/.test(texto('birthDate', 10)) ? texto('birthDate', 10) : '',
      country: texto('country', 60),
      state: texto('state', 60),
      city: texto('city', 60),
      situation: SITUACIONES.includes(datos.get('situation')) ? datos.get('situation') : '',
      services: datos.getAll('services').filter((id) => SERVICIOS.some((s) => s.id === id)),
      language: datos.get('language') === 'en' ? 'en' : 'es',
      theme: ['claro', 'oscuro', 'sistema'].includes(datos.get('theme')) ? datos.get('theme') : 'sistema',
      consentMarketing: $('#p-marketing').checked,
    };
    const boton = $('#btn-guardar-perfil');
    botonOcupado(boton, true, 'perfil.guardando');
    try {
      const { fs, db } = fb;
      await fs.updateDoc(fs.doc(db, 'users', usuario.uid), {
        ...cambios,
        focusStage: etapa >= 1 && etapa <= 4 ? etapa : fs.deleteField(),
        updatedAt: fs.serverTimestamp(),
      });
      const nombreCompleto = `${cambios.firstName} ${cambios.lastName}`;
      if (usuario.displayName !== nombreCompleto) fb.fa.updateProfile(usuario, { displayName: nombreCompleto }).catch(() => {});
      Object.assign(perfil, cambios);
      if (etapa >= 1 && etapa <= 4) perfil.focusStage = etapa; else delete perfil.focusStage;
      perfilSucio = false;
      aplicarTema(cambios.theme);
      if (cambios.language !== idioma) cambiarIdioma(cambios.language);
      pintarLateral();
      pintarInicio();
      pintarPerfil();
      toast(t('perfil.guardado'));
    } catch (err) {
      console.error('[portal] Perfil:', err);
      error.textContent = mensajeError(err);
    } finally {
      botonOcupado(boton, false);
    }
  });
}

/* ==========================================================================
   ONBOARDING (3 pantallas)
   ========================================================================== */
let onbPaso = 1;
let onbEtapa = 1;
let onbRecomendada = 1;
let focoPrevio = null;

function etapaRecomendada() {
  const servicio = SERVICIOS.find((s) => (perfil?.services || []).includes(s.id) && s.etapa);
  return servicio ? servicio.etapa : 1;
}

function pintarOnbEtapas() {
  $('#onb-etapas').innerHTML = ETAPAS.map((e) => `
    <button type="button" class="onb-etapa" role="radio" aria-checked="${e.n === onbEtapa}" tabindex="${e.n === onbEtapa ? 0 : -1}" data-etapa="${e.n}">
      <b>${e.n}</b><span>${escaparHTML(e[idioma])}</span>
      ${e.n === onbRecomendada ? `<em>${escaparHTML(t('onb.recomendada'))}</em>` : ''}
    </button>`).join('');
}

function pintarOnbPaso() {
  $$('.onb-pantalla').forEach((p) => {
    const activa = Number(p.dataset.onb) === onbPaso;
    p.hidden = !activa;
    const h2 = $('h2', p);
    if (h2) h2.id = activa ? 'onb-titulo' : '';
  });
  $$('.onb-puntos-nav span').forEach((s, i) => s.classList.toggle('activo', i === onbPaso - 1));
  $('#onb-paso').textContent = t('onb.paso', { n: onbPaso });
  $('#onb-atras').hidden = onbPaso === 1;
  const siguiente = $('#onb-siguiente span');
  siguiente.dataset.i18n = onbPaso === 3 ? 'onb.empezar' : 'onb.siguiente';
  siguiente.textContent = t(siguiente.dataset.i18n);
}

function abrirOnboarding() {
  onbRecomendada = etapaRecomendada();
  onbEtapa = perfil?.focusStage || onbRecomendada;
  onbPaso = 1;
  pintarOnbEtapas();
  pintarOnbPaso();
  focoPrevio = document.activeElement;
  $('#onboarding').hidden = false;
  $('#onb-siguiente').focus();
}

async function cerrarOnboarding(irARuta) {
  $('#onboarding').hidden = true;
  const cambios = { onboardingDone: true, focusStage: onbEtapa };
  Object.assign(perfil, cambios);
  pintarInicio();
  pintarPerfil();
  try {
    await fb.fs.updateDoc(fb.fs.doc(fb.db, 'users', usuario.uid), { ...cambios, updatedAt: fb.fs.serverTimestamp() });
  } catch (error) {
    console.warn('[portal] Onboarding no guardado:', error.message);
  }
  if (irARuta) location.hash = '#ruta';
  else focoPrevio?.focus?.();
}

function iniciarOnboarding() {
  $('#onb-siguiente').addEventListener('click', () => {
    if (onbPaso < 3) { onbPaso++; pintarOnbPaso(); $('#onb-siguiente').focus(); }
    else cerrarOnboarding(true);
  });
  $('#onb-atras').addEventListener('click', () => { onbPaso = Math.max(1, onbPaso - 1); pintarOnbPaso(); });
  $('#onb-saltar').addEventListener('click', () => cerrarOnboarding(false));
  $('#onb-etapas').addEventListener('click', (e) => {
    const boton = e.target.closest('[data-etapa]');
    if (!boton) return;
    onbEtapa = Number(boton.dataset.etapa);
    pintarOnbEtapas();
    $(`[data-etapa="${onbEtapa}"]`).focus();
  });
  // Flechas para moverse entre etapas (patrón radiogroup)
  $('#onb-etapas').addEventListener('keydown', (e) => {
    const mover = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!mover) return;
    e.preventDefault();
    onbEtapa = ((onbEtapa - 1 + mover + 4) % 4) + 1;
    pintarOnbEtapas();
    $(`[data-etapa="${onbEtapa}"]`).focus();
  });
  // Mantener el foco dentro del diálogo
  $('#onboarding').addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusables = $$('button:not([hidden]), [tabindex="0"]', $('.onboarding-panel')).filter((el) => el.offsetParent !== null);
    const primero = focusables[0];
    const ultimo = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  });
}

/* ==========================================================================
   Sesión: carga del perfil y actividad
   ========================================================================== */
async function registrarActividad() {
  const ultima = aFecha(perfil.lastActiveAt)?.getTime() || 0;
  if (Date.now() - ultima < 6 * 3600 * 1000) return;
  try {
    await fb.fs.updateDoc(fb.fs.doc(fb.db, 'users', usuario.uid), {
      lastActiveAt: fb.fs.serverTimestamp(),
      updatedAt: fb.fs.serverTimestamp(),
    });
  } catch (error) {
    console.warn('[portal] Actividad no registrada:', error.message);
  }
}

async function alCambiarSesion(user) {
  if (registrando) return; // el flujo de registro se encarga
  usuario = user;
  if (!user) {
    perfil = null;
    botonOcupado($('#btn-entrar'), false);
    $('#e-contrasena').value = '';
    $('#form-registro').classList.remove('modo-completar');
    $('#pestanas').classList.remove('oculta');
    mostrarAcceso();
    ocultarCarga();
    return;
  }
  try {
    const snap = await fb.fs.getDoc(fb.fs.doc(fb.db, 'users', user.uid));
    if (!snap.exists()) {
      activarModoCompletar(user);
      ocultarCarga();
      return;
    }
    perfil = snap.data();
  } catch (error) {
    console.error('[portal] No se pudo leer el perfil:', error);
    mostrarAcceso();
    $('#error-entrar').textContent = mensajeError(error);
    ocultarCarga();
    return;
  }
  if (perfil.theme) aplicarTema(perfil.theme);
  if (perfil.language && perfil.language !== idioma) cambiarIdioma(perfil.language);
  mostrarApp();
  registrarActividad();
  if (!perfil.onboardingDone) abrirOnboarding();
}

/* ==========================================================================
   Medios (logo y fondo del acceso) y arranque
   ========================================================================== */
async function iniciarMedios() {
  pintarMarcadores();
  const cache = leerCacheMedios();
  if (cache) { medios = cache; aplicarMedios(cache.medios, idioma); }
  const firestore = await cargarFirestore();
  if (!firestore) return;
  try {
    medios = await leerMediosFirestore(firestore);
    aplicarMedios(medios.medios, idioma);
  } catch (error) {
    console.warn('[portal] Medios no disponibles:', error.message);
  }
}

async function arrancar() {
  llenarOpciones();
  iniciarAcceso();
  iniciarApp();
  iniciarMedios();

  const [auth, firestore] = await Promise.all([cargarAuth(), cargarFirestore()]);
  if (!auth || !firestore) {
    mostrarAcceso();
    $('#error-entrar').textContent = t('acc.sinFirebase');
    ocultarCarga();
    return;
  }
  fb = { ...auth, ...firestore };
  fb.auth.languageCode = idioma;
  fb.fa.onAuthStateChanged(fb.auth, alCambiarSesion);
}

// Al cambiar de idioma se repinta todo lo dinámico
document.addEventListener('idioma', (e) => {
  idioma = e.detail;
  if (fb) fb.auth.languageCode = idioma;
  llenarOpciones();
  aplicarMedios(medios.medios, idioma);
  if (perfil) {
    pintarInicio();
    pintarComunidad();
    pintarRuta();
    pintarAvisoVerificacion();
    if (!perfilSucio) pintarPerfil(); // no pisar cambios sin guardar
    navegar(vistaDesdeHash(), { enfocar: false });
    if (!$('#onboarding').hidden) { pintarOnbEtapas(); pintarOnbPaso(); }
  }
});

arrancar();
