/* ==========================================================================
   Portal · Artículos exclusivos
   Lista los artículos "Solo miembros" publicados; se leen completos en el
   blog (con la sesión iniciada, las reglas permiten leer su cuerpo).
   ========================================================================== */
import { $, escaparHTML, campo, formatearFecha, urlCloudinary } from './util.js';
import { t } from './i18n.js';
import { leerCategorias, consultarPublicados, nombreCategoria, rutaArticulo, minutosLectura } from './blog-datos.js';

let ctx = null;
let posts = null;
let categorias = [];
let cargando = null;

export function iniciarArticulos(contexto) { ctx = contexto; }

async function cargar() {
  if (!ctx?.fb) return;
  const firebase = { db: ctx.fb.db, fs: ctx.fb.fs };
  try {
    [categorias, posts] = await Promise.all([
      leerCategorias(firebase),
      consultarPublicados(firebase, { filtros: [['visibility', '==', 'miembros']], limite: 60 }),
    ]);
  } catch (error) {
    console.warn('[portal] Artículos exclusivos no disponibles:', error.message);
    posts = [];
  }
}

const tarjeta = (p, idioma) => {
  const portada = typeof p.coverUrl === 'string' && p.coverUrl.startsWith('https://')
    ? `<img class="media-img" src="${escaparHTML(urlCloudinary(p.coverUrl, 'f_auto,q_auto,c_fill,g_auto,w_640,ar_16:9'))}" alt="${escaparHTML(p.coverAlt || '')}" loading="lazy" width="640" height="360" style="opacity:1">`
    : '<span class="marcador" aria-hidden="true"><span class="marcador-k">K</span></span>';
  const cat = nombreCategoria(categorias, p.category, idioma);
  return `
    <a class="tarjeta-curso panel" href="${rutaArticulo(p.slug, '../')}">
      <div class="curso-portada">${portada}</div>
      <div class="tarjeta-curso-cuerpo">
        ${cat ? `<span class="curso-insignia">${escaparHTML(cat)}</span>` : ''}
        <h3>${escaparHTML(campo(p, 'title', idioma))}</h3>
        <p class="curso-meta">${escaparHTML(campo(p, 'excerpt', idioma))}</p>
        <p class="curso-pie"><span>${escaparHTML(formatearFecha(p.publishAt, idioma, { day: 'numeric', month: 'short', year: 'numeric' }))} · ${escaparHTML(t('blog.minutos', { n: p.readingMinutes || minutosLectura(p.contentHtml) }))}</span><span class="curso-cta">${escaparHTML(t('blogp.leer'))}</span></p>
      </div>
    </a>`;
};

/* Pinta la vista (carga una sola vez por sesión) */
export async function pintarArticulos() {
  const cont = $('#lista-articulos');
  if (!cont || !ctx) return;
  if (posts === null) {
    cont.innerHTML = '<div class="rejilla-cursos"><div class="esqueleto-app"></div><div class="esqueleto-app"></div></div>';
    cargando ??= cargar();
    await cargando;
  }
  const idioma = ctx.idioma;
  cont.innerHTML = posts.length
    ? `<div class="rejilla-cursos">${posts.map((p) => tarjeta(p, idioma)).join('')}</div>`
    : `<div class="estado-vacio-app panel">
        <span class="vacio-icono" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h5v17H6a2 2 0 0 0-2 1z"/><path d="M20 5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 1 2 1z"/></svg></span>
        <h2>${escaparHTML(t('vac.artT'))}</h2>
        <p>${escaparHTML(t('vac.artD'))}</p>
        <a class="btn btn-linea-app btn-sm" href="../blog/">${escaparHTML(t('blog.verTodos'))}</a>
      </div>`;
}

export function reiniciarArticulos() { posts = null; cargando = null; }
