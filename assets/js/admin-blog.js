/* ==========================================================================
   Panel admin · Blog
   - Lista con miniatura, estado, categoría, visibilidad, fecha, lecturas;
     búsqueda, filtros, selección múltiple y acciones masivas.
   - Estados: borrador, programado (fecha y hora), publicado, archivado y
     papelera (con restauración y borrado definitivo confirmado).
   - Fijados y destacado de la landing, reordenables arrastrando o con teclado.
   - Editor a pantalla completa: slug único, extracto, categoría, etiquetas,
     portada 16:9 con texto alternativo, Quill 2 (imágenes, videos y botón
     CTA), DOMPurify al guardar, tiempo de lectura, SEO con vistas previas,
     versión en inglés, autoguardado cada 20 s e historial de 10 versiones.
   - Categorías: crear, renombrar, ordenar y eliminar.
   Los artículos "Solo miembros" guardan su cuerpo en posts/{id}/privado/cuerpo.
   ========================================================================== */
import { CONFIG, CATEGORIAS_BLOG } from './config.js';
import { $, $$, escaparHTML, toast, subirACloudinary, cloudinaryConfigurado, urlCloudinary, sanearHTML } from './util.js';
import { t, registrarTextos } from './i18n.js';
import {
  estado, fs, col, ref, db, ahora, registrarActividad, fecha, ms, normalizar, campoTexto, slugificar, nombreAdmin, relativo,
  abrirCajon, cerrarCajon, marcarSucio, haySinGuardar, confirmar, conDeshacer, estadoVacio, hacerOrdenable, botonesMover,
  recortarImagen, crearEditor, interruptor, esURLSegura, actualizarTituloCajon, dialogo, cerrarModal,
} from './admin-nucleo.js';
import { estadoEfectivo, minutosLectura, urlCompartir } from './blog-datos.js';

const ESTADOS = ['borrador', 'programado', 'publicado', 'archivado'];
const MAX = { titulo: 140, extracto: 300, seoTitulo: 60, seoDesc: 160, etiquetas: 12 };

let posts = [];
let categorias = [];
let cargado = false;
let vistaActual = null;
const filtros = { q: '', estado: '', categoria: '', visibilidad: '' };
const seleccion = new Set();

/* ---------- Datos ---------- */
async function cargar(forzar = false) {
  if (cargado && !forzar) return posts;
  const [sp, sc] = await Promise.all([fs().getDocs(col('posts')), fs().getDocs(col('postCategories')).catch(() => ({ docs: [] }))]);
  posts = sp.docs.map((d) => ({ id: d.id, ...d.data() }));
  categorias = sc.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  cargado = true;
  return posts;
}

const nombreCat = (id) => {
  const c = categorias.find((x) => x.id === id) || CATEGORIAS_BLOG.find((x) => x.id === id);
  if (!c) return id || '—';
  return (estado.idioma === 'en' ? (c.name_en || c.en) : (c.name || c.es)) || c.name || c.es || id;
};
const listaCategorias = () => (categorias.length ? categorias.map((c) => ({ id: c.id, nombre: nombreCat(c.id) })) : CATEGORIAS_BLOG.map((c) => ({ id: c.id, nombre: estado.idioma === 'en' ? c.en : c.es })));
const estadoDe = (p) => (p.status === 'papelera' ? 'papelera' : estadoEfectivo(p));
const titulo = (p) => campoTexto(p, 'title') || t('blg.sinTitulo');

/* Slug único entre los artículos cargados */
function slugUnico(base, idPropio = null) {
  const raiz = slugificar(base).slice(0, 80) || 'articulo';
  let slug = raiz; let n = 2;
  while (posts.some((p) => p.id !== idPropio && p.slug === slug)) slug = `${raiz}-${n++}`;
  return slug;
}

/* ==========================================================================
   Lista
   ========================================================================== */
function filtrar() {
  const q = normalizar(filtros.q);
  return posts.filter((p) => {
    const e = estadoDe(p);
    if (filtros.estado ? e !== filtros.estado : e === 'papelera') return false;
    if (filtros.categoria && p.category !== filtros.categoria) return false;
    if (filtros.visibilidad && (p.visibility || 'publico') !== filtros.visibilidad) return false;
    if (q && !normalizar(`${p.title} ${p.title_en || ''} ${p.slug} ${(p.tags || []).join(' ')} ${p.author || ''}`).includes(q)) return false;
    return true;
  }).sort((a, b) => ms(b.publishAt || b.updatedAt) - ms(a.publishAt || a.updatedAt));
}

const etiquetaEstado = (e) => `<span class="estado-post estado-${e}">${escaparHTML(t(`blg.e.${e}`))}</span>`;

function pintarChips() {
  const cuenta = (e) => posts.filter((p) => estadoDe(p) === e).length;
  const chips = [['', t('adm.todos'), posts.filter((p) => estadoDe(p) !== 'papelera').length], ...ESTADOS.map((e) => [e, t(`blg.e.${e}`), cuenta(e)]), ['papelera', t('adm.papelera'), cuenta('papelera')]];
  $('#chips-blog').innerHTML = chips.map(([id, nombre, n]) => `<button type="button" class="filtro" data-estado="${id}" aria-pressed="${filtros.estado === id}">${escaparHTML(nombre)} <span class="filtro-n">${n}</span></button>`).join('');
}

function pintarTabla() {
  const cuerpo = $('#tabla-blog tbody');
  if (!cuerpo) return;
  const lista = filtrar();
  [...seleccion].forEach((id) => { if (!lista.some((p) => p.id === id)) seleccion.delete(id); });
  $('#conteo-blog').textContent = t('blg.conteo', { n: lista.length });
  if (!lista.length) {
    cuerpo.innerHTML = `<tr><td colspan="8" class="celda-vacia">${escaparHTML(posts.length ? t('blg.sinFiltro') : t('blg.vacio'))}</td></tr>`;
    pintarMasivas();
    return;
  }
  cuerpo.innerHTML = lista.map((p) => {
    const e = estadoDe(p);
    const enPapelera = e === 'papelera';
    return `
    <tr data-id="${escaparHTML(p.id)}"${seleccion.has(p.id) ? ' class="seleccionada"' : ''}>
      <td class="celda-check"><input type="checkbox" data-sel="${escaparHTML(p.id)}" aria-label="${escaparHTML(t('blg.seleccionar', { t: titulo(p) }))}"${seleccion.has(p.id) ? ' checked' : ''}></td>
      <td>
        <div class="celda-post">
          <span class="miniatura">${esURLSegura(p.coverUrl) ? `<img src="${escaparHTML(urlCloudinary(p.coverUrl, 'f_auto,q_auto,c_fill,w_160,h_90'))}" alt="" loading="lazy">` : '<span class="k-tipografica">K</span>'}</span>
          <a class="celda-principal" href="#blog/${encodeURIComponent(p.id)}"><strong>${escaparHTML(titulo(p))}</strong><span>/${escaparHTML(p.slug || '')}${p.featured ? ` · ★ ${escaparHTML(t('blg.destacado'))}` : ''}${p.pinned ? ` · ${escaparHTML(t('blg.fijado'))}` : ''}</span></a>
        </div>
      </td>
      <td>${etiquetaEstado(e)}</td>
      <td class="nowrap">${escaparHTML(nombreCat(p.category))}</td>
      <td class="nowrap">${p.visibility === 'miembros' ? `<span class="chips-mini"><span>${escaparHTML(t('blg.miembros'))}</span></span>` : escaparHTML(t('blg.publico'))}</td>
      <td class="nowrap texto-suave-app">${p.publishAt ? `${escaparHTML(fecha(p.publishAt))}${e === 'programado' ? `<br><span class="hora-post">${escaparHTML(fecha(p.publishAt, { hour: 'numeric', minute: '2-digit' }))}</span>` : ''}` : '—'}</td>
      <td class="nowrap">${Number(p.views || 0).toLocaleString(estado.idioma)}</td>
      <td class="nowrap acciones-fila">
        ${enPapelera ? `
          <button type="button" class="btn btn-linea-app btn-sm" data-accion="restaurar">${escaparHTML(t('adm.restaurar'))}</button>
          <button type="button" class="btn btn-peligro-suave btn-sm" data-accion="eliminar">${escaparHTML(t('adm.eliminarDef'))}</button>` : `
          <a class="btn btn-linea-app btn-sm" href="#blog/${encodeURIComponent(p.id)}">${escaparHTML(t('adm.editar'))}</a>
          <details class="menu-acciones">
            <summary class="btn-mini" aria-label="${escaparHTML(t('blg.masAcciones'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6h.01M12 12h.01M12 18h.01"/></svg></summary>
            <div class="menu-acciones-lista" role="menu">
              <button type="button" role="menuitem" data-accion="vista">${escaparHTML(t('blg.vistaPrevia'))}</button>
              <button type="button" role="menuitem" data-accion="duplicar">${escaparHTML(t('blg.duplicar'))}</button>
              ${e === 'publicado' || e === 'programado'
    ? `<button type="button" role="menuitem" data-accion="despublicar">${escaparHTML(t('blg.despublicar'))}</button>`
    : `<button type="button" role="menuitem" data-accion="publicar">${escaparHTML(t('adm.publicar'))}</button>`}
              <button type="button" role="menuitem" data-accion="destacar">${escaparHTML(p.featured ? t('blg.quitarDestacado') : t('blg.destacar'))}</button>
              <button type="button" role="menuitem" data-accion="fijar">${escaparHTML(p.pinned ? t('blg.desfijar') : t('blg.fijar'))}</button>
              ${e !== 'archivado' ? `<button type="button" role="menuitem" data-accion="archivar">${escaparHTML(t('blg.archivar'))}</button>` : ''}
              <button type="button" role="menuitem" class="peligro" data-accion="papelera">${escaparHTML(t('adm.moverPapelera'))}</button>
            </div>
          </details>`}
      </td>
    </tr>`;
  }).join('');
  $('#sel-todos').checked = lista.length > 0 && lista.every((p) => seleccion.has(p.id));
  pintarMasivas();
}

function pintarMasivas() {
  const barra = $('#barra-masiva');
  if (!barra) return;
  barra.hidden = !seleccion.size;
  const enPapelera = filtros.estado === 'papelera';
  barra.innerHTML = `
    <span class="masiva-n">${escaparHTML(t('blg.seleccionados', { n: seleccion.size }))}</span>
    ${enPapelera ? `
      <button type="button" class="btn btn-linea-app btn-sm" data-masiva="restaurar">${escaparHTML(t('adm.restaurar'))}</button>` : `
      <button type="button" class="btn btn-linea-app btn-sm" data-masiva="publicar">${escaparHTML(t('adm.publicar'))}</button>
      <button type="button" class="btn btn-linea-app btn-sm" data-masiva="despublicar">${escaparHTML(t('blg.despublicar'))}</button>
      <button type="button" class="btn btn-linea-app btn-sm" data-masiva="archivar">${escaparHTML(t('blg.archivar'))}</button>
      <button type="button" class="btn btn-peligro-suave btn-sm" data-masiva="papelera">${escaparHTML(t('adm.moverPapelera'))}</button>`}
    <button type="button" class="btn-mini" data-masiva="limpiar" aria-label="${escaparHTML(t('blg.limpiarSeleccion'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;
}

/* Fijados + destacado de la landing */
function pintarFijados() {
  const zona = $('#lista-fijados');
  if (!zona) return;
  const fijados = posts.filter((p) => p.pinned && estadoDe(p) !== 'papelera').sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const destacado = posts.find((p) => p.featured && estadoDe(p) !== 'papelera');
  $('#info-destacado').innerHTML = destacado
    ? `★ ${escaparHTML(t('blg.destacadoActual'))}: <a href="#blog/${encodeURIComponent(destacado.id)}">${escaparHTML(titulo(destacado))}</a>`
    : escaparHTML(t('blg.sinDestacado'));
  zona.innerHTML = fijados.length ? fijados.map((p, i) => `
    <li class="fila-contenido compacta" data-id="${escaparHTML(p.id)}">
      ${botonesMover()}
      <span class="num-leccion">${i + 1}</span>
      <div class="fila-texto"><strong>${escaparHTML(titulo(p))}</strong><span>${etiquetaEstado(estadoDe(p))}</span></div>
      <button type="button" class="btn btn-linea-app btn-sm" data-desfijar="${escaparHTML(p.id)}">${escaparHTML(t('blg.desfijar'))}</button>
    </li>`).join('') : `<li class="lista-vacia">${escaparHTML(t('blg.sinFijados'))}</li>`;
}

function repintarTodo() { pintarChips(); pintarTabla(); pintarFijados(); }

async function montar(vista, params) {
  vistaActual = vista;
  if (!vista.querySelector('#tabla-blog')) {
    vista.innerHTML = `
      <div class="barra-herramientas">
        <input type="search" id="b-q" class="campo-buscar" placeholder="${escaparHTML(t('blg.buscar'))}" aria-label="${escaparHTML(t('blg.buscar'))}" value="${escaparHTML(filtros.q)}">
        <select id="b-cat" aria-label="${escaparHTML(t('blg.categoria'))}"><option value="">${escaparHTML(t('blg.todasCat'))}</option></select>
        <select id="b-vis" aria-label="${escaparHTML(t('blg.visibilidad'))}">
          <option value="">${escaparHTML(t('blg.todaVis'))}</option>
          <option value="publico">${escaparHTML(t('blg.publico'))}</option>
          <option value="miembros">${escaparHTML(t('blg.miembros'))}</option>
        </select>
        <span class="espaciador"></span>
        <button type="button" class="btn btn-linea-app btn-sm" id="btn-categorias">${escaparHTML(t('blg.categorias'))}</button>
        <button type="button" class="btn btn-principal btn-sm" id="btn-nuevo-post">${escaparHTML(t('blg.nuevo'))}</button>
      </div>
      <div class="filtros" id="chips-blog" role="group" aria-label="${escaparHTML(t('blg.estado'))}"></div>
      <details class="panel panel-fijados" id="panel-fijados">
        <summary><strong>${escaparHTML(t('blg.fijadosT'))}</strong><span class="texto-suave-app" id="info-destacado"></span></summary>
        <p class="texto-suave-app">${escaparHTML(t('blg.fijadosAyuda'))}</p>
        <ol class="lista-contenido" id="lista-fijados"></ol>
      </details>
      <p class="conteo" id="conteo-blog" aria-live="polite"></p>
      <div class="barra-masiva panel" id="barra-masiva" hidden></div>
      <div class="panel panel-tabla"><div class="tabla-scroll">
        <table class="tabla tabla-tarjetas" id="tabla-blog">
          <thead><tr>
            <th scope="col" class="celda-check"><input type="checkbox" id="sel-todos" aria-label="${escaparHTML(t('blg.seleccionarTodos'))}"></th>
            <th scope="col">${escaparHTML(t('adm.titulo'))}</th><th scope="col">${escaparHTML(t('blg.estado'))}</th>
            <th scope="col">${escaparHTML(t('blg.categoria'))}</th><th scope="col">${escaparHTML(t('blg.visibilidad'))}</th>
            <th scope="col">${escaparHTML(t('adm.fecha'))}</th><th scope="col">${escaparHTML(t('blg.lecturas'))}</th>
            <th scope="col"><span class="solo-lectores">${escaparHTML(t('adm.acciones'))}</span></th>
          </tr></thead>
          <tbody><tr><td colspan="8">${'<div class="esqueleto-fila"></div>'.repeat(4)}</td></tr></tbody>
        </table>
      </div></div>`;

    $('#btn-nuevo-post').addEventListener('click', crearPost);
    $('#btn-categorias').addEventListener('click', gestionarCategorias);
    $('#b-q').addEventListener('input', (e) => { filtros.q = e.target.value; pintarTabla(); });
    $('#b-cat').addEventListener('change', (e) => { filtros.categoria = e.target.value; pintarTabla(); });
    $('#b-vis').addEventListener('change', (e) => { filtros.visibilidad = e.target.value; pintarTabla(); });
    $('#chips-blog').addEventListener('click', (e) => {
      const b = e.target.closest('[data-estado]');
      if (!b) return;
      filtros.estado = b.dataset.estado;
      seleccion.clear();
      pintarChips(); pintarTabla();
    });
    $('#sel-todos').addEventListener('change', (e) => {
      filtrar().forEach((p) => (e.target.checked ? seleccion.add(p.id) : seleccion.delete(p.id)));
      pintarTabla();
    });
    const tabla = $('#tabla-blog');
    tabla.addEventListener('change', (e) => {
      const c = e.target.closest('[data-sel]');
      if (!c) return;
      if (c.checked) seleccion.add(c.dataset.sel); else seleccion.delete(c.dataset.sel);
      c.closest('tr').classList.toggle('seleccionada', c.checked);
      $('#sel-todos').checked = filtrar().every((p) => seleccion.has(p.id));
      pintarMasivas();
    });
    tabla.addEventListener('click', (e) => {
      const b = e.target.closest('[data-accion]');
      if (!b) return;
      b.closest('details')?.removeAttribute('open');
      accion(b.dataset.accion, b.closest('tr').dataset.id);
    });
    // Cerrar menús de acciones al hacer clic fuera o con Esc
    document.addEventListener('click', (e) => { $$('.menu-acciones[open]').forEach((d) => { if (!d.contains(e.target)) d.removeAttribute('open'); }); });
    tabla.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const d = e.target.closest('.menu-acciones[open]'); if (d) { e.stopPropagation(); d.removeAttribute('open'); $('summary', d).focus(); } } });
    $('#barra-masiva').addEventListener('click', (e) => { const b = e.target.closest('[data-masiva]'); if (b) accionMasiva(b.dataset.masiva); });
    const listaFijados = $('#lista-fijados');
    listaFijados.addEventListener('click', (e) => { const b = e.target.closest('[data-desfijar]'); if (b) accion('fijar', b.dataset.desfijar); });
    hacerOrdenable(listaFijados, async (ids) => {
      try {
        const lote = fs().writeBatch(db());
        ids.forEach((id, i) => { lote.update(ref('posts', id), { order: i }); const p = posts.find((x) => x.id === id); if (p) p.order = i; });
        await lote.commit();
        pintarFijados();
        toast(t('adm.ordenGuardado'));
        registrarActividad('ordenar', 'posts', '', t('blg.fijadosT'));
      } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
    });

    try { await cargar(); } catch (error) { console.error(error); vista.innerHTML = estadoVacio(t('adm.errCargar'), ''); return; }
    $('#b-cat').insertAdjacentHTML('beforeend', listaCategorias().map((c) => `<option value="${escaparHTML(c.id)}">${escaparHTML(c.nombre)}</option>`).join(''));
    $('#b-cat').value = filtros.categoria;
    $('#b-vis').value = filtros.visibilidad;
    repintarTodo();
  }
  if (params[0]) abrirEditor(params[0]);
}

/* ---------- Crear, duplicar ---------- */
function datosNuevos(extra = {}) {
  return {
    title: t('blg.nuevoTitulo'), title_en: '', slug: slugUnico(`${t('blg.nuevoTitulo')}-${Math.random().toString(36).slice(2, 6)}`),
    excerpt: '', excerpt_en: '', contentHtml: '', contentHtml_en: '',
    coverUrl: '', coverPublicId: '', coverAlt: '',
    category: listaCategorias()[0]?.id || 'universidad', tags: [], author: CONFIG.blog.autora.nombre,
    status: 'borrador', visibility: 'publico', featured: false, pinned: false, order: 0,
    publishAt: null, readingMinutes: 1, views: 0,
    ctaType: 'registro', ctaText: '', ctaUrl: '',
    seoTitle: '', seoDescription: '', ogImageUrl: '',
    createdAt: ahora(), updatedAt: ahora(), updatedBy: nombreAdmin(),
    ...extra,
  };
}

async function crearPost() {
  const datos = datosNuevos();
  try {
    const nuevo = await fs().addDoc(col('posts'), datos);
    posts.push({ id: nuevo.id, ...datos, createdAt: new Date(), updatedAt: new Date() });
    registrarActividad('crear', 'posts', nuevo.id, datos.title);
    repintarTodo();
    location.hash = `#blog/${nuevo.id}`;
  } catch (error) { console.error(error); toast(t('adm.errGuardar'), { tipo: 'error' }); }
}

async function leerPrivado(id) {
  try {
    const snap = await fs().getDoc(ref('posts', id, 'privado', 'cuerpo'));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}

async function duplicar(id) {
  const p = posts.find((x) => x.id === id);
  const { id: _omit, ...resto } = p;
  const datos = datosNuevos({
    ...resto,
    title: `${p.title} (${t('blg.copia')})`,
    slug: slugUnico(`${p.slug}-${t('blg.copia')}`),
    status: 'borrador', featured: false, pinned: false, views: 0, publishAt: null,
    createdAt: ahora(), updatedAt: ahora(), updatedBy: nombreAdmin(),
  });
  delete datos.deletedAt; delete datos.statusPrevio;
  try {
    const nuevo = await fs().addDoc(col('posts'), datos);
    if (p.visibility === 'miembros') {
      const privado = await leerPrivado(id);
      if (privado) await fs().setDoc(ref('posts', nuevo.id, 'privado', 'cuerpo'), { ...privado, updatedAt: ahora() });
    }
    posts.push({ id: nuevo.id, ...datos, createdAt: new Date(), updatedAt: new Date() });
    registrarActividad('duplicar', 'posts', nuevo.id, datos.title);
    repintarTodo();
    toast(t('blg.duplicado'), { accion: { texto: t('adm.editar'), fn: () => { location.hash = `#blog/${nuevo.id}`; } } });
  } catch (error) { console.error(error); toast(t('adm.errGuardar'), { tipo: 'error' }); }
}

/* ---------- Cambios de estado (individuales y masivos) ---------- */
function cambiosPara(accionId, p) {
  switch (accionId) {
    case 'publicar': return { status: 'publicado', publishAt: (p.publishAt && ms(p.publishAt) <= Date.now()) ? p.publishAt : fs().Timestamp.now() };
    case 'despublicar': return { status: 'borrador' };
    case 'archivar': return { status: 'archivado', featured: false };
    case 'papelera': return { status: 'papelera', statusPrevio: p.status === 'papelera' ? 'borrador' : (p.status || 'borrador'), deletedAt: ahora(), featured: false, pinned: false };
    case 'restaurar': return { status: p.statusPrevio && p.statusPrevio !== 'papelera' ? p.statusPrevio : 'borrador', deletedAt: fs().deleteField(), statusPrevio: fs().deleteField() };
    default: return null;
  }
}
const locales = (cambios) => Object.fromEntries(Object.entries(cambios).map(([k, v]) => [k, (v && typeof v === 'object' && !v.toMillis && !(v instanceof Date)) ? (k === 'deletedAt' ? new Date() : undefined) : v]));

async function aplicar(ids, accionId) {
  const previos = ids.map((id) => { const p = posts.find((x) => x.id === id); return [id, { status: p.status, featured: !!p.featured, pinned: !!p.pinned, publishAt: p.publishAt ?? null, statusPrevio: p.statusPrevio }]; });
  const lote = fs().writeBatch(db());
  ids.forEach((id) => {
    const p = posts.find((x) => x.id === id);
    const cambios = { ...cambiosPara(accionId, p), updatedAt: ahora(), updatedBy: nombreAdmin() };
    lote.update(ref('posts', id), cambios);
    Object.assign(p, locales(cambios), { updatedAt: new Date() });
    if (accionId === 'restaurar') { delete p.deletedAt; delete p.statusPrevio; }
  });
  await lote.commit();
  ids.forEach((id) => registrarActividad(accionId, 'posts', id, titulo(posts.find((x) => x.id === id))));
  repintarTodo();
  const mensaje = t(`blg.hecho.${accionId}`, { n: ids.length });
  if (['papelera', 'archivar', 'despublicar'].includes(accionId)) {
    conDeshacer(mensaje, async () => {
      const deshacer = fs().writeBatch(db());
      previos.forEach(([id, v]) => {
        const datos = { ...v, deletedAt: fs().deleteField(), statusPrevio: v.statusPrevio ?? fs().deleteField() };
        deshacer.update(ref('posts', id), datos);
        const p = posts.find((x) => x.id === id);
        Object.assign(p, v); delete p.deletedAt;
      });
      await deshacer.commit();
      repintarTodo();
      toast(t('adm.deshecho'));
    });
  } else toast(mensaje);
}

async function destacar(id) {
  const p = posts.find((x) => x.id === id);
  const nuevo = !p.featured;
  const lote = fs().writeBatch(db());
  // Solo un artículo destacado a la vez
  posts.filter((x) => x.featured && x.id !== id).forEach((x) => { lote.update(ref('posts', x.id), { featured: false }); x.featured = false; });
  lote.update(ref('posts', id), { featured: nuevo, updatedAt: ahora() });
  p.featured = nuevo;
  await lote.commit();
  registrarActividad(nuevo ? 'destacar' : 'quitar-destacado', 'posts', id, titulo(p));
  toast(nuevo ? t('blg.hecho.destacar') : t('blg.hecho.quitarDestacado'));
  repintarTodo();
}

async function fijar(id) {
  const p = posts.find((x) => x.id === id);
  const nuevo = !p.pinned;
  const orden = nuevo ? Math.max(-1, ...posts.filter((x) => x.pinned).map((x) => x.order ?? 0)) + 1 : (p.order ?? 0);
  await fs().updateDoc(ref('posts', id), { pinned: nuevo, order: orden, updatedAt: ahora() });
  Object.assign(p, { pinned: nuevo, order: orden });
  registrarActividad(nuevo ? 'fijar' : 'desfijar', 'posts', id, titulo(p));
  toast(nuevo ? t('blg.hecho.fijar') : t('blg.hecho.desfijar'));
  repintarTodo();
}

async function eliminarDefinitivo(id) {
  const p = posts.find((x) => x.id === id);
  const ok = await confirmar({ titulo: t('blg.borrarTitulo'), texto: t('blg.borrarTexto'), boton: t('adm.eliminarDef'), peligro: true, escribir: titulo(p) });
  if (!ok) return;
  try {
    const versiones = await fs().getDocs(col('posts', id, 'versions')).catch(() => ({ docs: [] }));
    const lote = fs().writeBatch(db());
    versiones.docs.forEach((v) => lote.delete(ref('posts', id, 'versions', v.id)));
    lote.delete(ref('posts', id, 'privado', 'cuerpo'));
    lote.delete(ref('posts', id));
    await lote.commit();
    posts = posts.filter((x) => x.id !== id);
    registrarActividad('eliminar', 'posts', id, titulo(p));
    toast(t('adm.eliminado'));
    repintarTodo();
  } catch (error) { console.error(error); toast(t('adm.errGuardar'), { tipo: 'error' }); }
}

async function accion(accionId, id) {
  try {
    if (accionId === 'vista') { const p = posts.find((x) => x.id === id); abrirVistaPrevia(p, p.visibility === 'miembros' ? await leerPrivado(id) : null); return; }
    if (accionId === 'duplicar') return duplicar(id);
    if (accionId === 'destacar') return destacar(id);
    if (accionId === 'fijar') return fijar(id);
    if (accionId === 'eliminar') return eliminarDefinitivo(id);
    await aplicar([id], accionId);
  } catch (error) { console.error(error); toast(t('adm.errGuardar'), { tipo: 'error' }); }
}

async function accionMasiva(accionId) {
  if (accionId === 'limpiar') { seleccion.clear(); pintarTabla(); return; }
  const ids = [...seleccion];
  if (!ids.length) return;
  if (accionId === 'papelera') {
    const ok = await confirmar({ titulo: t('blg.masivaPapeleraT', { n: ids.length }), texto: t('blg.masivaPapeleraD'), boton: t('adm.moverPapelera'), peligro: true });
    if (!ok) return;
  }
  try {
    await aplicar(ids, accionId);
    seleccion.clear();
    pintarTabla();
  } catch (error) { console.error(error); toast(t('adm.errGuardar'), { tipo: 'error' }); }
}

/* ---------- Vista previa exacta (el borrador viaja por localStorage) ---------- */
function abrirVistaPrevia(post, privado) {
  const serializable = JSON.parse(JSON.stringify(post, (k, v) => (v && typeof v === 'object' && typeof v.toMillis === 'function' ? v.toMillis() : v)));
  try {
    localStorage.setItem('sbk-vista-previa', JSON.stringify({ post: serializable, privado, guardadoEn: Date.now() }));
  } catch { toast(t('blg.errVista'), { tipo: 'error' }); return; }
  window.open('../blog/articulo.html?vista=local', '_blank', 'noopener');
}

/* ==========================================================================
   Categorías
   ========================================================================== */
async function gestionarCategorias() {
  await cargar();
  const pintar = () => {
    const lista = $('#lista-cats');
    lista.innerHTML = categorias.length ? categorias.map((c) => `
      <li class="fila-contenido compacta" data-id="${escaparHTML(c.id)}">
        ${botonesMover()}
        <div class="campos-2 fila-categoria">
          <input data-c="name" maxlength="60" value="${escaparHTML(c.name || '')}" aria-label="${escaparHTML(t('blg.catNombre'))}">
          <input data-c="name_en" maxlength="60" value="${escaparHTML(c.name_en || '')}" placeholder="English" aria-label="${escaparHTML(t('blg.catNombreEn'))}">
        </div>
        <span class="texto-suave-app nowrap">${posts.filter((p) => p.category === c.id).length}</span>
        <button type="button" class="btn-mini" data-borrar-cat="${escaparHTML(c.id)}" aria-label="${escaparHTML(t('adm.eliminar'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>
      </li>`).join('') : `<li class="lista-vacia">${escaparHTML(t('blg.catVacias'))} <button type="button" class="btn btn-linea-app btn-sm" id="sembrar-cats">${escaparHTML(t('blg.catSembrar'))}</button></li>`;
  };
  dialogo({
    titulo: t('blg.categorias'),
    ancho: 'grande',
    html: `
      <p class="texto-suave-app">${escaparHTML(t('blg.catAyuda'))}</p>
      <ol class="lista-contenido" id="lista-cats"></ol>
      <form class="fila-nueva-cat" id="form-nueva-cat">
        <input id="nueva-cat" maxlength="60" placeholder="${escaparHTML(t('blg.catNueva'))}" aria-label="${escaparHTML(t('blg.catNueva'))}">
        <button type="submit" class="btn btn-linea-app btn-sm">${escaparHTML(t('adm.crear'))}</button>
      </form>`,
    acciones: [{ texto: t('adm.cerrar'), valor: false, principal: true }],
  });
  pintar();
  const lista = $('#lista-cats');
  // Renombrar al salir del campo
  lista.addEventListener('change', async (e) => {
    const input = e.target.closest('[data-c]');
    if (!input) return;
    const id = input.closest('[data-id]').dataset.id;
    const c = categorias.find((x) => x.id === id);
    const valor = input.value.trim();
    if (input.dataset.c === 'name' && !valor) { input.value = c.name; return; }
    try {
      await fs().updateDoc(ref('postCategories', id), { [input.dataset.c]: valor });
      c[input.dataset.c] = valor;
      toast(t('adm.guardado'));
      registrarActividad('editar', 'postCategories', id, valor);
    } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
  });
  lista.addEventListener('click', async (e) => {
    if (e.target.closest('#sembrar-cats')) {
      const lote = fs().writeBatch(db());
      CATEGORIAS_BLOG.forEach((c) => lote.set(ref('postCategories', c.id), { name: c.es, name_en: c.en, slug: c.id, order: c.order }));
      await lote.commit();
      categorias = CATEGORIAS_BLOG.map((c) => ({ id: c.id, name: c.es, name_en: c.en, slug: c.id, order: c.order }));
      registrarActividad('crear', 'postCategories', '', t('blg.catSembrar'));
      pintar();
      return;
    }
    const b = e.target.closest('[data-borrar-cat]');
    if (!b) return;
    const id = b.dataset.borrarCat;
    const c = categorias.find((x) => x.id === id);
    const usados = posts.filter((p) => p.category === id).length;
    const ok = await confirmar({ titulo: t('blg.catBorrarT', { c: c.name }), texto: usados ? t('blg.catBorrarUsada', { n: usados }) : t('blg.catBorrarD'), boton: t('adm.eliminar'), peligro: true });
    if (!ok) { gestionarCategorias(); return; }
    try {
      await fs().deleteDoc(ref('postCategories', id));
      categorias = categorias.filter((x) => x.id !== id);
      registrarActividad('eliminar', 'postCategories', id, c.name);
      toast(t('adm.eliminado'));
    } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
    gestionarCategorias();
  });
  hacerOrdenable(lista, async (ids) => {
    const lote = fs().writeBatch(db());
    ids.forEach((id, i) => { lote.update(ref('postCategories', id), { order: i + 1 }); const c = categorias.find((x) => x.id === id); if (c) c.order = i + 1; });
    categorias.sort((a, b) => a.order - b.order);
    try { await lote.commit(); toast(t('adm.ordenGuardado')); } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
  });
  $('#form-nueva-cat').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = $('#nueva-cat').value.trim();
    if (!nombre) return;
    let id = slugificar(nombre).slice(0, 40) || `cat-${Date.now()}`;
    while (categorias.some((c) => c.id === id)) id += '-2';
    const datos = { name: nombre, name_en: '', slug: id, order: categorias.length + 1 };
    try {
      await fs().setDoc(ref('postCategories', id), datos);
      categorias.push({ id, ...datos });
      registrarActividad('crear', 'postCategories', id, nombre);
      $('#nueva-cat').value = '';
      pintar();
      toast(t('adm.creado'));
    } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
  });
}

/* ==========================================================================
   Editor a pantalla completa
   ========================================================================== */
const aLocalInput = (v) => { const x = ms(v); if (!x) return ''; const d = new Date(x - new Date(x).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };
const contador = (id, max) => `<span class="contador" data-contador-de="${id}" data-max="${max}" aria-live="polite"></span>`;

/* Convierte un enlace de YouTube/Vimeo al formato "embed" */
function urlEmbed(url = '') {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return '';
}

/* Pequeño formulario modal: devuelve los valores o null */
function pedir({ tituloModal, campos }) {
  const html = campos.map((c) => `<div class="campo"><label for="pedir-${c.id}">${escaparHTML(c.etiqueta)}</label><input id="pedir-${c.id}" type="${c.tipo || 'text'}" maxlength="${c.max || 300}" placeholder="${escaparHTML(c.ph || '')}" value="${escaparHTML(c.valor || '')}"></div>`).join('');
  const promesa = dialogo({ titulo: tituloModal, html, acciones: [{ texto: t('adm.cancelar'), valor: false }, { texto: t('blg.insertar'), valor: true, principal: true }] });
  setTimeout(() => $(`#pedir-${campos[0].id}`)?.focus(), 60);
  const leer = () => Object.fromEntries(campos.map((c) => [c.id, $(`#pedir-${c.id}`)?.value.trim() || '']));
  let valores = null;
  $('#modal-cuerpo').addEventListener('input', () => { valores = leer(); });
  $('#modal-cuerpo').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); valores = leer(); cerrarModal(true); } });
  valores = leer();
  return promesa.then((ok) => (ok ? valores : null));
}

async function abrirEditor(id) {
  await cargar();
  const original = posts.find((x) => x.id === id);
  if (!original) { history.replaceState(null, '', '#blog'); return; }
  const privadoInicial = original.visibility === 'miembros' ? await leerPrivado(id) : null;
  const p = { ...original };
  p.contentHtml = original.visibility === 'miembros' ? (privadoInicial?.contentHtml || '') : (original.contentHtml || '');
  p.contentHtml_en = original.visibility === 'miembros' ? (privadoInicial?.contentHtml_en || '') : (original.contentHtml_en || '');
  let slugEditado = !!original.slug && !original.slug.startsWith(slugificar(t('blg.nuevoTitulo')));
  let editorEs = null;
  let editorEn = null;
  let ultimoGuardado = ms(original.updatedAt) || Date.now();
  let ultimaVersion = 0;
  let guardando = false;
  const temporizadores = [];
  const est = estadoDe(original) === 'papelera' ? 'borrador' : (original.status || 'borrador');

  const cuerpo = abrirCajon({
    titulo: titulo(original),
    subtitulo: t('blg.editando'),
    ancho: 'completo',
    onCerrar: () => {
      temporizadores.forEach(clearInterval);
      if (location.hash.startsWith('#blog/')) history.replaceState(null, '', '#blog');
    },
    html: `
      <form class="formulario form-app editor-post" id="form-post" novalidate>
        <div class="editor-post-principal">
          <div class="pestanas-app" role="tablist" aria-label="${escaparHTML(t('blg.secciones'))}">
            ${['contenido', 'seo', 'ingles', 'historial'].map((pt, i) => `<button type="button" role="tab" id="ptab-${pt}" aria-controls="ppanel-${pt}" aria-selected="${i === 0}" tabindex="${i ? -1 : 0}">${escaparHTML(t(`blg.tab.${pt}`))}</button>`).join('')}
          </div>

          <section class="panel-pestana" role="tabpanel" id="ppanel-contenido" aria-labelledby="ptab-contenido">
            <div class="campo">
              <label for="p-titulo">${escaparHTML(t('adm.titulo'))} * ${contador('p-titulo', MAX.titulo)}</label>
              <input id="p-titulo" class="input-titulo" maxlength="${MAX.titulo}" required value="${escaparHTML(p.title || '')}">
            </div>
            <div class="campo">
              <label for="p-slug">${escaparHTML(t('blg.slug'))}</label>
              <div class="slug-fila"><span class="slug-base">…/blog/</span><input id="p-slug" maxlength="90" value="${escaparHTML(p.slug || '')}" pattern="[a-z0-9-]+" aria-describedby="p-slug-ayuda"></div>
              <p class="ayuda-campo" id="p-slug-ayuda"></p>
            </div>
            <div class="campo">
              <label for="p-extracto">${escaparHTML(t('blg.extracto'))} ${contador('p-extracto', MAX.extracto)}</label>
              <textarea id="p-extracto" rows="2" maxlength="${MAX.extracto}">${escaparHTML(p.excerpt || '')}</textarea>
            </div>
            <div class="campo">
              <span class="etiqueta-campo">${escaparHTML(t('blg.contenido'))} <span class="texto-suave-app" id="minutos-lectura"></span></span>
              <div class="editor-quill editor-quill-alto" id="quill-es"></div>
            </div>
          </section>

          <section class="panel-pestana" role="tabpanel" id="ppanel-seo" aria-labelledby="ptab-seo" hidden>
            <div class="campo">
              <label for="p-seo-titulo">${escaparHTML(t('blg.seoTitulo'))} ${contador('p-seo-titulo', MAX.seoTitulo)}</label>
              <input id="p-seo-titulo" maxlength="90" value="${escaparHTML(p.seoTitle || '')}" placeholder="${escaparHTML(t('blg.seoTituloPh'))}">
            </div>
            <div class="campo">
              <label for="p-seo-desc">${escaparHTML(t('blg.seoDesc'))} ${contador('p-seo-desc', MAX.seoDesc)}</label>
              <textarea id="p-seo-desc" rows="3" maxlength="220" placeholder="${escaparHTML(t('blg.seoDescPh'))}">${escaparHTML(p.seoDescription || '')}</textarea>
            </div>
            <div class="campo">
              <span class="etiqueta-campo">${escaparHTML(t('blg.ogImagen'))}</span>
              <div class="og-editor" id="og-editor"></div>
              <p class="ayuda-campo">${escaparHTML(t('blg.ogAyuda'))}</p>
            </div>
            <div class="vistas-seo">
              <div>
                <p class="etiqueta-campo">${escaparHTML(t('blg.vistaGoogle'))}</p>
                <div class="vista-google" id="vista-google"></div>
              </div>
              <div>
                <p class="etiqueta-campo">${escaparHTML(t('blg.vistaWhatsapp'))}</p>
                <div class="vista-whatsapp" id="vista-whatsapp"></div>
              </div>
            </div>
          </section>

          <section class="panel-pestana" role="tabpanel" id="ppanel-ingles" aria-labelledby="ptab-ingles" hidden>
            <p class="nota-privada">${escaparHTML(t('blg.inglesAyuda'))}</p>
            <div class="campo"><label for="p-titulo-en">Title</label><input id="p-titulo-en" maxlength="${MAX.titulo}" value="${escaparHTML(p.title_en || '')}"></div>
            <div class="campo"><label for="p-extracto-en">Excerpt</label><textarea id="p-extracto-en" rows="2" maxlength="${MAX.extracto}">${escaparHTML(p.excerpt_en || '')}</textarea></div>
            <div class="campo"><span class="etiqueta-campo">Content</span><div class="editor-quill editor-quill-alto" id="quill-en"></div></div>
          </section>

          <section class="panel-pestana" role="tabpanel" id="ppanel-historial" aria-labelledby="ptab-historial" hidden>
            <p class="texto-suave-app">${escaparHTML(t('blg.historialAyuda'))}</p>
            <ul class="lista-versiones" id="lista-versiones"></ul>
          </section>
        </div>

        <aside class="editor-post-lateral">
          <div class="bloque-editor">
            <h3>${escaparHTML(t('blg.publicacion'))}</h3>
            <div class="campo"><label for="p-estado">${escaparHTML(t('blg.estado'))}</label>
              <select id="p-estado">${ESTADOS.map((e) => `<option value="${e}"${e === est ? ' selected' : ''}>${escaparHTML(t(`blg.e.${e}`))}</option>`).join('')}</select>
            </div>
            <div class="campo" id="campo-fecha"><label for="p-fecha">${escaparHTML(t('blg.fechaHora'))}</label><input id="p-fecha" type="datetime-local" value="${escaparHTML(aLocalInput(p.publishAt))}"><p class="ayuda-campo" id="ayuda-fecha"></p></div>
            <div class="campo"><label for="p-vis">${escaparHTML(t('blg.visibilidad'))}</label>
              <select id="p-vis"><option value="publico"${p.visibility !== 'miembros' ? ' selected' : ''}>${escaparHTML(t('blg.publico'))}</option><option value="miembros"${p.visibility === 'miembros' ? ' selected' : ''}>${escaparHTML(t('blg.miembros'))}</option></select>
              <p class="ayuda-campo" id="ayuda-vis"></p>
            </div>
            <div class="fila-interruptores">
              ${interruptor('p-destacado', p.featured, t('blg.destacado'))}
              ${interruptor('p-fijado', p.pinned, t('blg.fijado'))}
            </div>
          </div>

          <div class="bloque-editor">
            <h3>${escaparHTML(t('blg.portada'))}</h3>
            <div class="portada-editor" id="portada-post"></div>
            <div class="campo"><label for="p-alt">${escaparHTML(t('blg.alt'))}</label><input id="p-alt" maxlength="160" value="${escaparHTML(p.coverAlt || '')}" placeholder="${escaparHTML(t('blg.altPh'))}"></div>
          </div>

          <div class="bloque-editor">
            <h3>${escaparHTML(t('blg.organizacion'))}</h3>
            <div class="campo"><label for="p-cat">${escaparHTML(t('blg.categoria'))}</label><select id="p-cat">${listaCategorias().map((c) => `<option value="${escaparHTML(c.id)}"${c.id === p.category ? ' selected' : ''}>${escaparHTML(c.nombre)}</option>`).join('')}</select></div>
            <div class="campo"><label for="p-tags">${escaparHTML(t('blg.etiquetas'))}</label><input id="p-tags" maxlength="200" value="${escaparHTML((p.tags || []).join(', '))}" placeholder="FAFSA, Becas"><p class="ayuda-campo">${escaparHTML(t('blg.etiquetasAyuda'))}</p></div>
            <div class="campo"><label for="p-autora">${escaparHTML(t('blg.autora'))}</label><input id="p-autora" maxlength="80" value="${escaparHTML(p.author || CONFIG.blog.autora.nombre)}"></div>
          </div>

          <div class="bloque-editor">
            <h3>${escaparHTML(t('blg.ctaFinal'))}</h3>
            <div class="campo"><label for="p-cta">${escaparHTML(t('blg.ctaTipo'))}</label>
              <select id="p-cta">${['registro', 'consulta', 'personalizado', 'ninguno'].map((c) => `<option value="${c}"${(p.ctaType || 'registro') === c ? ' selected' : ''}>${escaparHTML(t(`blg.cta.${c}`))}</option>`).join('')}</select>
            </div>
            <div class="campo"><label for="p-cta-texto">${escaparHTML(t('blg.ctaTexto'))}</label><input id="p-cta-texto" maxlength="80" value="${escaparHTML(p.ctaText || '')}" placeholder="${escaparHTML(t('blg.ctaTextoPh'))}"></div>
            <div class="campo" id="campo-cta-url"><label for="p-cta-url">URL</label><input id="p-cta-url" type="url" maxlength="300" value="${escaparHTML(p.ctaUrl || '')}" placeholder="https://…"></div>
          </div>
        </aside>

        <div class="barra-guardar-cajon">
          <button type="button" class="btn btn-sm btn-peligro-suave" id="post-papelera">${escaparHTML(t('adm.moverPapelera'))}</button>
          <span class="espaciador"></span>
          <span class="texto-suave-app estado-guardado" id="estado-guardado" aria-live="polite"></span>
          <button type="button" class="btn btn-linea-app btn-sm" id="post-vista">${escaparHTML(t('blg.vistaPrevia'))}</button>
          <button type="submit" class="btn btn-principal btn-sm" id="guardar-post">${escaparHTML(t('adm.guardar'))}</button>
        </div>
      </form>`,
  });

  const form = $('#form-post', cuerpo);
  const cambio = () => { marcarSucio(true); pintarEstadoGuardado(); };
  form.addEventListener('input', (e) => { if (!e.target.closest('#modal')) cambio(); });
  form.addEventListener('change', cambio);

  /* --- Pestañas --- */
  const PT = ['contenido', 'seo', 'ingles', 'historial'];
  const activar = async (pt) => {
    PT.forEach((x) => {
      const b = $(`#ptab-${x}`); const panel = $(`#ppanel-${x}`);
      b.setAttribute('aria-selected', String(x === pt)); b.tabIndex = x === pt ? 0 : -1; panel.hidden = x !== pt;
    });
    $(`#ptab-${pt}`).focus();
    if (pt === 'seo') pintarVistasSEO();
    if (pt === 'ingles' && !editorEn) editorEn = await montarEditor('#quill-en', p.contentHtml_en);
    if (pt === 'historial') pintarVersiones();
  };
  $('.pestanas-app', form).addEventListener('click', (e) => { const b = e.target.closest('[role="tab"]'); if (b) activar(b.id.replace('ptab-', '')); });
  $('.pestanas-app', form).addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!d) return;
    const i = PT.findIndex((x) => $(`#ptab-${x}`).getAttribute('aria-selected') === 'true');
    activar(PT[(i + d + PT.length) % PT.length]);
  });

  /* --- Contadores de caracteres en vivo --- */
  const pintarContadores = () => $$('[data-contador-de]', form).forEach((c) => {
    const n = $(`#${c.dataset.contadorDe}`).value.length;
    const max = Number(c.dataset.max);
    c.textContent = t('adm.caracteres', { n, max });
    c.classList.toggle('excedido', n > max);
  });
  form.addEventListener('input', pintarContadores);
  pintarContadores();

  /* --- Slug automático, editable y único --- */
  const validarSlug = () => {
    const input = $('#p-slug');
    const limpio = slugificar(input.value).slice(0, 90);
    const repetido = posts.some((x) => x.id !== id && x.slug === limpio);
    input.setAttribute('aria-invalid', String(!limpio || repetido));
    $('#p-slug-ayuda').textContent = !limpio ? t('blg.slugVacio') : repetido ? t('blg.slugRepetido') : `${CONFIG.sitio.url.replace(/^https?:\/\//, '')}/blog/${limpio}`;
    return limpio && !repetido ? limpio : null;
  };
  $('#p-titulo').addEventListener('input', (e) => {
    if (!slugEditado) $('#p-slug').value = slugUnico(e.target.value, id);
    validarSlug();
    actualizarTituloCajon(e.target.value || t('blg.sinTitulo'));
  });
  $('#p-slug').addEventListener('input', () => { slugEditado = true; validarSlug(); });
  $('#p-slug').addEventListener('blur', () => { $('#p-slug').value = slugificar($('#p-slug').value).slice(0, 90); validarSlug(); });
  validarSlug();

  /* --- Estado y fecha --- */
  const pintarFecha = () => {
    const e = $('#p-estado').value;
    const valor = $('#p-fecha').value;
    const cuando = valor ? new Date(valor).getTime() : 0;
    $('#campo-fecha').hidden = !['programado', 'publicado'].includes(e);
    let ayuda = '';
    if (e === 'programado') ayuda = !cuando ? t('blg.fechaRequerida') : cuando <= Date.now() ? t('blg.fechaPasada') : t('blg.seProgramara', { f: new Date(cuando).toLocaleString(estado.idioma) });
    if (e === 'publicado') ayuda = cuando > Date.now() ? t('blg.publicadoFuturo') : t('blg.publicadoAhora');
    $('#ayuda-fecha').textContent = ayuda;
    $('#ayuda-vis').textContent = $('#p-vis').value === 'miembros' ? t('blg.miembrosAyuda') : '';
    $('#campo-cta-url').hidden = $('#p-cta').value !== 'personalizado';
  };
  ['#p-estado', '#p-fecha', '#p-vis', '#p-cta'].forEach((s) => $(s).addEventListener('change', pintarFecha));
  $('#p-estado').addEventListener('change', () => {
    const e = $('#p-estado').value;
    const actual = $('#p-fecha').value ? new Date($('#p-fecha').value).getTime() : 0;
    if (e === 'programado' && actual <= Date.now()) {
      // Propuesta: mañana a las 9:00
      const manana = new Date(); manana.setDate(manana.getDate() + 1); manana.setHours(9, 0, 0, 0);
      $('#p-fecha').value = aLocalInput(manana);
    } else if (e === 'publicado' && !actual) $('#p-fecha').value = aLocalInput(Date.now());
    pintarFecha();
  });
  pintarFecha();

  /* --- Portada 16:9 y alt --- */
  const pintarPortada = () => {
    $('#portada-post').innerHTML = `
      <div class="portada-vista">${esURLSegura(p.coverUrl) ? `<img src="${escaparHTML(urlCloudinary(p.coverUrl, 'f_auto,q_auto,c_fill,w_640,h_360'))}" alt="">` : '<span class="marcador"><span class="marcador-k">K</span><span class="marcador-marca">16:9 · 1600×900</span></span>'}</div>
      <div class="fila-botones">
        <label class="btn btn-linea-app btn-sm">${escaparHTML(p.coverUrl ? t('adm.cambiarFoto') : t('blg.subirPortada'))}<input type="file" accept="image/jpeg,image/png,image/webp" id="archivo-portada-post" hidden></label>
        ${p.coverUrl ? `<button type="button" class="btn btn-sm btn-peligro-suave" id="quitar-portada-post">${escaparHTML(t('adm.quitar'))}</button>` : ''}
      </div>`;
    $('#archivo-portada-post').addEventListener('change', (e) => subirImagen(e.target, { ratio: 16 / 9, ancho: 1600, destino: 'cover' }));
    $('#quitar-portada-post')?.addEventListener('click', () => { p.coverUrl = ''; p.coverPublicId = ''; pintarPortada(); cambio(); });
  };
  const pintarOG = () => {
    $('#og-editor').innerHTML = `
      <div class="og-vista">${esURLSegura(p.ogImageUrl) ? `<img src="${escaparHTML(urlCloudinary(p.ogImageUrl, 'f_auto,q_auto,c_fill,w_600,h_315'))}" alt="">` : `<span class="texto-suave-app">${escaparHTML(t('blg.ogUsaPortada'))}</span>`}</div>
      <div class="fila-botones">
        <label class="btn btn-linea-app btn-sm">${escaparHTML(t('blg.subirOg'))}<input type="file" accept="image/jpeg,image/png" id="archivo-og" hidden></label>
        ${p.ogImageUrl ? `<button type="button" class="btn btn-sm btn-peligro-suave" id="quitar-og">${escaparHTML(t('adm.quitar'))}</button>` : ''}
      </div>`;
    $('#archivo-og').addEventListener('change', (e) => subirImagen(e.target, { ratio: 1200 / 630, ancho: 1200, destino: 'og' }));
    $('#quitar-og')?.addEventListener('click', () => { p.ogImageUrl = ''; pintarOG(); pintarVistasSEO(); cambio(); });
  };
  async function subirImagen(input, { ratio, ancho, destino }) {
    const archivo = input.files[0];
    input.value = '';
    if (!archivo) return;
    if (!/^image\/(jpeg|png|webp)$/.test(archivo.type) || archivo.size > CONFIG.cloudinary.maxBytes) { toast(t('adm.errImagen'), { tipo: 'error' }); return; }
    if (!cloudinaryConfigurado()) { toast(t('docs.sinConfig'), { tipo: 'info' }); return; }
    const blob = await recortarImagen(archivo, { ratio, anchoMax: ancho, tipo: 'image/jpeg' });
    if (!blob) return;
    const zona = destino === 'cover' ? $('#portada-post .portada-vista') : $('#og-editor .og-vista');
    zona.dataset.progreso = '0%';
    try {
      const r = await subirACloudinary(blob, { carpeta: `blog/${id}`, tipo: 'image', onProgreso: (n) => { zona.dataset.progreso = `${n}%`; } });
      if (destino === 'cover') { p.coverUrl = r.url; p.coverPublicId = r.publicId; pintarPortada(); if (!$('#p-alt').value) $('#p-alt').focus(); }
      else { p.ogImageUrl = r.url; pintarOG(); }
      pintarVistasSEO();
      cambio();
    } catch { delete zona.dataset.progreso; toast(t('docs.errSubida', { nombre: archivo.name }), { tipo: 'error' }); }
  }
  pintarPortada();
  pintarOG();

  /* --- Editores Quill (imágenes a Cloudinary, videos y botón CTA) --- */
  const insertarImagen = async (editor) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif' });
    input.addEventListener('change', async () => {
      const archivo = input.files[0];
      if (!archivo) return;
      if (archivo.size > CONFIG.cloudinary.maxBytes) { toast(t('adm.errImagen'), { tipo: 'error' }); return; }
      if (!cloudinaryConfigurado()) { toast(t('docs.sinConfig'), { tipo: 'info' }); return; }
      const rango = editor.getSelection(true) || { index: editor.getLength() };
      toast(t('adm.subiendo'), { tipo: 'info' });
      try {
        const blob = archivo.type === 'image/gif' ? archivo : await recortarImagen(archivo, { ratio: null, anchoMax: 1600, tipo: 'image/jpeg' });
        if (!blob) return;
        const r = await subirACloudinary(blob, { carpeta: `blog/${id}`, tipo: 'image' });
        editor.insertEmbed(rango.index, 'image', r.url, 'user');
        editor.setSelection(rango.index + 1, 0);
      } catch { toast(t('docs.errSubida', { nombre: archivo.name }), { tipo: 'error' }); }
    });
    input.click();
  };
  const insertarVideo = async (editor) => {
    const rango = editor.getSelection(true) || { index: editor.getLength() };
    const v = await pedir({ tituloModal: t('adm.videoInsertar'), campos: [{ id: 'url', etiqueta: t('blg.videoUrl'), tipo: 'url', ph: 'https://youtu.be/…' }] });
    if (!v) return;
    const src = urlEmbed(v.url);
    if (!src) { toast(t('blg.videoInvalido'), { tipo: 'error' }); return; }
    editor.insertEmbed(rango.index, 'video', src, 'user');
    editor.setSelection(rango.index + 1, 0);
  };
  const insertarCTA = async (editor) => {
    const rango = editor.getSelection(true) || { index: editor.getLength() };
    const seleccionado = rango.length ? editor.getText(rango.index, rango.length) : '';
    const v = await pedir({ tituloModal: t('adm.botonCta'), campos: [
      { id: 'texto', etiqueta: t('blg.ctaBotonTexto'), valor: seleccionado || t('art.ctaRegistroBtn'), max: 60 },
      { id: 'url', etiqueta: 'URL', tipo: 'url', ph: 'https://…', valor: `${CONFIG.sitio.url}/portal/?registro=1` },
    ] });
    if (!v || !v.texto || !/^https?:\/\//.test(v.url)) return;
    if (rango.length) editor.deleteText(rango.index, rango.length, 'user');
    editor.insertText(rango.index, '\n', 'user');
    editor.insertText(rango.index + 1, v.texto, { cta: v.url }, 'user');
    editor.insertText(rango.index + 1 + v.texto.length, '\n', 'user');
    editor.setSelection(rango.index + v.texto.length + 2, 0);
  };
  const montarEditor = async (selector, html) => {
    try {
      return await crearEditor($(selector), {
        html: await sanearHTML(html || '', { videos: true }),
        placeholder: t('blg.contenidoPh'),
        imagenes: insertarImagen, video: insertarVideo, cta: insertarCTA,
        alCambiar: () => { cambio(); if (selector === '#quill-es') pintarMinutos(); },
      });
    } catch {
      $(selector).innerHTML = `<textarea class="contenido-simple" data-simple="${selector}" rows="14">${escaparHTML(html || '')}</textarea>`;
      return null;
    }
  };
  const htmlDe = (editor, selector) => {
    if (editor) return editor.root.innerHTML === '<p><br></p>' ? '' : editor.root.innerHTML;
    return $(`[data-simple="${selector}"]`)?.value ?? (selector === '#quill-en' ? p.contentHtml_en : p.contentHtml) ?? '';
  };
  const pintarMinutos = () => { $('#minutos-lectura').textContent = `· ${t('blog.minutos', { n: minutosLectura(htmlDe(editorEs, '#quill-es')) })}`; };
  editorEs = await montarEditor('#quill-es', p.contentHtml);
  pintarMinutos();

  /* --- Vistas previas SEO (Google y WhatsApp) --- */
  function pintarVistasSEO() {
    const tituloSEO = $('#p-seo-titulo').value.trim() || $('#p-titulo').value.trim();
    const desc = $('#p-seo-desc').value.trim() || $('#p-extracto').value.trim();
    const slug = slugificar($('#p-slug').value) || 'articulo';
    const img = p.ogImageUrl || p.coverUrl;
    const dominio = CONFIG.sitio.url.replace(/^https?:\/\//, '');
    const corta = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
    $('#vista-google').innerHTML = `
      <p class="g-url">${escaparHTML(dominio)} › blog › ${escaparHTML(slug)}</p>
      <p class="g-titulo">${escaparHTML(corta(`${tituloSEO} | Karely Paredes`, 62))}</p>
      <p class="g-desc">${escaparHTML(corta(desc || t('blg.seoSinDesc'), 158))}</p>`;
    $('#vista-whatsapp').innerHTML = `
      <div class="wa-burbuja">
        <div class="wa-tarjeta">
          ${esURLSegura(img) ? `<img src="${escaparHTML(urlCloudinary(img, 'f_auto,q_auto,c_fill,w_600,h_315'))}" alt="">` : '<div class="wa-sin-img"><span class="marcador-k">K</span></div>'}
          <div class="wa-texto"><strong>${escaparHTML(corta(tituloSEO, 70))}</strong><span>${escaparHTML(corta(desc, 110))}</span><em>${escaparHTML(dominio)}</em></div>
        </div>
        <span class="wa-enlace">${escaparHTML(urlCompartir(slug))}</span>
      </div>
      ${CONFIG.blog.paginasEstaticas ? '' : `<p class="ayuda-campo">${escaparHTML(t('blg.waAviso'))}</p>`}`;
  }
  ['#p-seo-titulo', '#p-seo-desc', '#p-titulo', '#p-extracto', '#p-slug'].forEach((s) => $(s).addEventListener('input', () => { if (!$('#ppanel-seo').hidden) pintarVistasSEO(); }));

  /* --- Recoger el formulario --- */
  async function recoger() {
    const htmlEs = await sanearHTML(htmlDe(editorEs, '#quill-es'), { videos: true });
    const htmlEn = editorEn || $('[data-simple="#quill-en"]') ? await sanearHTML(htmlDe(editorEn, '#quill-en'), { videos: true }) : (p.contentHtml_en || '');
    const e = $('#p-estado').value;
    const fechaInput = $('#p-fecha').value ? new Date($('#p-fecha').value) : null;
    const vis = $('#p-vis').value;
    let publishAt = original.publishAt ?? null;
    if (e === 'programado') publishAt = fechaInput ? fs().Timestamp.fromDate(fechaInput) : null;
    if (e === 'publicado') publishAt = fechaInput && fechaInput.getTime() <= Date.now() + 60000 ? fs().Timestamp.fromDate(fechaInput) : fs().Timestamp.now();
    const tags = [...new Set($('#p-tags').value.split(',').map((x) => x.trim().replace(/^#/, '')).filter(Boolean))].slice(0, MAX.etiquetas).map((x) => x.slice(0, 30));
    return {
      datos: {
        title: $('#p-titulo').value.trim().slice(0, MAX.titulo),
        title_en: $('#p-titulo-en').value.trim().slice(0, MAX.titulo),
        slug: slugificar($('#p-slug').value).slice(0, 90),
        excerpt: $('#p-extracto').value.trim().slice(0, MAX.extracto),
        excerpt_en: $('#p-extracto-en').value.trim().slice(0, MAX.extracto),
        contentHtml: vis === 'miembros' ? '' : htmlEs,
        contentHtml_en: vis === 'miembros' ? '' : htmlEn,
        coverUrl: p.coverUrl || '', coverPublicId: p.coverPublicId || '', coverAlt: $('#p-alt').value.trim().slice(0, 160),
        category: $('#p-cat').value,
        tags,
        author: $('#p-autora').value.trim().slice(0, 80) || CONFIG.blog.autora.nombre,
        status: e,
        visibility: vis,
        featured: $('#p-destacado').checked,
        pinned: $('#p-fijado').checked,
        publishAt,
        readingMinutes: minutosLectura(htmlEs),
        ctaType: $('#p-cta').value,
        ctaText: $('#p-cta-texto').value.trim().slice(0, 80),
        ctaUrl: esURLSegura($('#p-cta-url').value.trim()) ? $('#p-cta-url').value.trim() : '',
        seoTitle: $('#p-seo-titulo').value.trim().slice(0, 90),
        seoDescription: $('#p-seo-desc').value.trim().slice(0, 220),
        ogImageUrl: p.ogImageUrl || '',
      },
      privado: vis === 'miembros' ? { contentHtml: htmlEs, contentHtml_en: htmlEn } : null,
    };
  }

  /* --- Guardar (manual o automático) --- */
  async function guardar({ automatico = false } = {}) {
    if (guardando) return;
    const tituloVal = $('#p-titulo').value.trim();
    const slugOk = validarSlug();
    if (!tituloVal || !slugOk) {
      if (automatico) return;
      activar('contenido');
      const campo = !tituloVal ? $('#p-titulo') : $('#p-slug');
      campo.setAttribute('aria-invalid', 'true'); campo.focus();
      toast(!tituloVal ? t('blg.errTitulo') : t('blg.slugRepetido'), { tipo: 'error' });
      return;
    }
    const { datos, privado } = await recoger();
    if (!automatico && datos.status === 'programado' && (!datos.publishAt || ms(datos.publishAt) <= Date.now())) {
      $('#p-fecha').focus(); toast(t('blg.fechaRequerida'), { tipo: 'error' }); return;
    }
    if (automatico && datos.status === 'programado' && !datos.publishAt) return;
    guardando = true;
    const boton = $('#guardar-post');
    boton.disabled = true;
    $('#estado-guardado').textContent = t('adm.guardando');
    try {
      const lote = fs().writeBatch(db());
      lote.update(ref('posts', id), { ...datos, updatedAt: ahora(), updatedBy: nombreAdmin() });
      if (privado) lote.set(ref('posts', id, 'privado', 'cuerpo'), { ...privado, updatedAt: ahora() });
      else if (original.visibility === 'miembros') lote.delete(ref('posts', id, 'privado', 'cuerpo'));
      // Solo un destacado a la vez
      if (datos.featured) posts.filter((x) => x.featured && x.id !== id).forEach((x) => { lote.update(ref('posts', x.id), { featured: false }); x.featured = false; });
      if (datos.pinned && !original.pinned) datos.order = Math.max(-1, ...posts.filter((x) => x.pinned && x.id !== id).map((x) => x.order ?? 0)) + 1;
      if (datos.order !== undefined) lote.update(ref('posts', id), { order: datos.order });
      // Historial: versión en cada guardado manual y, en automático, cada 5 minutos
      const tocaVersion = !automatico || Date.now() - ultimaVersion > 5 * 60000;
      if (tocaVersion) {
        lote.set(ref('posts', id, 'versions', `v${Date.now()}`), { snapshot: { ...datos, publishAt: datos.publishAt ?? null, contentHtml: privado ? privado.contentHtml : datos.contentHtml, contentHtml_en: privado ? privado.contentHtml_en : datos.contentHtml_en }, savedAt: ahora(), savedBy: nombreAdmin(), automatico });
      }
      await lote.commit();
      if (tocaVersion) { ultimaVersion = Date.now(); podarVersiones(); }
      Object.assign(original, datos, { updatedAt: new Date() });
      if (privado) Object.assign(p, privado);
      ultimoGuardado = Date.now();
      marcarSucio(false);
      pintarEstadoGuardado();
      actualizarTituloCajon(tituloVal);
      repintarTodo();
      if (!automatico) {
        toast(t(datos.status === 'publicado' ? 'blg.hecho.publicado' : datos.status === 'programado' ? 'blg.hecho.programado' : 'adm.guardado'));
        registrarActividad('editar', 'posts', id, `${tituloVal} · ${t(`blg.e.${datos.status}`)}`);
      }
    } catch (error) {
      console.error(error);
      $('#estado-guardado').textContent = '';
      if (!automatico) toast(t('adm.errGuardar'), { tipo: 'error' });
    } finally {
      guardando = false;
      boton.disabled = false;
    }
  }

  async function podarVersiones() {
    try {
      const snap = await fs().getDocs(col('posts', id, 'versions'));
      const lista = snap.docs.map((d) => ({ id: d.id, t: ms(d.data().savedAt) || Number(d.id.slice(1)) })).sort((a, b) => b.t - a.t);
      await Promise.all(lista.slice(10).map((v) => fs().deleteDoc(ref('posts', id, 'versions', v.id))));
    } catch { /* no crítico */ }
  }

  async function pintarVersiones() {
    const zona = $('#lista-versiones');
    zona.innerHTML = '<li><div class="esqueleto-fila"></div></li>';
    try {
      const snap = await fs().getDocs(col('posts', id, 'versions'));
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (ms(b.savedAt) || Number(b.id.slice(1))) - (ms(a.savedAt) || Number(a.id.slice(1)))).slice(0, 10);
      zona.innerHTML = lista.length ? lista.map((v) => `
        <li class="fila-contenido compacta" data-version="${escaparHTML(v.id)}">
          <div class="fila-texto"><strong>${escaparHTML(v.snapshot?.title || t('blg.sinTitulo'))}</strong><span>${escaparHTML(`${relativo(v.savedAt || Number(v.id.slice(1)))} · ${v.savedBy || ''}${v.automatico ? ` · ${t('blg.auto')}` : ''}`)}</span></div>
          <button type="button" class="btn btn-linea-app btn-sm" data-restaurar-version="${escaparHTML(v.id)}">${escaparHTML(t('adm.restaurar'))}</button>
        </li>`).join('') : `<li class="lista-vacia">${escaparHTML(t('blg.sinVersiones'))}</li>`;
      zona.onclick = async (e) => {
        const b = e.target.closest('[data-restaurar-version]');
        if (!b) return;
        const v = lista.find((x) => x.id === b.dataset.restaurarVersion);
        const ok = await confirmar({ titulo: t('blg.restaurarVersionT'), texto: t('blg.restaurarVersionD'), boton: t('adm.restaurar') });
        if (ok) restaurarVersion(v.snapshot || {});
      };
    } catch { zona.innerHTML = `<li class="lista-vacia">${escaparHTML(t('adm.errCargar'))}</li>`; }
  }

  function restaurarVersion(s) {
    $('#p-titulo').value = s.title || '';
    $('#p-titulo-en').value = s.title_en || '';
    $('#p-slug').value = s.slug || $('#p-slug').value;
    $('#p-extracto').value = s.excerpt || '';
    $('#p-extracto-en').value = s.excerpt_en || '';
    $('#p-alt').value = s.coverAlt || '';
    $('#p-tags').value = (s.tags || []).join(', ');
    $('#p-seo-titulo').value = s.seoTitle || '';
    $('#p-seo-desc').value = s.seoDescription || '';
    if (s.category) $('#p-cat').value = s.category;
    p.coverUrl = s.coverUrl || ''; p.coverPublicId = s.coverPublicId || ''; p.ogImageUrl = s.ogImageUrl || '';
    pintarPortada(); pintarOG();
    if (editorEs) { editorEs.setContents([]); editorEs.clipboard.dangerouslyPasteHTML(s.contentHtml || ''); }
    if (editorEn) { editorEn.setContents([]); editorEn.clipboard.dangerouslyPasteHTML(s.contentHtml_en || ''); } else p.contentHtml_en = s.contentHtml_en || '';
    slugEditado = true;
    validarSlug(); pintarContadores(); pintarMinutos();
    cambio();
    activar('contenido');
    toast(t('blg.versionRestaurada'));
  }

  /* --- Indicador "Guardado hace X s" y autoguardado cada 20 s --- */
  function pintarEstadoGuardado() {
    const zona = $('#estado-guardado');
    if (!zona || guardando) return;
    if (haySinGuardar()) { zona.textContent = t('blg.sinGuardar'); zona.classList.add('pendiente'); return; }
    zona.classList.remove('pendiente');
    const s = Math.max(0, Math.round((Date.now() - ultimoGuardado) / 1000));
    zona.textContent = s < 60 ? t('blg.guardadoS', { s }) : t('blg.guardadoHace', { cuando: relativo(ultimoGuardado) });
  }
  temporizadores.push(setInterval(() => { if (!document.body.contains(form)) { temporizadores.forEach(clearInterval); return; } pintarEstadoGuardado(); }, 1000));
  temporizadores.push(setInterval(() => { if (document.body.contains(form) && haySinGuardar()) guardar({ automatico: true }); }, 20000));
  pintarEstadoGuardado();

  form.addEventListener('submit', (e) => { e.preventDefault(); guardar(); });
  const atajo = () => { if (document.body.contains(form)) guardar(); else document.removeEventListener('admin:guardar', atajo); };
  document.addEventListener('admin:guardar', atajo);
  $('#post-vista').addEventListener('click', async () => {
    const { datos, privado } = await recoger();
    abrirVistaPrevia({ ...original, ...datos, id, publishAt: datos.publishAt || new Date(), updatedAt: new Date() }, privado);
  });
  $('#post-papelera').addEventListener('click', async () => {
    marcarSucio(false);
    cerrarCajon(true);
    await accion('papelera', id);
  });
  setTimeout(() => $('#p-titulo').focus(), 80);
}

/* ---------- Búsqueda global ---------- */
async function buscar(q) {
  await cargar();
  const n = normalizar(q);
  return posts.filter((p) => estadoDe(p) !== 'papelera' && normalizar(`${p.title} ${p.title_en || ''} ${p.slug} ${(p.tags || []).join(' ')}`).includes(n))
    .map((p) => ({ titulo: titulo(p), sub: `${t(`blg.e.${estadoDe(p)}`)} · ${nombreCat(p.category)}`, href: `#blog/${encodeURIComponent(p.id)}` }));
}

export default {
  id: 'blog',
  icono: 'blog',
  clave: 'blg.menu',
  acceso: 'editor',
  montar,
  buscar,
  repintar: () => { if (vistaActual) { vistaActual.innerHTML = ''; montar(vistaActual, []); } },
  alCerrarSesion: () => { posts = []; categorias = []; cargado = false; seleccion.clear(); },
};

registrarTextos({
  es: {
    'blg.menu': 'Blog',
    'blg.nuevo': 'Nuevo artículo',
    'blg.nuevoTitulo': 'Artículo sin título',
    'blg.sinTitulo': 'Sin título',
    'blg.buscar': 'Buscar por título, slug o etiqueta',
    'blg.categoria': 'Categoría',
    'blg.categorias': 'Categorías',
    'blg.todasCat': 'Todas las categorías',
    'blg.visibilidad': 'Visibilidad',
    'blg.todaVis': 'Toda visibilidad',
    'blg.publico': 'Público',
    'blg.miembros': 'Solo miembros',
    'blg.estado': 'Estado',
    'blg.lecturas': 'Lecturas',
    'blg.e.borrador': 'Borrador',
    'blg.e.programado': 'Programado',
    'blg.e.publicado': 'Publicado',
    'blg.e.archivado': 'Archivado',
    'blg.e.papelera': 'En papelera',
    'blg.conteo': '{n} artículos',
    'blg.vacio': 'Aún no hay artículos. Crea el primero y compártelo con tu comunidad.',
    'blg.sinFiltro': 'Ningún artículo coincide con los filtros.',
    'blg.seleccionar': 'Seleccionar “{t}”',
    'blg.seleccionarTodos': 'Seleccionar todos los visibles',
    'blg.seleccionados': '{n} seleccionados',
    'blg.limpiarSeleccion': 'Quitar la selección',
    'blg.masAcciones': 'Más acciones',
    'blg.vistaPrevia': 'Vista previa',
    'blg.duplicar': 'Duplicar',
    'blg.duplicado': 'Artículo duplicado como borrador',
    'blg.copia': 'copia',
    'blg.despublicar': 'Despublicar',
    'blg.destacar': 'Destacar en la landing',
    'blg.quitarDestacado': 'Quitar destacado',
    'blg.destacado': 'Destacado',
    'blg.fijar': 'Fijar arriba',
    'blg.desfijar': 'Desfijar',
    'blg.fijado': 'Fijado',
    'blg.archivar': 'Archivar',
    'blg.fijadosT': 'Fijados y destacado',
    'blg.fijadosAyuda': 'Los artículos fijados aparecen primero en el blog y en la landing, en este orden. Arrastra o usa las flechas.',
    'blg.destacadoActual': 'Destacado actual',
    'blg.sinDestacado': 'Sin destacado: se muestra el más reciente.',
    'blg.sinFijados': 'Aún no hay artículos fijados.',
    'blg.hecho.publicar': 'Artículos publicados: {n}',
    'blg.hecho.despublicar': 'Artículos despublicados: {n}',
    'blg.hecho.archivar': 'Artículos archivados: {n}',
    'blg.hecho.papelera': 'Movidos a la papelera: {n}',
    'blg.hecho.restaurar': 'Artículos restaurados: {n}',
    'blg.hecho.destacar': 'Artículo destacado',
    'blg.hecho.quitarDestacado': 'Destacado quitado',
    'blg.hecho.fijar': 'Artículo fijado',
    'blg.hecho.desfijar': 'Artículo desfijado',
    'blg.hecho.publicado': 'Artículo publicado',
    'blg.hecho.programado': 'Artículo programado',
    'blg.masivaPapeleraT': '¿Mover {n} artículos a la papelera?',
    'blg.masivaPapeleraD': 'Dejarán de verse en el sitio. Puedes restaurarlos desde la papelera.',
    'blg.borrarTitulo': 'Eliminar el artículo para siempre',
    'blg.borrarTexto': 'Se borran el artículo, su contenido exclusivo y su historial. Esta acción no se puede deshacer.',
    'blg.errVista': 'No pude abrir la vista previa en este navegador.',
    'blg.catAyuda': 'Ordena arrastrando. Los cambios de nombre se guardan al salir de cada campo.',
    'blg.catNombre': 'Nombre en español',
    'blg.catNombreEn': 'Nombre en inglés',
    'blg.catNueva': 'Nueva categoría',
    'blg.catVacias': 'Aún no hay categorías guardadas; el sitio usa las 7 de respaldo.',
    'blg.catSembrar': 'Crear las categorías iniciales',
    'blg.catBorrarT': '¿Eliminar la categoría “{c}”?',
    'blg.catBorrarD': 'No hay artículos en esta categoría.',
    'blg.catBorrarUsada': '{n} artículos usan esta categoría y quedarán sin categoría visible hasta que les asignes otra.',
    'blg.editando': 'Editor de artículo · Ctrl/Cmd + S para guardar',
    'blg.secciones': 'Secciones del editor',
    'blg.tab.contenido': 'Contenido',
    'blg.tab.seo': 'SEO y redes',
    'blg.tab.ingles': 'Inglés',
    'blg.tab.historial': 'Historial',
    'blg.slug': 'Dirección (slug)',
    'blg.slugVacio': 'El slug no puede quedar vacío.',
    'blg.slugRepetido': 'Ya existe otro artículo con este slug. Cámbialo para que sea único.',
    'blg.extracto': 'Extracto',
    'blg.contenido': 'Contenido',
    'blg.contenidoPh': 'Escribe aquí tu artículo. Usa H2 y H3 para los subtítulos: con ellos se arma la tabla de contenido.',
    'blg.seoTitulo': 'Título SEO',
    'blg.seoTituloPh': 'Si lo dejas vacío se usa el título',
    'blg.seoDesc': 'Meta descripción',
    'blg.seoDescPh': 'Si la dejas vacía se usa el extracto',
    'blg.seoSinDesc': 'Agrega un extracto o una meta descripción para mejorar tu resultado en Google.',
    'blg.ogImagen': 'Imagen para compartir (1200×630)',
    'blg.ogAyuda': 'Opcional. Si no subes una, se usa la portada.',
    'blg.ogUsaPortada': 'Se usará la portada',
    'blg.subirOg': 'Subir imagen para compartir',
    'blg.vistaGoogle': 'Así se verá en Google',
    'blg.vistaWhatsapp': 'Así se verá en WhatsApp',
    'blg.waAviso': 'Las vistas previas en WhatsApp y Facebook se activan con las páginas estáticas del blog (GitHub Action, ver README).',
    'blg.inglesAyuda': 'Opcional. Si completas la versión en inglés, quien navegue en inglés la verá; si no, verá la versión en español.',
    'blg.historialAyuda': 'Se guardan las últimas 10 versiones. Restaurar carga la versión en el editor; luego guarda para aplicarla.',
    'blg.sinVersiones': 'Aún no hay versiones guardadas.',
    'blg.auto': 'autoguardado',
    'blg.restaurarVersionT': '¿Restaurar esta versión?',
    'blg.restaurarVersionD': 'Reemplaza lo que ves en el editor. Nada cambia en el sitio hasta que guardes.',
    'blg.versionRestaurada': 'Versión cargada en el editor. Guarda para aplicarla.',
    'blg.publicacion': 'Publicación',
    'blg.fechaHora': 'Fecha y hora de publicación',
    'blg.fechaRequerida': 'Elige una fecha y hora futura para programarlo.',
    'blg.fechaPasada': 'Esa fecha ya pasó: se publicará en cuanto guardes.',
    'blg.seProgramara': 'Se publicará solo el {f}.',
    'blg.publicadoFuturo': 'La fecha es futura: se mostrará a partir de ese momento.',
    'blg.publicadoAhora': 'Visible en el sitio al guardar.',
    'blg.miembrosAyuda': 'El público verá título, portada y extracto con una invitación a crear su cuenta.',
    'blg.portada': 'Portada',
    'blg.subirPortada': 'Subir portada 16:9',
    'blg.alt': 'Texto alternativo',
    'blg.altPh': 'Describe la imagen para lectores de pantalla',
    'blg.organizacion': 'Organización',
    'blg.etiquetas': 'Etiquetas',
    'blg.etiquetasAyuda': 'Separadas por comas (máximo 12).',
    'blg.autora': 'Autora',
    'blg.ctaFinal': 'Llamada a la acción final',
    'blg.ctaTipo': 'Tipo',
    'blg.cta.registro': 'Crea tu cuenta gratis',
    'blg.cta.consulta': 'Agenda tu consulta',
    'blg.cta.personalizado': 'Personalizada',
    'blg.cta.ninguno': 'Sin llamada a la acción',
    'blg.ctaTexto': 'Texto del botón (opcional)',
    'blg.ctaTextoPh': 'Usa el texto predeterminado',
    'blg.ctaBotonTexto': 'Texto del botón',
    'blg.videoUrl': 'Enlace de YouTube o Vimeo',
    'blg.videoInvalido': 'Pega un enlace de YouTube o Vimeo.',
    'blg.insertar': 'Insertar',
    'blg.errTitulo': 'Escribe un título para el artículo.',
    'blg.sinGuardar': 'Cambios sin guardar',
    'blg.guardadoS': 'Guardado hace {s} s',
    'blg.guardadoHace': 'Guardado {cuando}',
  },
  en: {
    'blg.menu': 'Blog',
    'blg.nuevo': 'New article',
    'blg.nuevoTitulo': 'Untitled article',
    'blg.sinTitulo': 'Untitled',
    'blg.buscar': 'Search by title, slug or tag',
    'blg.categoria': 'Category',
    'blg.categorias': 'Categories',
    'blg.todasCat': 'All categories',
    'blg.visibilidad': 'Visibility',
    'blg.todaVis': 'Any visibility',
    'blg.publico': 'Public',
    'blg.miembros': 'Members only',
    'blg.estado': 'Status',
    'blg.lecturas': 'Reads',
    'blg.e.borrador': 'Draft',
    'blg.e.programado': 'Scheduled',
    'blg.e.publicado': 'Published',
    'blg.e.archivado': 'Archived',
    'blg.e.papelera': 'In trash',
    'blg.conteo': '{n} articles',
    'blg.vacio': 'No articles yet. Create the first one and share it with your community.',
    'blg.sinFiltro': 'No articles match the filters.',
    'blg.seleccionar': 'Select “{t}”',
    'blg.seleccionarTodos': 'Select all visible',
    'blg.seleccionados': '{n} selected',
    'blg.limpiarSeleccion': 'Clear selection',
    'blg.masAcciones': 'More actions',
    'blg.vistaPrevia': 'Preview',
    'blg.duplicar': 'Duplicate',
    'blg.duplicado': 'Article duplicated as a draft',
    'blg.copia': 'copy',
    'blg.despublicar': 'Unpublish',
    'blg.destacar': 'Feature on the landing page',
    'blg.quitarDestacado': 'Remove feature',
    'blg.destacado': 'Featured',
    'blg.fijar': 'Pin to top',
    'blg.desfijar': 'Unpin',
    'blg.fijado': 'Pinned',
    'blg.archivar': 'Archive',
    'blg.fijadosT': 'Pinned and featured',
    'blg.fijadosAyuda': 'Pinned articles appear first on the blog and landing page, in this order. Drag or use the arrows.',
    'blg.destacadoActual': 'Current featured',
    'blg.sinDestacado': 'No featured article: the latest one is shown.',
    'blg.sinFijados': 'No pinned articles yet.',
    'blg.hecho.publicar': 'Articles published: {n}',
    'blg.hecho.despublicar': 'Articles unpublished: {n}',
    'blg.hecho.archivar': 'Articles archived: {n}',
    'blg.hecho.papelera': 'Moved to trash: {n}',
    'blg.hecho.restaurar': 'Articles restored: {n}',
    'blg.hecho.destacar': 'Article featured',
    'blg.hecho.quitarDestacado': 'Feature removed',
    'blg.hecho.fijar': 'Article pinned',
    'blg.hecho.desfijar': 'Article unpinned',
    'blg.hecho.publicado': 'Article published',
    'blg.hecho.programado': 'Article scheduled',
    'blg.masivaPapeleraT': 'Move {n} articles to the trash?',
    'blg.masivaPapeleraD': 'They will no longer show on the site. You can restore them from the trash.',
    'blg.borrarTitulo': 'Delete the article forever',
    'blg.borrarTexto': 'The article, its exclusive content and its history will be deleted. This cannot be undone.',
    'blg.errVista': 'I couldn’t open the preview in this browser.',
    'blg.catAyuda': 'Drag to reorder. Name changes are saved when you leave each field.',
    'blg.catNombre': 'Spanish name',
    'blg.catNombreEn': 'English name',
    'blg.catNueva': 'New category',
    'blg.catVacias': 'No saved categories yet; the site uses the 7 default ones.',
    'blg.catSembrar': 'Create the default categories',
    'blg.catBorrarT': 'Delete the “{c}” category?',
    'blg.catBorrarD': 'No articles use this category.',
    'blg.catBorrarUsada': '{n} articles use this category and will have no visible category until you assign another.',
    'blg.editando': 'Article editor · Ctrl/Cmd + S to save',
    'blg.secciones': 'Editor sections',
    'blg.tab.contenido': 'Content',
    'blg.tab.seo': 'SEO & social',
    'blg.tab.ingles': 'English',
    'blg.tab.historial': 'History',
    'blg.slug': 'Address (slug)',
    'blg.slugVacio': 'The slug can’t be empty.',
    'blg.slugRepetido': 'Another article already uses this slug. Change it so it is unique.',
    'blg.extracto': 'Excerpt',
    'blg.contenido': 'Content',
    'blg.contenidoPh': 'Write your article here. Use H2 and H3 for subheadings: they build the table of contents.',
    'blg.seoTitulo': 'SEO title',
    'blg.seoTituloPh': 'Leave empty to use the title',
    'blg.seoDesc': 'Meta description',
    'blg.seoDescPh': 'Leave empty to use the excerpt',
    'blg.seoSinDesc': 'Add an excerpt or meta description to improve your Google result.',
    'blg.ogImagen': 'Share image (1200×630)',
    'blg.ogAyuda': 'Optional. If you don’t upload one, the cover is used.',
    'blg.ogUsaPortada': 'The cover will be used',
    'blg.subirOg': 'Upload share image',
    'blg.vistaGoogle': 'How it looks on Google',
    'blg.vistaWhatsapp': 'How it looks on WhatsApp',
    'blg.waAviso': 'WhatsApp and Facebook previews work once the blog static pages are enabled (GitHub Action, see README).',
    'blg.inglesAyuda': 'Optional. If you fill in the English version, English readers will see it; otherwise they see the Spanish one.',
    'blg.historialAyuda': 'The last 10 versions are kept. Restoring loads the version into the editor; then save to apply it.',
    'blg.sinVersiones': 'No saved versions yet.',
    'blg.auto': 'autosave',
    'blg.restaurarVersionT': 'Restore this version?',
    'blg.restaurarVersionD': 'It replaces what you see in the editor. Nothing changes on the site until you save.',
    'blg.versionRestaurada': 'Version loaded into the editor. Save to apply it.',
    'blg.publicacion': 'Publishing',
    'blg.fechaHora': 'Publish date and time',
    'blg.fechaRequerida': 'Pick a future date and time to schedule it.',
    'blg.fechaPasada': 'That date has passed: it will be published as soon as you save.',
    'blg.seProgramara': 'It will publish automatically on {f}.',
    'blg.publicadoFuturo': 'The date is in the future: it will show from that moment.',
    'blg.publicadoAhora': 'Visible on the site when you save.',
    'blg.miembrosAyuda': 'The public will see the title, cover and excerpt with an invitation to create an account.',
    'blg.portada': 'Cover',
    'blg.subirPortada': 'Upload 16:9 cover',
    'blg.alt': 'Alt text',
    'blg.altPh': 'Describe the image for screen readers',
    'blg.organizacion': 'Organization',
    'blg.etiquetas': 'Tags',
    'blg.etiquetasAyuda': 'Comma separated (up to 12).',
    'blg.autora': 'Author',
    'blg.ctaFinal': 'Final call to action',
    'blg.ctaTipo': 'Type',
    'blg.cta.registro': 'Create your free account',
    'blg.cta.consulta': 'Book your consultation',
    'blg.cta.personalizado': 'Custom',
    'blg.cta.ninguno': 'No call to action',
    'blg.ctaTexto': 'Button text (optional)',
    'blg.ctaTextoPh': 'Use the default text',
    'blg.ctaBotonTexto': 'Button text',
    'blg.videoUrl': 'YouTube or Vimeo link',
    'blg.videoInvalido': 'Paste a YouTube or Vimeo link.',
    'blg.insertar': 'Insert',
    'blg.errTitulo': 'Write a title for the article.',
    'blg.sinGuardar': 'Unsaved changes',
    'blg.guardadoS': 'Saved {s}s ago',
    'blg.guardadoHace': 'Saved {cuando}',
  },
});
