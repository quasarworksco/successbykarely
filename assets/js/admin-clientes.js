/* ==========================================================================
   Panel admin · Clientes (CRM)
   Tabla con búsqueda y filtros, etapa editable en línea y ficha completa en
   cajón: datos, CRM y notas internas, progreso, documentos, tareas y cursos.
   ========================================================================== */
import { SERVICIOS, ETAPAS, CONFIG } from './config.js';
import {
  $, $$, escaparHTML, toast, subirACloudinary, cloudinaryConfigurado, tamanoLegible, TIPOS_DOCUMENTO,
} from './util.js';
import { t, registrarTextos } from './i18n.js';
import {
  estado, puede, fs, col, ref, ahora, registrarActividad, fecha, relativo, ms, normalizar, campoTexto,
  abrirCajon, cerrarCajon, marcarSucio, confirmar, conDeshacer, estadoVacio, esqueletoTabla, icono, esURLSegura,
} from './admin-nucleo.js';
import { ETAPAS_CRM } from './admin-resumen.js';

let clientes = [];          // users + crm combinados
let cursos = [];
let progresos = {};         // uid -> { courseId: {completed} }
let cargado = false;
let filtros = { q: '', etapa: '', servicio: '', idioma: '', desde: '' };
let vistaActual = null;

const nombre = (c) => `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || c.id;
const soloDigitos = (s = '') => String(s).replace(/\D/g, '');

/* ---------- Datos ---------- */
export async function cargarClientes(forzar = false) {
  if (cargado && !forzar) return clientes;
  const f = fs();
  const [usuarios, crm, snapCursos] = await Promise.all([
    f.getDocs(col('users')),
    f.getDocs(col('crm')).catch(() => ({ docs: [] })),
    f.getDocs(col('courses')).catch(() => ({ docs: [] })),
  ]);
  const mapaCrm = Object.fromEntries(crm.docs.map((d) => [d.id, d.data()]));
  clientes = usuarios.docs.map((d) => ({ id: d.id, ...d.data(), crm: mapaCrm[d.id] || {} }))
    .sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
  cursos = snapCursos.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => !c.deletedAt);
  cargado = true;
  return clientes;
}
export const obtenerClientes = () => clientes;

async function progresoDe(uid) {
  if (progresos[uid]) return progresos[uid];
  const snap = await fs().getDocs(col('users', uid, 'progress')).catch(() => ({ docs: [] }));
  progresos[uid] = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
  return progresos[uid];
}
function porcentajeGlobal(uid) {
  const p = progresos[uid];
  if (!p) return null;
  const total = cursos.reduce((s, c) => s + (c.lessons?.length || 0), 0);
  if (!total) return 0;
  const hechas = cursos.reduce((s, c) => {
    const ids = new Set((c.lessons || []).map((l) => l.id));
    return s + (p[c.id]?.completed || []).filter((id) => ids.has(id)).length;
  }, 0);
  return Math.round((hechas / total) * 100);
}

/* ---------- Tabla ---------- */
function filtrar() {
  const q = normalizar(filtros.q);
  const desde = filtros.desde ? new Date(`${filtros.desde}T00:00:00`).getTime() : 0;
  return clientes.filter((c) => {
    if (q && !normalizar(`${nombre(c)} ${c.email} ${c.phone} ${c.country} ${c.city}`).includes(q)) return false;
    if (filtros.etapa && (c.crm.stage || 'nuevo') !== filtros.etapa) return false;
    if (filtros.servicio && !(c.services || []).includes(filtros.servicio)) return false;
    if (filtros.idioma && (c.language || 'es') !== filtros.idioma) return false;
    if (desde && ms(c.createdAt) < desde) return false;
    return true;
  });
}

const selectEtapa = (id, actual, clase = '') => `
  <select class="select-etapa ${clase}" data-etapa-de="${escaparHTML(id)}" aria-label="${escaparHTML(t('crm.etapa'))}">
    ${ETAPAS_CRM.map((e) => `<option value="${e}"${e === actual ? ' selected' : ''}>${escaparHTML(t(`crm.etapa.${e}`))}</option>`).join('')}
  </select>`;

function pintarTabla() {
  const cuerpo = $('#tabla-clientes tbody');
  if (!cuerpo) return;
  const lista = filtrar();
  $('#conteo-clientes').textContent = t('crm.conteo', { n: lista.length, total: clientes.length });
  if (!lista.length) {
    cuerpo.innerHTML = `<tr><td colspan="7" class="celda-vacia">${escaparHTML(clientes.length ? t('crm.sinFiltro') : t('crm.vacio'))}</td></tr>`;
    return;
  }
  cuerpo.innerHTML = lista.map((c) => {
    const pct = porcentajeGlobal(c.id);
    return `
    <tr data-uid="${escaparHTML(c.id)}">
      <td><a class="celda-principal" href="#clientes/${encodeURIComponent(c.id)}"><strong>${escaparHTML(nombre(c))}</strong><span>${escaparHTML(c.email || '')}</span></a></td>
      <td class="nowrap">${escaparHTML(c.phone || '—')}</td>
      <td><span class="chips-mini">${(c.services || []).slice(0, 3).map((s) => `<span>${escaparHTML((SERVICIOS.find((x) => x.id === s)?.[estado.idioma] || s).split(/[\s,]+/)[0])}</span>`).join('')}${(c.services || []).length > 3 ? `<span>+${c.services.length - 3}</span>` : ''}</span></td>
      <td>${selectEtapa(c.id, c.crm.stage || 'nuevo')}</td>
      <td class="nowrap">${pct === null ? '<span class="texto-suave-app">…</span>' : `<span class="mini-barra"><span style="width:${pct}%"></span></span> ${pct}%`}</td>
      <td class="nowrap texto-suave-app">${escaparHTML(fecha(c.createdAt))}</td>
      <td class="nowrap acciones-fila">
        ${c.phone ? `<a class="btn-mini" href="https://wa.me/${soloDigitos(c.phone)}" target="_blank" rel="noopener" aria-label="WhatsApp">${ICONO_WA}</a>` : ''}
        ${c.email ? `<a class="btn-mini" href="mailto:${escaparHTML(c.email)}" aria-label="${escaparHTML(t('crm.correo'))}">${ICONO_MAIL}</a>` : ''}
      </td>
    </tr>`;
  }).join('');
  // Progreso bajo demanda (en paralelo, sin bloquear la tabla)
  lista.filter((c) => !progresos[c.id]).slice(0, 60).forEach((c) => progresoDe(c.id).then(() => {
    const fila = $(`#tabla-clientes tr[data-uid="${CSS.escape(c.id)}"] td:nth-child(5)`);
    const pct = porcentajeGlobal(c.id);
    if (fila) fila.innerHTML = `<span class="mini-barra"><span style="width:${pct}%"></span></span> ${pct}%`;
  }));
}

const ICONO_WA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.2-4A8 8 0 1 1 8 18.8Z"/></svg>';
const ICONO_MAIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>';

async function cambiarEtapa(uid, etapa, { silencioso = false } = {}) {
  const c = clientes.find((x) => x.id === uid);
  const anterior = c.crm.stage || 'nuevo';
  if (anterior === etapa) return;
  c.crm = { ...c.crm, stage: etapa };
  try {
    await fs().setDoc(ref('crm', uid), { stage: etapa, updatedAt: ahora() }, { merge: true });
    registrarActividad('etapa', 'crm', uid, `${nombre(c)}: ${anterior} → ${etapa}`);
    if (!silencioso) conDeshacer(t('crm.etapaCambiada', { etapa: t(`crm.etapa.${etapa}`) }), () => cambiarEtapa(uid, anterior, { silencioso: true }).then(() => { pintarTabla(); toast(t('adm.deshecho')); }));
  } catch (error) {
    c.crm.stage = anterior;
    toast(t('adm.errGuardar'), { tipo: 'error' });
  }
  pintarTabla();
  const selectCajon = $(`#cajon-cuerpo select[data-etapa-de="${CSS.escape(uid)}"]`);
  if (selectCajon) selectCajon.value = c.crm.stage;
}

async function montar(vista, params) {
  vistaActual = vista;
  if (!vista.querySelector('#tabla-clientes')) {
    vista.innerHTML = `
      <div class="barra-herramientas">
        <input type="search" id="f-q" class="campo-buscar" placeholder="${escaparHTML(t('crm.buscar'))}" aria-label="${escaparHTML(t('crm.buscar'))}" value="${escaparHTML(filtros.q)}">
        <select id="f-etapa" aria-label="${escaparHTML(t('crm.etapa'))}"><option value="">${escaparHTML(t('crm.todasEtapas'))}</option>${ETAPAS_CRM.map((e) => `<option value="${e}">${escaparHTML(t(`crm.etapa.${e}`))}</option>`).join('')}</select>
        <select id="f-servicio" aria-label="${escaparHTML(t('crm.servicio'))}"><option value="">${escaparHTML(t('crm.todosServicios'))}</option>${SERVICIOS.map((s) => `<option value="${s.id}">${escaparHTML(s[estado.idioma] || s.es)}</option>`).join('')}</select>
        <select id="f-idioma" aria-label="${escaparHTML(t('reg.idioma'))}"><option value="">${escaparHTML(t('crm.todosIdiomas'))}</option><option value="es">Español</option><option value="en">English</option></select>
        <label class="filtro-fecha"><span>${escaparHTML(t('crm.desde'))}</span><input type="date" id="f-desde" value="${escaparHTML(filtros.desde)}"></label>
        <button type="button" class="btn btn-linea-app btn-sm" id="btn-recargar-clientes">${escaparHTML(t('crm.recargar'))}</button>
      </div>
      <p class="conteo" id="conteo-clientes" aria-live="polite"></p>
      <div class="panel panel-tabla">
        <div class="tabla-scroll">
          <table class="tabla tabla-tarjetas" id="tabla-clientes">
            <thead><tr>
              <th scope="col">${escaparHTML(t('crm.cliente'))}</th><th scope="col">${escaparHTML(t('reg.telefono'))}</th>
              <th scope="col">${escaparHTML(t('crm.servicios'))}</th><th scope="col">${escaparHTML(t('crm.etapa'))}</th>
              <th scope="col">${escaparHTML(t('crm.progreso'))}</th><th scope="col">${escaparHTML(t('crm.registro'))}</th><th scope="col"><span class="solo-lectores">${escaparHTML(t('adm.acciones'))}</span></th>
            </tr></thead>
            <tbody><tr><td colspan="7">${esqueletoTabla(5)}</td></tr></tbody>
          </table>
        </div>
      </div>`;
    ['etapa', 'servicio', 'idioma'].forEach((k) => { $(`#f-${k}`).value = filtros[k]; });
    let tempo = 0;
    $('#f-q').addEventListener('input', (e) => { clearTimeout(tempo); tempo = setTimeout(() => { filtros.q = e.target.value; pintarTabla(); }, 150); });
    ['etapa', 'servicio', 'idioma', 'desde'].forEach((k) => $(`#f-${k}`).addEventListener('change', (e) => { filtros[k] = e.target.value; pintarTabla(); }));
    $('#btn-recargar-clientes').addEventListener('click', async () => { progresos = {}; await cargarClientes(true); pintarTabla(); });
    $('#tabla-clientes').addEventListener('change', (e) => {
      const s = e.target.closest('select[data-etapa-de]');
      if (s) cambiarEtapa(s.dataset.etapaDe, s.value);
    });
    try { await cargarClientes(); } catch (error) { console.error(error); vista.innerHTML = estadoVacio(t('adm.errCargar'), ''); return; }
    pintarTabla();
  }
  if (params[0]) abrirFicha(params[0]);
}

/* ==========================================================================
   Ficha del cliente (cajón)
   ========================================================================== */
const PESTANAS = ['ficha', 'crm', 'progreso', 'documentos', 'tareas', 'cursos'];

async function abrirFicha(uid) {
  await cargarClientes();
  const c = clientes.find((x) => x.id === uid);
  if (!c) { toast(t('crm.noEncontrado'), { tipo: 'error' }); history.replaceState(null, '', '#clientes'); return; }
  const cuerpo = abrirCajon({
    titulo: nombre(c),
    subtitulo: `${c.email || ''} · ${t('crm.miembroDesde', { fecha: fecha(c.createdAt) })}`,
    ancho: 'ancho',
    onCerrar: () => { if (location.hash.startsWith('#clientes/')) history.replaceState(null, '', '#clientes'); },
    html: `
      <div class="acciones-rapidas">
        <a class="btn btn-suave btn-sm" href="#mensajes/${encodeURIComponent(uid)}">${icono('mensajes')}${escaparHTML(t('crm.chat'))}</a>
        ${c.phone ? `<a class="btn btn-linea-app btn-sm" href="https://wa.me/${soloDigitos(c.phone)}" target="_blank" rel="noopener">${ICONO_WA} WhatsApp</a>` : ''}
        ${c.email ? `<a class="btn btn-linea-app btn-sm" href="mailto:${escaparHTML(c.email)}">${ICONO_MAIL} ${escaparHTML(t('crm.correo'))}</a>` : ''}
        ${selectEtapa(uid, c.crm.stage || 'nuevo', 'etapa-grande')}
      </div>
      <div class="pestanas-app" role="tablist">
        ${PESTANAS.map((p, i) => `<button type="button" role="tab" id="tab-${p}" aria-controls="panel-${p}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${escaparHTML(t(`crm.tab.${p}`))}</button>`).join('')}
      </div>
      ${PESTANAS.map((p, i) => `<section class="panel-pestana" role="tabpanel" id="panel-${p}" aria-labelledby="tab-${p}"${i ? ' hidden' : ''}></section>`).join('')}`,
  });

  cuerpo.querySelector('.acciones-rapidas select').addEventListener('change', (e) => cambiarEtapa(uid, e.target.value));
  const activar = (p) => {
    PESTANAS.forEach((x) => {
      const on = x === p;
      $(`#tab-${x}`).setAttribute('aria-selected', String(on));
      $(`#tab-${x}`).tabIndex = on ? 0 : -1;
      $(`#panel-${x}`).hidden = !on;
    });
    CARGAR[p](uid, $(`#panel-${p}`));
  };
  const tabs = $('.pestanas-app', cuerpo);
  tabs.addEventListener('click', (e) => { const b = e.target.closest('[role="tab"]'); if (b) activar(b.id.replace('tab-', '')); });
  tabs.addEventListener('keydown', (e) => {
    const i = PESTANAS.findIndex((p) => $(`#tab-${p}`).getAttribute('aria-selected') === 'true');
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!d) return;
    const sig = PESTANAS[(i + d + PESTANAS.length) % PESTANAS.length];
    activar(sig);
    $(`#tab-${sig}`).focus();
  });
  activar('ficha');
}

const fila = (etiqueta, valor) => `<div><dt>${escaparHTML(etiqueta)}</dt><dd>${escaparHTML(valor || '—')}</dd></div>`;

const CARGAR = {
  /* ---- Datos del perfil (solo lectura) ---- */
  ficha(uid, zona) {
    const c = clientes.find((x) => x.id === uid);
    const etapa = ETAPAS.find((e) => e.n === c.focusStage);
    zona.innerHTML = `
      <dl class="ficha-datos">
        ${fila(t('reg.nombre'), c.firstName)}${fila(t('reg.apellido'), c.lastName)}
        ${fila(t('acc.correo'), c.email)}${fila(t('reg.telefono'), c.phone)}
        ${fila(t('reg.pais'), c.country)}${fila(t('reg.estado'), [c.city, c.state].filter(Boolean).join(', '))}
        ${fila(t('reg.idioma'), c.language === 'en' ? 'English' : 'Español')}${fila(t('reg.nacimiento'), c.birthDate)}
        ${fila(t('reg.situacion'), c.situation ? t(`reg.sit.${c.situation}`) : '')}${fila(t('reg.referencia'), c.referral)}
        ${fila(t('perfil.etapa'), etapa ? `${etapa.n}. ${etapa[estado.idioma]}` : '')}${fila(t('ini.racha'), `${c.streak || 0}`)}
        ${fila(t('crm.ultimaActividad'), relativo(c.lastActiveAt))}${fila(t('crm.marketing'), c.consentMarketing ? t('crm.si') : t('crm.no'))}
        ${fila(t('crm.terminos'), fecha(c.acceptedTermsAt))}
      </dl>
      <h4 class="subtitulo-cajon">${escaparHTML(t('crm.servicios'))}</h4>
      <p class="chips-mini grande">${(c.services || []).map((s) => `<span>${escaparHTML(SERVICIOS.find((x) => x.id === s)?.[estado.idioma] || s)}</span>`).join('') || '—'}</p>`;
  },

  /* ---- CRM y notas internas ---- */
  async crm(uid, zona) {
    const c = clientes.find((x) => x.id === uid);
    const m = c.crm;
    const seguimiento = m.followUpAt ? new Date(ms(m.followUpAt)).toISOString().slice(0, 10) : '';
    zona.innerHTML = `
      <p class="nota-privada">${icono('equipo')} ${escaparHTML(t('crm.privado'))}</p>
      <form class="formulario form-app" id="form-crm">
        <div class="campos-2">
          <div class="campo"><label for="crm-owner">${escaparHTML(t('crm.responsable'))}</label><input id="crm-owner" maxlength="80" value="${escaparHTML(m.owner || '')}" list="lista-responsables"><datalist id="lista-responsables"><option value="${escaparHTML(estado.admin.name || '')}"></datalist></div>
          <div class="campo"><label for="crm-seguimiento">${escaparHTML(t('crm.seguimiento'))}</label><input id="crm-seguimiento" type="date" value="${seguimiento}"></div>
        </div>
        <div class="campo"><label for="crm-accion">${escaparHTML(t('crm.proximaAccion'))}</label><input id="crm-accion" maxlength="200" value="${escaparHTML(m.nextAction || '')}"></div>
        <div class="campo"><label for="crm-tags">${escaparHTML(t('crm.etiquetas'))}</label><input id="crm-tags" maxlength="300" value="${escaparHTML((m.tags || []).join(', '))}" placeholder="${escaparHTML(t('crm.etiquetasPh'))}"></div>
        <div class="fila-botones"><button type="submit" class="btn btn-principal btn-sm">${escaparHTML(t('adm.guardar'))}</button></div>
      </form>
      <h4 class="subtitulo-cajon">${escaparHTML(t('crm.notas'))}</h4>
      <form class="nota-nueva" id="form-nota">
        <label class="solo-lectores" for="nota-texto">${escaparHTML(t('crm.notaNueva'))}</label>
        <textarea id="nota-texto" rows="2" maxlength="2000" placeholder="${escaparHTML(t('crm.notaPh'))}"></textarea>
        <button type="submit" class="btn btn-suave btn-sm">${escaparHTML(t('crm.agregarNota'))}</button>
      </form>
      <ul class="lista-notas" id="lista-notas"><li class="texto-suave-app">…</li></ul>`;
    const form = $('#form-crm');
    form.addEventListener('input', () => marcarSucio(true));
    const guardar = async (e) => {
      e?.preventDefault();
      const datos = {
        owner: $('#crm-owner').value.trim(),
        nextAction: $('#crm-accion').value.trim(),
        tags: $('#crm-tags').value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 20),
        followUpAt: $('#crm-seguimiento').value ? fs().Timestamp.fromDate(new Date(`${$('#crm-seguimiento').value}T12:00:00`)) : null,
        updatedAt: ahora(),
      };
      try {
        await fs().setDoc(ref('crm', uid), datos, { merge: true });
        c.crm = { ...c.crm, ...datos, followUpAt: datos.followUpAt };
        marcarSucio(false);
        toast(t('adm.guardado'));
        registrarActividad('editar', 'crm', uid, nombre(c));
      } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
    };
    form.addEventListener('submit', guardar);
    const atajo = () => { if (document.body.contains(form)) guardar(); else document.removeEventListener('admin:guardar', atajo); };
    document.addEventListener('admin:guardar', atajo);

    const pintarNotas = async () => {
      const snap = await fs().getDocs(col('crm', uid, 'notes')).catch(() => ({ docs: [] }));
      const notas = snap.docs.map((d) => d.data()).sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
      $('#lista-notas').innerHTML = notas.length ? notas.map((n) => `
        <li><p>${escaparHTML(n.text).replace(/\n/g, '<br>')}</p><span>${escaparHTML(n.author || '')} · ${escaparHTML(relativo(n.createdAt))}</span></li>`).join('')
        : `<li class="texto-suave-app">${escaparHTML(t('crm.sinNotas'))}</li>`;
    };
    $('#form-nota').addEventListener('submit', async (e) => {
      e.preventDefault();
      const texto = $('#nota-texto').value.trim();
      if (!texto) return;
      try {
        await fs().addDoc(col('crm', uid, 'notes'), { text: texto.slice(0, 2000), author: estado.admin.name || estado.usuario.email, authorUid: estado.usuario.uid, createdAt: ahora() });
        $('#nota-texto').value = '';
        toast(t('crm.notaAgregada'));
        registrarActividad('nota', 'crm', uid, nombre(c));
        pintarNotas();
      } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
    });
    pintarNotas();
  },

  /* ---- Progreso por curso ---- */
  async progreso(uid, zona) {
    zona.innerHTML = '<p class="texto-suave-app">…</p>';
    const p = await progresoDe(uid);
    const c = clientes.find((x) => x.id === uid);
    if (!cursos.length) { zona.innerHTML = `<p class="lista-vacia">${escaparHTML(t('crm.sinCursos'))}</p>`; return; }
    zona.innerHTML = `
      <p class="texto-suave-app" style="margin-bottom:12px">${escaparHTML(t('crm.progresoGlobal', { n: porcentajeGlobal(uid) }))} · ${escaparHTML(t('ini.racha'))}: ${c.streak || 0}</p>
      <ul class="lista-progreso">${cursos.map((curso) => {
        const ids = new Set((curso.lessons || []).map((l) => l.id));
        const hechas = (p[curso.id]?.completed || []).filter((id) => ids.has(id)).length;
        const total = ids.size;
        const pct = total ? Math.round((hechas / total) * 100) : 0;
        return `<li><div><strong>${escaparHTML(campoTexto(curso, 'title'))}</strong><span>${hechas}/${total} · ${p[curso.id] ? escaparHTML(relativo(p[curso.id].updatedAt)) : escaparHTML(t('crm.sinEmpezar'))}</span></div><span class="barra-progreso"><span style="width:${pct}%"></span></span><b>${pct}%</b></li>`;
      }).join('')}</ul>`;
  },

  /* ---- Documentos: estados, comentarios y archivos del equipo ---- */
  async documentos(uid, zona) {
    zona.innerHTML = `
      <label class="zona-subida zona-compacta">
        <input type="file" id="doc-equipo" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx">
        <strong>${escaparHTML(t('crm.subirParaCliente'))}</strong>
        <span class="texto-suave-app">${escaparHTML(t('docs.formatos'))}</span>
      </label>
      <p class="texto-suave-app" id="doc-progreso" hidden></p>
      <ul class="lista-docs-admin" id="docs-admin"><li class="texto-suave-app">…</li></ul>`;
    const pintar = async () => {
      const snap = await fs().getDocs(col('users', uid, 'documents')).catch(() => ({ docs: [] }));
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
      $('#docs-admin').innerHTML = docs.length ? docs.map((d) => `
        <li class="doc-admin" data-doc="${escaparHTML(d.id)}">
          <div class="doc-admin-cabecera">
            <div><strong>${escaparHTML(d.name)}</strong><span class="texto-suave-app">${escaparHTML([String(d.format || '').toUpperCase(), d.bytes ? tamanoLegible(d.bytes) : '', fecha(d.createdAt), d.uploadedBy === 'admin' ? t('crm.delEquipo') : t('crm.delCliente')].filter(Boolean).join(' · '))}</span></div>
            ${esURLSegura(d.url) ? `<a class="btn btn-linea-app btn-sm" href="${escaparHTML(d.url)}" target="_blank" rel="noopener">${escaparHTML(t('docs.abrir'))}</a>` : ''}
          </div>
          ${d.uploadedBy === 'admin' ? '' : `
          <div class="doc-admin-edicion">
            <select data-campo="status" aria-label="${escaparHTML(t('crm.estadoDoc'))}">${['recibido', 'revision', 'aprobado', 'correccion'].map((s) => `<option value="${s}"${s === d.status ? ' selected' : ''}>${escaparHTML(t(`docs.estado.${s}`))}</option>`).join('')}</select>
            <input data-campo="adminComment" maxlength="500" placeholder="${escaparHTML(t('crm.comentarioPh'))}" value="${escaparHTML(d.adminComment || '')}" aria-label="${escaparHTML(t('docs.comentario'))}">
            <button type="button" class="btn btn-suave btn-sm" data-guardar-doc>${escaparHTML(t('adm.guardar'))}</button>
          </div>`}
        </li>`).join('') : `<li class="lista-vacia">${escaparHTML(t('crm.sinDocs'))}</li>`;
    };
    $('#docs-admin').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-guardar-doc]');
      if (!b) return;
      const li = b.closest('[data-doc]');
      const datos = { status: $('[data-campo="status"]', li).value, adminComment: $('[data-campo="adminComment"]', li).value.trim().slice(0, 500) };
      try {
        await fs().updateDoc(ref('users', uid, 'documents', li.dataset.doc), datos);
        toast(t('crm.docActualizado'));
        registrarActividad('documento', 'users', uid, `${datos.status}`);
      } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
    });
    $('#doc-equipo').addEventListener('change', async (e) => {
      const archivo = e.target.files[0];
      e.target.value = '';
      if (!archivo) return;
      if (archivo.size > CONFIG.cloudinary.maxBytes || !(TIPOS_DOCUMENTO[archivo.type] || /\.(pdf|jpe?g|png|webp|docx)$/i.test(archivo.name))) { toast(t('docs.errTipo', { nombre: archivo.name }), { tipo: 'error' }); return; }
      if (!cloudinaryConfigurado()) { toast(t('docs.sinConfig'), { tipo: 'info' }); return; }
      const aviso = $('#doc-progreso');
      aviso.hidden = false;
      try {
        const r = await subirACloudinary(archivo, { carpeta: `clientes/${uid}/documentos`, tipo: archivo.type.startsWith('image/') ? 'image' : 'auto', onProgreso: (p) => { aviso.textContent = t('adm.subiendo', { p }); } });
        await fs().addDoc(col('users', uid, 'documents'), {
          name: archivo.name.slice(0, 160), url: r.url, publicId: r.publicId, format: (r.format || archivo.name.split('.').pop()).slice(0, 10),
          bytes: r.bytes || archivo.size, uploadedBy: 'admin', status: 'aprobado', adminComment: '', createdAt: ahora(),
        });
        toast(t('docs.subido'));
        registrarActividad('subir', 'users', uid, archivo.name);
        pintar();
      } catch (error) { console.error(error); toast(t('docs.errSubida', { nombre: archivo.name }), { tipo: 'error' }); }
      aviso.hidden = true;
    });
    pintar();
  },

  /* ---- Tareas del plan de acción ---- */
  async tareas(uid, zona) {
    zona.innerHTML = `
      <form class="formulario form-app form-tarea" id="form-tarea">
        <div class="campo"><label for="tarea-titulo">${escaparHTML(t('crm.tareaTitulo'))}</label><input id="tarea-titulo" maxlength="140" required></div>
        <div class="campos-2">
          <div class="campo"><label for="tarea-detalle">${escaparHTML(t('crm.tareaDetalle'))}</label><input id="tarea-detalle" maxlength="400"></div>
          <div class="campo"><label for="tarea-fecha">${escaparHTML(t('crm.tareaFecha'))}</label><input id="tarea-fecha" type="date"></div>
        </div>
        <div class="fila-botones"><button type="submit" class="btn btn-suave btn-sm">${escaparHTML(t('crm.agregarTarea'))}</button></div>
      </form>
      <ul class="lista-tareas-admin" id="tareas-admin"></ul>`;
    const pintar = async () => {
      const snap = await fs().getDocs(col('users', uid, 'tasks')).catch(() => ({ docs: [] }));
      const tareas = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => Number(a.done) - Number(b.done) || String(a.dueDate || '9').localeCompare(String(b.dueDate || '9')));
      $('#tareas-admin').innerHTML = tareas.length ? tareas.map((x) => `
        <li data-tarea="${escaparHTML(x.id)}" class="${x.done ? 'hecha' : ''}">
          <label><input type="checkbox" data-hecha${x.done ? ' checked' : ''}><span><strong>${escaparHTML(x.title)}</strong>${x.detail ? `<small>${escaparHTML(x.detail)}</small>` : ''}</span></label>
          <span class="texto-suave-app">${x.dueDate ? escaparHTML(fecha(`${x.dueDate}T12:00:00`)) : ''}</span>
          <button type="button" class="btn-mini" data-borrar-tarea aria-label="${escaparHTML(t('adm.eliminar'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>
        </li>`).join('') : `<li class="lista-vacia">${escaparHTML(t('crm.sinTareas'))}</li>`;
    };
    $('#form-tarea').addEventListener('submit', async (e) => {
      e.preventDefault();
      const titulo = $('#tarea-titulo').value.trim();
      if (!titulo) return;
      try {
        await fs().addDoc(col('users', uid, 'tasks'), { title: titulo, detail: $('#tarea-detalle').value.trim(), dueDate: $('#tarea-fecha').value || '', done: false, createdBy: estado.admin.name || estado.usuario.email, createdAt: ahora() });
        e.target.reset();
        toast(t('crm.tareaAgregada'));
        registrarActividad('tarea', 'users', uid, titulo);
        pintar();
      } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
    });
    $('#tareas-admin').addEventListener('change', async (e) => {
      const casilla = e.target.closest('[data-hecha]');
      if (!casilla) return;
      const id = casilla.closest('[data-tarea]').dataset.tarea;
      await fs().updateDoc(ref('users', uid, 'tasks', id), { done: casilla.checked }).catch(() => toast(t('adm.errGuardar'), { tipo: 'error' }));
      pintar();
    });
    $('#tareas-admin').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-borrar-tarea]');
      if (!b) return;
      const id = b.closest('[data-tarea]').dataset.tarea;
      const snap = await fs().getDoc(ref('users', uid, 'tasks', id));
      const copia = snap.data();
      await fs().deleteDoc(ref('users', uid, 'tasks', id));
      pintar();
      conDeshacer(t('crm.tareaEliminada'), async () => { await fs().setDoc(ref('users', uid, 'tasks', id), copia); pintar(); toast(t('adm.deshecho')); });
    });
    pintar();
  },

  /* ---- Cursos restringidos asignados ---- */
  cursos(uid, zona) {
    const restringidos = cursos.filter((c) => c.access === 'restringido');
    if (!restringidos.length) { zona.innerHTML = `<p class="lista-vacia">${escaparHTML(t('crm.sinRestringidos'))}</p>`; return; }
    const editable = puede.editor();
    zona.innerHTML = `
      ${editable ? '' : `<p class="nota-privada">${escaparHTML(t('crm.soloEditor'))}</p>`}
      <ul class="lista-asignar">${restringidos.map((c) => `
        <li><label><input type="checkbox" data-curso="${escaparHTML(c.id)}"${(c.allowedUids || []).includes(uid) ? ' checked' : ''}${editable ? '' : ' disabled'}><span>${escaparHTML(campoTexto(c, 'title'))}</span></label><span class="texto-suave-app">${c.published ? escaparHTML(t('adm.publicado')) : escaparHTML(t('adm.oculto'))}</span></li>`).join('')}</ul>`;
    zona.addEventListener('change', async (e) => {
      const casilla = e.target.closest('[data-curso]');
      if (!casilla) return;
      const curso = cursos.find((c) => c.id === casilla.dataset.curso);
      const f = fs();
      try {
        await f.updateDoc(ref('courses', curso.id), { allowedUids: casilla.checked ? f.arrayUnion(uid) : f.arrayRemove(uid), updatedAt: ahora() });
        curso.allowedUids = casilla.checked ? [...(curso.allowedUids || []), uid] : (curso.allowedUids || []).filter((x) => x !== uid);
        toast(t(casilla.checked ? 'crm.cursoAsignado' : 'crm.cursoQuitado'));
        registrarActividad(casilla.checked ? 'asignar' : 'desasignar', 'courses', curso.id, uid);
      } catch { casilla.checked = !casilla.checked; toast(t('adm.errGuardar'), { tipo: 'error' }); }
    });
  },
};

/* ---------- Búsqueda global ---------- */
async function buscar(q) {
  await cargarClientes();
  const n = normalizar(q);
  return clientes.filter((c) => normalizar(`${nombre(c)} ${c.email} ${c.phone}`).includes(n))
    .map((c) => ({ titulo: nombre(c), sub: c.email, href: `#clientes/${encodeURIComponent(c.id)}` }));
}

export default {
  id: 'clientes',
  icono: 'clientes',
  clave: 'crm.menu',
  acceso: 'staff',
  montar,
  buscar,
  repintar: () => { if (vistaActual) { vistaActual.innerHTML = ''; montar(vistaActual, []); } },
  alCerrarSesion: () => { clientes = []; cursos = []; progresos = {}; cargado = false; },
};

registrarTextos({
  es: {
    'crm.menu': 'Clientes',
    'crm.buscar': 'Buscar por nombre, correo o teléfono',
    'crm.etapa': 'Etapa',
    'crm.todasEtapas': 'Todas las etapas',
    'crm.servicio': 'Servicio',
    'crm.todosServicios': 'Todos los servicios',
    'crm.todosIdiomas': 'Todos los idiomas',
    'crm.desde': 'Desde',
    'crm.recargar': 'Actualizar',
    'crm.conteo': '{n} de {total} clientes',
    'crm.sinFiltro': 'Ningún cliente coincide con estos filtros.',
    'crm.vacio': 'Aún no hay clientes registrados. Cuando alguien cree su cuenta en el portal aparecerá aquí.',
    'crm.cliente': 'Cliente',
    'crm.servicios': 'Servicios',
    'crm.progreso': 'Progreso',
    'crm.registro': 'Registro',
    'crm.correo': 'Correo',
    'crm.chat': 'Abrir chat',
    'crm.noEncontrado': 'No encontré a ese cliente.',
    'crm.miembroDesde': 'desde {fecha}',
    'crm.etapaCambiada': 'Etapa cambiada a {etapa}',
    'crm.tab.ficha': 'Ficha',
    'crm.tab.crm': 'CRM y notas',
    'crm.tab.progreso': 'Progreso',
    'crm.tab.documentos': 'Documentos',
    'crm.tab.tareas': 'Tareas',
    'crm.tab.cursos': 'Cursos',
    'crm.ultimaActividad': 'Última actividad',
    'crm.marketing': 'Acepta comunicaciones',
    'crm.terminos': 'Aceptó términos',
    'crm.si': 'Sí',
    'crm.no': 'No',
    'crm.privado': 'Todo lo de esta pestaña es interno: el cliente nunca lo ve.',
    'crm.responsable': 'Responsable',
    'crm.seguimiento': 'Fecha de seguimiento',
    'crm.proximaAccion': 'Próxima acción',
    'crm.etiquetas': 'Etiquetas',
    'crm.etiquetasPh': 'Separadas por comas: FAFSA 2027, prioridad',
    'crm.notas': 'Notas internas',
    'crm.notaNueva': 'Nueva nota',
    'crm.notaPh': 'Escribe una nota interna…',
    'crm.agregarNota': 'Agregar nota',
    'crm.notaAgregada': 'Nota agregada',
    'crm.sinNotas': 'Aún no hay notas.',
    'crm.sinCursos': 'Aún no hay cursos creados.',
    'crm.progresoGlobal': 'Progreso total: {n}%',
    'crm.sinEmpezar': 'sin empezar',
    'crm.subirParaCliente': 'Compartir un archivo con este cliente',
    'crm.delEquipo': 'del equipo',
    'crm.delCliente': 'del cliente',
    'crm.estadoDoc': 'Estado del documento',
    'crm.comentarioPh': 'Comentario para el cliente (opcional)',
    'crm.docActualizado': 'Documento actualizado',
    'crm.sinDocs': 'Este cliente aún no tiene documentos.',
    'crm.tareaTitulo': 'Nueva tarea',
    'crm.tareaDetalle': 'Detalle (opcional)',
    'crm.tareaFecha': 'Fecha límite',
    'crm.agregarTarea': 'Agregar tarea',
    'crm.tareaAgregada': 'Tarea agregada',
    'crm.tareaEliminada': 'Tarea eliminada',
    'crm.sinTareas': 'Sin tareas por ahora.',
    'crm.sinRestringidos': 'No hay cursos restringidos. Los cursos públicos ya los ve todo el mundo.',
    'crm.soloEditor': 'Solo un editor o la dueña pueden asignar cursos.',
    'crm.cursoAsignado': 'Curso asignado',
    'crm.cursoQuitado': 'Curso quitado',
  },
  en: {
    'crm.menu': 'Clients',
    'crm.buscar': 'Search by name, email or phone',
    'crm.etapa': 'Stage',
    'crm.todasEtapas': 'All stages',
    'crm.servicio': 'Service',
    'crm.todosServicios': 'All services',
    'crm.todosIdiomas': 'All languages',
    'crm.desde': 'Since',
    'crm.recargar': 'Refresh',
    'crm.conteo': '{n} of {total} clients',
    'crm.sinFiltro': 'No clients match these filters.',
    'crm.vacio': 'No registered clients yet. When someone creates an account in the portal, they’ll appear here.',
    'crm.cliente': 'Client',
    'crm.servicios': 'Services',
    'crm.progreso': 'Progress',
    'crm.registro': 'Signed up',
    'crm.correo': 'Email',
    'crm.chat': 'Open chat',
    'crm.noEncontrado': 'I couldn’t find that client.',
    'crm.miembroDesde': 'since {fecha}',
    'crm.etapaCambiada': 'Stage changed to {etapa}',
    'crm.tab.ficha': 'Profile',
    'crm.tab.crm': 'CRM & notes',
    'crm.tab.progreso': 'Progress',
    'crm.tab.documentos': 'Documents',
    'crm.tab.tareas': 'Tasks',
    'crm.tab.cursos': 'Courses',
    'crm.ultimaActividad': 'Last activity',
    'crm.marketing': 'Accepts communications',
    'crm.terminos': 'Accepted terms',
    'crm.si': 'Yes',
    'crm.no': 'No',
    'crm.privado': 'Everything on this tab is internal: the client never sees it.',
    'crm.responsable': 'Owner',
    'crm.seguimiento': 'Follow-up date',
    'crm.proximaAccion': 'Next action',
    'crm.etiquetas': 'Tags',
    'crm.etiquetasPh': 'Comma separated: FAFSA 2027, priority',
    'crm.notas': 'Internal notes',
    'crm.notaNueva': 'New note',
    'crm.notaPh': 'Write an internal note…',
    'crm.agregarNota': 'Add note',
    'crm.notaAgregada': 'Note added',
    'crm.sinNotas': 'No notes yet.',
    'crm.sinCursos': 'No courses created yet.',
    'crm.progresoGlobal': 'Overall progress: {n}%',
    'crm.sinEmpezar': 'not started',
    'crm.subirParaCliente': 'Share a file with this client',
    'crm.delEquipo': 'from the team',
    'crm.delCliente': 'from the client',
    'crm.estadoDoc': 'Document status',
    'crm.comentarioPh': 'Comment for the client (optional)',
    'crm.docActualizado': 'Document updated',
    'crm.sinDocs': 'This client has no documents yet.',
    'crm.tareaTitulo': 'New task',
    'crm.tareaDetalle': 'Detail (optional)',
    'crm.tareaFecha': 'Due date',
    'crm.agregarTarea': 'Add task',
    'crm.tareaAgregada': 'Task added',
    'crm.tareaEliminada': 'Task deleted',
    'crm.sinTareas': 'No tasks for now.',
    'crm.sinRestringidos': 'There are no restricted courses. Public courses are already visible to everyone.',
    'crm.soloEditor': 'Only an editor or the owner can assign courses.',
    'crm.cursoAsignado': 'Course assigned',
    'crm.cursoQuitado': 'Course removed',
  },
});
