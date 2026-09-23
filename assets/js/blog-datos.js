/* ==========================================================================
   Blog · capa de datos compartida (landing, blog, portal y panel)
   --------------------------------------------------------------------------
   Modelo:
   - posts/{id}: metadatos visibles para todos cuando el artículo está
     publicado (título, portada, extracto…). Si es "Solo miembros", el
     cuerpo NO va aquí: contentHtml queda vacío.
   - posts/{id}/privado/cuerpo: cuerpo de los artículos "Solo miembros",
     legible solo con sesión iniciada (lo exigen las reglas).
   - Un artículo es público cuando status es "publicado" o "programado" y
     su publishAt ya pasó: así los programados se publican solos a su hora.
   ========================================================================== */
import { CONFIG, CATEGORIAS_BLOG } from './config.js';
import { campo, escaparHTML } from './util.js';

export const ESTADOS_VISIBLES = ['publicado', 'programado'];

/* Raíz relativa del sitio según la página (meta sbk-raiz), p. ej. "../" */
export const RAIZ = document.querySelector('meta[name="sbk-raiz"]')?.content ?? '';

/* Enlace interno a un artículo */
export const rutaArticulo = (slug, raiz = RAIZ) => `${raiz}blog/articulo.html?slug=${encodeURIComponent(slug || '')}`;

/* URL absoluta para compartir (usa las páginas estáticas si el Action está activo) */
export function urlCompartir(slug) {
  const base = CONFIG.sitio.url.replace(/\/$/, '');
  return CONFIG.blog.paginasEstaticas
    ? `${base}/blog/${encodeURIComponent(slug)}/`
    : `${base}/blog/articulo.html?slug=${encodeURIComponent(slug)}`;
}

/* Milisegundos de un Timestamp de Firestore, Date o número */
export const msFecha = (v) => (v?.toMillis ? v.toMillis() : v instanceof Date ? v.getTime() : typeof v === 'number' ? v : 0);

/* Estado efectivo: un "programado" cuya hora ya pasó se muestra como publicado */
export function estadoEfectivo(post) {
  if (post.status === 'programado' && msFecha(post.publishAt) <= Date.now()) return 'publicado';
  return post.status || 'borrador';
}

/* Minutos de lectura a partir del HTML (≈ 220 palabras por minuto) */
export function minutosLectura(html = '') {
  const palabras = String(html).replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(palabras / 220));
}

/* Nombre de categoría en el idioma actual */
export function nombreCategoria(categorias, id, idioma) {
  const c = categorias.find((x) => x.id === id);
  return c ? (campo(c, 'name', idioma) || c.name || '') : '';
}

/* Categorías: postCategories ordenadas, o las de respaldo si aún no hay */
export async function leerCategorias({ db, fs }) {
  try {
    const snap = await fs.getDocs(fs.collection(db, 'postCategories'));
    const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    if (lista.length) return lista;
  } catch (error) {
    console.warn('[blog] Categorías de respaldo:', error.message);
  }
  return CATEGORIAS_BLOG.map((c) => ({ id: c.id, name: c.es, name_en: c.en, slug: c.id, order: c.order }));
}

/*
 * Consulta de artículos visibles con los mismos filtros que exigen las reglas.
 * Se consulta con un margen de 2 minutos por si el reloj del dispositivo va
 * adelantado; si aun así se rechaza, se reintenta con un margen de un día.
 */
export async function consultarPublicados({ db, fs }, { filtros = [], limite = 60 } = {}) {
  const ejecutar = (margenMs) => fs.getDocs(fs.query(
    fs.collection(db, 'posts'),
    ...filtros.map(([c, op, v]) => fs.where(c, op, v)),
    fs.where('status', 'in', ESTADOS_VISIBLES),
    fs.where('publishAt', '<=', fs.Timestamp.fromMillis(Date.now() - margenMs)),
    fs.orderBy('publishAt', 'desc'),
    fs.limit(limite),
  ));
  let snap;
  try {
    snap = await ejecutar(2 * 60 * 1000);
  } catch (error) {
    if (error?.code !== 'permission-denied') throw error;
    snap = await ejecutar(24 * 60 * 60 * 1000);
  }
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* Orden editorial: fijados primero (por order), luego los más recientes */
export function ordenEditorial(lista) {
  return [...lista].sort((a, b) => {
    if (!!b.pinned - !!a.pinned) return !!b.pinned - !!a.pinned;
    if (a.pinned && b.pinned) return (a.order ?? 0) - (b.order ?? 0);
    return msFecha(b.publishAt) - msFecha(a.publishAt);
  });
}

/* Artículo destacado: el marcado como destacado o, si no hay, el más reciente */
export const elegirDestacado = (lista) => lista.find((p) => p.featured) || ordenEditorial(lista)[0] || null;

/* Cuerpo de un artículo en el idioma actual (con el privado si es de miembros) */
export function cuerpoArticulo(post, privado, idioma) {
  const fuente = post.visibility === 'miembros' ? (privado || {}) : post;
  return (idioma === 'en' && fuente.contentHtml_en) ? fuente.contentHtml_en : (fuente.contentHtml || '');
}

/* Título SEO y descripción con respaldo */
export function metaArticulo(post, idioma) {
  const titulo = campo(post, 'title', idioma);
  return {
    titulo: (idioma === 'es' && post.seoTitle) ? post.seoTitle : titulo,
    descripcion: ((idioma === 'es' && post.seoDescription) ? post.seoDescription : campo(post, 'excerpt', idioma)) || '',
  };
}

/* Texto plano seguro de una etiqueta para URL/filtros */
export const normalizarEtiqueta = (t) => String(t || '').trim().toLowerCase();

export const etiquetasHTML = (tags = [], raiz = RAIZ) => tags.map((tag) => `<a class="etiqueta-blog" href="${raiz}blog/?etiqueta=${encodeURIComponent(normalizarEtiqueta(tag))}">#${escaparHTML(tag)}</a>`).join('');
