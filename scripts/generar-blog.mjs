/* ==========================================================================
   Generador estático del blog (lo ejecuta .github/workflows/blog-estatico.yml)
   --------------------------------------------------------------------------
   WhatsApp, Facebook y otros no ejecutan JavaScript al crear la vista previa
   de un enlace. Este script lee los artículos publicados desde Firestore con
   una cuenta de servicio (secreto FIREBASE_SERVICE_ACCOUNT de GitHub) y crea:
     - blog/{slug}/index.html  con título, descripción, Open Graph, Twitter
       y JSON-LD correctos (el contenido lo sigue pintando blog.js)
     - sitemap.xml             con todas las páginas públicas
     - blog/feed.xml           RSS con los artículos más recientes
   Uso local:  FIREBASE_SERVICE_ACCOUNT="$(cat cuenta.json)" node scripts/generar-blog.mjs
   ========================================================================== */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (ruta) => readFileSync(join(RAIZ, ruta), 'utf8');

// Dirección del sitio: la misma de assets/js/config.js
const URL_SITIO = (leer('assets/js/config.js').match(/url:\s*'(https:\/\/[^']+)'/)?.[1] || '').replace(/\/$/, '');
if (!URL_SITIO) throw new Error('No encontré CONFIG.sitio.url en assets/js/config.js');

const credencial = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!credencial) {
  console.log('::notice::Falta el secreto FIREBASE_SERVICE_ACCOUNT; no se generó nada.');
  process.exit(0);
}

const { initializeApp, cert } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');
initializeApp({ credential: cert(JSON.parse(credencial)) });
const db = getFirestore();

/* ---------- Utilidades ---------- */
const escHTML = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const escXML = escHTML;
const ms = (v) => (v?.toMillis ? v.toMillis() : v instanceof Date ? v.getTime() : 0);
const iso = (v) => (ms(v) ? new Date(ms(v)).toISOString() : undefined);
const SLUG_VALIDO = /^[a-z0-9](?:[a-z0-9-]{0,88}[a-z0-9])?$/;
const urlPost = (slug) => `${URL_SITIO}/blog/${slug}/`;
const imagenCloudinary = (url, t) => (url.includes('res.cloudinary.com') && url.includes('/upload/') ? url.replace('/upload/', `/upload/${t}/`) : url);
// Defensa extra: el HTML ya se sanea con DOMPurify al guardar en el panel
const limpiarHTML = (html = '') => String(html)
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<(style|form|input|button|textarea|select|object|embed)[\s\S]*?(<\/\1>|\/?>)/gi, '')
  .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"')
  .replace(/<iframe(?![^>]*src="https:\/\/(www\.youtube(-nocookie)?\.com\/embed\/|player\.vimeo\.com\/video\/))[^>]*>[\s\S]*?<\/iframe>/gi, '');

/* ---------- Datos ---------- */
const ahora = Date.now();
const [snapPosts, snapCats] = await Promise.all([
  db.collection('posts').where('status', 'in', ['publicado', 'programado']).get(),
  db.collection('postCategories').get(),
]);
const categorias = Object.fromEntries(snapCats.docs.map((d) => [d.id, d.data()]));
const posts = snapPosts.docs
  .map((d) => ({ id: d.id, ...d.data() }))
  .filter((p) => ms(p.publishAt) && ms(p.publishAt) <= ahora && SLUG_VALIDO.test(p.slug || ''))
  .sort((a, b) => ms(b.publishAt) - ms(a.publishAt));
console.log(`Artículos visibles: ${posts.length}`);

/* ---------- Páginas por artículo ---------- */
const plantilla = leer('blog/articulo.html');

function pagina(p) {
  const titulo = p.seoTitle || p.title || 'Artículo';
  const descripcion = (p.seoDescription || p.excerpt || '').slice(0, 300);
  const url = urlPost(p.slug);
  const imagen = p.ogImageUrl?.startsWith('https://') ? p.ogImageUrl
    : p.coverUrl?.startsWith('https://') ? imagenCloudinary(p.coverUrl, 'f_jpg,q_auto,c_fill,g_auto,w_1200,h_630')
      : `${URL_SITIO}/assets/img/og-image.jpg`;
  const categoria = categorias[p.category]?.name || '';
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: String(p.title || '').slice(0, 110),
    description: descripcion,
    image: [imagen],
    datePublished: iso(p.publishAt),
    dateModified: iso(p.updatedAt) || iso(p.publishAt),
    inLanguage: 'es',
    articleSection: categoria || undefined,
    keywords: (p.tags || []).join(', ') || undefined,
    isAccessibleForFree: p.visibility !== 'miembros',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@type': 'Person', name: p.author || 'Karely Paredes', url: `${URL_SITIO}/` },
    publisher: { '@type': 'Organization', name: 'Success by Karely', logo: { '@type': 'ImageObject', url: `${URL_SITIO}/assets/img/marca/logo-completo.png` } },
  };
  const meta = (atributo, nombre, valor) => `<meta ${atributo}="${nombre}" content="${escHTML(valor)}">`;
  let html = plantilla
    // Rutas relativas: la página vive un nivel más abajo (blog/{slug}/)
    .replace(/(href|src)="\.\.\//g, '$1="../../')
    .replace(/href="\.\/"/g, 'href="../"')
    .replace('<meta name="sbk-raiz" content="../">', `<meta name="sbk-raiz" content="../../">\n  <meta name="sbk-slug" content="${escHTML(p.slug)}">`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escHTML(titulo)} | Karely Paredes</title>`)
    .replace(/<meta name="description"[^>]*>/, meta('name', 'description', descripcion))
    .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${escHTML(url)}">`)
    .replace(/<meta property="og:title"[^>]*>/, meta('property', 'og:title', titulo))
    .replace(/<meta property="og:description"[^>]*>/, meta('property', 'og:description', descripcion))
    .replace(/<meta property="og:url"[^>]*>/, meta('property', 'og:url', url))
    .replace(/<meta property="og:image"[^>]*>/, `${meta('property', 'og:image', imagen)}\n  ${meta('property', 'og:image:width', '1200')}\n  ${meta('property', 'og:image:height', '630')}\n  ${meta('property', 'og:image:alt', p.coverAlt || titulo)}\n  ${meta('property', 'article:published_time', iso(p.publishAt) || '')}`)
    .replace(/<meta name="twitter:title"[^>]*>/, meta('name', 'twitter:title', titulo))
    .replace(/<meta name="twitter:description"[^>]*>/, meta('name', 'twitter:description', descripcion))
    .replace(/<meta name="twitter:image"[^>]*>/, meta('name', 'twitter:image', imagen))
    .replace('<script type="application/ld+json" id="jsonld-articulo">{}</script>', `<script type="application/ld+json" id="jsonld-articulo">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>`)
    // Contenido visible sin JavaScript (blog.js lo reemplaza al cargar)
    .replace(/<h1 class="articulo-titulo" id="articulo-titulo">[\s\S]*?<\/h1>/, `<h1 class="articulo-titulo" id="articulo-titulo">${escHTML(p.title)}</h1>`)
    .replace('<p class="articulo-extracto" id="articulo-extracto"></p>', `<p class="articulo-extracto" id="articulo-extracto">${escHTML(p.excerpt || '')}</p>`);
  if (p.visibility !== 'miembros' && p.contentHtml) {
    html = html.replace(/<div class="prosa" id="prosa">[\s\S]*?<\/div>\s*\n\s*<div class="articulo-etiquetas"/, `<div class="prosa" id="prosa">${limpiarHTML(p.contentHtml)}</div>\n\n          <div class="articulo-etiquetas"`);
  }
  return html;
}

const registro = join(RAIZ, 'blog/.generados.json');
const anteriores = existsSync(registro) ? JSON.parse(readFileSync(registro, 'utf8')) : [];
const actuales = [];
for (const p of posts) {
  const carpeta = join(RAIZ, 'blog', p.slug);
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(join(carpeta, 'index.html'), pagina(p));
  actuales.push(p.slug);
}
// Quitar páginas de artículos que ya no están publicados
for (const slug of anteriores) {
  if (!actuales.includes(slug) && SLUG_VALIDO.test(slug) && !['index.html', 'articulo.html'].includes(slug)) {
    rmSync(join(RAIZ, 'blog', slug), { recursive: true, force: true });
    console.log(`Retirado: blog/${slug}/`);
  }
}
writeFileSync(registro, `${JSON.stringify(actuales, null, 2)}\n`);

/* ---------- sitemap.xml ---------- */
const fijas = [
  { loc: `${URL_SITIO}/`, freq: 'weekly', prio: '1.0', en: `${URL_SITIO}/?lang=en` },
  { loc: `${URL_SITIO}/blog/`, freq: 'daily', prio: '0.8', en: `${URL_SITIO}/blog/?lang=en` },
  { loc: `${URL_SITIO}/privacidad.html`, freq: 'yearly', prio: '0.3' },
  { loc: `${URL_SITIO}/terminos.html`, freq: 'yearly', prio: '0.3' },
];
const urlXML = (u) => `  <url>
    <loc>${escXML(u.loc)}</loc>${u.en ? `
    <xhtml:link rel="alternate" hreflang="es" href="${escXML(u.loc)}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${escXML(u.en)}"/>` : ''}${u.mod ? `
    <lastmod>${u.mod}</lastmod>` : ''}
    <changefreq>${u.freq}</changefreq>
    <priority>${u.prio}</priority>
  </url>`;
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generado por scripts/generar-blog.mjs: no editar a mano -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${[...fijas, ...posts.map((p) => ({ loc: urlPost(p.slug), freq: 'monthly', prio: '0.7', mod: (iso(p.updatedAt) || iso(p.publishAt) || '').slice(0, 10) }))].map(urlXML).join('\n')}
</urlset>
`;
writeFileSync(join(RAIZ, 'sitemap.xml'), sitemap);

/* ---------- blog/feed.xml (RSS 2.0) ---------- */
const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Blog de Success by Karely</title>
    <link>${URL_SITIO}/blog/</link>
    <atom:link href="${URL_SITIO}/blog/feed.xml" rel="self" type="application/rss+xml"/>
    <description>Guías claras de Karely Paredes para familias inmigrantes en Estados Unidos: becas, FAFSA, carrera, crédito y negocio.</description>
    <language>es</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${posts.slice(0, 30).map((p) => `    <item>
      <title>${escXML(p.title)}</title>
      <link>${urlPost(p.slug)}</link>
      <guid isPermaLink="true">${urlPost(p.slug)}</guid>
      <pubDate>${new Date(ms(p.publishAt)).toUTCString()}</pubDate>
      ${categorias[p.category]?.name ? `<category>${escXML(categorias[p.category].name)}</category>` : ''}
      <description>${escXML(p.excerpt || '')}</description>
    </item>`).join('\n')}
  </channel>
</rss>
`;
writeFileSync(join(RAIZ, 'blog/feed.xml'), rss);
console.log(`Listo: ${actuales.length} páginas, sitemap.xml y blog/feed.xml`);
process.exit(0);
