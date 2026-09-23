/* ==========================================================================
   Blog público (blog/index.html y blog/articulo.html)
   - Listado: destacado tipo revista, filtros por categoría, búsqueda,
     etiquetas y "Cargar más".
   - Artículo: portada, progreso de lectura, tabla de contenido, contenido
     saneado con DOMPurify, "Solo miembros", CTA, compartir, autora,
     relacionados, contador de lecturas, SEO dinámico y vista previa.
   - Boletín → leads con source "blog-newsletter".
   ========================================================================== */
import { CONFIG, esPendiente } from './config.js';
import { cargarFirestore, cargarAuth } from './firebase.js';
import {
  $, $$, escaparHTML, campo, toast, formatearFecha, urlCloudinary,
  pintarMarcadores, aplicarMedios, leerCacheMedios, leerMediosFirestore, sanearHTML, avisarAppsScript,
} from './util.js';
import { iniciarI18n, t } from './i18n.js';
import { iniciarCookies } from './cookies.js';
import {
  RAIZ, rutaArticulo, urlCompartir, msFecha, leerCategorias, consultarPublicados, ordenEditorial,
  elegirDestacado, cuerpoArticulo, metaArticulo, nombreCategoria, normalizarEtiqueta, etiquetasHTML, minutosLectura,
} from './blog-datos.js';

document.documentElement.classList.add('js');
let idioma = iniciarI18n();
const pagina = document.body.dataset.pagina;
const esURLSegura = (url) => typeof url === 'string' && url.startsWith('https://');
const quitarAcentos = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/* ---------- Iconos ---------- */
const ICONOS = {
  instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v11.5A3.5 3.5 0 1 1 10.5 11"/><path d="M14 3c.4 2.7 2.2 4.4 5 4.6"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3.5h-2A3.5 3.5 0 0 0 9.5 7v3H7v3.5h2.5V21H13v-7.5h2.5l.5-3.5h-3V7.5a1 1 0 0 1 1-1h1.5Z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.2-4A8 8 0 1 1 8 18.8Z"/><path d="M9 9.5c.3 1.8 2.7 4.2 4.5 4.5l1.2-1.1 1.8.9c-.2 1.2-1 1.7-2 1.7-3.1 0-6.5-3.4-6.5-6.5 0-1 .5-1.8 1.7-2l.9 1.8Z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7.5 10v6.5M7.5 7.5v.01M11 16.5V10M11 13a2.5 2.5 0 0 1 5 0v3.5"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4l16 16M20 4 4 20" transform="scale(.9) translate(1.3 1.3)"/></svg>',
  enlace: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  candado: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  reloj: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  ojo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
};

/* ==========================================================================
   Comunes: navegación, medios, redes, año
   ========================================================================== */
function iniciarNavegacion() {
  const nav = $('#nav');
  const botonMenu = $('.btn-menu');
  const menu = $('#menu-movil');
  let pendiente = false;
  const alHacerScroll = () => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => { nav.classList.toggle('flotante', window.scrollY > 24); pendiente = false; });
  };
  window.addEventListener('scroll', alHacerScroll, { passive: true });
  alHacerScroll();
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
  $$('a', menu).forEach((a) => a.addEventListener('click', () => cerrarMenu()));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) cerrarMenu(true); });
  window.matchMedia('(min-width: 1000px)').addEventListener('change', (e) => { if (e.matches) cerrarMenu(); });
}

async function iniciarMedios() {
  pintarMarcadores();
  const cache = leerCacheMedios();
  if (cache) aplicarMedios(cache.medios, idioma);
  const firebase = await cargarFirestore();
  if (!firebase) return;
  try {
    const { medios } = await leerMediosFirestore(firebase);
    aplicarMedios(medios, idioma);
  } catch (error) {
    console.warn('[medios] Se usan los marcadores:', error.message);
  }
}

function redesHTML(redes) {
  return Object.entries(redes)
    .filter(([, url]) => !esPendiente(url))
    .map(([red, url]) => `<li><a href="${escaparHTML(url)}" target="_blank" rel="noopener" aria-label="${red.charAt(0).toUpperCase() + red.slice(1)}">${ICONOS[red] || ''}</a></li>`)
    .join('');
}

function pintarComunes() {
  const redesPie = $('#redes-pie');
  if (redesPie) redesPie.innerHTML = redesHTML(CONFIG.redes.successbykarely);
  const anio = $('#anio');
  if (anio) anio.textContent = new Date().getFullYear();
  // Los orbes se animan solo cuando su sección está a la vista
  const observador = new IntersectionObserver((entradas) => entradas.forEach((e) => e.target.classList.toggle('activo', e.isIntersecting)));
  $$('.fondo-vivo').forEach((f) => observador.observe(f));
}

/* ==========================================================================
   Tarjetas de artículo (listado y relacionados)
   ========================================================================== */
let categorias = [];

function portadaHTML(post, { anchos = [400, 640, 960], sizes = '(min-width: 900px) 33vw, 92vw', prioridad = false } = {}) {
  if (!esURLSegura(post.coverUrl)) {
    return `<div class="portada"><span class="marcador" aria-hidden="true"><span class="marcador-k">K</span><span class="marcador-marca">Success <em>by</em> Karely</span></span></div>`;
  }
  const url = (w) => urlCloudinary(post.coverUrl, `f_auto,q_auto,c_fill,g_auto,w_${w},ar_16:9`);
  return `<div class="portada tiene-imagen">
    <img class="media-img" src="${escaparHTML(url(anchos[1] || anchos[0]))}" srcset="${escaparHTML(anchos.map((w) => `${url(w)} ${w}w`).join(', '))}"
      sizes="${sizes}" alt="${escaparHTML(post.coverAlt || '')}" ${prioridad ? 'fetchpriority="high"' : 'loading="lazy"'} width="960" height="540">
  </div>`;
}

function metaTarjeta(post) {
  const cat = nombreCategoria(categorias, post.category, idioma);
  const minutos = post.readingMinutes || minutosLectura(post.contentHtml);
  return `
    <p class="tarjeta-blog-meta">
      ${cat ? `<span class="tarjeta-blog-cat">${escaparHTML(cat)}</span>` : ''}
      <span>${escaparHTML(formatearFecha(post.publishAt, idioma, { day: 'numeric', month: 'short', year: 'numeric' }))}</span>
      <span>${escaparHTML(t('blog.minutos', { n: minutos }))}</span>
    </p>`;
}

function tarjetaBlog(post) {
  return `
    <a class="tarjeta-blog" href="${rutaArticulo(post.slug)}">
      ${portadaHTML(post)}
      ${post.visibility === 'miembros' ? `<span class="sello-miembros">${ICONOS.candado}${escaparHTML(t('blog.exclusivo'))}</span>` : ''}
      <div class="tarjeta-blog-cuerpo">
        ${metaTarjeta(post)}
        <h3>${escaparHTML(campo(post, 'title', idioma))}</h3>
        <p class="tarjeta-blog-extracto">${escaparHTML(campo(post, 'excerpt', idioma))}</p>
        <p class="tarjeta-blog-autora">${escaparHTML(t('blogp.por', { autora: post.author || CONFIG.blog.autora.nombre }))}</p>
      </div>
    </a>`;
}

function revistaHTML(post) {
  return `
    <a class="revista glass-claro" href="${rutaArticulo(post.slug)}">
      ${portadaHTML(post, { anchos: [640, 960, 1400], sizes: '(min-width: 900px) 60vw, 92vw', prioridad: true })}
      <div class="revista-texto">
        <p class="revista-etiqueta">${escaparHTML(t('blogp.destacado'))}${post.visibility === 'miembros' ? ` · ${escaparHTML(t('blog.exclusivo'))}` : ''}</p>
        <h2>${escaparHTML(campo(post, 'title', idioma))}</h2>
        <p class="revista-extracto">${escaparHTML(campo(post, 'excerpt', idioma))}</p>
        ${metaTarjeta(post)}
        <span class="btn btn-principal btn-sm revista-btn">${escaparHTML(t('blogp.leer'))}</span>
      </div>
    </a>`;
}

/* ==========================================================================
   Listado (blog/index.html)
   ========================================================================== */
const listado = { posts: [], visibles: CONFIG.blog.porPagina, categoria: '', etiqueta: '', q: '' };

function leerFiltrosURL() {
  const p = new URLSearchParams(location.search);
  listado.categoria = p.get('categoria') || '';
  listado.etiqueta = normalizarEtiqueta(p.get('etiqueta') || '');
  listado.q = p.get('q') || '';
  $('#blog-q').value = listado.q;
}

function guardarFiltrosURL() {
  const url = new URL(location.href);
  [['categoria', listado.categoria], ['etiqueta', listado.etiqueta], ['q', listado.q.trim()]].forEach(([k, v]) => {
    if (v) url.searchParams.set(k, v); else url.searchParams.delete(k);
  });
  history.replaceState(null, '', url);
}

function filtrarPosts() {
  const q = quitarAcentos(listado.q.trim());
  return listado.posts.filter((p) => {
    if (listado.categoria && p.category !== listado.categoria) return false;
    if (listado.etiqueta && !(p.tags || []).some((tag) => normalizarEtiqueta(tag) === listado.etiqueta)) return false;
    if (!q) return true;
    const texto = quitarAcentos([campo(p, 'title', idioma), campo(p, 'excerpt', idioma), (p.tags || []).join(' '), nombreCategoria(categorias, p.category, idioma)].join(' '));
    return q.split(/\s+/).every((palabra) => texto.includes(palabra));
  });
}

function pintarChips() {
  const usadas = new Set(listado.posts.map((p) => p.category));
  const lista = [{ id: '', nombre: t('blogp.todas') }, ...categorias.filter((c) => usadas.has(c.id)).map((c) => ({ id: c.id, nombre: nombreCategoria(categorias, c.id, idioma) }))];
  $('#chips-categorias').innerHTML = lista.map((c) => `
    <button type="button" class="chip-cat" data-categoria="${escaparHTML(c.id)}" aria-pressed="${listado.categoria === c.id}">${escaparHTML(c.nombre)}</button>`).join('');
  const etiqueta = $('#filtro-etiqueta');
  etiqueta.hidden = !listado.etiqueta;
  etiqueta.innerHTML = listado.etiqueta ? `
    <span>${escaparHTML(t('blogp.etiqueta', { t: listado.etiqueta }))}</span>
    <button type="button" class="btn-quitar" id="quitar-etiqueta" aria-label="${escaparHTML(t('blogp.quitarEtiqueta'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>` : '';
}

function pintarListado() {
  const grid = $('#blog-grid');
  const destacadoZona = $('#blog-destacado');
  grid.removeAttribute('aria-busy');
  const hayFiltro = listado.categoria || listado.etiqueta || listado.q.trim();

  // Destacado tipo revista (solo sin filtros)
  const destacado = !hayFiltro ? elegirDestacado(listado.posts) : null;
  destacadoZona.innerHTML = destacado ? revistaHTML(destacado) : '';
  destacadoZona.hidden = !destacado;

  if (!listado.posts.length) {
    grid.innerHTML = `
      <div class="estado-vacio glass-claro">
        <span class="marcador-k" aria-hidden="true">K</span>
        <h3>${escaparHTML(t('blog.vacioT'))}</h3>
        <p>${escaparHTML(t('blog.vacioD'))}</p>
        <a class="btn btn-principal" href="${RAIZ}portal/?registro=1">${escaparHTML(t('blog.vacioBtn'))}</a>
      </div>`;
    $('#btn-mas').hidden = true;
    $('#blog-conteo').textContent = '';
    return;
  }

  const filtrados = filtrarPosts().filter((p) => p !== destacado);
  const total = filtrarPosts().length;
  $('#blog-conteo').textContent = total === 1 ? t('blogp.resultado1') : t('blogp.resultados', { n: total });
  if (!filtrados.length && hayFiltro) {
    grid.innerHTML = `
      <div class="estado-vacio glass-claro">
        <span class="marcador-k" aria-hidden="true">K</span>
        <h3>${escaparHTML(t('blogp.vacioFiltroT'))}</h3>
        <p>${escaparHTML(t('blogp.vacioFiltroD'))}</p>
        <button type="button" class="btn btn-principal" id="limpiar-filtros">${escaparHTML(t('blogp.limpiar'))}</button>
      </div>`;
    $('#btn-mas').hidden = true;
    return;
  }
  grid.innerHTML = filtrados.slice(0, listado.visibles).map(tarjetaBlog).join('');
  $('#btn-mas').hidden = filtrados.length <= listado.visibles;
}

async function iniciarListado() {
  leerFiltrosURL();
  const firebase = await cargarFirestore();
  if (firebase) {
    try {
      [categorias, listado.posts] = await Promise.all([leerCategorias(firebase), consultarPublicados(firebase, { limite: 120 })]);
      listado.posts = ordenEditorial(listado.posts);
    } catch (error) {
      console.warn('[blog] Sin artículos disponibles:', error.message);
      listado.posts = [];
    }
  }
  pintarChips();
  pintarListado();

  $('#chips-categorias').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-categoria]');
    if (!chip) return;
    listado.categoria = chip.dataset.categoria;
    listado.visibles = CONFIG.blog.porPagina;
    guardarFiltrosURL(); pintarChips(); pintarListado();
  });
  $('.blog-filtros').addEventListener('click', (e) => {
    if (!e.target.closest('#quitar-etiqueta')) return;
    listado.etiqueta = '';
    guardarFiltrosURL(); pintarChips(); pintarListado();
    $('#chips-categorias button')?.focus();
  });
  $('#blog-grid').addEventListener('click', (e) => {
    if (!e.target.closest('#limpiar-filtros')) return;
    Object.assign(listado, { categoria: '', etiqueta: '', q: '', visibles: CONFIG.blog.porPagina });
    $('#blog-q').value = '';
    guardarFiltrosURL(); pintarChips(); pintarListado();
  });
  let espera;
  $('#blog-q').addEventListener('input', (e) => {
    clearTimeout(espera);
    espera = setTimeout(() => { listado.q = e.target.value; listado.visibles = CONFIG.blog.porPagina; guardarFiltrosURL(); pintarListado(); }, 180);
  });
  $('#form-buscar').addEventListener('submit', (e) => { e.preventDefault(); $('#blog-grid').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('#btn-mas').addEventListener('click', () => {
    const antes = listado.visibles;
    listado.visibles += CONFIG.blog.porPagina;
    pintarListado();
    // Llevar el foco a la primera tarjeta nueva
    $$('#blog-grid .tarjeta-blog')[antes]?.focus();
  });
}

/* ==========================================================================
   Artículo (blog/articulo.html)
   ========================================================================== */
let articulo = null;

function ponerMeta(selector, atributo, valor) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement(selector.startsWith('link') ? 'link' : 'meta');
    const [, clave, nombre] = selector.match(/\[(\w+(?::\w+)?)="([^"]+)"\]/) || [];
    if (clave) el.setAttribute(clave, nombre);
    document.head.append(el);
  }
  el.setAttribute(atributo, valor);
}

function actualizarSEO(post) {
  const { titulo, descripcion } = metaArticulo(post, idioma);
  const url = urlCompartir(post.slug);
  const imagen = esURLSegura(post.ogImageUrl) ? post.ogImageUrl
    : esURLSegura(post.coverUrl) ? urlCloudinary(post.coverUrl, 'f_jpg,q_auto,c_fill,g_auto,w_1200,h_630')
      : `${CONFIG.sitio.url}/assets/img/og-image.jpg`;
  document.title = `${titulo} | Karely Paredes`;
  ponerMeta('meta[name="description"]', 'content', descripcion);
  ponerMeta('link[rel="canonical"]', 'href', url);
  ponerMeta('meta[property="og:title"]', 'content', titulo);
  ponerMeta('meta[property="og:description"]', 'content', descripcion);
  ponerMeta('meta[property="og:url"]', 'content', url);
  ponerMeta('meta[property="og:image"]', 'content', imagen);
  ponerMeta('meta[name="twitter:title"]', 'content', titulo);
  ponerMeta('meta[name="twitter:description"]', 'content', descripcion);
  ponerMeta('meta[name="twitter:image"]', 'content', imagen);
  const fechaISO = (v) => (msFecha(v) ? new Date(msFecha(v)).toISOString() : undefined);
  $('#jsonld-articulo').textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: campo(post, 'title', idioma).slice(0, 110),
    description: descripcion,
    image: [imagen],
    datePublished: fechaISO(post.publishAt),
    dateModified: fechaISO(post.updatedAt) || fechaISO(post.publishAt),
    inLanguage: idioma,
    articleSection: nombreCategoria(categorias, post.category, idioma) || undefined,
    keywords: (post.tags || []).join(', ') || undefined,
    isAccessibleForFree: post.visibility !== 'miembros',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@type': 'Person', name: post.author || CONFIG.blog.autora.nombre, url: `${CONFIG.sitio.url}/` },
    publisher: {
      '@type': 'Organization',
      name: 'Success by Karely',
      logo: { '@type': 'ImageObject', url: `${CONFIG.sitio.url}/assets/img/marca/logo-completo.png` },
      parentOrganization: { '@type': 'Organization', name: '6SGS Consultants' },
    },
  });
}

/* Asigna ids a H2/H3, arma la tabla de contenido y resalta la sección actual */
function armarTOC(prosa) {
  const titulos = $$('h2, h3', prosa);
  const toc = $('#toc');
  if (titulos.length < 2) { toc.hidden = true; return; }
  const usados = new Set();
  titulos.forEach((h) => {
    let base = quitarAcentos(h.textContent).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'seccion';
    let id = base; let n = 2;
    while (usados.has(id) || document.getElementById(id)) id = `${base}-${n++}`;
    usados.add(id);
    h.id = id;
  });
  $('#toc-lista').innerHTML = `<ol>${titulos.map((h) => `<li class="toc-${h.tagName.toLowerCase()}"><a href="#${h.id}">${escaparHTML(h.textContent)}</a></li>`).join('')}</ol>`;
  toc.hidden = false;
  // En móvil la tabla empieza cerrada para no empujar el contenido
  if (!window.matchMedia('(min-width: 1100px)').matches) $('#toc-panel').open = false;
  const enlaces = $$('#toc-lista a');
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => {
      if (!e.isIntersecting) return;
      enlaces.forEach((a) => (a.getAttribute('href') === `#${e.target.id}` ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    });
  }, { rootMargin: '-20% 0px -70% 0px' });
  titulos.forEach((h) => observador.observe(h));
}

/* Ajustes editoriales tras sanear: videos responsivos, imágenes perezosas, enlaces externos */
function pulirProsa(prosa) {
  $$('iframe', prosa).forEach((f) => {
    if (f.parentElement.classList.contains('video')) return;
    const marco = document.createElement('div');
    marco.className = 'video';
    f.replaceWith(marco);
    marco.append(f);
    f.removeAttribute('width'); f.removeAttribute('height');
    if (!f.title) f.title = 'Video';
  });
  $$('img', prosa).forEach((img) => {
    img.loading = 'lazy';
    img.decoding = 'async';
    if (esURLSegura(img.src) && img.src.includes('res.cloudinary.com')) img.src = urlCloudinary(img.src, 'f_auto,q_auto,c_limit,w_1400');
  });
  $$('a[href^="http"]', prosa).forEach((a) => {
    if (!a.href.startsWith(CONFIG.sitio.url)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  });
  // Tablas con desplazamiento horizontal en móvil
  $$('table', prosa).forEach((tabla) => {
    const caja = document.createElement('div');
    caja.className = 'tabla-prosa';
    tabla.replaceWith(caja);
    caja.append(tabla);
  });
}

function ctaHTML(post) {
  const tipo = post.ctaType || 'registro';
  if (tipo === 'ninguno') return '';
  let titulo; let texto; let boton; let href;
  if (tipo === 'personalizado' && esURLSegura(post.ctaUrl)) {
    titulo = post.ctaText || t('art.ctaConsultaT');
    texto = '';
    boton = post.ctaButton || t('blogp.leer');
    href = post.ctaUrl;
  } else if (tipo === 'consulta') {
    titulo = t('art.ctaConsultaT'); texto = t('art.ctaConsultaD');
    boton = post.ctaText || t('art.ctaConsultaBtn');
    href = esPendiente(CONFIG.contacto.agenda) ? `${RAIZ}#contacto` : CONFIG.contacto.agenda;
  } else {
    titulo = t('art.ctaRegistroT'); texto = t('art.ctaRegistroD');
    boton = post.ctaText || t('art.ctaRegistroBtn');
    href = `${RAIZ}portal/?registro=1`;
  }
  const externo = /^https:/.test(href) && !href.startsWith(CONFIG.sitio.url);
  return `
    <aside class="cta-articulo glass-oro seccion-oscura">
      <span class="marcador-k" aria-hidden="true">K</span>
      <div>
        <h2>${escaparHTML(titulo)}</h2>
        ${texto ? `<p>${escaparHTML(texto)}</p>` : ''}
      </div>
      <a class="btn btn-principal" href="${escaparHTML(href)}"${externo ? ' target="_blank" rel="noopener"' : ''}>${escaparHTML(boton)}</a>
    </aside>`;
}

function pintarCompartir(post) {
  const url = urlCompartir(post.slug);
  const titulo = campo(post, 'title', idioma);
  const u = encodeURIComponent(url);
  const botones = [
    ['whatsapp', 'WhatsApp', `https://wa.me/?text=${encodeURIComponent(`${titulo} ${url}`)}`],
    ['facebook', 'Facebook', `https://www.facebook.com/sharer/sharer.php?u=${u}`],
    ['linkedin', 'LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
    ['x', 'X', `https://twitter.com/intent/tweet?url=${u}&text=${encodeURIComponent(titulo)}`],
  ];
  $('#compartir-botones').innerHTML = botones.map(([icono, nombre, href]) => `
    <a class="btn-compartir" href="${escaparHTML(href)}" target="_blank" rel="noopener" aria-label="${escaparHTML(`${t('art.compartir')}: ${nombre}`)}">${ICONOS[icono]}<span>${nombre}</span></a>`).join('')
    + `<button type="button" class="btn-compartir" id="copiar-enlace">${ICONOS.enlace}<span>${escaparHTML(t('art.copiar'))}</span></button>`;
  $('#copiar-enlace').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const campoTmp = Object.assign(document.createElement('textarea'), { value: url });
      document.body.append(campoTmp); campoTmp.select(); document.execCommand('copy'); campoTmp.remove();
    }
    toast(t('art.copiado'));
  });
  $('#compartir').hidden = false;
}

function pintarAutora() {
  const { autora } = CONFIG.blog;
  $('#autora-nombre').textContent = autora.nombre;
  $('#autora-cred').textContent = autora.credenciales;
  $('#autora-bio').textContent = idioma === 'en' ? autora.bio_en : autora.bio_es;
  $('#redes-autora').innerHTML = redesHTML(CONFIG.redes.successbykarely);
}

function panelMiembrosHTML() {
  return `
    <div class="muro-miembros glass seccion-oscura">
      <span class="muro-icono" aria-hidden="true">${ICONOS.candado}</span>
      <h2>${escaparHTML(t('art.miembrosT'))}</h2>
      <p>${escaparHTML(t('art.miembrosD'))}</p>
      <div class="muro-acciones">
        <a class="btn btn-principal" href="${RAIZ}portal/?registro=1">${escaparHTML(t('art.miembrosCrear'))}</a>
        <a class="btn btn-vidrio" href="${RAIZ}portal/">${escaparHTML(t('art.miembrosEntrar'))}</a>
      </div>
    </div>`;
}

/* Espera la primera respuesta de Authentication (sesión o no) */
async function usuarioActual() {
  const auth = await cargarAuth();
  if (!auth) return null;
  return new Promise((resolver) => {
    const cancelar = auth.fa.onAuthStateChanged(auth.auth, (u) => { setTimeout(() => cancelar?.(), 0); resolver(u); });
  });
}

async function pintarArticulo(post, privado, { vistaPrevia = false } = {}) {
  articulo = { post, privado, vistaPrevia };
  const titulo = campo(post, 'title', idioma);
  const extracto = campo(post, 'excerpt', idioma);
  const cat = nombreCategoria(categorias, post.category, idioma);
  const minutos = post.readingMinutes || minutosLectura(cuerpoArticulo(post, privado, idioma));

  // Portada
  const portada = $('#portada-img');
  if (esURLSegura(post.coverUrl)) {
    const url = (w) => urlCloudinary(post.coverUrl, `f_auto,q_auto,c_fill,g_auto,w_${w},ar_16:9`);
    portada.innerHTML = `<img src="${escaparHTML(url(1400))}" srcset="${escaparHTML([640, 1000, 1400, 2000].map((w) => `${url(w)} ${w}w`).join(', '))}" sizes="100vw" alt="" fetchpriority="high">`;
    $('#articulo-portada').classList.add('con-imagen');
  } else {
    portada.innerHTML = '';
    $('#articulo-portada').classList.remove('con-imagen');
  }
  $('#articulo-cat').innerHTML = cat ? `<a href="${RAIZ}blog/?categoria=${encodeURIComponent(post.category)}">${escaparHTML(cat)}</a>${post.visibility === 'miembros' ? `<span class="sello-miembros">${ICONOS.candado}${escaparHTML(t('blog.exclusivo'))}</span>` : ''}` : '';
  $('#articulo-titulo').textContent = titulo;
  $('#articulo-extracto').textContent = extracto;
  $('#articulo-extracto').hidden = !extracto;
  const actualizado = msFecha(post.updatedAt) - msFecha(post.publishAt) > 86400000 ? t('art.actualizado', { fecha: formatearFecha(post.updatedAt, idioma) }) : '';
  $('#articulo-meta').innerHTML = `
    <span class="meta-autora"><span class="meta-avatar" data-espacio="autora_blog" data-ancho-max="120" data-sizes="36px"></span>${escaparHTML(post.author || CONFIG.blog.autora.nombre)}</span>
    <span>${escaparHTML(formatearFecha(post.publishAt || new Date(), idioma))}</span>
    <span>${ICONOS.reloj}${escaparHTML(t('blog.minutos', { n: minutos }))}</span>
    ${post.views > 0 ? `<span>${ICONOS.ojo}${escaparHTML(t('art.lecturas', { n: new Intl.NumberFormat(idioma).format(post.views) }))}</span>` : ''}
    ${actualizado ? `<span class="meta-actualizado">${escaparHTML(actualizado)}</span>` : ''}`;

  // Cuerpo (o muro de miembros)
  const prosa = $('#prosa');
  const bloqueado = post.visibility === 'miembros' && !privado && !vistaPrevia;
  if (bloqueado) {
    prosa.innerHTML = `${extracto ? `<p class="prosa-entrada">${escaparHTML(extracto)}</p>` : ''}${panelMiembrosHTML()}`;
    $('#toc').hidden = true;
  } else {
    prosa.innerHTML = await sanearHTML(cuerpoArticulo(post, privado, idioma), { videos: true });
    pulirProsa(prosa);
    armarTOC(prosa);
  }
  $('#articulo-etiquetas').innerHTML = etiquetasHTML(post.tags || []);
  $('#articulo-cta').innerHTML = bloqueado ? '' : ctaHTML(post);
  pintarCompartir(post);
  pintarAutora();
  pintarMarcadores($('#articulo-meta'));
  pintarMarcadores($('.autora'));
  const cache = leerCacheMedios();
  if (cache) aplicarMedios(cache.medios, idioma);
  actualizarSEO(post);
}

async function pintarRelacionados(firebase, post) {
  let lista = [];
  try {
    if (post?.category) {
      lista = await consultarPublicados(firebase, { filtros: [['category', '==', post.category]], limite: 4 });
    }
    if (lista.filter((p) => p.slug !== post?.slug).length < 3) {
      const recientes = await consultarPublicados(firebase, { limite: 6 });
      recientes.forEach((p) => { if (!lista.some((x) => x.id === p.id)) lista.push(p); });
    }
  } catch (error) {
    console.warn('[blog] Sin relacionados:', error.message);
  }
  lista = lista.filter((p) => p.slug !== post?.slug).slice(0, 3);
  if (!lista.length) return;
  $('#rel-grid').innerHTML = lista.map(tarjetaBlog).join('');
  $('#relacionados').hidden = false;
}

/* Contador de lecturas: +1 por sesión y artículo (las reglas solo permiten sumar 1) */
async function contarLectura({ db, fs }, post) {
  const clave = `sbk-leido-${post.id}`;
  try { if (sessionStorage.getItem(clave)) return; sessionStorage.setItem(clave, '1'); } catch { /* sin almacenamiento */ }
  try {
    await fs.updateDoc(fs.doc(db, 'posts', post.id), { views: fs.increment(1) });
  } catch (error) {
    console.warn('[blog] No se pudo contar la lectura:', error.message);
  }
}

function pintarNoEncontrado() {
  document.title = `${t('art.noEncontradoT')} | Karely Paredes`;
  ponerMeta('meta[name="robots"]', 'content', 'noindex, follow');
  $('#articulo-titulo').textContent = t('art.noEncontradoT');
  $('#articulo-extracto').textContent = t('art.noEncontradoD');
  $('#prosa').innerHTML = `<p class="prosa-entrada"><a class="btn btn-principal" href="./">${escaparHTML(t('art.volver'))}</a></p>`;
  $('#articulo-meta').innerHTML = '';
  $('.autora').hidden = true;
  $('.articulo-aviso').hidden = true;
}

/* Barra de progreso de lectura (dorada) */
function iniciarProgreso() {
  const barra = $('#progreso-lectura');
  const relleno = $('span', barra);
  let pendiente = false;
  const actualizar = () => {
    pendiente = false;
    const art = $('#articulo');
    const inicio = art.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.3;
    const fin = inicio + art.offsetHeight - window.innerHeight * 0.4;
    const pct = Math.min(100, Math.max(0, ((window.scrollY - inicio) / Math.max(1, fin - inicio)) * 100));
    relleno.style.transform = `scaleX(${pct / 100})`;
    barra.setAttribute('aria-valuenow', String(Math.round(pct)));
  };
  window.addEventListener('scroll', () => { if (!pendiente) { pendiente = true; requestAnimationFrame(actualizar); } }, { passive: true });
  window.addEventListener('resize', actualizar);
  actualizar();
}

async function iniciarArticulo() {
  iniciarProgreso();
  const parametros = new URLSearchParams(location.search);
  const slug = parametros.get('slug') || document.querySelector('meta[name="sbk-slug"]')?.content || '';
  const firebase = await cargarFirestore();
  if (firebase) categorias = await leerCategorias(firebase);

  // Vista previa exacta desde el panel (el borrador viaja por localStorage)
  if (parametros.get('vista') === 'local') {
    try {
      const datos = JSON.parse(localStorage.getItem('sbk-vista-previa') || 'null');
      if (datos?.post) {
        ponerMeta('meta[name="robots"]', 'content', 'noindex, nofollow');
        $('#aviso-vista-previa').hidden = false;
        await pintarArticulo(datos.post, datos.privado || null, { vistaPrevia: true });
        document.title = `${t('art.vistaPrevia').split(':')[0]} · ${document.title}`;
        return;
      }
    } catch (error) { console.warn('[blog] Vista previa no disponible:', error.message); }
  }

  if (!firebase || !slug) { pintarNoEncontrado(); if (firebase) pintarRelacionados(firebase, null); return; }
  let post = null;
  try {
    [post] = await consultarPublicados(firebase, { filtros: [['slug', '==', slug]], limite: 1 });
  } catch (error) {
    console.warn('[blog] No se pudo leer el artículo:', error.message);
  }
  if (!post) { pintarNoEncontrado(); pintarRelacionados(firebase, null); return; }

  // Artículos "Solo miembros": el cuerpo solo se lee con sesión iniciada
  let privado = null;
  if (post.visibility === 'miembros') {
    const usuario = await usuarioActual();
    if (usuario) {
      try {
        const snap = await firebase.fs.getDoc(firebase.fs.doc(firebase.db, 'posts', post.id, 'privado', 'cuerpo'));
        privado = snap.exists() ? snap.data() : { contentHtml: '' };
      } catch (error) {
        console.warn('[blog] Contenido de miembros no disponible:', error.message);
      }
    }
  }
  await pintarArticulo(post, privado);
  // Si llegó con #ancla, llevarla a su subtítulo una vez armado el contenido
  if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  contarLectura(firebase, post);
  pintarRelacionados(firebase, post);
}

/* ==========================================================================
   Boletín → leads (source "blog-newsletter")
   ========================================================================== */
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function iniciarBoletin() {
  $$('[data-boletin]').forEach((caja, i) => {
    const id = `bol-${i}`;
    caja.insertAdjacentHTML('beforeend', `
      <form class="boletin-form" novalidate>
        <div class="boletin-fila">
          <label class="solo-lectores" for="${id}-correo">${escaparHTML(t('blogp.boletinPh'))}</label>
          <input type="email" id="${id}-correo" autocomplete="email" required maxlength="120" placeholder="${escaparHTML(t('blogp.boletinPh'))}" aria-describedby="${id}-error">
          <button type="submit" class="btn btn-principal">${escaparHTML(t('blogp.boletinBtn'))}</button>
        </div>
        <div class="trampa" aria-hidden="true"><label for="${id}-web">Web</label><input id="${id}-web" tabindex="-1" autocomplete="off"></div>
        <label class="check check-claro"><input type="checkbox" id="${id}-consent"><span>${t('blogp.boletinConsent', { raiz: RAIZ })}</span></label>
        <p class="error" id="${id}-error" aria-live="polite"></p>
      </form>
      <div class="boletin-ok" hidden tabindex="-1">
        <svg class="exito-check" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29"/><path d="m20 33 8 8 16-17"/></svg>
        <div><strong>${escaparHTML(t('blogp.boletinOk'))}</strong><p>${escaparHTML(t('blogp.boletinOkD'))}</p></div>
      </div>`);
    const form = $('form', caja);
    const inicio = Date.now();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const correo = $(`#${id}-correo`).value.trim();
      const error = $(`#${id}-error`);
      error.textContent = '';
      if ($(`#${id}-web`).value) return; // bot
      if (!REGEX_CORREO.test(correo)) { error.textContent = t('blogp.boletinCorreoErr'); $(`#${id}-correo`).setAttribute('aria-invalid', 'true'); $(`#${id}-correo`).focus(); return; }
      $(`#${id}-correo`).removeAttribute('aria-invalid');
      if (!$(`#${id}-consent`).checked) { error.textContent = t('blogp.boletinConsentErr'); $(`#${id}-consent`).focus(); return; }
      if (Date.now() - inicio < 2000) { error.textContent = t('blogp.boletinErr'); return; }
      const boton = $('button[type="submit"]', form);
      boton.disabled = true;
      try {
        const firebase = await cargarFirestore();
        if (!firebase) throw new Error('sin-firebase');
        const { db, fs } = firebase;
        await fs.addDoc(fs.collection(db, 'leads'), {
          email: correo.toLowerCase(), language: idioma, source: 'blog-newsletter', status: 'nuevo', consent: true, services: [], createdAt: fs.serverTimestamp(),
        });
        avisarAppsScript('suscriptor', { email: correo.toLowerCase() });
        form.hidden = true;
        const ok = $('.boletin-ok', caja);
        ok.hidden = false;
        ok.focus();
      } catch (err) {
        console.error(err);
        error.textContent = t('blogp.boletinErr');
        boton.disabled = false;
      }
    });
  });
}

/* ==========================================================================
   Arranque
   ========================================================================== */
iniciarNavegacion();
pintarComunes();
iniciarMedios();
iniciarBoletin();
iniciarCookies(RAIZ);
if (pagina === 'listado') iniciarListado();
if (pagina === 'articulo') iniciarArticulo();

// Cambiar idioma: repintar lo que depende de datos
document.addEventListener('idioma', (e) => {
  idioma = e.detail;
  if (pagina === 'listado' && listado.posts) { pintarChips(); pintarListado(); }
  if (pagina === 'articulo' && articulo) pintarArticulo(articulo.post, articulo.privado, { vistaPrevia: articulo.vistaPrevia });
  $$('[data-boletin]').forEach((caja) => { $$('form, .boletin-ok', caja).forEach((el) => el.remove()); });
  iniciarBoletin();
});
