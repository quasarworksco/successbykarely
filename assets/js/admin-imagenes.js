/* ==========================================================================
   Panel admin · Imágenes del sitio
   Un espacio por cada entrada de ESPACIOS_IMAGEN: estado, subida con recorte
   guiado, texto alternativo ES/EN, reemplazar, quitar, restaurar la anterior,
   vista previa y galerías con reordenar. Favicon y og-image: descarga lista.
   ========================================================================== */
import { ESPACIOS_IMAGEN, CONFIG } from './config.js';
import { $, $$, escaparHTML, toast, subirACloudinary, cloudinaryConfigurado, urlCloudinary } from './util.js';
import { t, registrarTextos } from './i18n.js';
import {
  estado, fs, col, ref, ahora, registrarActividad, relativo, nombreAdmin,
  abrirCajon, abrirModal, cerrarModal, confirmar, conDeshacer, hacerOrdenable, botonesMover, recortarImagen, esURLSegura,
} from './admin-nucleo.js';

let medios = {};
let galerias = {};
let vistaActual = null;

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', svg: 'image/svg+xml' };
const aceptar = (e) => e.formatos.map((f) => MIME[f]).filter(Boolean).join(',');

async function cargar() {
  const snap = await fs().getDocs(col('siteMedia'));
  medios = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
  await Promise.all(ESPACIOS_IMAGEN.filter((e) => e.galeria).map(async (e) => {
    const s = await fs().getDocs(col('siteMedia', e.id, 'items')).catch(() => ({ docs: [] }));
    galerias[e.id] = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }));
  try { sessionStorage.removeItem('sbk-medios-v1'); } catch { /* sin almacenamiento */ }
}

const lista = (e) => (e.galeria ? (galerias[e.id] || []).length > 0 : Boolean(medios[e.id]?.url));

function tarjeta(e) {
  const m = medios[e.id];
  const ok = lista(e);
  const vista = e.galeria
    ? `<div class="espacio-vista galeria-vista">${(galerias[e.id] || []).slice(0, 4).map((i) => `<img src="${escaparHTML(urlCloudinary(i.url, 'f_auto,q_auto,c_fill,w_200,h_200'))}" alt="">`).join('') || '<span class="marcador"><span class="marcador-k">K</span></span>'}</div>`
    : `<div class="espacio-vista"><div class="espacio-marco" style="--r:${Number(e.ratio) || 1}">${ok ? `<img src="${escaparHTML(urlCloudinary(m.url, 'f_auto,q_auto,c_limit,w_600'))}" alt="${escaparHTML(m.alt_es || '')}">` : '<span class="marcador"><span class="marcador-k">K</span></span>'}</div></div>`;
  return `
    <article class="panel tarjeta-espacio" data-espacio-admin="${e.id}">
      ${vista}
      <div class="espacio-info">
        <div class="espacio-cabecera">
          <h3>${escaparHTML(e.nombre)}</h3>
          <span class="estado-espacio ${ok ? 'lista' : 'pendiente'}">${escaparHTML(ok ? t('img.lista') : (e.obligatorio ? t('img.pendiente') : t('img.opcional')))}</span>
        </div>
        <p class="texto-suave-app">${escaparHTML(e.donde)}</p>
        <p class="espacio-medidas">${escaparHTML(e.galeria ? t('img.galeriaMedidas', { w: e.ancho, h: e.alto }) : t('img.medidas', { w: e.ancho, h: e.alto, p: e.proporcion }))} · ${escaparHTML(e.formatos.join(', ').toUpperCase())}</p>
        ${!e.galeria && m?.updatedAt ? `<p class="texto-suave-app espacio-fecha">${escaparHTML(m.updatedBy ? t('img.actualizada', { cuando: relativo(m.updatedAt), quien: m.updatedBy }) : t('img.actualizadaSin', { cuando: relativo(m.updatedAt) }))}</p>` : ''}
        <div class="espacio-acciones">
          ${e.galeria
            ? `<button type="button" class="btn btn-suave btn-sm" data-galeria="${e.id}">${escaparHTML(t('img.gestionar'))}</button>`
            : `<label class="btn btn-suave btn-sm">${escaparHTML(ok ? t('img.reemplazar') : t('img.subir'))}<input type="file" accept="${aceptar(e)}" data-subir="${e.id}" hidden></label>
               ${ok ? `<button type="button" class="btn btn-linea-app btn-sm" data-editar="${e.id}">${escaparHTML(t('img.textoAlt'))}</button>
               <button type="button" class="btn btn-linea-app btn-sm" data-previa="${e.id}">${escaparHTML(t('img.vistaPrevia'))}</button>
               <button type="button" class="btn btn-sm btn-peligro-suave" data-quitar="${e.id}">${escaparHTML(t('adm.quitar'))}</button>` : ''}
               ${m?.previous?.url ? `<button type="button" class="btn btn-linea-app btn-sm" data-anterior="${e.id}">${escaparHTML(t('img.restaurarAnterior'))}</button>` : ''}`}
        </div>
      </div>
    </article>`;
}

function pintar() {
  const zona = $('#rejilla-espacios');
  if (!zona) return;
  const pendientes = ESPACIOS_IMAGEN.filter((e) => e.obligatorio && !lista(e)).length;
  $('#resumen-imagenes').textContent = pendientes ? t('img.faltan', { n: pendientes }) : t('img.completas');
  zona.innerHTML = ESPACIOS_IMAGEN.map(tarjeta).join('');
}

/* ---------- Subir / reemplazar ---------- */
async function prepararArchivo(e, archivo) {
  const ext = archivo.type === 'image/svg+xml' ? 'svg' : (archivo.type.split('/')[1] || '').replace('jpeg', 'jpg');
  if (!e.formatos.includes(ext) || archivo.size > CONFIG.cloudinary.maxBytes) {
    toast(t('img.errFormato', { formatos: e.formatos.join(', ').toUpperCase() }), { tipo: 'error', duracion: 6000 });
    return null;
  }
  if (ext === 'svg') return archivo; // los SVG no se recortan
  const tipoSalida = ['png', 'webp'].includes(ext) && e.formatos.includes('png') ? 'image/png' : 'image/jpeg';
  return recortarImagen(archivo, { ratio: e.ratio, anchoMax: Math.max(e.ancho, 600), tipo: tipoSalida });
}

async function subir(e, archivo) {
  if (!cloudinaryConfigurado()) { toast(t('docs.sinConfig'), { tipo: 'info' }); return; }
  const blob = await prepararArchivo(e, archivo);
  if (!blob) return;
  const tarjetaEl = $(`[data-espacio-admin="${e.id}"]`);
  tarjetaEl.classList.add('subiendo');
  tarjetaEl.dataset.progreso = '0%';
  try {
    const r = await subirACloudinary(blob, { carpeta: 'sitio', tipo: 'image', onProgreso: (p) => { tarjetaEl.dataset.progreso = `${p}%`; } });
    const anterior = medios[e.id]?.url ? { url: medios[e.id].url, publicId: medios[e.id].publicId || '', width: medios[e.id].width || 0, height: medios[e.id].height || 0, format: medios[e.id].format || '' } : null;
    const datos = {
      url: r.url, publicId: r.publicId, width: r.width || 0, height: r.height || 0, format: r.format || '',
      alt_es: medios[e.id]?.alt_es || '', alt_en: medios[e.id]?.alt_en || '',
      previous: anterior, updatedAt: ahora(), updatedBy: nombreAdmin(),
    };
    await fs().setDoc(ref('siteMedia', e.id), datos);
    medios[e.id] = { ...datos, updatedAt: new Date() };
    registrarActividad(anterior ? 'reemplazar' : 'subir', 'siteMedia', e.id, e.nombre);
    toast(t('img.subida'));
    pintar();
    if (!datos.alt_es) editarAlt(e.id, true);
    if (['favicon', 'og_imagen'].includes(e.id)) mostrarDescarga(e);
  } catch (error) {
    console.error(error);
    toast(t('docs.errSubida', { nombre: archivo.name }), { tipo: 'error' });
  } finally {
    tarjetaEl?.classList.remove('subiendo');
  }
}

/* Favicon y og-image: los buscadores y redes no ejecutan JavaScript */
function mostrarDescarga(e) {
  const m = medios[e.id];
  const og = e.id === 'og_imagen';
  const url = urlCloudinary(m.url, og ? 'c_fill,g_auto,w_1200,h_630,f_jpg,q_85' : 'c_fill,w_512,h_512,f_png');
  const nombre = og ? 'og-image.jpg' : 'favicon.png';
  abrirModal({
    titulo: t('img.copiaEstatica'),
    html: `
      <p>${escaparHTML(t('img.copiaEstaticaD'))}</p>
      <ol class="pasos-lista">
        <li>${escaparHTML(t('img.paso1', { nombre }))}</li>
        <li>${escaparHTML(t('img.paso2', { nombre }))}</li>
        ${og ? '' : `<li>${escaparHTML(t('img.paso3'))}</li>`}
        <li>${escaparHTML(t('img.paso4'))}</li>
      </ol>
      <p><a class="btn btn-principal btn-sm" href="${escaparHTML(url)}" download="${nombre}" target="_blank" rel="noopener">${escaparHTML(t('img.descargar', { nombre }))}</a></p>`,
    acciones: [{ texto: t('adm.cerrar'), fn: () => cerrarModal() }],
  });
}

/* ---------- Texto alternativo ---------- */
function editarAlt(id, tras = false) {
  const e = ESPACIOS_IMAGEN.find((x) => x.id === id);
  const m = medios[id];
  abrirModal({
    titulo: t('img.textoAltTitulo', { nombre: e.nombre }),
    html: `
      ${tras ? `<p class="texto-suave-app">${escaparHTML(t('img.textoAltAyuda'))}</p>` : ''}
      <div class="formulario form-app">
        <div class="campo"><label for="alt-es">${escaparHTML(t('img.altEs'))}</label><input id="alt-es" maxlength="160" value="${escaparHTML(m.alt_es || '')}" placeholder="${escaparHTML(t('img.altPh'))}"></div>
        <div class="campo"><label for="alt-en">${escaparHTML(t('img.altEn'))}</label><input id="alt-en" maxlength="160" value="${escaparHTML(m.alt_en || '')}"></div>
      </div>`,
    acciones: [
      { texto: t('adm.cancelar'), fn: () => cerrarModal() },
      { texto: t('adm.guardar'), clase: 'btn-principal', fn: async () => {
        const datos = { alt_es: $('#alt-es').value.trim(), alt_en: $('#alt-en').value.trim(), updatedAt: ahora(), updatedBy: nombreAdmin() };
        try {
          await fs().updateDoc(ref('siteMedia', id), datos);
          Object.assign(m, datos, { updatedAt: new Date() });
          toast(t('adm.guardado'));
          cerrarModal();
          pintar();
        } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
      } },
    ],
  });
}

/* ---------- Vista previa "así se verá" ---------- */
function vistaPrevia(id) {
  const e = ESPACIOS_IMAGEN.find((x) => x.id === id);
  const m = medios[id];
  const src = urlCloudinary(m.url, 'f_auto,q_auto,c_limit,w_900');
  const escenas = {
    monograma: `<div class="previa-nav"><span class="monograma"><img src="${escaparHTML(src)}" alt=""></span><span class="marca-texto">Success <em>by</em> Karely</span></div>`,
    logo_completo: `<div class="previa-pie"><img src="${escaparHTML(src)}" alt="" style="width:150px"><p>Engineering Success in the USA™</p></div>`,
    retrato_karely: `<div class="previa-retrato"><figure class="retrato-marco glass-claro filo-oro"><div class="retrato" style="aspect-ratio:4/5"><img class="media-img" style="opacity:1" src="${escaparHTML(src)}" alt=""></div><figcaption class="retrato-pie"><span class="retrato-nombre">Karely Paredes</span><span>Immigrant systems architect</span></figcaption></figure></div>`,
    og_imagen: `<div class="previa-whatsapp"><img src="${escaparHTML(src)}" alt=""><strong>Karely Paredes | Success by Karely</strong><span>successbykarely.dgp-link.com</span></div>`,
    favicon: `<div class="previa-pestana"><img src="${escaparHTML(src)}" alt=""><span>Karely Paredes | Success by Karely</span></div>`,
  };
  abrirModal({
    titulo: t('img.asiSeVera'),
    ancho: 'grande',
    html: `<p class="texto-suave-app">${escaparHTML(e.donde)}</p><div class="escena-previa">${escenas[id] || `<div class="previa-generica" style="aspect-ratio:${e.ratio || 1}"><img src="${escaparHTML(src)}" alt=""></div>`}</div>`,
    acciones: [{ texto: t('adm.cerrar'), fn: () => cerrarModal() }],
  });
}

/* ---------- Quitar y restaurar ---------- */
async function quitar(id) {
  const e = ESPACIOS_IMAGEN.find((x) => x.id === id);
  const ok = await confirmar({ titulo: t('img.quitarTitulo'), texto: t('img.quitarTexto'), boton: t('adm.quitar'), peligro: true });
  if (!ok) return;
  const actual = medios[id];
  const datos = {
    url: '', publicId: '', width: 0, height: 0, format: '', alt_es: actual.alt_es || '', alt_en: actual.alt_en || '',
    previous: { url: actual.url, publicId: actual.publicId || '', width: actual.width || 0, height: actual.height || 0, format: actual.format || '' },
    updatedAt: ahora(), updatedBy: nombreAdmin(),
  };
  try {
    await fs().setDoc(ref('siteMedia', id), datos);
    medios[id] = { ...datos, updatedAt: new Date() };
    registrarActividad('quitar', 'siteMedia', id, e.nombre);
    pintar();
    conDeshacer(t('img.quitada'), () => restaurarAnterior(id, true));
  } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
}

async function restaurarAnterior(id, silencioso = false) {
  const m = medios[id];
  const prev = m.previous;
  if (!prev?.url) return;
  const datos = {
    ...prev, alt_es: m.alt_es || '', alt_en: m.alt_en || '',
    previous: m.url ? { url: m.url, publicId: m.publicId || '', width: m.width || 0, height: m.height || 0, format: m.format || '' } : null,
    updatedAt: ahora(), updatedBy: nombreAdmin(),
  };
  try {
    await fs().setDoc(ref('siteMedia', id), datos);
    medios[id] = { ...datos, updatedAt: new Date() };
    registrarActividad('restaurar', 'siteMedia', id, '');
    toast(t(silencioso ? 'adm.deshecho' : 'img.restaurada'));
    pintar();
  } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
}

/* ---------- Galerías ---------- */
function abrirGaleria(id) {
  const e = ESPACIOS_IMAGEN.find((x) => x.id === id);
  const cuerpo = abrirCajon({
    titulo: e.nombre,
    subtitulo: e.donde,
    html: `
      <label class="zona-subida zona-compacta">
        <input type="file" accept="${aceptar(e)}" multiple id="subir-galeria">
        <strong>${escaparHTML(t('img.agregarFotos'))}</strong>
        <span class="texto-suave-app">${escaparHTML(t('img.galeriaMedidas', { w: e.ancho, h: e.alto }))}</span>
      </label>
      <p class="texto-suave-app" id="progreso-galeria" hidden></p>
      <ul class="lista-contenido lista-galeria" id="items-galeria"></ul>`,
  });
  const pintarItems = () => {
    const items = galerias[id] || [];
    $('#items-galeria').innerHTML = items.length ? items.map((i) => `
      <li class="fila-contenido" data-id="${escaparHTML(i.id)}">
        ${botonesMover()}
        <span class="miniatura"><img src="${escaparHTML(urlCloudinary(i.url, 'f_auto,q_auto,c_fill,w_160,h_120'))}" alt=""></span>
        <div class="fila-texto campos-alt">
          <input data-alt="es" maxlength="160" value="${escaparHTML(i.alt_es || '')}" placeholder="${escaparHTML(t('img.altEs'))}" aria-label="${escaparHTML(t('img.altEs'))}">
          <input data-alt="en" maxlength="160" value="${escaparHTML(i.alt_en || '')}" placeholder="${escaparHTML(t('img.altEn'))}" aria-label="${escaparHTML(t('img.altEn'))}">
          ${id === 'logos_prensa' ? `<input data-alt="link" type="url" maxlength="300" value="${escaparHTML(i.link || '')}" placeholder="${escaparHTML(t('img.enlaceMedio'))}" aria-label="${escaparHTML(t('img.enlaceMedio'))}">` : ''}
        </div>
        <button type="button" class="btn-mini" data-quitar-item aria-label="${escaparHTML(t('adm.quitar'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>
      </li>`).join('') : `<li class="lista-vacia">${escaparHTML(t('img.galeriaVacia'))}</li>`;
  };
  pintarItems();
  const listaEl = $('#items-galeria');
  hacerOrdenable(listaEl, async (ids) => {
    galerias[id].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    const lote = fs().writeBatch(estado.fb.db);
    ids.forEach((iid, n) => lote.update(ref('siteMedia', id, 'items', iid), { order: n }));
    await lote.commit().then(() => toast(t('adm.ordenGuardado'))).catch(() => toast(t('adm.errGuardar'), { tipo: 'error' }));
  });
  listaEl.addEventListener('change', async (ev) => {
    const input = ev.target.closest('[data-alt]');
    if (!input) return;
    const iid = input.closest('[data-id]').dataset.id;
    const campo = input.dataset.alt === 'link' ? 'link' : `alt_${input.dataset.alt}`;
    const valor = input.value.trim();
    if (campo === 'link' && valor && !esURLSegura(valor)) { input.setAttribute('aria-invalid', 'true'); return; }
    input.removeAttribute('aria-invalid');
    try {
      await fs().updateDoc(ref('siteMedia', id, 'items', iid), { [campo]: valor });
      galerias[id].find((x) => x.id === iid)[campo] = valor;
      toast(t('adm.guardado'));
    } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
  });
  listaEl.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-quitar-item]');
    if (!b) return;
    const iid = b.closest('[data-id]').dataset.id;
    const item = galerias[id].find((x) => x.id === iid);
    try {
      await fs().deleteDoc(ref('siteMedia', id, 'items', iid));
      galerias[id] = galerias[id].filter((x) => x.id !== iid);
      pintarItems(); pintar();
      registrarActividad('quitar', 'siteMedia', `${id}/${iid}`, e.nombre);
      conDeshacer(t('img.quitada'), async () => {
        const { id: _, ...datos } = item;
        await fs().setDoc(ref('siteMedia', id, 'items', iid), datos);
        galerias[id].push(item);
        galerias[id].sort((a, c) => (a.order ?? 999) - (c.order ?? 999));
        pintarItems(); pintar();
        toast(t('adm.deshecho'));
      });
    } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
  });
  $('#subir-galeria', cuerpo).addEventListener('change', async (ev) => {
    const archivos = [...ev.target.files];
    ev.target.value = '';
    if (!cloudinaryConfigurado()) { toast(t('docs.sinConfig'), { tipo: 'info' }); return; }
    const aviso = $('#progreso-galeria');
    for (const archivo of archivos) {
      const blob = await prepararArchivo(e, archivo);
      if (!blob) continue;
      aviso.hidden = false;
      try {
        const r = await subirACloudinary(blob, { carpeta: `sitio/${id}`, tipo: 'image', onProgreso: (p) => { aviso.textContent = `${archivo.name} · ${t('adm.subiendo', { p })}`; } });
        const datos = { url: r.url, publicId: r.publicId, alt_es: '', alt_en: '', order: (galerias[id] || []).length, createdAt: ahora() };
        const nuevo = await fs().addDoc(col('siteMedia', id, 'items'), datos);
        (galerias[id] ||= []).push({ id: nuevo.id, ...datos });
        registrarActividad('subir', 'siteMedia', `${id}/${nuevo.id}`, e.nombre);
        pintarItems(); pintar();
      } catch { toast(t('docs.errSubida', { nombre: archivo.name }), { tipo: 'error' }); }
    }
    aviso.hidden = true;
  });
}

async function montar(vista) {
  vistaActual = vista;
  vista.innerHTML = `
    <div class="barra-herramientas"><p id="resumen-imagenes" class="texto-suave-app"></p></div>
    <div class="rejilla-espacios" id="rejilla-espacios">${'<div class="esqueleto-app"></div>'.repeat(4)}</div>`;
  try { await cargar(); } catch (error) { console.error(error); toast(t('adm.errCargar'), { tipo: 'error' }); }
  pintar();
  const zona = $('#rejilla-espacios');
  zona.addEventListener('change', (ev) => {
    const input = ev.target.closest('[data-subir]');
    if (!input?.files[0]) return;
    const archivo = input.files[0];
    input.value = '';
    subir(ESPACIOS_IMAGEN.find((x) => x.id === input.dataset.subir), archivo);
  });
  zona.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.editar) editarAlt(b.dataset.editar);
    if (b.dataset.previa) vistaPrevia(b.dataset.previa);
    if (b.dataset.quitar) quitar(b.dataset.quitar);
    if (b.dataset.anterior) restaurarAnterior(b.dataset.anterior);
    if (b.dataset.galeria) abrirGaleria(b.dataset.galeria);
  });
  // Arrastrar y soltar sobre la tarjeta de un espacio
  zona.addEventListener('dragover', (ev) => { const c = ev.target.closest('[data-espacio-admin]'); if (c) { ev.preventDefault(); c.classList.add('arrastrando'); } });
  zona.addEventListener('dragleave', (ev) => ev.target.closest('[data-espacio-admin]')?.classList.remove('arrastrando'));
  zona.addEventListener('drop', (ev) => {
    const c = ev.target.closest('[data-espacio-admin]');
    if (!c) return;
    ev.preventDefault();
    c.classList.remove('arrastrando');
    const e = ESPACIOS_IMAGEN.find((x) => x.id === c.dataset.espacioAdmin);
    const archivo = ev.dataTransfer.files[0];
    if (!archivo) return;
    if (e.galeria) abrirGaleria(e.id); else subir(e, archivo);
  });
}

export default {
  id: 'imagenes',
  icono: 'imagenes',
  clave: 'img.menu',
  acceso: 'editor',
  montar,
  repintar: () => { if (vistaActual) montar(vistaActual); },
};

registrarTextos({
  es: {
    'img.menu': 'Imágenes del sitio',
    'img.faltan': 'Faltan {n} imágenes obligatorias. Mientras tanto, el sitio muestra marcadores elegantes con tu monograma.',
    'img.completas': 'Todas las imágenes obligatorias están listas.',
    'img.lista': 'Lista',
    'img.pendiente': 'Pendiente',
    'img.opcional': 'Opcional',
    'img.medidas': 'Recomendado: {w}×{h} px ({p})',
    'img.galeriaMedidas': 'Recomendado: {w}×{h} px por imagen',
    'img.actualizada': 'Actualizada {cuando} por {quien}',
    'img.actualizadaSin': 'Actualizada {cuando}',
    'img.subir': 'Subir imagen',
    'img.reemplazar': 'Reemplazar',
    'img.gestionar': 'Gestionar galería',
    'img.textoAlt': 'Texto alternativo',
    'img.textoAltTitulo': 'Texto alternativo · {nombre}',
    'img.textoAltAyuda': 'Describe la imagen en una frase. Ayuda a personas con lectores de pantalla y a Google.',
    'img.altEs': 'Descripción en español',
    'img.altEn': 'Descripción en inglés',
    'img.altPh': 'Ej.: Karely Paredes sonriendo en su oficina de Houston',
    'img.vistaPrevia': 'Vista previa',
    'img.asiSeVera': 'Así se verá',
    'img.restaurarAnterior': 'Restaurar anterior',
    'img.restaurada': 'Imagen anterior restaurada',
    'img.subida': 'Imagen actualizada',
    'img.quitada': 'Imagen quitada',
    'img.quitarTitulo': 'Quitar esta imagen',
    'img.quitarTexto': 'El sitio volverá a mostrar el marcador elegante. Podrás restaurarla después.',
    'img.errFormato': 'Formato o tamaño no válido. Usa {formatos}, máximo 10 MB.',
    'img.agregarFotos': 'Agregar imágenes',
    'img.galeriaVacia': 'Esta galería está vacía. Es opcional: si no subes nada, la sección no se muestra.',
    'img.enlaceMedio': 'Enlace al artículo del medio (opcional)',
    'img.copiaEstatica': 'Un paso más para redes y buscadores',
    'img.copiaEstaticaD': 'WhatsApp, Facebook y Google no ejecutan JavaScript, así que también necesitan una copia fija del archivo en el repositorio.',
    'img.paso1': 'Descarga el archivo listo con el botón de abajo ({nombre}).',
    'img.paso2': 'En GitHub, entra a la carpeta assets/img y usa "Add file → Upload files" para reemplazar {nombre}.',
    'img.paso3': 'Haz lo mismo con favicon-32.png y apple-touch-icon.png si quieres (versiones pequeñas).',
    'img.paso4': 'Confirma con "Commit changes". En unos minutos GitHub Pages lo publica.',
    'img.descargar': 'Descargar {nombre}',
  },
  en: {
    'img.menu': 'Site images',
    'img.faltan': '{n} required images are missing. Meanwhile, the site shows elegant placeholders with your monogram.',
    'img.completas': 'All required images are ready.',
    'img.lista': 'Ready',
    'img.pendiente': 'Missing',
    'img.opcional': 'Optional',
    'img.medidas': 'Recommended: {w}×{h} px ({p})',
    'img.galeriaMedidas': 'Recommended: {w}×{h} px per image',
    'img.actualizada': 'Updated {cuando} by {quien}',
    'img.actualizadaSin': 'Updated {cuando}',
    'img.subir': 'Upload image',
    'img.reemplazar': 'Replace',
    'img.gestionar': 'Manage gallery',
    'img.textoAlt': 'Alt text',
    'img.textoAltTitulo': 'Alt text · {nombre}',
    'img.textoAltAyuda': 'Describe the image in one sentence. It helps screen reader users and Google.',
    'img.altEs': 'Description in Spanish',
    'img.altEn': 'Description in English',
    'img.altPh': 'E.g.: Karely Paredes smiling in her Houston office',
    'img.vistaPrevia': 'Preview',
    'img.asiSeVera': 'How it will look',
    'img.restaurarAnterior': 'Restore previous',
    'img.restaurada': 'Previous image restored',
    'img.subida': 'Image updated',
    'img.quitada': 'Image removed',
    'img.quitarTitulo': 'Remove this image',
    'img.quitarTexto': 'The site will show the elegant placeholder again. You can restore it later.',
    'img.errFormato': 'Invalid format or size. Use {formatos}, up to 10 MB.',
    'img.agregarFotos': 'Add images',
    'img.galeriaVacia': 'This gallery is empty. It’s optional: if you don’t upload anything, the section stays hidden.',
    'img.enlaceMedio': 'Link to the media article (optional)',
    'img.copiaEstatica': 'One more step for social networks and search engines',
    'img.copiaEstaticaD': 'WhatsApp, Facebook and Google don’t run JavaScript, so they also need a fixed copy of the file in the repository.',
    'img.paso1': 'Download the ready file with the button below ({nombre}).',
    'img.paso2': 'On GitHub, open the assets/img folder and use "Add file → Upload files" to replace {nombre}.',
    'img.paso3': 'Do the same with favicon-32.png and apple-touch-icon.png if you want (smaller versions).',
    'img.paso4': 'Confirm with "Commit changes". GitHub Pages publishes it within minutes.',
    'img.descargar': 'Download {nombre}',
  },
});
