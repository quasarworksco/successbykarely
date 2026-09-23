/* ==========================================================================
   Portal · Documentos (Fase 4)
   Subida a Cloudinary (clientes/{uid}/documentos) con progreso y registro en
   users/{uid}/documents. El cliente no puede cambiar status ni adminComment.
   ========================================================================== */
import { CONFIG } from './config.js';
import {
  $, escaparHTML, toast, formatearFecha, subirACloudinary, cloudinaryConfigurado,
  TIPOS_DOCUMENTO, tamanoLegible, avisarAppsScript,
} from './util.js';
import { t } from './i18n.js';

let ctx = null;
let documentos = [];
let desuscribir = null;

const EXTENSIONES = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'docx'];
const ICONO_DOC = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/></svg>';
const ICONO_IMG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/></svg>';

function extension(nombre = '') { return nombre.split('.').pop().toLowerCase(); }

/* Escucha en tiempo real los documentos del cliente */
export function escucharDocumentos() {
  const { fb, usuario } = ctx;
  if (!fb || !usuario || desuscribir) return;
  const { fs, db } = fb;
  desuscribir = fs.onSnapshot(fs.collection(db, 'users', usuario.uid, 'documents'), (snap) => {
    documentos = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    pintarDocumentos();
  }, (error) => console.warn('[documentos] Escucha detenida:', error.message));
}

export function detenerDocumentos() {
  desuscribir?.();
  desuscribir = null;
  documentos = [];
}

function itemDocumento(d) {
  const esImagen = ['jpg', 'jpeg', 'png', 'webp'].includes(String(d.format).toLowerCase());
  const estado = ['recibido', 'revision', 'aprobado', 'correccion'].includes(d.status) ? d.status : 'recibido';
  const url = typeof d.url === 'string' && d.url.startsWith('https://') ? d.url : '';
  return `
    <li class="documento">
      <span class="doc-icono">${esImagen ? ICONO_IMG : ICONO_DOC}</span>
      <div class="doc-info">
        <strong>${escaparHTML(d.name || '')}</strong>
        <span class="texto-suave-app">${escaparHTML([String(d.format || '').toUpperCase(), d.bytes ? tamanoLegible(d.bytes) : '', formatearFecha(d.createdAt, ctx.idioma, { day: 'numeric', month: 'short', year: 'numeric' })].filter(Boolean).join(' · '))}</span>
        ${d.adminComment ? `<p class="doc-comentario"><b>${escaparHTML(t('docs.comentario'))}:</b> ${escaparHTML(d.adminComment)}</p>` : ''}
      </div>
      ${d.uploadedBy === 'admin' ? '' : `<span class="estado-doc estado-${estado}">${escaparHTML(t(`docs.estado.${estado}`))}</span>`}
      ${url ? `<a class="btn btn-linea-app btn-sm" href="${escaparHTML(url)}" target="_blank" rel="noopener">${escaparHTML(t('docs.abrir'))}</a>` : ''}
    </li>`;
}

export function pintarDocumentos() {
  const propios = documentos.filter((d) => d.uploadedBy !== 'admin');
  const equipo = documentos.filter((d) => d.uploadedBy === 'admin');
  const listaCliente = $('#docs-cliente');
  const listaEquipo = $('#docs-equipo');
  if (!listaCliente) return;
  listaCliente.innerHTML = propios.length ? propios.map(itemDocumento).join('')
    : `<li class="doc-vacio"><strong>${escaparHTML(t('vac.docsT'))}</strong><span>${escaparHTML(t('vac.docsD2'))}</span></li>`;
  listaEquipo.innerHTML = equipo.length ? equipo.map(itemDocumento).join('')
    : `<li class="doc-vacio"><span>${escaparHTML(t('docs.equipoVacio'))}</span></li>`;
}

/* ---------- Subida ---------- */
function validar(archivo) {
  const tipoValido = TIPOS_DOCUMENTO[archivo.type] || EXTENSIONES.includes(extension(archivo.name));
  if (!tipoValido) return t('docs.errTipo', { nombre: archivo.name });
  if (archivo.size > CONFIG.cloudinary.maxBytes) return t('docs.errTamano', { nombre: archivo.name });
  return '';
}

async function subir(archivo) {
  const error = validar(archivo);
  if (error) { toast(error, { tipo: 'error', duracion: 6000 }); return; }
  if (!cloudinaryConfigurado()) { toast(t('docs.sinConfig'), { tipo: 'info' }); return; }

  const lista = $('#subidas');
  const item = document.createElement('li');
  item.className = 'subida';
  item.innerHTML = `<span class="subida-nombre">${escaparHTML(t('docs.subiendo', { nombre: archivo.name }))}</span>
    <span class="barra-progreso"><span style="width:0%"></span></span><span class="subida-pct">0%</span>`;
  lista.append(item);
  const barra = item.querySelector('.barra-progreso span');
  const pct = item.querySelector('.subida-pct');

  try {
    const { uid } = ctx.usuario;
    const r = await subirACloudinary(archivo, {
      carpeta: `clientes/${uid}/documentos`,
      tipo: archivo.type.startsWith('image/') ? 'image' : 'auto',
      onProgreso: (p) => { barra.style.width = `${p}%`; pct.textContent = `${p}%`; },
    });
    const { fs, db } = ctx.fb;
    await fs.addDoc(fs.collection(db, 'users', uid, 'documents'), {
      name: archivo.name.slice(0, 160),
      url: r.url,
      publicId: r.publicId,
      format: (r.format || extension(archivo.name)).slice(0, 10),
      bytes: r.bytes || archivo.size,
      uploadedBy: 'client',
      status: 'recibido',
      adminComment: '',
      createdAt: fs.serverTimestamp(),
    });
    avisarAppsScript('documento', { name: archivo.name.slice(0, 160), email: ctx.usuario.email });
    item.classList.add('lista');
    pct.textContent = '✓';
    toast(t('docs.subido'));
    setTimeout(() => item.remove(), 2500);
  } catch (err) {
    console.error('[documentos] Subida:', err);
    item.classList.add('fallo');
    pct.textContent = '!';
    toast(t('docs.errSubida', { nombre: archivo.name }), { tipo: 'error', duracion: 7000 });
    setTimeout(() => item.remove(), 6000);
  }
}

export function iniciarDocumentos(contexto) {
  ctx = contexto;
  const zona = $('#zona-subida');
  const input = $('#archivo-doc');
  input.addEventListener('change', () => {
    [...input.files].forEach(subir);
    input.value = '';
  });
  ['dragenter', 'dragover'].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.add('arrastrando'); }));
  ['dragleave', 'drop'].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.remove('arrastrando'); }));
  zona.addEventListener('drop', (e) => [...(e.dataTransfer?.files || [])].forEach(subir));
}
