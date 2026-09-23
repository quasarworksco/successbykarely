/* ==========================================================================
   Panel admin · Resumen
   KPIs, registros por semana, clientes por etapa, servicios más pedidos,
   artículos más leídos y aviso de imágenes pendientes (según el rol).
   ========================================================================== */
import { SERVICIOS, ESPACIOS_IMAGEN } from './config.js';
import { $, escaparHTML } from './util.js';
import { t, registrarTextos } from './i18n.js';
import { estado, puede, fs, col, cargarLibreria, ms, icono, campoTexto } from './admin-nucleo.js';

export const ETAPAS_CRM = ['nuevo', 'contactado', 'consulta', 'cliente', 'completado', 'pausa'];

let graficos = [];

function destruirGraficos() { graficos.forEach((g) => g.destroy()); graficos = []; }

function colores() {
  const oscuro = document.documentElement.dataset.efectivo === 'oscuro';
  return {
    barra: oscuro ? '#D3AE7A' : '#7A2A45',
    texto: oscuro ? 'rgba(246,220,185,.78)' : '#6B4B55',
    rejilla: oscuro ? 'rgba(246,220,185,.08)' : 'rgba(86,23,44,.07)',
  };
}

/* Gráfico de barras de una sola serie + tabla equivalente para lectores */
async function grafico(lienzo, etiquetas, valores, { horizontal = false, nombre = '' } = {}) {
  const Chart = await cargarLibreria('chart');
  const c = colores();
  const g = new Chart(lienzo, {
    type: 'bar',
    data: { labels: etiquetas, datasets: [{ label: nombre, data: valores, backgroundColor: c.barra, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 26 }] },
    options: {
      indexAxis: horizontal ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 600 },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(58,14,29,.92)', titleColor: '#F6DCB9', bodyColor: '#FFFCFA', padding: 10, cornerRadius: 10, displayColors: false } },
      scales: {
        x: { grid: { display: horizontal, color: c.rejilla }, ticks: { color: c.texto, font: { family: 'Plus Jakarta Sans', size: 11 }, precision: 0 }, border: { display: false } },
        y: { grid: { display: !horizontal, color: c.rejilla }, ticks: { color: c.texto, font: { family: 'Plus Jakarta Sans', size: 11 }, precision: 0 }, border: { display: false }, beginAtZero: true },
      },
    },
  });
  graficos.push(g);
}
const tablaDatos = (etiquetas, valores, cab) => `
  <details class="tabla-datos"><summary>${escaparHTML(t('res.verTabla'))}</summary>
    <table class="tabla"><thead><tr><th>${escaparHTML(cab)}</th><th>${escaparHTML(t('res.total'))}</th></tr></thead>
    <tbody>${etiquetas.map((e, i) => `<tr><td>${escaparHTML(e)}</td><td>${valores[i]}</td></tr>`).join('')}</tbody></table>
  </details>`;

const kpi = (valor, etiqueta, href, ico, destacado = false) => `
  <a class="kpi panel${destacado ? ' kpi-alerta' : ''}" href="${href}">
    <span class="tarjeta-icono">${icono(ico)}</span>
    <span class="kpi-valor">${valor}</span>
    <span class="kpi-etiqueta">${escaparHTML(etiqueta)}</span>
  </a>`;

async function montar(vista) {
  destruirGraficos();
  vista.innerHTML = `<div class="rejilla-kpis">${'<div class="esqueleto-app" style="min-height:120px"></div>'.repeat(4)}</div>`;
  const { fs: f } = estado.fb;
  const leer = (c) => f.getDocs(col(c)).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))).catch(() => []);
  const [usuarios, leadsLista, chats, crm, medios, posts] = await Promise.all([
    puede.staff() ? leer('users') : [],
    puede.staff() ? leer('leads') : [],
    puede.staff() ? leer('chats') : [],
    puede.staff() ? leer('crm') : [],
    leer('siteMedia'),
    puede.editor() ? leer('posts') : [],
  ]);

  const leadsNuevos = leadsLista.filter((l) => l.status === 'nuevo').length;
  const sinLeer = chats.reduce((s, c) => s + (Number(c.unreadByAdmin) || 0), 0);
  const listos = new Set(medios.filter((m) => m.url).map((m) => m.id));
  const faltan = ESPACIOS_IMAGEN.filter((e) => e.obligatorio && !e.galeria && !listos.has(e.id)).length;

  const kpis = [];
  if (puede.staff()) {
    kpis.push(kpi(usuarios.length, t('res.clientes'), '#clientes', 'clientes'));
    kpis.push(kpi(leadsNuevos, t('res.leadsNuevos'), '#leads', 'leads', leadsNuevos > 0));
    kpis.push(kpi(sinLeer, t('res.sinLeer'), '#mensajes', 'mensajes', sinLeer > 0));
  }
  if (puede.editor()) {
    kpis.push(kpi(posts.filter((p) => p.status === 'publicado').length, t('res.publicados'), '#blog', 'blog'));
  }

  vista.innerHTML = `
    ${faltan && puede.editor() ? `<a class="aviso-imagenes" href="#imagenes">${icono('imagenes')}<span><strong>${escaparHTML(t('res.faltanImg', { n: faltan }))}</strong> ${escaparHTML(t('res.faltanImgD'))}</span></a>` : ''}
    <div class="rejilla-kpis">${kpis.join('')}</div>
    <div class="rejilla-graficos" id="rejilla-graficos"></div>`;

  const zona = $('#rejilla-graficos');
  if (puede.staff()) {
    // Registros por semana (últimas 8)
    const semanas = Array.from({ length: 8 }, (_, i) => {
      const fin = new Date(); fin.setHours(23, 59, 59, 999); fin.setDate(fin.getDate() - (7 - i) * 7);
      const inicio = new Date(fin); inicio.setDate(inicio.getDate() - 6); inicio.setHours(0, 0, 0, 0);
      return { inicio: inicio.getTime(), fin: fin.getTime(), etiqueta: new Intl.DateTimeFormat(estado.idioma === 'en' ? 'en-US' : 'es-US', { day: 'numeric', month: 'short' }).format(inicio) };
    });
    const porSemana = semanas.map((s) => usuarios.filter((u) => { const x = ms(u.createdAt); return x >= s.inicio && x <= s.fin; }).length);

    const etapas = ETAPAS_CRM.map((e) => t(`crm.etapa.${e}`));
    const mapaCrm = Object.fromEntries(crm.map((c) => [c.id, c.stage]));
    const porEtapa = ETAPAS_CRM.map((e) => usuarios.filter((u) => (mapaCrm[u.id] || 'nuevo') === e).length);

    const conteo = Object.fromEntries(SERVICIOS.map((s) => [s.id, 0]));
    [...usuarios, ...leadsLista].forEach((x) => (x.services || []).forEach((s) => { if (s in conteo) conteo[s]++; }));
    const servicios = SERVICIOS.map((s) => ({ nombre: s[estado.idioma] || s.es, n: conteo[s.id] })).sort((a, b) => b.n - a.n);

    zona.insertAdjacentHTML('beforeend', `
      <section class="panel tarjeta-grafico ancho-2"><h3>${escaparHTML(t('res.registrosSemana'))}</h3><div class="lienzo"><canvas id="g-semanas" role="img" aria-label="${escaparHTML(t('res.registrosSemana'))}"></canvas></div>${tablaDatos(semanas.map((s) => s.etiqueta), porSemana, t('res.semana'))}</section>
      <section class="panel tarjeta-grafico"><h3>${escaparHTML(t('res.porEtapa'))}</h3><div class="lienzo"><canvas id="g-etapas" role="img" aria-label="${escaparHTML(t('res.porEtapa'))}"></canvas></div>${tablaDatos(etapas, porEtapa, t('res.etapa'))}</section>
      <section class="panel tarjeta-grafico ancho-2"><h3>${escaparHTML(t('res.servicios'))}</h3><div class="lienzo lienzo-alto"><canvas id="g-servicios" role="img" aria-label="${escaparHTML(t('res.servicios'))}"></canvas></div>${tablaDatos(servicios.map((s) => s.nombre), servicios.map((s) => s.n), t('res.servicio'))}</section>`);
    grafico($('#g-semanas'), semanas.map((s) => s.etiqueta), porSemana, { nombre: t('res.registros') }).catch(() => {});
    grafico($('#g-etapas'), etapas, porEtapa, { horizontal: true, nombre: t('res.clientes') }).catch(() => {});
    grafico($('#g-servicios'), servicios.map((s) => s.nombre), servicios.map((s) => s.n), { horizontal: true, nombre: t('res.solicitudes') }).catch(() => {});
  }
  if (puede.editor()) {
    const top = posts.filter((p) => p.status === 'publicado').sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
    zona.insertAdjacentHTML('beforeend', `
      <section class="panel tarjeta-grafico">
        <h3>${escaparHTML(t('res.masLeidos'))}</h3>
        ${top.length ? `<ol class="lista-ranking">${top.map((p) => `<li><a href="#blog/${encodeURIComponent(p.id)}">${escaparHTML(campoTexto(p, 'title'))}</a><span>${Number(p.views) || 0}</span></li>`).join('')}</ol>`
          : `<p class="lista-vacia">${escaparHTML(t('res.sinArticulos'))}</p>`}
      </section>`);
  }
}

export default {
  id: 'resumen',
  icono: 'resumen',
  clave: 'res.menu',
  acceso: 'todos',
  montar,
  desmontar: destruirGraficos,
};

registrarTextos({
  es: {
    'res.menu': 'Resumen',
    'res.clientes': 'Clientes registrados',
    'res.leadsNuevos': 'Leads sin atender',
    'res.sinLeer': 'Mensajes sin leer',
    'res.publicados': 'Artículos publicados',
    'res.faltanImg': 'Faltan {n} imágenes del sitio.',
    'res.faltanImgD': 'Súbelas desde Imágenes del sitio para completar el diseño.',
    'res.registrosSemana': 'Registros por semana',
    'res.porEtapa': 'Clientes por etapa',
    'res.servicios': 'Servicios más solicitados',
    'res.masLeidos': 'Artículos más leídos',
    'res.sinArticulos': 'Aún no hay artículos publicados.',
    'res.verTabla': 'Ver como tabla',
    'res.total': 'Total',
    'res.semana': 'Semana',
    'res.etapa': 'Etapa',
    'res.servicio': 'Servicio',
    'res.registros': 'Registros',
    'res.solicitudes': 'Solicitudes',
    'crm.etapa.nuevo': 'Nuevo',
    'crm.etapa.contactado': 'Contactado',
    'crm.etapa.consulta': 'Consulta',
    'crm.etapa.cliente': 'Cliente',
    'crm.etapa.completado': 'Completado',
    'crm.etapa.pausa': 'En pausa',
  },
  en: {
    'res.menu': 'Overview',
    'res.clientes': 'Registered clients',
    'res.leadsNuevos': 'Unattended leads',
    'res.sinLeer': 'Unread messages',
    'res.publicados': 'Published articles',
    'res.faltanImg': '{n} site images are missing.',
    'res.faltanImgD': 'Upload them from Site images to complete the design.',
    'res.registrosSemana': 'Sign-ups per week',
    'res.porEtapa': 'Clients by stage',
    'res.servicios': 'Most requested services',
    'res.masLeidos': 'Most read articles',
    'res.sinArticulos': 'No published articles yet.',
    'res.verTabla': 'View as table',
    'res.total': 'Total',
    'res.semana': 'Week',
    'res.etapa': 'Stage',
    'res.servicio': 'Service',
    'res.registros': 'Sign-ups',
    'res.solicitudes': 'Requests',
    'crm.etapa.nuevo': 'New',
    'crm.etapa.contactado': 'Contacted',
    'crm.etapa.consulta': 'Consultation',
    'crm.etapa.cliente': 'Client',
    'crm.etapa.completado': 'Completed',
    'crm.etapa.pausa': 'On hold',
  },
});
