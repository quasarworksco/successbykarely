/* ==========================================================================
   Propuesta DGP Group USA → Karely Paredes
   Revelado al hacer scroll, contadores de precio, anillos, halo del cursor,
   barra fija para elegir plan y enlaces de WhatsApp por plan.
   ========================================================================== */

const WHATSAPP_DGP = '12398231738';
const MENSAJES = {
  Completo: 'Hola Andrés, soy Karely Paredes. Revisé la propuesta y quiero avanzar con el Plan Completo ($882).',
  Esencial: 'Hola Andrés, soy Karely Paredes. Revisé la propuesta y me interesa el Plan Esencial ($575).',
};

const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const punteroFino = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

document.documentElement.classList.add('js');

/* Enlaces de WhatsApp con mensaje prellenado según el plan */
$$('[data-whatsapp]').forEach((enlace) => {
  const mensaje = MENSAJES[enlace.dataset.whatsapp] || MENSAJES.Completo;
  enlace.href = `https://wa.me/${WHATSAPP_DGP}?text=${encodeURIComponent(mensaje)}`;
  enlace.target = '_blank';
  enlace.rel = 'noopener';
});

/* Navegación en cápsula al hacer scroll + barra fija para elegir plan */
const nav = document.getElementById('nav');
const barra = document.getElementById('barra-elegir');
const hero = document.getElementById('inicio');
const cta = document.querySelector('.cta-final');
let ctaVisible = false;
new IntersectionObserver(([e]) => { ctaVisible = e.isIntersecting; actualizarBarra(); }).observe(cta);
function actualizarBarra() {
  const pasoHero = window.scrollY > hero.offsetHeight * 0.8;
  const mostrar = pasoHero && !ctaVisible;
  barra.classList.toggle('visible', mostrar);
  barra.setAttribute('aria-hidden', String(!mostrar));
  barra.querySelector('a').tabIndex = mostrar ? 0 : -1;
}
let pendiente = false;
window.addEventListener('scroll', () => {
  if (pendiente) return;
  pendiente = true;
  requestAnimationFrame(() => {
    nav.classList.toggle('flotante', window.scrollY > 24);
    actualizarBarra();
    pendiente = false;
  });
}, { passive: true });

/* Contador animado de precios */
function contar(el) {
  const final = Number(el.dataset.contar);
  if (reducir) { el.textContent = final; return; }
  const inicio = performance.now();
  const duracion = 1400;
  const paso = (ahora) => {
    const t = Math.min(1, (ahora - inicio) / duracion);
    el.textContent = Math.round(final * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

/* Revelado al entrar en pantalla (tarjetas, maquetas, precios, anillos) */
const observador = new IntersectionObserver((entradas, obs) => {
  entradas.forEach((entrada) => {
    if (!entrada.isIntersecting) return;
    const el = entrada.target;
    el.classList.add('visible');
    $$('[data-contar]', el).forEach(contar);
    $$('.m-anillo .valor', el).forEach((c) => { c.style.strokeDasharray = `${c.dataset.valor} 100`; });
    obs.unobserve(el);
  });
}, { threshold: 0.18 });
$$('[data-aparecer], .modulo-visual').forEach((el) => observador.observe(el));

/* Orbes activos solo en pantalla */
const obsFondos = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('activo', e.isIntersecting)));
$$('.fondo-vivo').forEach((f) => obsFondos.observe(f));

if (!reducir && punteroFino) {
  /* Halo dorado que sigue el cursor */
  $$('.seccion-oscura').forEach((seccion) => {
    const halo = seccion.querySelector('.halo');
    if (!halo) return;
    seccion.addEventListener('pointermove', (e) => {
      const caja = seccion.getBoundingClientRect();
      halo.style.setProperty('--hx', `${e.clientX - caja.left}px`);
      halo.style.setProperty('--hy', `${e.clientY - caja.top}px`);
    });
    seccion.addEventListener('pointerenter', () => seccion.classList.add('con-halo'));
    seccion.addEventListener('pointerleave', () => seccion.classList.remove('con-halo'));
  });

  /* Inclinación 3D suave en maquetas y razones (máx. 4°) */
  $$('.maqueta, .razon').forEach((tarjeta) => {
    tarjeta.addEventListener('pointermove', (e) => {
      const caja = tarjeta.getBoundingClientRect();
      const x = (e.clientX - caja.left) / caja.width - 0.5;
      const y = (e.clientY - caja.top) / caja.height - 0.5;
      tarjeta.style.transform = `perspective(900px) rotateX(${(-y * 8).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg)`;
    });
    tarjeta.addEventListener('pointerleave', () => { tarjeta.style.transform = ''; });
  });
}
