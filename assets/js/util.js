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
