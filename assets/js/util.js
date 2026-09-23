/* ==========================================================================
   Utilidades compartidas: DOM, escape de HTML, fechas, Cloudinary,
   toasts, CSV y medios administrables (siteMedia).
   ========================================================================== */
import { CONFIG, ESPACIOS_IMAGEN } from './config.js';

/* ---------- DOM ---------- */
export const $ = (selector, contexto = document) => contexto.querySelector(selector);
export const $$ = (selector, contexto = document) => [...contexto.querySelectorAll(selector)];

/* Escapa cualquier texto de usuario antes de insertarlo como HTML */
export function escaparHTML(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/* ¿El usuario pidió menos movimiento? */
export const reducirMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ¿Dispositivo con puntero fino (escritorio)? */
export const punteroFino = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* Lee un campo traducible: primero campo_en/campo_es según idioma, luego el base */
export function campo(objeto, nombre, idioma = 'es') {
  if (!objeto) return '';
  return objeto[`${nombre}_${idioma}`] || objeto[nombre] || objeto[`${nombre}_es`] || '';
}

/* ---------- Fechas ---------- */
export function aFecha(valor) {
  if (!valor) return null;
  if (typeof valor.toDate === 'function') return valor.toDate();
  if (valor instanceof Date) return valor;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function formatearFecha(valor, idioma = 'es', opciones = { day: 'numeric', month: 'long', year: 'numeric' }) {
  const fecha = aFecha(valor);
  if (!fecha) return '';
  return new Intl.DateTimeFormat(idioma === 'en' ? 'en-US' : 'es-US', opciones).format(fecha);
}

/* ---------- Cloudinary ---------- */
/* Inserta una transformación en una URL de Cloudinary (…/upload/<t>/…) */
export function urlCloudinary(url, transformacion = 'f_auto,q_auto') {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/${transformacion}/`);
}

/* srcset responsivo; si la imagen no es de Cloudinary devuelve cadena vacía */
export function srcsetCloudinary(url, anchos = [400, 800, 1200, 1600], anchoOriginal = Infinity) {
  if (!url || !url.includes('res.cloudinary.com')) return '';
  return anchos
    .filter((ancho, i) => ancho <= anchoOriginal || i === 0)
    .map((ancho) => `${urlCloudinary(url, `f_auto,q_auto,c_limit,w_${ancho}`)} ${ancho}w`)
    .join(', ');
}

/* ---------- Toasts ---------- */
function contenedorToasts() {
  let contenedor = $('#toasts');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.id = 'toasts';
    contenedor.className = 'toasts';
    contenedor.setAttribute('role', 'status');
    contenedor.setAttribute('aria-live', 'polite');
    document.body.append(contenedor);
  }
  return contenedor;
}

/**
 * Muestra un toast de vidrio.
 * @param {string} mensaje
 * @param {{tipo?: 'exito'|'error'|'info', duracion?: number, accion?: {texto: string, fn: Function}}} opciones
 */
export function toast(mensaje, { tipo = 'exito', duracion = 4500, accion } = {}) {
  const elemento = document.createElement('div');
  elemento.className = `toast glass toast-${tipo}`;
  elemento.innerHTML = `<span class="toast-icono" aria-hidden="true"></span><span class="toast-texto">${escaparHTML(mensaje)}</span>`;
  if (accion) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'toast-accion';
    boton.textContent = accion.texto;
    boton.addEventListener('click', () => { accion.fn(); cerrar(); });
    elemento.append(boton);
  }
  contenedorToasts().append(elemento);
  requestAnimationFrame(() => elemento.classList.add('visible'));
  const temporizador = setTimeout(cerrar, duracion);
  function cerrar() {
    clearTimeout(temporizador);
    elemento.classList.remove('visible');
    setTimeout(() => elemento.remove(), 300);
  }
  return cerrar;
}

/* ---------- CSV (BOM UTF-8 para que Excel respete los acentos) ---------- */
export function descargarCSV(nombreArchivo, filas) {
  const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const contenido = '﻿' + filas.map((fila) => fila.map(celda).join(',')).join('\r\n');
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }));
  enlace.download = nombreArchivo;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}

/* ==========================================================================
   Medios administrables (siteMedia)
   Marcado esperado en el HTML:
     <div data-espacio="retrato_karely" data-sizes="…" [data-opcional] [data-carga="eager"]>
       [<span class="sin-imagen">…respaldo propio…</span>]
     </div>
   - Si el contenedor tiene hijos .sin-imagen, esos son el respaldo.
   - Si no, y no es data-opcional, se inyecta el marcador de vidrio.
   ========================================================================== */
const CLAVE_CACHE = 'sbk-medios-v1';

export const espacioPorId = (id) => ESPACIOS_IMAGEN.find((e) => e.id === id);

export function leerCacheMedios() {
  try { return JSON.parse(sessionStorage.getItem(CLAVE_CACHE)) || null; } catch { return null; }
}

export function guardarCacheMedios(medios) {
  try { sessionStorage.setItem(CLAVE_CACHE, JSON.stringify(medios)); } catch { /* modo privado */ }
}

const MARCADOR_HTML = `
  <span class="marcador" aria-hidden="true">
    <span class="marcador-k">K</span>
    <span class="marcador-marca">Success <em>by</em> Karely</span>
  </span>`;

/* Pinta los marcadores de vidrio en los espacios que no tienen respaldo propio */
export function pintarMarcadores(raiz = document) {
  $$('[data-espacio]', raiz).forEach((el) => {
    const espacio = espacioPorId(el.dataset.espacio);
    if (espacio?.ratio && !el.style.aspectRatio && !el.hasAttribute('data-sin-ratio')) {
      el.style.aspectRatio = String(espacio.ratio);
    }
    if (el.hasAttribute('data-opcional') || $('.sin-imagen', el) || $('.marcador', el)) return;
    el.insertAdjacentHTML('afterbegin', MARCADOR_HTML);
  });
}

/* Aplica las URLs de siteMedia a cada espacio; sin imagen, deja el marcador */
export function aplicarMedios(medios, idioma = 'es', raiz = document) {
  medios ||= {};
  $$('[data-espacio]', raiz).forEach((el) => {
    const medio = medios[el.dataset.espacio];
    let img = $('img.media-img', el);
    if (!medio?.url) {
      img?.remove();
      el.classList.remove('tiene-imagen');
      return;
    }
    const alt = medio[`alt_${idioma}`] || medio.alt_es || '';
    if (img && img.dataset.origen === medio.url) { img.alt = alt; return; }
    img?.remove();
    img = document.createElement('img');
    img.className = 'media-img';
    img.dataset.origen = medio.url;
    img.alt = alt;
    img.decoding = 'async';
    img.loading = el.dataset.carga === 'eager' ? 'eager' : 'lazy';
    if (medio.width && medio.height) { img.width = medio.width; img.height = medio.height; }
    const anchoMax = Number(el.dataset.anchoMax) || 1600;
    img.src = urlCloudinary(medio.url, `f_auto,q_auto,c_limit,w_${anchoMax}`);
    const srcset = srcsetCloudinary(medio.url, [320, 480, 800, 1200, 1600].filter((a) => a <= anchoMax), medio.width || Infinity);
    if (srcset) { img.srcset = srcset; img.sizes = el.dataset.sizes || '100vw'; }
    img.addEventListener('load', () => el.classList.add('tiene-imagen'), { once: true });
    img.addEventListener('error', () => { img.remove(); el.classList.remove('tiene-imagen'); }, { once: true });
    el.append(img);
    if (img.complete && img.naturalWidth) el.classList.add('tiene-imagen');
  });

  // Favicon dinámico (la copia estática en assets/img/ es la que ven buscadores)
  if (medios.favicon?.url) {
    const icono = $('link[rel="icon"]') || document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'icon' }));
    icono.type = 'image/png';
    icono.href = urlCloudinary(medios.favicon.url, 'f_png,c_fill,w_64,h_64');
  }
}

/**
 * Lee siteMedia de Firestore, actualiza la caché y devuelve { medios, galerias }.
 * @param {{db: any, fs: any}} firebase
 * @param {string[]} galerias ids de galerías a leer (siteMedia/{id}/items)
 */
export async function leerMediosFirestore({ db, fs }, galerias = []) {
  const medios = {};
  const snap = await fs.getDocs(fs.collection(db, 'siteMedia'));
  snap.forEach((d) => { medios[d.id] = d.data(); });
  const resultadoGalerias = {};
  await Promise.all(galerias.map(async (id) => {
    try {
      const items = await fs.getDocs(fs.query(fs.collection(db, 'siteMedia', id, 'items'), fs.orderBy('order')));
      resultadoGalerias[id] = items.docs.map((d) => ({ id: d.id, ...d.data() })).filter((i) => i.url);
    } catch (error) {
      console.warn(`[medios] Galería ${id} no disponible:`, error.message);
      resultadoGalerias[id] = [];
    }
  }));
  const datos = { medios, galerias: resultadoGalerias };
  guardarCacheMedios(datos);
  return datos;
}

/* URL absoluta para enlaces de contacto */
export function enlaceWhatsApp(mensaje = '') {
  const numero = String(CONFIG.contacto.whatsapp).replace(/\D/g, '');
  return `https://wa.me/${numero}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''}`;
}

/* ==========================================================================
   Cloudinary: subida sin firma con progreso (XMLHttpRequest)
   ========================================================================== */
export const TIPOS_DOCUMENTO = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

export function cloudinaryConfigurado() {
  const { cloudName, uploadPreset } = CONFIG.cloudinary;
  return !/(TU_|PENDIENTE)/.test(cloudName + uploadPreset);
}

/**
 * Sube un archivo a Cloudinary.
 * @param {File|Blob} archivo
 * @param {{carpeta?: string, onProgreso?: (p: number) => void, tipo?: 'auto'|'image'|'raw'}} opciones
 * @returns {Promise<{url: string, publicId: string, width?: number, height?: number, format: string, bytes: number, resourceType: string}>}
 */
export function subirACloudinary(archivo, { carpeta = '', onProgreso, tipo = 'auto' } = {}) {
  const { cloudName, uploadPreset, carpetaBase } = CONFIG.cloudinary;
  return new Promise((resolver, rechazar) => {
    const datos = new FormData();
    datos.append('file', archivo);
    datos.append('upload_preset', uploadPreset);
    datos.append('folder', [carpetaBase, carpeta].filter(Boolean).join('/'));
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/${tipo}/upload`);
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgreso) onProgreso(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener('load', () => {
      let r = {};
      try { r = JSON.parse(xhr.responseText); } catch { /* respuesta vacía */ }
      if (xhr.status >= 200 && xhr.status < 300 && r.secure_url) {
        resolver({
          url: r.secure_url,
          publicId: r.public_id,
          width: r.width,
          height: r.height,
          format: r.format || String(r.public_id || '').split('.').pop(),
          bytes: r.bytes,
          resourceType: r.resource_type,
        });
      } else {
        rechazar(new Error(r.error?.message || `Cloudinary respondió ${xhr.status}`));
      }
    });
    xhr.addEventListener('error', () => rechazar(new Error('network')));
    xhr.send(datos);
  });
}

/* Tamaño legible (KB / MB) */
export function tamanoLegible(bytes = 0) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* Fecha local AAAA-MM-DD (para rachas y fechas límite) */
export function fechaLocal(fecha = new Date()) {
  const d = new Date(fecha);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* HTML de un iframe para videos de YouTube o Vimeo; cadena vacía si la URL no es válida */
export function embedVideo(url, titulo = '') {
  if (!url) return '';
  let src = '';
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (yt) src = `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0`;
  else if (vimeo) src = `https://player.vimeo.com/video/${vimeo[1]}`;
  if (!src) return '';
  return `<div class="video"><iframe src="${src}" title="${escaparHTML(titulo)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
}

/* DOMPurify bajo demanda para contenido con formato */
let promesaPurify = null;
// Únicos reproductores que pueden incrustarse (videos del blog y lecciones)
const IFRAMES_PERMITIDOS = /^https:\/\/(www\.youtube(-nocookie)?\.com\/embed\/|player\.vimeo\.com\/video\/)/i;
export async function sanearHTML(html = '', { videos = false } = {}) {
  promesaPurify ??= import('https://cdn.jsdelivr.net/npm/dompurify@3.1.6/+esm').then((m) => {
    const purify = m.default;
    // Los iframes que no sean de YouTube/Vimeo se eliminan; los válidos se endurecen
    purify.addHook('uponSanitizeElement', (nodo, datos) => {
      if (datos.tagName === 'iframe' && !IFRAMES_PERMITIDOS.test(nodo.getAttribute('src') || '')) nodo.remove();
    });
    purify.addHook('afterSanitizeAttributes', (nodo) => {
      if (nodo.tagName === 'IFRAME') {
        nodo.setAttribute('loading', 'lazy');
        nodo.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        nodo.setAttribute('allow', 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen');
      }
      // Enlaces que abren otra pestaña siempre con rel seguro
      if (nodo.tagName === 'A' && nodo.getAttribute('target') === '_blank') nodo.setAttribute('rel', 'noopener noreferrer');
    });
    return purify;
  }).catch(() => null);
  const purify = await promesaPurify;
  if (!purify) return escaparHTML(String(html).replace(/<[^>]+>/g, ' '));
  return purify.sanitize(html, {
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#)/i,
    ADD_TAGS: videos ? ['iframe'] : [],
    ADD_ATTR: videos ? ['target', 'rel', 'allowfullscreen', 'frameborder'] : ['target', 'rel'],
  });
}

/* Confeti dorado discreto (respeta "reducir movimiento") */
let promesaConfeti = null;
export async function confetiDorado() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  promesaConfeti ??= import('https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/+esm').then((m) => m.default).catch(() => null);
  const confeti = await promesaConfeti;
  if (!confeti) return;
  const colores = ['#D3AE7A', '#E4C692', '#F6DCB9', '#C99F66', '#7A2A45'];
  confeti({ particleCount: 90, spread: 70, startVelocity: 38, origin: { y: 0.65 }, colors: colores, zIndex: 400 });
  setTimeout(() => confeti({ particleCount: 60, spread: 100, origin: { y: 0.55 }, colors: colores, zIndex: 400 }), 250);
}
