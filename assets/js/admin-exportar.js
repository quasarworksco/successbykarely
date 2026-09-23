/* ==========================================================================
   Panel admin · Exportar
   CSV con BOM UTF-8 (Excel respeta acentos) de clientes, leads y suscriptores.
   ========================================================================== */
import { SERVICIOS } from './config.js';
import { $, escaparHTML, toast, descargarCSV, fechaLocal } from './util.js';
import { t, registrarTextos } from './i18n.js';
import { fs, col, ms, registrarActividad, icono } from './admin-nucleo.js';

const fechaISO = (v) => { const x = ms(v); return x ? new Date(x).toISOString().replace('T', ' ').slice(0, 16) : ''; };
const servicios = (lista = []) => lista.map((s) => SERVICIOS.find((x) => x.id === s)?.es || s).join('; ');

async function exportarClientes() {
  const [u, c] = await Promise.all([fs().getDocs(col('users')), fs().getDocs(col('crm')).catch(() => ({ docs: [] }))]);
  const crm = Object.fromEntries(c.docs.map((d) => [d.id, d.data()]));
  const filas = [['UID', 'Nombre', 'Apellido', 'Correo', 'Teléfono', 'País', 'Estado', 'Ciudad', 'Idioma', 'Situación', 'Servicios', 'Cómo nos conoció', 'Acepta comunicaciones', 'Etapa CRM', 'Etiquetas', 'Responsable', 'Próxima acción', 'Registro', 'Última actividad']];
  u.docs.forEach((d) => {
    const x = d.data();
    const m = crm[d.id] || {};
    filas.push([d.id, x.firstName, x.lastName, x.email, x.phone, x.country, x.state, x.city, x.language, x.situation, servicios(x.services), x.referral, x.consentMarketing ? 'Sí' : 'No', m.stage || 'nuevo', (m.tags || []).join('; '), m.owner, m.nextAction, fechaISO(x.createdAt), fechaISO(x.lastActiveAt)]);
  });
  return { filas, nombre: `clientes-${fechaLocal()}.csv` };
}

async function exportarLeads(fuente) {
  const snap = await fs().getDocs(col('leads'));
  const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((l) => (fuente === 'blog-newsletter' ? l.source === 'blog-newsletter' : l.source !== 'blog-newsletter'))
    .sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
  const filas = fuente === 'blog-newsletter'
    ? [['Correo', 'Nombre', 'Idioma', 'Consentimiento', 'Fecha'], ...lista.map((l) => [l.email, `${l.firstName || ''} ${l.lastName || ''}`.trim(), l.language, l.consent ? 'Sí' : 'No', fechaISO(l.createdAt)])]
    : [['ID', 'Nombre', 'Apellido', 'Correo', 'Teléfono', 'País', 'Estado', 'Servicios', 'Mensaje', 'Cómo nos conoció', 'Idioma', 'Estado del lead', 'Cliente vinculado', 'Fecha'],
      ...lista.map((l) => [l.id, l.firstName, l.lastName, l.email, l.phone, l.country, l.state, servicios(l.services), l.message, l.referral, l.language, l.status, l.linkedUid || '', fechaISO(l.createdAt)])];
  return { filas, nombre: `${fuente === 'blog-newsletter' ? 'suscriptores' : 'leads'}-${fechaLocal()}.csv` };
}

function montar(vista) {
  const tarjeta = (id, titulo, desc) => `
    <article class="panel tarjeta-exportar">
      <span class="tarjeta-icono">${icono('exportar')}</span>
      <h3>${escaparHTML(t(titulo))}</h3>
      <p class="texto-suave-app">${escaparHTML(t(desc))}</p>
      <button type="button" class="btn btn-principal btn-sm" data-exportar="${id}">${escaparHTML(t('exp.descargar'))}</button>
    </article>`;
  vista.innerHTML = `
    <p class="texto-suave-app" style="margin-bottom:18px">${escaparHTML(t('exp.ayuda'))}</p>
    <div class="rejilla-exportar">
      ${tarjeta('clientes', 'exp.clientes', 'exp.clientesD')}
      ${tarjeta('leads', 'exp.leads', 'exp.leadsD')}
      ${tarjeta('suscriptores', 'exp.suscriptores', 'exp.suscriptoresD')}
    </div>`;
  vista.querySelector('.rejilla-exportar').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-exportar]');
    if (!b) return;
    b.disabled = true;
    try {
      const tipo = b.dataset.exportar;
      const { filas, nombre } = tipo === 'clientes' ? await exportarClientes() : await exportarLeads(tipo === 'suscriptores' ? 'blog-newsletter' : 'landing');
      descargarCSV(nombre, filas);
      toast(t('exp.listo', { n: filas.length - 1 }));
      registrarActividad('exportar', tipo, '', `${filas.length - 1}`);
    } catch (error) {
      console.error(error);
      toast(t('adm.errCargar'), { tipo: 'error' });
    } finally { b.disabled = false; }
  });
}

export default { id: 'exportar', icono: 'exportar', clave: 'exp.menu', acceso: 'staff', montar };

registrarTextos({
  es: {
    'exp.menu': 'Exportar',
    'exp.ayuda': 'Descarga archivos CSV que se abren directo en Excel o Google Sheets, con acentos correctos.',
    'exp.clientes': 'Clientes',
    'exp.clientesD': 'Todos los datos del perfil más la etapa, etiquetas y responsable del CRM.',
    'exp.leads': 'Leads del formulario',
    'exp.leadsD': 'Solicitudes de contacto con su estado y mensaje.',
    'exp.suscriptores': 'Suscriptores del blog',
    'exp.suscriptoresD': 'Correos que se suscribieron al boletín.',
    'exp.descargar': 'Descargar CSV',
    'exp.listo': 'Archivo descargado ({n} filas)',
  },
  en: {
    'exp.menu': 'Export',
    'exp.ayuda': 'Download CSV files that open directly in Excel or Google Sheets, with correct accents.',
    'exp.clientes': 'Clients',
    'exp.clientesD': 'All profile data plus CRM stage, tags and owner.',
    'exp.leads': 'Form leads',
    'exp.leadsD': 'Contact requests with their status and message.',
    'exp.suscriptores': 'Blog subscribers',
    'exp.suscriptoresD': 'Emails subscribed to the newsletter.',
    'exp.descargar': 'Download CSV',
    'exp.listo': 'File downloaded ({n} rows)',
  },
});
