/* ==========================================================================
   Portal · Plan de acción (Fase 3)
   Tareas en users/{uid}/tasks que asigna el equipo; el cliente solo marca "done".
   ========================================================================== */
import { $, escaparHTML, toast, formatearFecha, fechaLocal, campo } from './util.js';
import { t } from './i18n.js';

let ctx = null;
let tareas = [];
let cargado = false;

/* dueDate puede ser 'AAAA-MM-DD', Timestamp o Date */
function fechaLimite(tarea) {
  const v = tarea.dueDate;
  if (!v) return null;
  if (typeof v === 'string') return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  const d = v.toDate ? v.toDate() : new Date(v);
  return Number.isNaN(d.getTime()) ? null : fechaLocal(d);
}

export async function cargarTareas() {
  const { fb, usuario } = ctx;
  if (!fb || !usuario) return;
  try {
    const snap = await fb.fs.getDocs(fb.fs.collection(fb.db, 'users', usuario.uid, 'tasks'));
    tareas = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => Number(a.done) - Number(b.done) || (fechaLimite(a) || '9999').localeCompare(fechaLimite(b) || '9999'));
  } catch (error) {
    console.warn('[tareas] No disponibles:', error.message);
    tareas = [];
  }
  cargado = true;
}

export function detenerTareas() { tareas = []; cargado = false; }
export const tareasPendientes = () => tareas.filter((x) => !x.done);

export function itemTarea(tarea, compacto = false) {
  const limite = fechaLimite(tarea);
  const hoy = fechaLocal();
  const vencida = limite && !tarea.done && limite < hoy;
  const fecha = limite ? formatearFecha(`${limite}T12:00:00`, ctx.idioma, { day: 'numeric', month: 'short', year: compacto ? undefined : 'numeric' }) : '';
  const detalle = campo(tarea, 'detail', ctx.idioma);
  return `
    <li class="tarea${tarea.done ? ' hecha' : ''}${vencida ? ' vencida' : ''}">
      <label class="tarea-check">
        <input type="checkbox" data-tarea="${escaparHTML(tarea.id)}"${tarea.done ? ' checked' : ''}>
        <span class="caja" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-8"/></svg></span>
        <span class="tarea-texto">
          <strong>${escaparHTML(campo(tarea, 'title', ctx.idioma))}</strong>
          ${detalle && !compacto ? `<span class="tarea-detalle">${escaparHTML(detalle)}</span>` : ''}
        </span>
      </label>
      ${fecha ? `<span class="tarea-fecha">${vencida ? `<b>${escaparHTML(t('plan.vencida'))}</b> · ` : ''}${escaparHTML(t('plan.vence', { fecha }))}</span>` : ''}
    </li>`;
}

export function pintarPlan() {
  const zona = $('#lista-tareas');
  if (!zona || !cargado) return;
  if (!tareas.length) {
    zona.innerHTML = `
      <div class="estado-vacio-app panel">
        <span class="vacio-icono" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m4 6 1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17M11 6h9M11 12h9M11 18h9"/></svg></span>
        <h2>${escaparHTML(t('vac.planT'))}</h2>
        <p>${escaparHTML(t('vac.planD'))}</p>
        <a class="btn btn-principal" href="${escaparHTML(ctx.enlaceAgenda())}">${escaparHTML(t('ini.agendar'))}</a>
      </div>`;
    return;
  }
  const pendientes = tareas.filter((x) => !x.done);
  const hechas = tareas.filter((x) => x.done);
  zona.innerHTML = `
    <div class="panel bloque-tareas">
      <h3>${escaparHTML(t('plan.pendientes', { n: pendientes.length }))}</h3>
      ${pendientes.length ? `<ul class="lista-tareas">${pendientes.map((x) => itemTarea(x)).join('')}</ul>` : `<p class="lista-vacia">${escaparHTML(t('plan.todoListo'))}</p>`}
    </div>
    ${hechas.length ? `<div class="panel bloque-tareas"><h3>${escaparHTML(t('plan.hechas', { n: hechas.length }))}</h3><ul class="lista-tareas">${hechas.map((x) => itemTarea(x)).join('')}</ul></div>` : ''}`;
}

async function alternarTarea(id, done) {
  const tarea = tareas.find((x) => x.id === id);
  if (!tarea) return;
  tarea.done = done;
  try {
    const { fs, db } = ctx.fb;
    await fs.updateDoc(fs.doc(db, 'users', ctx.usuario.uid, 'tasks', id), { done });
    toast(t(done ? 'plan.ok' : 'plan.reabierta'));
  } catch (error) {
    tarea.done = !done;
    console.error('[tareas]', error);
    toast(t('err.permiso'), { tipo: 'error' });
  }
  pintarPlan();
  ctx.alCambiarProgreso();
}

export function iniciarTareas(contexto) {
  ctx = contexto;
  // Delegación: funciona en Plan de acción y en la tarjeta de Inicio
  document.addEventListener('change', (e) => {
    const casilla = e.target.closest('input[data-tarea]');
    if (casilla) alternarTarea(casilla.dataset.tarea, casilla.checked);
  });
}
