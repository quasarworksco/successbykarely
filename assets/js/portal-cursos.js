/* ==========================================================================
   Portal · Mi ruta y visor de cursos (Fase 3)
   - Cursos publicados para todos o asignados al cliente
   - Progreso en users/{uid}/progress/{courseId}: completed[], lastLessonId
   - Anillos por etapa, "continúa donde lo dejaste", racha y celebraciones
   ========================================================================== */
import { ETAPAS } from './config.js';
import {
  $, $$, escaparHTML, toast, urlCloudinary, campo, aFecha, fechaLocal,
  embedVideo, sanearHTML, confetiDorado,
} from './util.js';
import { t } from './i18n.js';

let ctx = null;
let cursos = [];
let progreso = {};          // { courseId: { completed: [], lastLessonId, updatedAt } }
let cargado = false;
let filtro = 'todas';
let cursoActual = null;
let leccionActual = null;

const idioma = () => ctx.idioma;
const esURLSegura = (url) => typeof url === 'string' && url.startsWith('https://');
export const etapaDeCurso = (curso) => ETAPAS.find((e) => e.id === curso.pillar)?.n || null;

/* ---------- Datos ---------- */
export async function cargarCursos() {
  const { fb, usuario } = ctx;
  if (!fb || !usuario) return;
  const { fs, db } = fb;
  const col = fs.collection(db, 'courses');
  try {
    // Dos consultas que cumplen las reglas: públicos para todos y asignados a mí
    const [publicos, asignados, snapProgreso] = await Promise.all([
      fs.getDocs(fs.query(col, fs.where('published', '==', true), fs.where('access', '==', 'todos'))),
      fs.getDocs(fs.query(col, fs.where('published', '==', true), fs.where('allowedUids', 'array-contains', usuario.uid))).catch(() => ({ docs: [] })),
      fs.getDocs(fs.collection(db, 'users', usuario.uid, 'progress')).catch(() => ({ docs: [] })),
    ]);
    const mapa = new Map();
    [...publicos.docs, ...asignados.docs].forEach((d) => mapa.set(d.id, { id: d.id, ...d.data() }));
    cursos = [...mapa.values()]
      .filter((c) => !c.deletedAt && Array.isArray(c.lessons))
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    progreso = Object.fromEntries(snapProgreso.docs.map((d) => [d.id, d.data()]));
  } catch (error) {
    console.warn('[cursos] No disponibles:', error.message);
    cursos = [];
  }
  cargado = true;
}

export function detenerCursos() {
  cursos = []; progreso = {}; cargado = false; cursoActual = null; leccionActual = null;
}

function completadas(curso) {
  const ids = new Set(curso.lessons.map((l) => l.id));
  return (progreso[curso.id]?.completed || []).filter((id) => ids.has(id));
}
export function porcentajeCurso(curso) {
  if (!curso.lessons.length) return 0;
  return Math.round((completadas(curso).length / curso.lessons.length) * 100);
}

/* Progreso por etapa y global (lecciones completadas / lecciones totales) */
export function progresoPorEtapa() {
  const resultado = { 1: 0, 2: 0, 3: 0, 4: 0, global: 0 };
  let totalHechas = 0;
  let totalLecciones = 0;
  ETAPAS.forEach((e) => {
    const deEtapa = cursos.filter((c) => etapaDeCurso(c) === e.n);
    const lecciones = deEtapa.reduce((s, c) => s + c.lessons.length, 0);
    const hechas = deEtapa.reduce((s, c) => s + completadas(c).length, 0);
    resultado[e.n] = lecciones ? Math.round((hechas / lecciones) * 100) : 0;
    totalHechas += hechas;
    totalLecciones += lecciones;
  });
  resultado.global = totalLecciones ? Math.round((totalHechas / totalLecciones) * 100) : 0;
  return resultado;
}

/* Curso en curso más reciente, con la lección donde quedó */
export function continuarDondeLoDejaste() {
  const candidatos = cursos
    .filter((c) => progreso[c.id] && porcentajeCurso(c) < 100)
    .sort((a, b) => (aFecha(progreso[b.id].updatedAt)?.getTime() || 0) - (aFecha(progreso[a.id].updatedAt)?.getTime() || 0));
  const curso = candidatos[0];
  if (!curso) return null;
  const hechas = new Set(completadas(curso));
  const ultima = curso.lessons.find((l) => l.id === progreso[curso.id].lastLessonId);
  const leccion = ultima && !hechas.has(ultima.id) ? ultima : curso.lessons.find((l) => !hechas.has(l.id)) || curso.lessons[0];
  return { curso, leccion };
}

export function primerCursoRecomendado() {
  const foco = ctx.perfil?.focusStage;
  return cursos.find((c) => etapaDeCurso(c) === foco && porcentajeCurso(c) < 100)
    || cursos.find((c) => porcentajeCurso(c) < 100) || null;
}

export const hayCursos = () => cursos.length > 0;
export const tituloCurso = (c) => campo(c, 'title', idioma());
export const tituloLeccion = (l) => campo(l, 'title', idioma());

/* ---------- Mi ruta ---------- */
function portada(curso) {
  if (esURLSegura(curso.coverUrl)) {
    return `<div class="curso-portada tiene-imagen"><img class="media-img" src="${escaparHTML(urlCloudinary(curso.coverUrl, 'f_auto,q_auto,c_fill,g_auto,w_720,ar_16:9'))}" alt="" loading="lazy" width="720" height="405"></div>`;
  }
  return '<div class="curso-portada"><span class="marcador" aria-hidden="true"><span class="marcador-k">K</span></span></div>';
}

export function pintarRuta() {
  const filtros = $('#filtros-ruta');
  const rejilla = $('#rejilla-cursos');
  if (!filtros || !rejilla) return;
  const foco = ctx.perfil?.focusStage;
  const opciones = [['todas', t('ruta.todas')], ...ETAPAS.map((e) => [String(e.n), `${e.n}. ${e[idioma()]}`])];
  filtros.innerHTML = opciones.map(([v, texto]) => `
    <button type="button" class="filtro${String(foco) === v ? ' filtro-foco' : ''}" data-filtro="${v}" aria-pressed="${filtro === v}">${escaparHTML(texto)}</button>`).join('');
  filtros.hidden = !cursos.length;

  if (!cargado) return;
  if (!cursos.length) {
    const etapa = ETAPAS.find((e) => e.n === foco);
    rejilla.innerHTML = `
      <div class="estado-vacio-app panel ancho-completo">
        <span class="vacio-icono" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/></svg></span>
        <h2>${escaparHTML(t('vac.rutaT'))}</h2>
        ${etapa ? `<p class="vacio-destacado">${escaparHTML(t('vac.rutaEtapa', { n: etapa.n, etapa: etapa[idioma()] }))}</p>` : ''}
        <p>${escaparHTML(t('vac.rutaD'))}</p>
      </div>`;
    return;
  }
  const lista = cursos.filter((c) => filtro === 'todas' || String(etapaDeCurso(c)) === filtro);
  if (!lista.length) {
    rejilla.innerHTML = `<p class="lista-vacia ancho-completo">${escaparHTML(t('ruta.filtroVacio'))}</p>`;
    return;
  }
  rejilla.innerHTML = lista.map((c) => {
    const pct = porcentajeCurso(c);
    const etapa = ETAPAS.find((e) => e.n === etapaDeCurso(c));
    const n = c.lessons.length;
    const accion = pct === 100 ? 'ruta.repasar' : pct > 0 ? 'ruta.continuar' : 'ruta.empezar';
    const meta = [c.level, c.duration, n === 1 ? t('ruta.leccion1') : t('ruta.lecciones', { n })].filter(Boolean);
    return `
      <a class="panel tarjeta-curso${pct === 100 ? ' completo' : ''}" href="#curso/${encodeURIComponent(c.id)}">
        ${portada(c)}
        <div class="tarjeta-curso-cuerpo">
          ${etapa ? `<span class="curso-insignia">${escaparHTML(`${etapa.n}. ${etapa[idioma()]}`)}</span>` : ''}
          <h3>${escaparHTML(tituloCurso(c))}</h3>
          <p class="curso-meta">${meta.map(escaparHTML).join(' · ')}</p>
          <div class="barra-progreso" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${escaparHTML(tituloCurso(c))}"><span style="width:${pct}%"></span></div>
          <p class="curso-pie"><span>${pct === 100 ? escaparHTML(t('ruta.completado')) : `${pct}%`}</span><span class="curso-cta">${escaparHTML(t(accion))}</span></p>
        </div>
      </a>`;
  }).join('');
}

/* ---------- Visor ---------- */
export async function abrirCurso(cursoId, leccionId) {
  if (!cargado) await cargarCursos();
  const curso = cursos.find((c) => c.id === cursoId);
  const zona = $('#leccion');
  if (!curso) {
    cursoActual = null;
    $('#curso-titulo').textContent = t('curso.noEncontrado');
    $('#curso-etapa').textContent = '';
    $('#curso-progreso-texto').textContent = '';
    $('#lista-lecciones').innerHTML = '';
    zona.innerHTML = `<p class="lista-vacia">${escaparHTML(t('curso.noEncontradoD'))}</p>`;
    return;
  }
  cursoActual = curso;
  const hechas = new Set(completadas(curso));
  leccionActual = curso.lessons.find((l) => l.id === leccionId)
    || curso.lessons.find((l) => l.id === progreso[curso.id]?.lastLessonId)
    || curso.lessons.find((l) => !hechas.has(l.id))
    || curso.lessons[0];
  if (leccionActual && leccionId !== leccionActual.id) {
    history.replaceState(null, '', `#curso/${encodeURIComponent(curso.id)}/${encodeURIComponent(leccionActual.id)}`);
  }
  pintarCabeceraCurso();
  pintarListaLecciones();
  await pintarLeccion();
  guardarUltimaLeccion();
  if (window.matchMedia('(max-width: 999px)').matches) $('#detalles-lecciones').open = false;
}

function pintarCabeceraCurso() {
  const c = cursoActual;
  const etapa = ETAPAS.find((e) => e.n === etapaDeCurso(c));
  $('#curso-etapa').textContent = etapa ? `${etapa.n}. ${etapa[idioma()]}` : '';
  $('#curso-titulo').textContent = tituloCurso(c);
  const hechas = completadas(c).length;
  $('#curso-barra').style.width = `${porcentajeCurso(c)}%`;
  $('#curso-progreso-texto').textContent = t('curso.progreso', { c: hechas, t: c.lessons.length });
  $('#curso-conteo').textContent = `(${hechas}/${c.lessons.length})`;
}

function pintarListaLecciones() {
  const hechas = new Set(completadas(cursoActual));
  $('#lista-lecciones').innerHTML = cursoActual.lessons.map((l, i) => `
    <li>
      <a href="#curso/${encodeURIComponent(cursoActual.id)}/${encodeURIComponent(l.id)}" class="${hechas.has(l.id) ? 'hecha' : ''}"${l.id === leccionActual?.id ? ' aria-current="step"' : ''}>
        <span class="leccion-check" aria-hidden="true">${hechas.has(l.id) ? '<svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-8"/></svg>' : i + 1}</span>
        <span>${escaparHTML(tituloLeccion(l))}</span>
        ${hechas.has(l.id) ? `<span class="solo-lectores">${escaparHTML(t('curso.completada'))}</span>` : ''}
      </a>
    </li>`).join('');
}

async function pintarLeccion() {
  const zona = $('#leccion');
  const l = leccionActual;
  if (!l) { zona.innerHTML = ''; return; }
  const indice = cursoActual.lessons.indexOf(l);
  const hecha = completadas(cursoActual).includes(l.id);
  const siguiente = cursoActual.lessons[indice + 1];
  const anterior = cursoActual.lessons[indice - 1];
  const contenido = await sanearHTML(campo(l, 'content', idioma()));
  const recursos = (l.resources || []).filter((r) => esURLSegura(r.url));
  const base = `#curso/${encodeURIComponent(cursoActual.id)}/`;
  zona.innerHTML = `
    ${embedVideo(l.videoUrl, tituloLeccion(l))}
    <p class="leccion-numero">${escaparHTML(t('curso.leccionN', { n: indice + 1, t: cursoActual.lessons.length }))}</p>
    <h3 class="leccion-titulo">${escaparHTML(tituloLeccion(l))}</h3>
    ${contenido ? `<div class="contenido-leccion">${contenido}</div>` : ''}
    ${recursos.length ? `
      <div class="recursos-leccion">
        <h4>${escaparHTML(t('curso.recursos'))}</h4>
        <ul>${recursos.map((r) => `<li><a href="${escaparHTML(r.url)}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>${escaparHTML(campo(r, 'name', idioma()) || r.url)}</a></li>`).join('')}</ul>
      </div>` : ''}
    <div class="leccion-acciones">
      <button type="button" class="btn ${hecha ? 'btn-linea-app' : 'btn-principal'} btn-marcar" id="btn-marcar" aria-pressed="${hecha}">
        <span class="check-animado${hecha ? ' activo' : ''}" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-8"/></svg></span>
        <span>${escaparHTML(t(hecha ? 'curso.completada' : 'curso.marcar'))}</span>
      </button>
      <div class="leccion-nav">
        ${anterior ? `<a class="btn btn-linea-app btn-sm" href="${base}${encodeURIComponent(anterior.id)}">${escaparHTML(t('curso.anterior'))}</a>` : ''}
        ${siguiente ? `<a class="btn btn-suave btn-sm" href="${base}${encodeURIComponent(siguiente.id)}">${escaparHTML(t('curso.siguiente'))}</a>` : ''}
      </div>
    </div>`;
  $$('.contenido-leccion a', zona).forEach((a) => { a.target = '_blank'; a.rel = 'noopener'; });
  $('#btn-marcar').addEventListener('click', alternarCompletada);
}

/* ---------- Guardado de progreso ---------- */
async function escribirProgreso(cursoId, datos) {
  const { fs, db } = ctx.fb;
  progreso[cursoId] = { ...(progreso[cursoId] || {}), ...datos, updatedAt: new Date() };
  await fs.setDoc(fs.doc(db, 'users', ctx.usuario.uid, 'progress', cursoId), {
    completed: progreso[cursoId].completed || [],
    lastLessonId: progreso[cursoId].lastLessonId || '',
    updatedAt: fs.serverTimestamp(),
  });
}

async function guardarUltimaLeccion() {
  if (!cursoActual || !leccionActual) return;
  if (progreso[cursoActual.id]?.lastLessonId === leccionActual.id) return;
  try { await escribirProgreso(cursoActual.id, { lastLessonId: leccionActual.id, completed: completadas(cursoActual) }); }
  catch (error) { console.warn('[cursos] Última lección no guardada:', error.message); }
}

async function alternarCompletada() {
  const curso = cursoActual;
  const leccion = leccionActual;
  const lista = new Set(completadas(curso));
  const marcar = !lista.has(leccion.id);
  const etapa = etapaDeCurso(curso);
  const etapaAntes = progresoPorEtapa()[etapa];
  if (marcar) lista.add(leccion.id); else lista.delete(leccion.id);

  const boton = $('#btn-marcar');
  boton.disabled = true;
  try {
    await escribirProgreso(curso.id, { completed: [...lista], lastLessonId: leccion.id });
  } catch (error) {
    console.error('[cursos] Progreso:', error);
    toast(t('err.permiso'), { tipo: 'error' });
    boton.disabled = false;
    return;
  }
  if (marcar) {
    boton.querySelector('.check-animado')?.classList.add('activo');
    await actualizarRacha();
  }
  pintarCabeceraCurso();
  pintarListaLecciones();
  await pintarLeccion();
  ctx.alCambiarProgreso();

  if (!marcar) return;
  const terminoCurso = porcentajeCurso(curso) === 100;
  const terminoEtapa = etapa && etapaAntes < 100 && progresoPorEtapa()[etapa] === 100;
  if (terminoCurso || terminoEtapa) {
    celebrar(curso, terminoEtapa ? ETAPAS.find((e) => e.n === etapa) : null);
  } else {
    toast(t('curso.leccionCompletada'));
    const siguiente = curso.lessons[curso.lessons.indexOf(leccion) + 1];
    if (siguiente) $('.leccion-nav .btn-suave')?.focus();
  }
}

/* Racha: días seguidos completando al menos una lección */
async function actualizarRacha() {
  const perfil = ctx.perfil;
  const hoy = fechaLocal();
  if (perfil.lastStudyDate === hoy) return;
  const ayer = fechaLocal(Date.now() - 86400000);
  const streak = perfil.lastStudyDate === ayer ? (Number(perfil.streak) || 0) + 1 : 1;
  const cambios = { streak, lastStudyDate: hoy };
  ctx.actualizarPerfilLocal(cambios);
  try {
    const { fs, db } = ctx.fb;
    await fs.updateDoc(fs.doc(db, 'users', ctx.usuario.uid), { ...cambios, updatedAt: fs.serverTimestamp() });
  } catch (error) {
    console.warn('[cursos] Racha no guardada:', error.message);
  }
}

/* ---------- Celebración ---------- */
function celebrar(curso, etapa) {
  const modal = $('#celebracion');
  $('#cel-texto').textContent = etapa
    ? t('cel.etapa', { etapa: etapa[idioma()] })
    : t('cel.curso', { curso: tituloCurso(curso) });
  modal.hidden = false;
  confetiDorado();
  $('#cel-ruta').focus();
}

export function iniciarCursos(contexto) {
  ctx = contexto;
  $('#filtros-ruta').addEventListener('click', (e) => {
    const boton = e.target.closest('[data-filtro]');
    if (!boton) return;
    filtro = boton.dataset.filtro;
    pintarRuta();
  });
  const cerrar = () => { $('#celebracion').hidden = true; };
  $('#cel-cerrar').addEventListener('click', cerrar);
  $('#cel-ruta').addEventListener('click', cerrar);
  $('#celebracion').addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
}

/* Al cambiar de idioma */
export async function repintarCursos() {
  pintarRuta();
  if (cursoActual) { pintarCabeceraCurso(); pintarListaLecciones(); await pintarLeccion(); }
}
