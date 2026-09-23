/* ==========================================================================
   Landing (index.html)
   Navegación, medios administrables, ruta del método, efectos de vidrio,
   testimonios y blog desde Firestore, y formulario de leads.
   ========================================================================== */
import {
  CONFIG, SERVICIOS, REFERENCIAS, ESTADOS_EEUU, PAISES_SUGERIDOS, TESTIMONIOS_RESPALDO, esPendiente,
} from './config.js';
import { cargarFirestore, firebaseConfigurado } from './firebase.js';
import {
  $, $$, escaparHTML, campo, toast, reducirMovimiento, punteroFino, formatearFecha,
  pintarMarcadores, aplicarMedios, leerCacheMedios, leerMediosFirestore,
  urlCloudinary, srcsetCloudinary, enlaceWhatsApp, avisarAppsScript,
} from './util.js';
import { iniciarI18n, t } from './i18n.js';
import { iniciarCookies } from './cookies.js';
import { leerCategorias, consultarPublicados, elegirDestacado, ordenEditorial, nombreCategoria, rutaArticulo } from './blog-datos.js';

document.documentElement.classList.add('js');
let idioma = iniciarI18n();

/* ---------- Iconos lineales ---------- */
const ICONOS = {
  instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v11.5A3.5 3.5 0 1 1 10.5 11"/><path d="M14 3c.4 2.7 2.2 4.4 5 4.6"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3.5h-2A3.5 3.5 0 0 0 9.5 7v3H7v3.5h2.5V21H13v-7.5h2.5l.5-3.5h-3V7.5a1 1 0 0 1 1-1h1.5Z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.2-4A8 8 0 1 1 8 18.8Z"/><path d="M9 9.5c.3 1.8 2.7 4.2 4.5 4.5l1.2-1.1 1.8.9c-.2 1.2-1 1.7-2 1.7-3.1 0-6.5-3.4-6.5-6.5 0-1 .5-1.8 1.7-2l.9 1.8Z"/></svg>',
  correo: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>',
  telefono: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z"/></svg>',
  agenda: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
};

/* ==========================================================================
   1. Navegación
   ========================================================================== */
function iniciarNavegacion() {
  const nav = $('#nav');
  const botonMenu = $('.btn-menu');
  const menu = $('#menu-movil');

  // Cápsula flotante al hacer scroll
  let pendiente = false;
  const alHacerScroll = () => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => {
      nav.classList.toggle('flotante', window.scrollY > 24);
      pendiente = false;
    });
  };
  window.addEventListener('scroll', alHacerScroll, { passive: true });
  alHacerScroll();

  // Menú móvil
  const cerrarMenu = (devolverFoco = false) => {
    menu.hidden = true;
    botonMenu.setAttribute('aria-expanded', 'false');
    botonMenu.setAttribute('aria-label', t('nav.abrirMenu'));
    if (devolverFoco) botonMenu.focus();
  };
  botonMenu.addEventListener('click', () => {
    const abrir = menu.hidden;
    menu.hidden = !abrir;
    botonMenu.setAttribute('aria-expanded', String(abrir));
    botonMenu.setAttribute('aria-label', t(abrir ? 'nav.cerrarMenu' : 'nav.abrirMenu'));
    if (abrir) $('a', menu)?.focus();
  });
  $$('a', menu).forEach((enlace) => enlace.addEventListener('click', () => cerrarMenu()));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) cerrarMenu(true); });
  window.matchMedia('(min-width: 1000px)').addEventListener('change', (e) => { if (e.matches) cerrarMenu(); });

  // Enlace activo según la sección visible
  const enlaces = $$('.nav-enlaces a[href^="#"]');
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
      if (!entrada.isIntersecting) return;
      enlaces.forEach((a) => {
        if (a.getAttribute('href') === `#${entrada.target.id}`) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  ['historia', 'metodo', 'servicios', 'contacto'].forEach((id) => { const s = document.getElementById(id); if (s) observador.observe(s); });
}

/* ==========================================================================
   2. Medios administrables (siteMedia) y galerías
   ========================================================================== */
let ultimosMedios = { medios: {}, galerias: {} };

async function iniciarMedios() {
  pintarMarcadores();
  const cache = leerCacheMedios();
  if (cache) {
    ultimosMedios = cache;
    aplicarMedios(cache.medios, idioma);
    pintarGalerias(cache.galerias);
  }
  const firebase = await cargarFirestore();
  if (!firebase) return;
  try {
    ultimosMedios = await leerMediosFirestore(firebase, ['logos_prensa', 'galeria_eventos']);
    aplicarMedios(ultimosMedios.medios, idioma);
    pintarGalerias(ultimosMedios.galerias);
  } catch (error) {
    console.warn('[medios] Se usan los marcadores:', error.message);
  }
}

const esURLSegura = (url) => typeof url === 'string' && url.startsWith('https://');

function pintarGalerias(galerias = {}) {
  // Logos de prensa: si hay, reemplazan los nombres de texto
  const logos = (galerias.logos_prensa || []).filter((i) => esURLSegura(i.url));
  const pista = $('.prensa-pista');
  if (logos.length && pista) {
    pista.innerHTML = logos.map((logo) => {
      const img = `<img src="${escaparHTML(urlCloudinary(logo.url, 'f_auto,q_auto,h_80'))}" alt="${escaparHTML(campo(logo, 'alt', idioma))}" loading="lazy" height="34">`;
      return `<li>${esURLSegura(logo.link) ? `<a href="${escaparHTML(logo.link)}" target="_blank" rel="noopener">${img}</a>` : img}</li>`;
    }).join('');
  }
  iniciarCarruselPrensa();

  // Galería de eventos: solo aparece si hay fotos
  const eventos = (galerias.galeria_eventos || []).filter((i) => esURLSegura(i.url));
  const bloque = $('#galeria-eventos');
  if (!bloque) return;
  bloque.hidden = !eventos.length;
  $('.eventos-lista', bloque).innerHTML = eventos.map((foto) => `
    <li><img src="${escaparHTML(urlCloudinary(foto.url, 'f_auto,q_auto,c_fill,w_800,h_600'))}"
      srcset="${escaparHTML(srcsetCloudinary(foto.url, [400, 800]))}" sizes="(min-width: 900px) 25vw, 90vw"
      alt="${escaparHTML(campo(foto, 'alt', idioma))}" loading="lazy" width="800" height="600"></li>`).join('');
}

/* Duplica la franja de prensa para un desplazamiento continuo */
function iniciarCarruselPrensa() {
  const pista = $('.prensa-pista');
  if (!pista) return;
  $$('[data-clon]', pista).forEach((n) => n.remove());
  if (reducirMovimiento()) return;
  [...pista.children].forEach((li) => {
    const clon = li.cloneNode(true);
    clon.dataset.clon = '';
    clon.setAttribute('aria-hidden', 'true');
    $$('a', clon).forEach((a) => a.setAttribute('tabindex', '-1'));
    pista.append(clon);
  });
}

/* ==========================================================================
   3. El método: la línea dorada se ilumina con el scroll
   ========================================================================== */
function iniciarMetodo() {
  const envoltura = $('.etapas-wrap');
  if (!envoltura) return;
  const linea = $('.linea-etapas', envoltura);
  const etapas = $$('.etapa', envoltura);

  if (reducirMovimiento()) {
    linea.style.setProperty('--progreso', 1);
    etapas.forEach((e) => e.classList.add('encendida'));
    return;
  }
  let pendiente = false;
  const actualizar = () => {
    pendiente = false;
    const caja = envoltura.getBoundingClientRect();
    const alto = window.innerHeight;
    const progreso = Math.min(1, Math.max(0, (alto * 0.78 - caja.top) / (caja.height * 0.9)));
    linea.style.setProperty('--progreso', progreso.toFixed(3));
    etapas.forEach((etapa, i) => etapa.classList.toggle('encendida', progreso >= i / etapas.length + 0.04));
  };
  const pedir = () => { if (!pendiente) { pendiente = true; requestAnimationFrame(actualizar); } };
  window.addEventListener('scroll', pedir, { passive: true });
  window.addEventListener('resize', pedir);
  actualizar();
}

/* ==========================================================================
   4. Efectos: fondos vivos, halo del cursor, inclinación 3D y revelado
   ========================================================================== */
function iniciarEfectos() {
  // Orbes solo animados mientras su sección está en pantalla
  const observadorFondos = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => e.target.classList.toggle('activo', e.isIntersecting));
  });
  $$('.fondo-vivo').forEach((f) => observadorFondos.observe(f));

  // Revelado suave (solo en elementos marcados, no en todas las secciones)
  const observadorRevelar = new IntersectionObserver((entradas, obs) => {
    entradas.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('revelado');
      obs.unobserve(e.target);
    });
  }, { threshold: 0.2 });
  $$('[data-revelar]').forEach((el) => observadorRevelar.observe(el));

  if (reducirMovimiento() || !punteroFino()) return;

  // Halo dorado que sigue el cursor en secciones oscuras
  $$('.seccion-oscura').forEach((seccion) => {
    const halo = $('.halo', seccion);
    if (!halo) return;
    let marco = 0;
    seccion.addEventListener('pointermove', (e) => {
      cancelAnimationFrame(marco);
      marco = requestAnimationFrame(() => {
        const caja = seccion.getBoundingClientRect();
        halo.style.setProperty('--hx', `${e.clientX - caja.left}px`);
        halo.style.setProperty('--hy', `${e.clientY - caja.top}px`);
      });
    });
    seccion.addEventListener('pointerenter', () => seccion.classList.add('con-halo'));
    seccion.addEventListener('pointerleave', () => seccion.classList.remove('con-halo'));
  });

  // Inclinación 3D (máx. 4°)
  $$('[data-inclinar]').forEach((tarjeta) => {
    let marco = 0;
    tarjeta.addEventListener('pointermove', (e) => {
      cancelAnimationFrame(marco);
      marco = requestAnimationFrame(() => {
        const caja = tarjeta.getBoundingClientRect();
        const x = (e.clientX - caja.left) / caja.width - 0.5;
        const y = (e.clientY - caja.top) / caja.height - 0.5;
        tarjeta.style.transform = `perspective(900px) rotateX(${(-y * 8).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg)`;
      });
    });
    tarjeta.addEventListener('pointerleave', () => {
      cancelAnimationFrame(marco);
      tarjeta.style.transform = '';
    });
  });
}

/* ==========================================================================
   5. Testimonios (Firestore con respaldo estático)
   ========================================================================== */
let testimonios = TESTIMONIOS_RESPALDO;

function pintarTestimonios() {
  const lista = $('#lista-testimonios');
  if (!lista) return;
  lista.innerHTML = testimonios.map((item) => {
    const autor = campo(item, 'author', idioma);
    const foto = esURLSegura(item.photoUrl)
      ? `<img class="testimonio-foto" src="${escaparHTML(urlCloudinary(item.photoUrl, 'f_auto,q_auto,c_fill,g_face,w_120,h_120'))}" alt="" width="52" height="52" loading="lazy">`
      : `<span class="testimonio-inicial" aria-hidden="true">${escaparHTML(autor.trim().charAt(0) || 'K')}</span>`;
    return `
      <li class="testimonio glass-claro">
        <blockquote><p>${escaparHTML(campo(item, 'quote', idioma))}</p></blockquote>
        <div class="testimonio-autor">${foto}
          <div><strong>${escaparHTML(autor)}</strong><span>${escaparHTML(campo(item, 'detail', idioma))}</span></div>
        </div>
      </li>`;
  }).join('');
}

async function iniciarTestimonios() {
  pintarTestimonios();
  const lista = $('#lista-testimonios');
  $$('[data-carrusel]').forEach((boton) => {
    boton.addEventListener('click', () => {
      const tarjeta = $('.testimonio', lista);
      const paso = tarjeta ? tarjeta.getBoundingClientRect().width + 20 : lista.clientWidth;
      lista.scrollBy({ left: boton.dataset.carrusel === 'siguiente' ? paso : -paso, behavior: reducirMovimiento() ? 'auto' : 'smooth' });
    });
  });

  const firebase = await cargarFirestore();
  if (!firebase) return;
  const { db, fs } = firebase;
  try {
    const snap = await fs.getDocs(fs.query(fs.collection(db, 'testimonials'), fs.where('published', '==', true), fs.orderBy('order')));
    const publicados = snap.docs.map((d) => d.data()).filter((d) => !d.deletedAt && d.quote);
    if (publicados.length) { testimonios = publicados; pintarTestimonios(); }
  } catch (error) {
    console.warn('[testimonios] Se usa el respaldo estático:', error.message);
  }
}

/* ==========================================================================
   6. Últimos artículos del blog
   ========================================================================== */
let articulos = null;
let categorias = [];

function portadaHTML(post, anchos, sizes) {
  if (!esURLSegura(post.coverUrl)) {
    return `<div class="portada" data-espacio-post><span class="marcador" aria-hidden="true"><span class="marcador-k">K</span><span class="marcador-marca">Success <em>by</em> Karely</span></span></div>`;
  }
  return `<div class="portada tiene-imagen" data-espacio-post>
    <img class="media-img" src="${escaparHTML(urlCloudinary(post.coverUrl, 'f_auto,q_auto,c_fill,g_auto,w_800,ar_16:9'))}"
      srcset="${escaparHTML(anchos.map((w) => `${urlCloudinary(post.coverUrl, `f_auto,q_auto,c_fill,g_auto,w_${w},ar_16:9`)} ${w}w`).join(', '))}"
      sizes="${sizes}" alt="${escaparHTML(post.coverAlt || '')}" loading="lazy" width="800" height="450">
  </div>`;
}

function tarjetaPost(post, destacada) {
  const titulo = campo(post, 'title', idioma);
  const extracto = campo(post, 'excerpt', idioma);
  const categoria = nombreCategoria(categorias, post.category, idioma);
  const minutos = post.readingMinutes ? t('blog.minutos', { n: post.readingMinutes }) : '';
  return `
    <a class="tarjeta-post${destacada ? ' destacada' : ''}" href="${rutaArticulo(post.slug, '')}">
      ${portadaHTML(post, destacada ? [480, 800, 1200] : [320, 480, 800], destacada ? '(min-width: 900px) 55vw, 92vw' : '(min-width: 900px) 18vw, 92vw')}
      <div class="tarjeta-post-cuerpo">
        <p class="tarjeta-post-meta">
          ${categoria ? `<span class="tarjeta-post-cat">${escaparHTML(categoria)}</span>` : ''}
          <span>${escaparHTML(formatearFecha(post.publishAt, idioma, { day: 'numeric', month: 'short', year: 'numeric' }))}</span>
          ${minutos ? `<span>${escaparHTML(minutos)}</span>` : ''}
        </p>
        ${post.visibility === 'miembros' ? `<span class="etiqueta-exclusivo">${escaparHTML(t('blog.exclusivo'))}</span>` : ''}
        <h3>${escaparHTML(titulo)}</h3>
        ${destacada && extracto ? `<p>${escaparHTML(extracto)}</p>` : ''}
      </div>
    </a>`;
}

function pintarBlog() {
  const rejilla = $('#blog-rejilla');
  if (!rejilla || articulos === null) return;
  if (!articulos.length) {
    rejilla.innerHTML = `
      <div class="estado-vacio glass-claro">
        <span class="marcador-k" aria-hidden="true">K</span>
        <h3>${escaparHTML(t('blog.vacioT'))}</h3>
        <p>${escaparHTML(t('blog.vacioD'))}</p>
        <a class="btn btn-principal" href="portal/?registro=1">${escaparHTML(t('blog.vacioBtn'))}</a>
      </div>`;
    return;
  }
  const destacado = elegirDestacado(articulos);
  const resto = ordenEditorial(articulos).filter((p) => p !== destacado).slice(0, 3);
  rejilla.innerHTML = tarjetaPost(destacado, true) + resto.map((p) => tarjetaPost(p, false)).join('');
}

async function iniciarBlog() {
  const firebase = await cargarFirestore();
  if (firebase) {
    try {
      // Mismos filtros que exigen las reglas de Firestore (ver blog-datos.js)
      [categorias, articulos] = await Promise.all([leerCategorias(firebase), consultarPublicados(firebase, { limite: 12 })]);
    } catch (error) {
      console.warn('[blog] Sin artículos disponibles:', error.message);
      articulos = [];
    }
  } else {
    articulos = [];
  }
  pintarBlog();
}

/* ==========================================================================
   7. Enlaces configurables: contacto directo, Telegram, WhatsApp, redes
   ========================================================================== */
function pintarEnlacesConfig() {
  const { contacto, redes } = CONFIG;

  // Contacto directo (solo lo que está configurado)
  const directos = [];
  if (!esPendiente(contacto.whatsapp)) directos.push(['whatsapp', enlaceWhatsApp(t('whatsapp.mensaje')), t('contacto.whatsapp'), true]);
  if (!esPendiente(contacto.agenda)) directos.push(['agenda', contacto.agenda, t('contacto.agenda'), true]);
  if (!esPendiente(contacto.correo)) directos.push(['correo', `mailto:${contacto.correo}`, contacto.correo, false]);
  if (!esPendiente(contacto.telefono)) directos.push(['telefono', `tel:${contacto.telefono.replace(/[^\d+]/g, '')}`, contacto.telefono, false]);
  const lista = $('#contacto-directo');
  if (lista) {
    lista.innerHTML = directos.map(([icono, href, texto, externo]) => `
      <li><a href="${escaparHTML(href)}"${externo ? ' target="_blank" rel="noopener"' : ''}>${ICONOS[icono]}<span>${escaparHTML(texto)}</span></a></li>`).join('');
    lista.hidden = !directos.length;
  }

  // Botones que dependen de un enlace de config (ej. Telegram)
  $$('[data-enlace-config]').forEach((boton) => {
    const valor = contacto[boton.dataset.enlaceConfig];
    if (esPendiente(valor)) {
      boton.removeAttribute('href');
      boton.setAttribute('aria-disabled', 'true');
      boton.dataset.i18n = 'comunidad.pronto';
      boton.textContent = t('comunidad.pronto');
    } else {
      boton.href = valor;
    }
  });

  // WhatsApp flotante
  const flotante = $('#whatsapp-flotante');
  if (flotante && !esPendiente(contacto.whatsapp)) {
    flotante.href = enlaceWhatsApp(t('whatsapp.mensaje'));
    flotante.hidden = false;
  }

  // Redes de Success by Karely en el pie
  const redesPie = $('#redes-pie');
  if (redesPie) {
    redesPie.innerHTML = Object.entries(redes.successbykarely)
      .filter(([, url]) => !esPendiente(url))
      .map(([red, url]) => `<li><a href="${escaparHTML(url)}" target="_blank" rel="noopener" aria-label="${red.charAt(0).toUpperCase() + red.slice(1)}">${ICONOS[red]}</a></li>`)
      .join('');
  }
}

/* ==========================================================================
   8. Formulario de contacto → leads
   ========================================================================== */
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REGEX_TELEFONO = /^\+?[\d\s().-]{7,30}$/;
const CLAVE_ULTIMO_ENVIO = 'sbk-ultimo-lead';

function llenarOpcionesFormulario() {
  const form = $('#form-contacto');
  if (!form) return;

  // Chips de servicios (conserva la selección al cambiar de idioma)
  const contenedorChips = $('#chips-servicios');
  const marcados = new Set($$('input:checked', contenedorChips).map((i) => i.value));
  contenedorChips.innerHTML = SERVICIOS.map((s) => `
    <label class="chip-opcion"><input type="checkbox" name="services" value="${s.id}"${marcados.has(s.id) ? ' checked' : ''}><span>${escaparHTML(s[idioma] || s.es)}</span></label>`).join('');

  // Estados
  const selectEstado = $('#f-estado');
  const estadoActual = selectEstado.value;
  selectEstado.innerHTML = `<option value="">${escaparHTML(t('form.elegir'))}</option>`
    + ESTADOS_EEUU.map((e) => `<option value="${escaparHTML(e)}">${escaparHTML(e)}</option>`).join('')
    + `<option value="Fuera de EE. UU.">${escaparHTML(t('form.fueraEEUU'))}</option>`;
  selectEstado.value = estadoActual;

  // ¿Cómo me conociste?
  const selectReferencia = $('#f-referencia');
  const referenciaActual = selectReferencia.value;
  selectReferencia.innerHTML = `<option value="">${escaparHTML(t('form.elegir'))}</option>`
    + REFERENCIAS.map((r) => `<option value="${r.id}">${escaparHTML(r[idioma] || r.es)}</option>`).join('');
  selectReferencia.value = referenciaActual;

  // Países sugeridos
  $('#lista-paises').innerHTML = PAISES_SUGERIDOS.map((p) => `<option value="${escaparHTML(p)}">`).join('');
}

/* Valida un campo y muestra su mensaje; devuelve true si es válido */
function validarCampo(input) {
  const valor = input.type === 'checkbox' ? input.checked : input.value.trim();
  let mensaje = '';
  if (input.required && !valor) mensaje = t(input.type === 'checkbox' ? 'form.errConsentimiento' : 'form.errRequerido');
  else if (input.type === 'email' && valor && !REGEX_CORREO.test(valor)) mensaje = t('form.errCorreo');
  else if (input.type === 'tel' && valor && !REGEX_TELEFONO.test(valor)) mensaje = t('form.errTelefono');

  const idError = { 'f-nombre': 'e-nombre', 'f-apellido': 'e-apellido', 'f-correo': 'e-correo', 'f-telefono': 'e-telefono', 'f-consentimiento': 'e-consentimiento' }[input.id];
  const error = idError && document.getElementById(idError);
  if (error) {
    error.textContent = mensaje;
    if (mensaje) input.setAttribute('aria-describedby', idError);
    else input.removeAttribute('aria-describedby');
  }
  input.setAttribute('aria-invalid', String(Boolean(mensaje)));
  return !mensaje;
}

function iniciarFormulario() {
  const form = $('#form-contacto');
  if (!form) return;
  const exito = $('#exito-form');
  const botonEnviar = $('#btn-enviar');
  const obligatorios = ['#f-nombre', '#f-apellido', '#f-correo', '#f-telefono', '#f-consentimiento'].map((s) => $(s));
  let inicioLlenado = 0;

  llenarOpcionesFormulario();

  // El tiempo mínimo cuenta desde la primera interacción real
  form.addEventListener('focusin', () => { inicioLlenado ||= Date.now(); }, { once: true });

  // Validación en vivo
  obligatorios.forEach((input) => {
    input.addEventListener('blur', () => { if (input.value || input.type === 'checkbox') validarCampo(input); });
    input.addEventListener(input.type === 'checkbox' ? 'change' : 'input', () => {
      if (input.getAttribute('aria-invalid') === 'true') validarCampo(input);
    });
  });

  // Contador del mensaje
  const mensaje = $('#f-mensaje');
  const contador = $('#c-mensaje');
  mensaje.addEventListener('input', () => { contador.textContent = `${mensaje.value.length} / 2000`; });

  // "Quiero este servicio" preselecciona el chip correspondiente
  $$('[data-servicio]').forEach((enlace) => {
    enlace.addEventListener('click', () => {
      const chip = $(`#chips-servicios input[value="${enlace.dataset.servicio}"]`);
      if (chip) chip.checked = true;
    });
  });

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    // Honeypot: si un bot lo llenó, fingimos éxito sin guardar nada
    if ($('#f-sitio').value) { mostrarExito(''); return; }

    const validos = obligatorios.map(validarCampo);
    if (validos.includes(false)) {
      obligatorios[validos.indexOf(false)].focus();
      toast(t('form.errRevisar'), { tipo: 'error' });
      return;
    }
    if (!inicioLlenado || Date.now() - inicioLlenado < CONFIG.formulario.segundosMinimos * 1000) {
      toast(t('form.esperaTiempo'), { tipo: 'info' });
      return;
    }
    let ultimo = 0;
    try { ultimo = Number(localStorage.getItem(CLAVE_ULTIMO_ENVIO)) || 0; } catch { /* sin almacenamiento */ }
    if (Date.now() - ultimo < CONFIG.formulario.esperaEntreEnvios * 1000) {
      toast(t('form.esperaReenvio'), { tipo: 'info' });
      return;
    }

    const firebase = await cargarFirestore();
    if (!firebase) {
      // Sin configurar: aviso para el equipo. Configurado pero sin carga: problema de conexión.
      toast(t(firebaseConfigurado ? 'form.errEnvio' : 'form.demo'), { tipo: firebaseConfigurado ? 'error' : 'info', duracion: 7000 });
      return;
    }

    const datos = new FormData(form);
    const texto = (nombre, max) => String(datos.get(nombre) || '').trim().slice(0, max);
    const lead = {
      firstName: texto('firstName', 60),
      lastName: texto('lastName', 60),
      email: texto('email', 120).toLowerCase(),
      phone: texto('phone', 30),
      country: texto('country', 60),
      state: texto('state', 60),
      services: datos.getAll('services').filter((id) => SERVICIOS.some((s) => s.id === id)),
      message: texto('message', 2000),
      referral: texto('referral', 40),
      language: datos.get('language') === 'en' ? 'en' : 'es',
      source: 'landing',
      status: 'nuevo',
      consent: true,
    };

    botonEnviar.disabled = true;
    const etiqueta = $('span', botonEnviar);
    etiqueta.textContent = t('form.enviando');
    try {
      const { db, fs } = firebase;
      await fs.addDoc(fs.collection(db, 'leads'), { ...lead, createdAt: fs.serverTimestamp() });
      avisarAppsScript('lead', lead);
      try { localStorage.setItem(CLAVE_ULTIMO_ENVIO, String(Date.now())); } catch { /* sin almacenamiento */ }
      mostrarExito(lead.firstName);
      toast(t('form.toastEnviada'));
    } catch (error) {
      console.error('[leads] Error al enviar:', error);
      toast(t('form.errEnvio'), { tipo: 'error', duracion: 7000 });
    } finally {
      botonEnviar.disabled = false;
      etiqueta.textContent = t('form.enviar');
    }
  });

  function mostrarExito(nombre) {
    $('#exito-titulo').textContent = nombre ? t('form.exitoTitulo', { nombre }) : t('form.toastEnviada');
    form.hidden = true;
    exito.hidden = false;
    exito.focus();
  }

  $('#btn-otra').addEventListener('click', () => {
    form.reset();
    contador.textContent = '0 / 2000';
    obligatorios.forEach((i) => { i.removeAttribute('aria-invalid'); i.removeAttribute('aria-describedby'); });
    $$('.error', form).forEach((e) => { e.textContent = ''; });
    exito.hidden = true;
    form.hidden = false;
    $('#f-nombre').focus();
  });
}

/* ==========================================================================
   9. Arranque
   ========================================================================== */
$('#anio').textContent = String(new Date().getFullYear());
iniciarNavegacion();
iniciarEfectos();
iniciarMetodo();
pintarEnlacesConfig();
iniciarFormulario();
iniciarMedios();
iniciarTestimonios();
iniciarBlog();
iniciarCookies();

// Al cambiar de idioma se vuelven a pintar las partes dinámicas
document.addEventListener('idioma', (e) => {
  idioma = e.detail;
  aplicarMedios(ultimosMedios.medios, idioma);
  pintarGalerias(ultimosMedios.galerias);
  pintarTestimonios();
  pintarBlog();
  pintarEnlacesConfig();
  llenarOpcionesFormulario();
  $$('#form-contacto [aria-invalid="true"]').forEach(validarCampo);
});
