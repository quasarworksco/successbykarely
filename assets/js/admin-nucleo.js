/* ==========================================================================
   Panel admin · Núcleo compartido por todos los módulos
   Estado, permisos por rol, registro de actividad, cajón, modal,
   confirmaciones, "Deshacer", librerías bajo demanda, recorte y reordenar.
   ========================================================================== */
import { $, $$, escaparHTML, toast, formatearFecha, aFecha, campo } from './util.js';
import { t, registrarTextos } from './i18n.js';

/* ---------- Estado global del panel ---------- */
export const estado = {
  fb: null,          // { auth, fa, db, fs }
  usuario: null,     // usuario de Auth
  admin: null,       // documento admins/{uid}
  idioma: 'es',
  admins: [],        // lista del equipo (solo owner la carga completa)
};

export const rol = () => estado.admin?.role || '';
export const puede = {
  staff: () => ['owner', 'staff'].includes(rol()),
  editor: () => ['owner', 'editor'].includes(rol()),
  owner: () => rol() === 'owner',
};
export const nombreAdmin = () => estado.admin?.name || estado.usuario?.displayName || estado.usuario?.email || '';

/* Accesos directos a Firestore */
export const fs = () => estado.fb.fs;
export const db = () => estado.fb.db;
export const ref = (...ruta) => estado.fb.fs.doc(estado.fb.db, ...ruta);
export const col = (...ruta) => estado.fb.fs.collection(estado.fb.db, ...ruta);
export const ahora = () => estado.fb.fs.serverTimestamp();

/* ---------- Registro de actividad (auditLog) ---------- */
export async function registrarActividad(action, collection, docId = '', summary = '') {
  try {
    await fs().addDoc(col('auditLog'), {
      uid: estado.usuario.uid,
      name: nombreAdmin().slice(0, 120),
      action,
      collection,
      docId: String(docId).slice(0, 200),
      summary: String(summary).slice(0, 300),
      createdAt: ahora(),
    });
  } catch (error) {
    console.warn('[actividad] No registrada:', error.message);
  }
}

/* ---------- Formatos ---------- */
export const fecha = (v, opciones) => formatearFecha(v, estado.idioma, opciones || { day: 'numeric', month: 'short', year: 'numeric' });
export const fechaHora = (v) => formatearFecha(v, estado.idioma, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export function relativo(v) {
  const d = aFecha(v);
  if (!d) return '';
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(estado.idioma === 'en' ? 'en' : 'es', { numeric: 'auto' });
  if (Math.abs(s) < 60) return rtf.format(-s, 'second');
  if (Math.abs(s) < 3600) return rtf.format(-Math.round(s / 60), 'minute');
  if (Math.abs(s) < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  if (Math.abs(s) < 86400 * 30) return rtf.format(-Math.round(s / 86400), 'day');
  return fecha(d);
}
export const ms = (v) => aFecha(v)?.getTime() || 0;
/* Campo traducible en el idioma activo del panel */
export const campoTexto = (obj, nombre) => campo(obj, nombre, estado.idioma);

export function slugificar(texto = '') {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}
export const idAleatorio = () => Math.random().toString(36).slice(2, 10);
export const esURLSegura = (url) => typeof url === 'string' && url.startsWith('https://');

/* Normaliza texto para búsquedas sin acentos */
export const normalizar = (s = '') => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* ---------- Cambios sin guardar ---------- */
let sucio = false;
export const marcarSucio = (valor = true) => { sucio = valor; };
export const haySinGuardar = () => sucio;
window.addEventListener('beforeunload', (e) => { if (sucio) { e.preventDefault(); e.returnValue = ''; } });
export function confirmarSalida() {
  if (!sucio) return true;
  const ok = window.confirm(t('adm.salirSinGuardar'));
  if (ok) sucio = false;
  return ok;
}

/* ---------- Cajón lateral ---------- */
let alCerrarCajon = null;
let focoAntesCajon = null;
export function abrirCajon({ titulo = '', subtitulo = '', html = '', ancho = 'normal', onCerrar = null } = {}) {
  const cont = $('#cajon-contenedor');
  focoAntesCajon = document.activeElement;
  $('#cajon-titulo').textContent = titulo;
  $('#cajon-subtitulo').textContent = subtitulo;
  const cuerpo = $('#cajon-cuerpo');
  cuerpo.innerHTML = html;
  cuerpo.scrollTop = 0;
  $('#cajon').dataset.ancho = ancho;
  alCerrarCajon = onCerrar;
  cont.hidden = false;
  requestAnimationFrame(() => cont.classList.add('abierto'));
  setTimeout(() => $('[data-cerrar-cajon].btn-icono', cont)?.focus(), 50);
  return cuerpo;
}
export function cerrarCajon(forzar = false) {
  const cont = $('#cajon-contenedor');
  if (cont.hidden) return true;
  if (!forzar && !confirmarSalida()) return false;
  marcarSucio(false);
  cont.classList.remove('abierto');
  setTimeout(() => { cont.hidden = true; $('#cajon-cuerpo').innerHTML = ''; }, 280);
  const fn = alCerrarCajon; alCerrarCajon = null;
  fn?.();
  focoAntesCajon?.focus?.();
  return true;
}
export const cajonAbierto = () => !$('#cajon-contenedor').hidden;
export function actualizarTituloCajon(titulo, subtitulo) {
  if (titulo !== undefined) $('#cajon-titulo').textContent = titulo;
  if (subtitulo !== undefined) $('#cajon-subtitulo').textContent = subtitulo;
}

/* ---------- Modal ---------- */
let resolverModal = null;
export function abrirModal({ titulo = '', html = '', acciones = [], ancho = '' } = {}) {
  const cont = $('#modal-contenedor');
  $('#modal-titulo').textContent = titulo;
  $('#modal-cuerpo').innerHTML = html;
  $('#modal').dataset.ancho = ancho;
  const zona = $('#modal-acciones');
  zona.innerHTML = '';
  acciones.forEach((a) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn btn-sm ${a.clase || 'btn-linea-app'}`;
    b.textContent = a.texto;
    if (a.id) b.id = a.id;
    b.addEventListener('click', () => a.fn?.());
    zona.append(b);
  });
  cont.hidden = false;
  setTimeout(() => ($('#modal-cuerpo input, #modal-cuerpo select, #modal-cuerpo textarea') || zona.lastElementChild)?.focus(), 30);
  return $('#modal-cuerpo');
}
export function cerrarModal(valor) {
  $('#modal-contenedor').hidden = true;
  $('#modal-cuerpo').innerHTML = '';
  const r = resolverModal; resolverModal = null;
  r?.(valor);
}
export const modalAbierto = () => !$('#modal-contenedor').hidden;

/**
 * Confirmación. Con `escribir`, pide teclear ese texto exacto (borrado definitivo).
 * @returns {Promise<boolean>}
 */
export function confirmar({ titulo, texto = '', boton = t('adm.confirmar'), peligro = false, escribir = '' }) {
  return new Promise((resolver) => {
    const html = `<p class="texto-suave-app">${escaparHTML(texto)}</p>
      ${escribir ? `<div class="campo" style="margin-top:14px"><label for="confirmar-texto">${escaparHTML(t('adm.escribeParaConfirmar', { texto: escribir }))}</label><input id="confirmar-texto" autocomplete="off"></div>` : ''}`;
    abrirModal({
      titulo,
      html,
      acciones: [
        { texto: t('adm.cancelar'), fn: () => cerrarModal(false) },
        { texto: boton, clase: peligro ? 'btn-peligro' : 'btn-principal', id: 'modal-ok', fn: () => { if (!escribir || $('#confirmar-texto').value.trim() === escribir.trim()) cerrarModal(true); } },
      ],
    });
    resolverModal = resolver;
    if (escribir) {
      const ok = $('#modal-ok');
      ok.disabled = true;
      $('#confirmar-texto').addEventListener('input', (e) => { ok.disabled = e.target.value.trim() !== escribir.trim(); });
    }
  });
}

/* Toast con "Deshacer" durante 6 segundos */
export function conDeshacer(mensaje, fnDeshacer) {
  toast(mensaje, { duracion: 6000, accion: { texto: t('adm.deshacer'), fn: fnDeshacer } });
}

/* ---------- Librerías bajo demanda (jsdelivr, versión fija) ---------- */
const LIBRERIAS = {
  chart: { js: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/+esm', exportar: (m) => { m.Chart.register(...m.registerables); return m.Chart; } },
  sortable: { js: 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.3/+esm', exportar: (m) => m.default },
  cropper: { js: 'https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/+esm', css: 'https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.min.css', exportar: (m) => m.default },
  quill: { js: 'https://cdn.jsdelivr.net/npm/quill@2.0.2/+esm', css: 'https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css', exportar: (m) => m.default },
};
const cargadas = {};
export function cargarLibreria(nombre) {
  const lib = LIBRERIAS[nombre];
  if (lib.css && !document.querySelector(`link[href="${lib.css}"]`)) {
    document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: lib.css }));
  }
  cargadas[nombre] ??= import(lib.js).then(lib.exportar).catch((error) => {
    delete cargadas[nombre];
    console.error(`[admin] No se pudo cargar ${nombre}:`, error);
    toast(t('adm.errLibreria'), { tipo: 'error' });
    throw error;
  });
  return cargadas[nombre];
}

/* ---------- Reordenar: arrastrar (SortableJS) + botones subir/bajar ---------- */
/**
 * @param {HTMLElement} lista contenedor cuyos hijos tienen data-id
 * @param {(ids: string[]) => Promise<void>|void} alCambiar recibe el nuevo orden
 */
export async function hacerOrdenable(lista, alCambiar) {
  const emitir = () => alCambiar($$(':scope > [data-id]', lista).map((el) => el.dataset.id));
  // Teclado / botones accesibles
  lista.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-mover]');
    if (!boton) return;
    const item = boton.closest('[data-id]');
    if (boton.dataset.mover === 'arriba' && item.previousElementSibling) item.previousElementSibling.before(item);
    else if (boton.dataset.mover === 'abajo' && item.nextElementSibling) item.nextElementSibling.after(item);
    else return;
    boton.focus();
    emitir();
  });
  try {
    const Sortable = await cargarLibreria('sortable');
    Sortable.create(lista, { handle: '.asa', animation: 180, ghostClass: 'arrastrando', onEnd: (ev) => { if (ev.oldIndex !== ev.newIndex) emitir(); } });
  } catch { /* sin arrastrar: quedan los botones */ }
}
export const botonesMover = () => `
  <span class="mover">
    <button type="button" class="btn-mini asa" aria-hidden="true" tabindex="-1" title="${escaparHTML(t('adm.arrastrar'))}"><svg viewBox="0 0 24 24"><path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/></svg></button>
    <button type="button" class="btn-mini" data-mover="arriba" aria-label="${escaparHTML(t('adm.subir'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg></button>
    <button type="button" class="btn-mini" data-mover="abajo" aria-label="${escaparHTML(t('adm.bajar'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
  </span>`;

/* Guarda el orden (campo order) de una colección en lote */
export async function guardarOrden(coleccion, ids) {
  const lote = fs().writeBatch(db());
  ids.forEach((id, i) => lote.update(ref(coleccion, id), { order: i }));
  await lote.commit();
  toast(t('adm.ordenGuardado'));
  registrarActividad('reordenar', coleccion, '', `${ids.length}`);
}

/* ---------- Recorte de imágenes (Cropper.js) ---------- */
/**
 * Abre un modal de recorte con la proporción indicada y devuelve un Blob.
 * @param {File} archivo
 * @param {{ratio?: number|null, anchoMax?: number, tipo?: string}} opciones
 * @returns {Promise<Blob|null>}
 */
export async function recortarImagen(archivo, { ratio = null, anchoMax = 1600, tipo = '' } = {}) {
  const Cropper = await cargarLibreria('cropper');
  const url = URL.createObjectURL(archivo);
  return new Promise((resolver) => {
    let cropper = null;
    const salida = tipo || (archivo.type === 'image/png' ? 'image/png' : 'image/jpeg');
    const terminar = (valor) => { cropper?.destroy(); URL.revokeObjectURL(url); cerrarModal(); resolver(valor); };
    abrirModal({
      titulo: t('adm.recortar'),
      ancho: 'grande',
      html: `<p class="texto-suave-app" style="margin-bottom:10px">${escaparHTML(t('adm.recortarAyuda'))}</p><div class="zona-recorte"><img id="img-recorte" src="${url}" alt=""></div>`,
      acciones: [
        { texto: t('adm.cancelar'), fn: () => terminar(null) },
        { texto: t('adm.usarImagen'), clase: 'btn-principal', fn: () => {
          const lienzo = cropper.getCroppedCanvas({ maxWidth: anchoMax, maxHeight: anchoMax * 2, imageSmoothingQuality: 'high' });
          lienzo.toBlob((blob) => terminar(blob), salida, 0.9);
        } },
      ],
    });
    const img = $('#img-recorte');
    img.addEventListener('load', () => {
      cropper = new Cropper(img, { aspectRatio: ratio || NaN, viewMode: 1, autoCropArea: 1, background: false, responsive: true });
    }, { once: true });
  });
}

/* ---------- Editor de texto enriquecido (Quill 2) ---------- */
export async function crearEditor(contenedor, { html = '', placeholder = '', imagenes = null, alCambiar = null } = {}) {
  const Quill = await cargarLibreria('quill');
  const barra = [
    [{ header: [2, 3, false] }],
    ['bold', 'italic', 'link'],
    [{ list: 'ordered' }, { list: 'bullet' }, 'blockquote'],
    imagenes ? ['image', 'video'] : ['video'],
    ['clean'],
  ];
  const editor = new Quill(contenedor, { theme: 'snow', placeholder, modules: { toolbar: { container: barra, handlers: imagenes ? { image: () => imagenes(editor) } : {} } } });
  if (html) editor.clipboard.dangerouslyPasteHTML(html);
  editor.on('text-change', () => alCambiar?.());
  return editor;
}

/* ---------- Piezas de interfaz reutilizables ---------- */
export const interruptor = (id, marcado, etiqueta) => `
  <label class="interruptor" for="${id}"><input type="checkbox" id="${id}"${marcado ? ' checked' : ''}><span class="interruptor-pista" aria-hidden="true"></span><span>${escaparHTML(etiqueta)}</span></label>`;

export const estadoVacio = (titulo, texto, icono = '') => `
  <div class="estado-vacio-app panel">
    <span class="vacio-icono" aria-hidden="true">${icono || '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>'}</span>
    <h2>${escaparHTML(titulo)}</h2><p>${escaparHTML(texto)}</p>
  </div>`;

export const esqueletoTabla = (filas = 6) => `<div class="panel">${Array.from({ length: filas }, () => '<div class="esqueleto-fila"></div>').join('')}</div>`;

export const ICONOS_ADMIN = {
  resumen: '<path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z"/>',
  clientes: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M16 14.2A5 5 0 0 1 21.5 19"/>',
  leads: '<path d="M4 4h16l-6 8v6l-4 2v-8Z"/>',
  mensajes: '<path d="M4 5h16v11H9l-5 4z"/>',
  cursos: '<path d="M2 9 12 4l10 5-10 5z"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5"/>',
  blog: '<path d="M5 4h11l3 3v13H5z"/><path d="M9 9h6M9 13h6M9 17h4"/>',
  testimonios: '<path d="M7 7h4v4H8a3 3 0 0 0 3 3v2a5 5 0 0 1-5-5V8a1 1 0 0 1 1-1ZM15 7h4v4h-3a3 3 0 0 0 3 3v2a5 5 0 0 1-5-5V8a1 1 0 0 1 1-1Z"/>',
  anuncios: '<path d="M4 10v4h3l6 4V6L7 10Z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
  imagenes: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>',
  exportar: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  equipo: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z"/><path d="m9 12 2 2 4-4"/>',
  actividad: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
export const icono = (nombre) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS_ADMIN[nombre] || ''}</svg>`;

/* ---------- Textos comunes del panel ---------- */
registrarTextos({
  es: {
    'adm.accesoTitulo': 'Panel de administración',
    'adm.accesoSub': 'Solo para el equipo de Success by Karely.',
    'adm.entrar': 'Entrar al panel',
    'adm.irPortal': '¿Eres cliente? Ve a tu espacio',
    'adm.sinAcceso': 'Esta cuenta no tiene acceso al panel.',
    'adm.verSitio': 'Ver el sitio',
    'adm.buscar': 'Buscar',
    'adm.buscarPh': 'Buscar clientes, leads, cursos…  ( / )',
    'adm.sinResultados': 'Sin resultados para “{q}”.',
    'adm.cerrar': 'Cerrar',
    'adm.guardar': 'Guardar',
    'adm.guardando': 'Guardando…',
    'adm.guardado': 'Cambios guardados',
    'adm.cancelar': 'Cancelar',
    'adm.confirmar': 'Confirmar',
    'adm.eliminar': 'Eliminar',
    'adm.eliminarDef': 'Eliminar definitivamente',
    'adm.papelera': 'Papelera',
    'adm.moverPapelera': 'Mover a papelera',
    'adm.movidoPapelera': 'Movido a la papelera',
    'adm.restaurar': 'Restaurar',
    'adm.restaurado': 'Restaurado',
    'adm.eliminado': 'Eliminado definitivamente',
    'adm.deshacer': 'Deshacer',
    'adm.deshecho': 'Cambio deshecho',
    'adm.editar': 'Editar',
    'adm.nuevo': 'Nuevo',
    'adm.crear': 'Crear',
    'adm.creado': 'Creado',
    'adm.publicado': 'Publicado',
    'adm.oculto': 'Oculto',
    'adm.publicar': 'Publicar',
    'adm.ocultar': 'Ocultar',
    'adm.subir': 'Subir',
    'adm.bajar': 'Bajar',
    'adm.arrastrar': 'Arrastra para reordenar',
    'adm.ordenGuardado': 'Orden guardado',
    'adm.escribeParaConfirmar': 'Escribe “{texto}” para confirmar',
    'adm.salirSinGuardar': 'Tienes cambios sin guardar. ¿Salir de todos modos?',
    'adm.errLibreria': 'No se pudo cargar una herramienta del panel. Revisa tu conexión.',
    'adm.errGuardar': 'No se pudo guardar. Revisa tu conexión o tus permisos.',
    'adm.errCargar': 'No se pudieron cargar los datos. Revisa tu conexión o tus permisos.',
    'adm.recortar': 'Recortar imagen',
    'adm.recortarAyuda': 'Ajusta el recuadro para elegir la parte de la imagen que se verá.',
    'adm.usarImagen': 'Usar imagen',
    'adm.subiendo': 'Subiendo… {p}%',
    'adm.errImagen': 'Elige una imagen JPG, PNG o WEBP de máximo 10 MB.',
    'adm.todos': 'Todos',
    'adm.todas': 'Todas',
    'adm.verPapelera': 'Ver papelera',
    'adm.verActivos': 'Ver activos',
    'adm.papeleraVacia': 'La papelera está vacía.',
    'adm.titulo': 'Título',
    'adm.descripcion': 'Descripción',
    'adm.foto': 'Foto',
    'adm.cambiarFoto': 'Cambiar foto',
    'adm.quitar': 'Quitar',
    'adm.enlace': 'Enlace',
    'adm.fecha': 'Fecha',
    'adm.acciones': 'Acciones',
    'adm.version': 'Versión en inglés (opcional)',
    'adm.caracteres': '{n}/{max}',
    'adm.rol.owner': 'Dueña',
    'adm.rol.staff': 'Staff',
    'adm.rol.editor': 'Editor',
  },
  en: {
    'adm.accesoTitulo': 'Admin panel',
    'adm.accesoSub': 'For the Success by Karely team only.',
    'adm.entrar': 'Enter the panel',
    'adm.irPortal': 'Are you a client? Go to your space',
    'adm.sinAcceso': 'This account doesn’t have access to the panel.',
    'adm.verSitio': 'View the site',
    'adm.buscar': 'Search',
    'adm.buscarPh': 'Search clients, leads, courses…  ( / )',
    'adm.sinResultados': 'No results for “{q}”.',
    'adm.cerrar': 'Close',
    'adm.guardar': 'Save',
    'adm.guardando': 'Saving…',
    'adm.guardado': 'Changes saved',
    'adm.cancelar': 'Cancel',
    'adm.confirmar': 'Confirm',
    'adm.eliminar': 'Delete',
    'adm.eliminarDef': 'Delete permanently',
    'adm.papelera': 'Trash',
    'adm.moverPapelera': 'Move to trash',
    'adm.movidoPapelera': 'Moved to trash',
    'adm.restaurar': 'Restore',
    'adm.restaurado': 'Restored',
    'adm.eliminado': 'Permanently deleted',
    'adm.deshacer': 'Undo',
    'adm.deshecho': 'Change undone',
    'adm.editar': 'Edit',
    'adm.nuevo': 'New',
    'adm.crear': 'Create',
    'adm.creado': 'Created',
    'adm.publicado': 'Published',
    'adm.oculto': 'Hidden',
    'adm.publicar': 'Publish',
    'adm.ocultar': 'Hide',
    'adm.subir': 'Move up',
    'adm.bajar': 'Move down',
    'adm.arrastrar': 'Drag to reorder',
    'adm.ordenGuardado': 'Order saved',
    'adm.escribeParaConfirmar': 'Type “{texto}” to confirm',
    'adm.salirSinGuardar': 'You have unsaved changes. Leave anyway?',
    'adm.errLibreria': 'A panel tool couldn’t load. Check your connection.',
    'adm.errGuardar': 'Couldn’t save. Check your connection or permissions.',
    'adm.errCargar': 'Couldn’t load the data. Check your connection or permissions.',
    'adm.recortar': 'Crop image',
    'adm.recortarAyuda': 'Adjust the frame to choose the part of the image that will show.',
    'adm.usarImagen': 'Use image',
    'adm.subiendo': 'Uploading… {p}%',
    'adm.errImagen': 'Choose a JPG, PNG or WEBP image up to 10 MB.',
    'adm.todos': 'All',
    'adm.todas': 'All',
    'adm.verPapelera': 'View trash',
    'adm.verActivos': 'View active',
    'adm.papeleraVacia': 'The trash is empty.',
    'adm.titulo': 'Title',
    'adm.descripcion': 'Description',
    'adm.foto': 'Photo',
    'adm.cambiarFoto': 'Change photo',
    'adm.quitar': 'Remove',
    'adm.enlace': 'Link',
    'adm.fecha': 'Date',
    'adm.acciones': 'Actions',
    'adm.version': 'English version (optional)',
    'adm.caracteres': '{n}/{max}',
    'adm.rol.owner': 'Owner',
    'adm.rol.staff': 'Staff',
    'adm.rol.editor': 'Editor',
  },
});
