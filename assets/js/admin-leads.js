/* ==========================================================================
   Panel admin · Leads
   Solicitudes del formulario y suscriptores del blog. Estados (nuevo,
   contactado, convertido, descartado), notas y vínculo con cliente registrado.
   ========================================================================== */
import { SERVICIOS, REFERENCIAS } from './config.js';
import { $, escaparHTML, toast } from './util.js';
import { t, registrarTextos } from './i18n.js';
import {
  estado, puede, fs, col, ref, ahora, registrarActividad, fecha, relativo, ms, normalizar,
  abrirCajon, confirmar, conDeshacer, estadoVacio, esqueletoTabla, icono, cerrarCajon,
} from './admin-nucleo.js';
import { cargarClientes } from './admin-clientes.js';

export const ESTADOS_LEAD = ['nuevo', 'contactado', 'convertido', 'descartado'];
let leads = [];
let cargado = false;
let filtros = { q: '', estado: '', origen: '' };
let vistaActual = null;
let ponerContadorMenu = null;

const nombre = (l) => `${l.firstName || ''} ${l.lastName || ''}`.trim() || l.email;
const soloDigitos = (s = '') => String(s).replace(/\D/g, '');

export async function cargarLeads(forzar = false) {
  if (cargado && !forzar) return leads;
  const snap = await fs().getDocs(col('leads'));
  leads = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
  cargado = true;
  actualizarContador();
  return leads;
}
export const obtenerLeads = () => leads;
function actualizarContador() { ponerContadorMenu?.('leads', leads.filter((l) => l.status === 'nuevo').length); }

const selectEstado = (id, actual) => `
  <select class="select-estado estado-${actual}" data-estado-de="${escaparHTML(id)}" aria-label="${escaparHTML(t('lead.estado'))}">
    ${ESTADOS_LEAD.map((e) => `<option value="${e}"${e === actual ? ' selected' : ''}>${escaparHTML(t(`lead.estado.${e}`))}</option>`).join('')}
  </select>`;

function filtrar() {
  const q = normalizar(filtros.q);
  return leads.filter((l) => (!q || normalizar(`${nombre(l)} ${l.email} ${l.phone} ${l.message}`).includes(q))
    && (!filtros.estado || l.status === filtros.estado)
    && (!filtros.origen || l.source === filtros.origen));
}

function pintarTabla() {
  const cuerpo = $('#tabla-leads tbody');
  if (!cuerpo) return;
  $$chips();
  const lista = filtrar();
  if (!lista.length) {
    cuerpo.innerHTML = `<tr><td colspan="7" class="celda-vacia">${escaparHTML(leads.length ? t('crm.sinFiltro') : t('lead.vacio'))}</td></tr>`;
    return;
  }
  cuerpo.innerHTML = lista.map((l) => `
    <tr class="${l.status === 'nuevo' ? 'fila-nueva' : ''}">
      <td><a class="celda-principal" href="#leads/${encodeURIComponent(l.id)}"><strong>${escaparHTML(nombre(l))}</strong><span>${escaparHTML(l.email || '')}</span></a></td>
      <td class="nowrap">${escaparHTML(l.phone || '—')}</td>
      <td><span class="chips-mini">${(l.services || []).slice(0, 2).map((s) => `<span>${escaparHTML((SERVICIOS.find((x) => x.id === s)?.[estado.idioma] || s).split(/[\s,]+/)[0])}</span>`).join('')}${(l.services || []).length > 2 ? `<span>+${l.services.length - 2}</span>` : ''}</span></td>
      <td class="nowrap"><span class="etiqueta-origen">${escaparHTML(t(`lead.origen.${l.source === 'blog-newsletter' ? 'boletin' : 'formulario'}`))}</span></td>
      <td>${selectEstado(l.id, l.status || 'nuevo')}</td>
      <td class="nowrap texto-suave-app">${escaparHTML(relativo(l.createdAt))}</td>
      <td class="nowrap">${l.linkedUid ? `<a class="btn-mini" href="#clientes/${encodeURIComponent(l.linkedUid)}" title="${escaparHTML(t('lead.verCliente'))}" aria-label="${escaparHTML(t('lead.verCliente'))}">${icono('clientes')}</a>` : ''}</td>
    </tr>`).join('');
}
function $$chips() {
  const zona = $('#chips-estado');
  if (!zona) return;
  zona.innerHTML = ['', ...ESTADOS_LEAD].map((e) => {
    const n = e ? leads.filter((l) => l.status === e).length : leads.length;
    return `<button type="button" class="filtro" data-estado="${e}" aria-pressed="${filtros.estado === e}">${escaparHTML(e ? t(`lead.estado.${e}`) : t('adm.todos'))} <span class="filtro-n">${n}</span></button>`;
  }).join('');
}

async function cambiarEstado(id, nuevo, { silencioso = false } = {}) {
  const l = leads.find((x) => x.id === id);
  const anterior = l.status;
  if (anterior === nuevo) return;
  l.status = nuevo;
  try {
    await fs().updateDoc(ref('leads', id), { status: nuevo });
    registrarActividad('estado', 'leads', id, `${nombre(l)}: ${anterior} → ${nuevo}`);
    if (!silencioso) conDeshacer(t('lead.estadoCambiado', { estado: t(`lead.estado.${nuevo}`) }), () => cambiarEstado(id, anterior, { silencioso: true }).then(() => toast(t('adm.deshecho'))));
  } catch {
    l.status = anterior;
    toast(t('adm.errGuardar'), { tipo: 'error' });
  }
  actualizarContador();
  pintarTabla();
  const s = $(`#cajon-cuerpo select[data-estado-de="${CSS.escape(id)}"]`);
  if (s) { s.value = l.status; s.className = `select-estado estado-${l.status}`; }
}

async function montar(vista, params) {
  vistaActual = vista;
  if (!vista.querySelector('#tabla-leads')) {
    vista.innerHTML = `
      <div class="barra-herramientas">
        <input type="search" id="l-q" class="campo-buscar" placeholder="${escaparHTML(t('lead.buscar'))}" aria-label="${escaparHTML(t('lead.buscar'))}" value="${escaparHTML(filtros.q)}">
        <select id="l-origen" aria-label="${escaparHTML(t('lead.origen'))}">
          <option value="">${escaparHTML(t('lead.todosOrigenes'))}</option>
          <option value="landing">${escaparHTML(t('lead.origen.formulario'))}</option>
          <option value="blog-newsletter">${escaparHTML(t('lead.origen.boletin'))}</option>
        </select>
        <button type="button" class="btn btn-linea-app btn-sm" id="btn-recargar-leads">${escaparHTML(t('crm.recargar'))}</button>
      </div>
      <div class="filtros" id="chips-estado" role="group" aria-label="${escaparHTML(t('lead.estado'))}"></div>
      <div class="panel panel-tabla"><div class="tabla-scroll">
        <table class="tabla tabla-tarjetas" id="tabla-leads">
          <thead><tr>
            <th scope="col">${escaparHTML(t('lead.persona'))}</th><th scope="col">${escaparHTML(t('reg.telefono'))}</th><th scope="col">${escaparHTML(t('crm.servicios'))}</th>
            <th scope="col">${escaparHTML(t('lead.origen'))}</th><th scope="col">${escaparHTML(t('lead.estado'))}</th><th scope="col">${escaparHTML(t('lead.recibido'))}</th><th scope="col"><span class="solo-lectores">${escaparHTML(t('lead.verCliente'))}</span></th>
          </tr></thead>
          <tbody><tr><td colspan="7">${esqueletoTabla(5)}</td></tr></tbody>
        </table>
      </div></div>`;
    $('#l-origen').value = filtros.origen;
    let tempo = 0;
    $('#l-q').addEventListener('input', (e) => { clearTimeout(tempo); tempo = setTimeout(() => { filtros.q = e.target.value; pintarTabla(); }, 150); });
    $('#l-origen').addEventListener('change', (e) => { filtros.origen = e.target.value; pintarTabla(); });
    $('#chips-estado').addEventListener('click', (e) => { const b = e.target.closest('[data-estado]'); if (b) { filtros.estado = b.dataset.estado; pintarTabla(); } });
    $('#btn-recargar-leads').addEventListener('click', async () => { await cargarLeads(true); pintarTabla(); });
    $('#tabla-leads').addEventListener('change', (e) => { const s = e.target.closest('select[data-estado-de]'); if (s) cambiarEstado(s.dataset.estadoDe, s.value); });
    try { await cargarLeads(); } catch (error) { console.error(error); vista.innerHTML = estadoVacio(t('adm.errCargar'), ''); return; }
    pintarTabla();
  }
  if (params[0]) abrirLead(params[0]);
}

/* ---------- Ficha del lead ---------- */
async function abrirLead(id) {
  await cargarLeads();
  const l = leads.find((x) => x.id === id);
  if (!l) { history.replaceState(null, '', '#leads'); return; }
  const referencia = REFERENCIAS.find((r) => r.id === l.referral);
  const cuerpo = abrirCajon({
    titulo: nombre(l),
    subtitulo: `${t(`lead.origen.${l.source === 'blog-newsletter' ? 'boletin' : 'formulario'}`)} · ${fecha(l.createdAt, { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`,
    onCerrar: () => { if (location.hash.startsWith('#leads/')) history.replaceState(null, '', '#leads'); },
    html: `
      <div class="acciones-rapidas">
        ${l.phone ? `<a class="btn btn-linea-app btn-sm" href="https://wa.me/${soloDigitos(l.phone)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
        ${l.email ? `<a class="btn btn-linea-app btn-sm" href="mailto:${escaparHTML(l.email)}">${escaparHTML(t('crm.correo'))}</a>` : ''}
        ${selectEstado(l.id, l.status || 'nuevo')}
      </div>
      <dl class="ficha-datos">
        <div><dt>${escaparHTML(t('acc.correo'))}</dt><dd>${escaparHTML(l.email || '—')}</dd></div>
        <div><dt>${escaparHTML(t('reg.telefono'))}</dt><dd>${escaparHTML(l.phone || '—')}</dd></div>
        <div><dt>${escaparHTML(t('reg.pais'))}</dt><dd>${escaparHTML(l.country || '—')}</dd></div>
        <div><dt>${escaparHTML(t('form.estado'))}</dt><dd>${escaparHTML(l.state || '—')}</dd></div>
        <div><dt>${escaparHTML(t('reg.idioma'))}</dt><dd>${l.language === 'en' ? 'English' : 'Español'}</dd></div>
        <div><dt>${escaparHTML(t('reg.referencia'))}</dt><dd>${escaparHTML(referencia ? referencia[estado.idioma] : (l.referral || '—'))}</dd></div>
      </dl>
      <h4 class="subtitulo-cajon">${escaparHTML(t('crm.servicios'))}</h4>
      <p class="chips-mini grande">${(l.services || []).map((s) => `<span>${escaparHTML(SERVICIOS.find((x) => x.id === s)?.[estado.idioma] || s)}</span>`).join('') || '—'}</p>
      ${l.message ? `<h4 class="subtitulo-cajon">${escaparHTML(t('lead.mensaje'))}</h4><blockquote class="mensaje-lead">${escaparHTML(l.message).replace(/\n/g, '<br>')}</blockquote>` : ''}
      <h4 class="subtitulo-cajon">${escaparHTML(t('lead.vinculo'))}</h4>
      <div id="zona-vinculo" class="zona-vinculo"><p class="texto-suave-app">…</p></div>
      <h4 class="subtitulo-cajon">${escaparHTML(t('crm.notas'))}</h4>
      <form class="nota-nueva" id="form-nota-lead">
        <label class="solo-lectores" for="nota-lead">${escaparHTML(t('crm.notaNueva'))}</label>
        <textarea id="nota-lead" rows="2" maxlength="2000" placeholder="${escaparHTML(t('crm.notaPh'))}"></textarea>
        <button type="submit" class="btn btn-suave btn-sm">${escaparHTML(t('crm.agregarNota'))}</button>
      </form>
      <ul class="lista-notas" id="notas-lead"></ul>
      ${puede.owner() ? `<div class="zona-peligro"><button type="button" class="btn btn-sm btn-peligro-suave" id="borrar-lead">${escaparHTML(t('adm.eliminarDef'))}</button></div>` : ''}`,
  });

  $('select[data-estado-de]', cuerpo).addEventListener('change', (e) => cambiarEstado(id, e.target.value));

  // Vincular con cliente registrado (mismo correo)
  const pintarVinculo = async () => {
    const zona = $('#zona-vinculo');
    const clientes = await cargarClientes().catch(() => []);
    if (l.linkedUid) {
      const c = clientes.find((x) => x.id === l.linkedUid);
      zona.innerHTML = `<p>${escaparHTML(t('lead.vinculado'))} <a href="#clientes/${encodeURIComponent(l.linkedUid)}">${escaparHTML(c ? `${c.firstName} ${c.lastName}` : l.linkedUid)}</a></p>`;
      return;
    }
    const coincidencia = clientes.find((c) => (c.email || '').toLowerCase() === (l.email || '').toLowerCase());
    zona.innerHTML = coincidencia
      ? `<p class="texto-suave-app">${escaparHTML(t('lead.coincidencia', { nombre: `${coincidencia.firstName} ${coincidencia.lastName}` }))}</p><button type="button" class="btn btn-suave btn-sm" id="btn-vincular">${escaparHTML(t('lead.vincular'))}</button>`
      : `<p class="texto-suave-app">${escaparHTML(t('lead.sinCuenta'))}</p>`;
    $('#btn-vincular')?.addEventListener('click', async () => {
      try {
        await fs().updateDoc(ref('leads', id), { linkedUid: coincidencia.id, status: 'convertido' });
        l.linkedUid = coincidencia.id; l.status = 'convertido';
        toast(t('lead.vinculadoOk'));
        registrarActividad('vincular', 'leads', id, coincidencia.id);
        actualizarContador(); pintarTabla(); pintarVinculo();
        const s = $('select[data-estado-de]', cuerpo); s.value = 'convertido';
      } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
    });
  };
  pintarVinculo();

  // Notas
  const pintarNotas = async () => {
    const snap = await fs().getDocs(col('leads', id, 'notes')).catch(() => ({ docs: [] }));
    const notas = snap.docs.map((d) => d.data()).sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
    $('#notas-lead').innerHTML = notas.length ? notas.map((n) => `<li><p>${escaparHTML(n.text).replace(/\n/g, '<br>')}</p><span>${escaparHTML(n.author || '')} · ${escaparHTML(relativo(n.createdAt))}</span></li>`).join('')
      : `<li class="texto-suave-app">${escaparHTML(t('crm.sinNotas'))}</li>`;
  };
  $('#form-nota-lead').addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = $('#nota-lead').value.trim();
    if (!texto) return;
    try {
      await fs().addDoc(col('leads', id, 'notes'), { text: texto.slice(0, 2000), author: estado.admin.name || estado.usuario.email, authorUid: estado.usuario.uid, createdAt: ahora() });
      $('#nota-lead').value = '';
      toast(t('crm.notaAgregada'));
      pintarNotas();
    } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
  });
  pintarNotas();

  $('#borrar-lead')?.addEventListener('click', async () => {
    const ok = await confirmar({ titulo: t('lead.borrarTitulo'), texto: t('lead.borrarTexto'), boton: t('adm.eliminarDef'), peligro: true, escribir: l.email });
    if (!ok) return;
    try {
      await fs().deleteDoc(ref('leads', id));
      leads = leads.filter((x) => x.id !== id);
      registrarActividad('eliminar', 'leads', id, l.email);
      toast(t('adm.eliminado'));
      cerrarCajon(true);
      actualizarContador(); pintarTabla();
    } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
  });
}

async function buscar(q) {
  await cargarLeads();
  const n = normalizar(q);
  return leads.filter((l) => normalizar(`${nombre(l)} ${l.email} ${l.phone}`).includes(n))
    .map((l) => ({ titulo: nombre(l), sub: `${l.email} · ${t(`lead.estado.${l.status}`)}`, href: `#leads/${encodeURIComponent(l.id)}` }));
}

export default {
  id: 'leads',
  icono: 'leads',
  clave: 'lead.menu',
  acceso: 'staff',
  montar,
  buscar,
  repintar: () => { if (vistaActual) { vistaActual.innerHTML = ''; montar(vistaActual, []); } },
  alIniciarSesion: ({ ponerContador }) => { ponerContadorMenu = ponerContador; cargarLeads().catch(() => {}); },
  refrescarContador: () => actualizarContador(),
  alCerrarSesion: () => { leads = []; cargado = false; },
};

registrarTextos({
  es: {
    'lead.menu': 'Leads',
    'lead.buscar': 'Buscar por nombre, correo, teléfono o mensaje',
    'lead.origen': 'Origen',
    'lead.todosOrigenes': 'Todos los orígenes',
    'lead.origen.formulario': 'Formulario',
    'lead.origen.boletin': 'Boletín del blog',
    'lead.estado': 'Estado',
    'lead.estado.nuevo': 'Nuevo',
    'lead.estado.contactado': 'Contactado',
    'lead.estado.convertido': 'Convertido',
    'lead.estado.descartado': 'Descartado',
    'lead.estadoCambiado': 'Lead marcado como {estado}',
    'lead.persona': 'Persona',
    'lead.recibido': 'Recibido',
    'lead.vacio': 'Aún no hay solicitudes. Cuando alguien llene el formulario de contacto aparecerá aquí.',
    'lead.verCliente': 'Ver cliente vinculado',
    'lead.mensaje': 'Mensaje',
    'lead.vinculo': 'Cliente registrado',
    'lead.vinculado': 'Vinculado con',
    'lead.coincidencia': 'Hay una cuenta en el portal con este correo: {nombre}.',
    'lead.vincular': 'Vincular y marcar como convertido',
    'lead.vinculadoOk': 'Lead vinculado',
    'lead.sinCuenta': 'Todavía no hay una cuenta en el portal con este correo.',
    'lead.borrarTitulo': 'Eliminar este lead',
    'lead.borrarTexto': 'Se borrará para siempre, junto con sus datos de contacto. Esta acción no se puede deshacer.',
  },
  en: {
    'lead.menu': 'Leads',
    'lead.buscar': 'Search by name, email, phone or message',
    'lead.origen': 'Source',
    'lead.todosOrigenes': 'All sources',
    'lead.origen.formulario': 'Form',
    'lead.origen.boletin': 'Blog newsletter',
    'lead.estado': 'Status',
    'lead.estado.nuevo': 'New',
    'lead.estado.contactado': 'Contacted',
    'lead.estado.convertido': 'Converted',
    'lead.estado.descartado': 'Discarded',
    'lead.estadoCambiado': 'Lead marked as {estado}',
    'lead.persona': 'Person',
    'lead.recibido': 'Received',
    'lead.vacio': 'No requests yet. When someone fills out the contact form, it’ll appear here.',
    'lead.verCliente': 'View linked client',
    'lead.mensaje': 'Message',
    'lead.vinculo': 'Registered client',
    'lead.vinculado': 'Linked to',
    'lead.coincidencia': 'There’s a portal account with this email: {nombre}.',
    'lead.vincular': 'Link and mark as converted',
    'lead.vinculadoOk': 'Lead linked',
    'lead.sinCuenta': 'There’s no portal account with this email yet.',
    'lead.borrarTitulo': 'Delete this lead',
    'lead.borrarTexto': 'It will be permanently deleted along with its contact details. This can’t be undone.',
  },
});
