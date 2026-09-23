/* ==========================================================================
   Cookies y Google Analytics 4 (opcional)
   - Si CONFIG.integraciones.ga4 no está configurado, no se muestra nada.
   - GA4 solo se carga después de que la persona acepta.
   - La decisión se guarda en localStorage ("sbk-cookies": "si" | "no").
   - Cualquier elemento [data-preferencias-cookies] vuelve a abrir el aviso.
   ========================================================================== */
import { CONFIG, esPendiente } from './config.js';
import { t } from './i18n.js';
import { escaparHTML } from './util.js';

const CLAVE = 'sbk-cookies';
const idGA = CONFIG.integraciones?.ga4;
const configurado = !esPendiente(idGA) && /^G-[A-Z0-9]{4,}$/.test(idGA);

const leer = () => { try { return localStorage.getItem(CLAVE); } catch { return null; } };
const guardar = (v) => { try { localStorage.setItem(CLAVE, v); } catch { /* sin almacenamiento */ } };

let cargado = false;
function cargarGA() {
  if (cargado || !configurado) return;
  cargado = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', idGA, { anonymize_ip: true });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(idGA)}`;
  document.head.append(s);
}

function mostrarAviso(raiz) {
  document.getElementById('aviso-cookies')?.remove();
  const aviso = document.createElement('div');
  aviso.id = 'aviso-cookies';
  aviso.className = 'aviso-cookies glass';
  aviso.setAttribute('role', 'region');
  aviso.setAttribute('aria-label', t('cookies.titulo'));
  aviso.innerHTML = `
    <p>${escaparHTML(t('cookies.texto'))} <a href="${raiz}privacidad.html#cookies">${escaparHTML(t('cookies.mas'))}</a></p>
    <div class="aviso-cookies-acciones">
      <button type="button" class="btn btn-vidrio btn-sm" data-cookies="no">${escaparHTML(t('cookies.rechazar'))}</button>
      <button type="button" class="btn btn-principal btn-sm" data-cookies="si">${escaparHTML(t('cookies.aceptar'))}</button>
    </div>`;
  document.body.append(aviso);
  requestAnimationFrame(() => aviso.classList.add('visible'));
  aviso.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cookies]');
    if (!b) return;
    guardar(b.dataset.cookies);
    if (b.dataset.cookies === 'si') cargarGA();
    aviso.classList.remove('visible');
    setTimeout(() => aviso.remove(), 300);
  });
}

export function iniciarCookies(raiz = '') {
  if (!configurado) {
    document.querySelectorAll('[data-preferencias-cookies]').forEach((el) => { el.hidden = true; });
    return;
  }
  const decision = leer();
  if (decision === 'si') cargarGA();
  else if (decision !== 'no') setTimeout(() => mostrarAviso(raiz), 1200);
  document.querySelectorAll('[data-preferencias-cookies]').forEach((el) => {
    el.hidden = false;
    el.addEventListener('click', (e) => { e.preventDefault(); mostrarAviso(raiz); });
  });
}
