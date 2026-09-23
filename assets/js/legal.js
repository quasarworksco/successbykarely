/* ==========================================================================
   Páginas legales: muestran el bloque del idioma activo (ES/EN),
   enlazan el botón de idioma y el aviso de cookies.
   ========================================================================== */
import { iniciarI18n } from './i18n.js';
import { iniciarCookies } from './cookies.js';

function mostrar(idioma) {
  document.querySelectorAll('[data-bloque-idioma]').forEach((b) => { b.hidden = b.dataset.bloqueIdioma !== idioma; });
  const titulo = document.querySelector(`[data-bloque-idioma="${idioma}"] h1`);
  if (titulo) document.title = `${titulo.textContent} | Success by Karely`;
}

mostrar(iniciarI18n());
document.addEventListener('idioma', (e) => mostrar(e.detail));
iniciarCookies('');
document.querySelectorAll('[data-anio]').forEach((el) => { el.textContent = new Date().getFullYear(); });
