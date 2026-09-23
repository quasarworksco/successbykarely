/* ==========================================================================
   Panel admin · Testimonios y Anuncios
   Un mismo generador de CRUD: crear, editar, foto opcional, publicar/ocultar,
   reordenar (arrastrar o botones), papelera con restaurar y "Deshacer".
   ========================================================================== */
import { CONFIG } from './config.js';
import { $, escaparHTML, toast, subirACloudinary, cloudinaryConfigurado, urlCloudinary } from './util.js';
import { t, registrarTextos } from './i18n.js';
import {
  fs, col, ref, ahora, registrarActividad, fecha, normalizar, campoTexto,
  abrirCajon, cerrarCajon, marcarSucio, confirmar, conDeshacer, estadoVacio, hacerOrdenable, botonesMover,
  guardarOrden, recortarImagen, interruptor, esURLSegura, icono,
} from './admin-nucleo.js';

/**
 * @param {{id: string, icono: string, clave: string, coleccion: string, foto?: boolean,
 *   campos: {id: string, etiqueta: string, tipo?: 'texto'|'area'|'url', max: number, requerido?: boolean, en?: boolean}[],
 *   titulo: (d: object) => string, detalle: (d: object) => string, vacio: [string, string]}} cfg
 */
function crearModulo(cfg) {
  let items = [];
  let cargado = false;
  let verPapelera = false;
  let vistaActual = null;

  const cargar = async (forzar = false) => {
    if (cargado && !forzar) return;
    const snap = await fs().getDocs(col(cfg.coleccion));
    items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    cargado = true;
  };

  const pintar = () => {
    const zona = $(`#lista-${cfg.id}`);
    if (!zona) return;
    const lista = items.filter((x) => Boolean(x.deletedAt) === verPapelera);
    $(`#papelera-${cfg.id}`).textContent = verPapelera ? t('adm.verActivos') : `${t('adm.verPapelera')} (${items.filter((x) => x.deletedAt).length})`;
    if (!lista.length) {
      zona.innerHTML = verPapelera ? `<li class="lista-vacia">${escaparHTML(t('adm.papeleraVacia'))}</li>` : `<li>${estadoVacio(t(cfg.vacio[0]), t(cfg.vacio[1]), icono(cfg.icono))}</li>`;
      return;
    }
    zona.innerHTML = lista.map((x) => `
      <li class="fila-contenido" data-id="${escaparHTML(x.id)}">
        ${verPapelera ? '' : botonesMover()}
        ${cfg.foto ? `<span class="miniatura redonda">${esURLSegura(x.photoUrl) ? `<img src="${escaparHTML(urlCloudinary(x.photoUrl, 'f_auto,q_auto,c_fill,g_face,w_96,h_96'))}" alt="" loading="lazy">` : `<span>${escaparHTML((cfg.titulo(x) || '?')[0])}</span>`}</span>` : ''}
        <div class="fila-texto"><strong>${escaparHTML(cfg.titulo(x))}</strong><span>${escaparHTML(cfg.detalle(x))}</span></div>
        ${verPapelera ? `
          <button type="button" class="btn btn-linea-app btn-sm" data-restaurar="${escaparHTML(x.id)}">${escaparHTML(t('adm.restaurar'))}</button>
          <button type="button" class="btn btn-peligro-suave btn-sm" data-borrar="${escaparHTML(x.id)}">${escaparHTML(t('adm.eliminarDef'))}</button>` : `
          <button type="button" class="estado-pub boton-estado ${x.published ? 'pub' : ''}" data-alternar="${escaparHTML(x.id)}" aria-label="${escaparHTML(x.published ? t('adm.ocultar') : t('adm.publicar'))}">${escaparHTML(x.published ? t('adm.publicado') : t('adm.oculto'))}</button>
          <a class="btn btn-linea-app btn-sm" href="#${cfg.id}/${encodeURIComponent(x.id)}">${escaparHTML(t('adm.editar'))}</a>`}
      </li>`).join('');
  };

  const actualizar = async (id, cambios, accion) => {
    const x = items.find((i) => i.id === id);
    const antes = Object.fromEntries(Object.keys(cambios).map((k) => [k, x[k]]));
    await fs().updateDoc(ref(cfg.coleccion, id), { ...cambios, updatedAt: ahora() });
    Object.assign(x, cambios);
    registrarActividad(accion, cfg.coleccion, id, cfg.titulo(x));
    pintar();
    return antes;
  };

  const alternar = async (id) => {
    const x = items.find((i) => i.id === id);
    try {
      await actualizar(id, { published: !x.published }, x.published ? 'ocultar' : 'publicar');
      toast(t(x.published ? 'adm.publicado' : 'adm.oculto'));
    } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
  };

  const moverPapelera = async (id) => {
    const x = items.find((i) => i.id === id);
    const publicado = x.published;
    try {
      await fs().updateDoc(ref(cfg.coleccion, id), { deletedAt: ahora(), published: false, updatedAt: ahora() });
      Object.assign(x, { deletedAt: new Date(), published: false });
      registrarActividad('papelera', cfg.coleccion, id, cfg.titulo(x));
      pintar();
      cerrarCajon(true);
      conDeshacer(t('adm.movidoPapelera'), async () => {
        await fs().updateDoc(ref(cfg.coleccion, id), { deletedAt: fs().deleteField(), published: publicado });
        delete x.deletedAt; x.published = publicado;
        pintar();
        toast(t('adm.deshecho'));
      });
    } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
  };

  const restaurar = async (id) => {
    const x = items.find((i) => i.id === id);
    try {
      await fs().updateDoc(ref(cfg.coleccion, id), { deletedAt: fs().deleteField(), updatedAt: ahora() });
      delete x.deletedAt;
      registrarActividad('restaurar', cfg.coleccion, id, cfg.titulo(x));
      toast(t('adm.restaurado'));
      pintar();
    } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
  };

  const borrar = async (id) => {
    const x = items.find((i) => i.id === id);
    const titulo = cfg.titulo(x).slice(0, 40);
    const ok = await confirmar({ titulo: t('cont.borrarTitulo'), texto: t('cont.borrarTexto'), boton: t('adm.eliminarDef'), peligro: true, escribir: titulo });
    if (!ok) return;
    try {
      await fs().deleteDoc(ref(cfg.coleccion, id));
      items = items.filter((i) => i.id !== id);
      registrarActividad('eliminar', cfg.coleccion, id, titulo);
      toast(t('adm.eliminado'));
      pintar();
    } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
  };

  /* ---------- Editor ---------- */
  const abrirEditor = async (id) => {
    await cargar();
    const nuevo = id === 'nuevo';
    const x = nuevo ? { published: false } : items.find((i) => i.id === id);
    if (!x) { history.replaceState(null, '', `#${cfg.id}`); return; }
    const datos = { ...x };
    const campo = (c, sufijo = '') => {
      const valor = datos[`${c.id}${sufijo}`] || '';
      const idCampo = `e-${c.id}${sufijo}`;
      const req = c.requerido && !sufijo ? ' required' : '';
      const etiqueta = `${t(c.etiqueta)}${sufijo ? ' (English)' : ''}${req ? ' *' : ''}`;
      const control = c.tipo === 'area'
        ? `<textarea id="${idCampo}" rows="4" maxlength="${c.max}"${req}>${escaparHTML(valor)}</textarea>`
        : `<input id="${idCampo}" type="${c.tipo === 'url' ? 'url' : 'text'}" maxlength="${c.max}"${req} value="${escaparHTML(valor)}"${c.tipo === 'url' ? ' placeholder="https://…"' : ''}>`;
      return `<div class="campo"><label for="${idCampo}">${escaparHTML(etiqueta)}</label>${control}<span class="contador-campo" data-contar="${idCampo}">${valor.length}/${c.max}</span></div>`;
    };
    const cuerpo = abrirCajon({
      titulo: nuevo ? t(`${cfg.id}.nuevo`) : cfg.titulo(x),
      subtitulo: nuevo ? '' : fecha(x.createdAt),
      onCerrar: () => { if (location.hash.startsWith(`#${cfg.id}/`)) history.replaceState(null, '', `#${cfg.id}`); },
      html: `
        <form class="formulario form-app" id="form-${cfg.id}" novalidate>
          ${cfg.foto ? `
          <div class="foto-editor">
            <span class="miniatura redonda grande" id="foto-vista">${esURLSegura(datos.photoUrl) ? `<img src="${escaparHTML(urlCloudinary(datos.photoUrl, 'f_auto,q_auto,c_fill,g_face,w_192,h_192'))}" alt="">` : `<span>${escaparHTML(t('adm.foto'))}</span>`}</span>
            <label class="btn btn-linea-app btn-sm">${escaparHTML(datos.photoUrl ? t('adm.cambiarFoto') : t('cont.subirFoto'))}<input type="file" id="archivo-foto" accept="image/jpeg,image/png,image/webp" hidden></label>
            ${datos.photoUrl ? `<button type="button" class="btn btn-sm btn-peligro-suave" id="quitar-foto">${escaparHTML(t('adm.quitar'))}</button>` : ''}
          </div>` : ''}
          ${cfg.campos.map((c) => campo(c)).join('')}
          ${cfg.campos.some((c) => c.en) ? `<details class="version-en"${cfg.campos.some((c) => c.en && datos[`${c.id}_en`]) ? ' open' : ''}><summary>${escaparHTML(t('adm.version'))}</summary>${cfg.campos.filter((c) => c.en).map((c) => campo(c, '_en')).join('')}</details>` : ''}
          ${interruptor('e-publicado', datos.published, t('adm.publicado'))}
          <div class="barra-guardar-cajon">
            ${nuevo ? '' : `<button type="button" class="btn btn-sm btn-peligro-suave" id="e-papelera">${escaparHTML(t('adm.moverPapelera'))}</button>`}
            <span class="espaciador"></span>
            <button type="submit" class="btn btn-principal btn-sm">${escaparHTML(nuevo ? t('adm.crear') : t('adm.guardar'))}</button>
          </div>
        </form>`,
    });
    const form = $(`#form-${cfg.id}`, cuerpo);
    form.addEventListener('input', (e) => {
      marcarSucio(true);
      const contador = e.target.id && $(`[data-contar="${e.target.id}"]`, form);
      if (contador) contador.textContent = `${e.target.value.length}/${e.target.maxLength}`;
      if (e.target.getAttribute('aria-invalid') === 'true' && e.target.value.trim()) e.target.removeAttribute('aria-invalid');
    });

    if (cfg.foto) {
      const pintarFoto = () => {
        $('#foto-vista').innerHTML = esURLSegura(datos.photoUrl) ? `<img src="${escaparHTML(urlCloudinary(datos.photoUrl, 'f_auto,q_auto,c_fill,g_face,w_192,h_192'))}" alt="">` : `<span>${escaparHTML(t('adm.foto'))}</span>`;
      };
      $('#archivo-foto').addEventListener('change', async (e) => {
        const archivo = e.target.files[0];
        e.target.value = '';
        if (!archivo) return;
        if (!/^image\/(jpeg|png|webp)$/.test(archivo.type) || archivo.size > CONFIG.cloudinary.maxBytes) { toast(t('adm.errImagen'), { tipo: 'error' }); return; }
        if (!cloudinaryConfigurado()) { toast(t('docs.sinConfig'), { tipo: 'info' }); return; }
        const blob = await recortarImagen(archivo, { ratio: 1, anchoMax: 600, tipo: 'image/jpeg' });
        if (!blob) return;
        $('#foto-vista').innerHTML = '<span>…</span>';
        try {
          const r = await subirACloudinary(blob, { carpeta: 'testimonios', tipo: 'image' });
          datos.photoUrl = r.url; datos.photoPublicId = r.publicId;
          marcarSucio(true);
        } catch { toast(t('docs.errSubida', { nombre: archivo.name }), { tipo: 'error' }); }
        pintarFoto();
      });
      $('#quitar-foto')?.addEventListener('click', () => { datos.photoUrl = ''; datos.photoPublicId = ''; marcarSucio(true); pintarFoto(); });
    }

    const guardar = async (e) => {
      e?.preventDefault();
      const valores = {};
      let invalido = null;
      cfg.campos.forEach((c) => {
        const v = $(`#e-${c.id}`, form).value.trim().slice(0, c.max);
        if (c.requerido && !v) { invalido ??= $(`#e-${c.id}`, form); $(`#e-${c.id}`, form).setAttribute('aria-invalid', 'true'); }
        if (c.tipo === 'url' && v && !esURLSegura(v)) { invalido ??= $(`#e-${c.id}`, form); $(`#e-${c.id}`, form).setAttribute('aria-invalid', 'true'); }
        valores[c.id] = v;
        if (c.en) valores[`${c.id}_en`] = $(`#e-${c.id}_en`, form).value.trim().slice(0, c.max);
      });
      if (invalido) { invalido.focus(); toast(t('cont.revisa'), { tipo: 'error' }); return; }
      if (cfg.foto) { valores.photoUrl = datos.photoUrl || ''; valores.photoPublicId = datos.photoPublicId || ''; }
      valores.published = $('#e-publicado', form).checked;
      try {
        if (nuevo) {
          const doc = await fs().addDoc(col(cfg.coleccion), { ...valores, order: -1, createdAt: ahora(), updatedAt: ahora() });
          items.unshift({ id: doc.id, ...valores, order: -1, createdAt: new Date() });
          registrarActividad('crear', cfg.coleccion, doc.id, cfg.titulo(valores));
          toast(t('adm.creado'));
          marcarSucio(false);
          cerrarCajon(true);
          await guardarOrden(cfg.coleccion, items.filter((i) => !i.deletedAt).map((i) => i.id)).catch(() => {});
          items.forEach((it, i) => { it.order = i; });
        } else {
          await fs().updateDoc(ref(cfg.coleccion, x.id), { ...valores, updatedAt: ahora() });
          Object.assign(x, valores);
          registrarActividad('editar', cfg.coleccion, x.id, cfg.titulo(x));
          toast(t('adm.guardado'));
          marcarSucio(false);
        }
        pintar();
      } catch (error) { console.error(error); toast(t('adm.errGuardar'), { tipo: 'error' }); }
    };
    form.addEventListener('submit', guardar);
    const atajo = () => { if (document.body.contains(form)) guardar(); else document.removeEventListener('admin:guardar', atajo); };
    document.addEventListener('admin:guardar', atajo);
    $('#e-papelera', form)?.addEventListener('click', () => { marcarSucio(false); moverPapelera(x.id); });
  };

  const montar = async (vista, params) => {
    vistaActual = vista;
    if (!vista.querySelector(`#lista-${cfg.id}`)) {
      vista.innerHTML = `
        <div class="barra-herramientas">
          <p class="texto-suave-app">${escaparHTML(t(`${cfg.id}.ayuda`))}</p>
          <span class="espaciador"></span>
          <button type="button" class="btn btn-linea-app btn-sm" id="papelera-${cfg.id}"></button>
          <a class="btn btn-principal btn-sm" href="#${cfg.id}/nuevo">${escaparHTML(t(`${cfg.id}.nuevo`))}</a>
        </div>
        <ul class="lista-contenido" id="lista-${cfg.id}"><li>${'<div class="esqueleto-fila"></div>'.repeat(3)}</li></ul>`;
      $(`#papelera-${cfg.id}`).addEventListener('click', () => { verPapelera = !verPapelera; pintar(); });
      const lista = $(`#lista-${cfg.id}`);
      lista.addEventListener('click', (e) => {
        const a = e.target.closest('[data-alternar]');
        const r = e.target.closest('[data-restaurar]');
        const b = e.target.closest('[data-borrar]');
        if (a) alternar(a.dataset.alternar);
        if (r) restaurar(r.dataset.restaurar);
        if (b) borrar(b.dataset.borrar);
      });
      hacerOrdenable(lista, async (ids) => {
        ids.forEach((id, i) => { const it = items.find((x) => x.id === id); if (it) it.order = i; });
        items.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
        try { await guardarOrden(cfg.coleccion, ids); } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
      });
      try { await cargar(); } catch (error) { console.error(error); vista.innerHTML = estadoVacio(t('adm.errCargar'), ''); return; }
      pintar();
    }
    if (params[0]) abrirEditor(params[0]);
  };

  return {
    id: cfg.id,
    icono: cfg.icono,
    clave: cfg.clave,
    acceso: 'editor',
    montar,
    repintar: () => { if (vistaActual) { vistaActual.innerHTML = ''; montar(vistaActual, []); } },
    alCerrarSesion: () => { items = []; cargado = false; },
    buscar: async (q) => {
      await cargar();
      const n = normalizar(q);
      return items.filter((x) => !x.deletedAt && normalizar(`${cfg.titulo(x)} ${cfg.detalle(x)}`).includes(n))
        .map((x) => ({ titulo: cfg.titulo(x), sub: cfg.detalle(x), href: `#${cfg.id}/${encodeURIComponent(x.id)}` }));
    },
  };
}

export const testimonios = crearModulo({
  id: 'testimonios',
  icono: 'testimonios',
  clave: 'testimonios.menu',
  coleccion: 'testimonials',
  foto: true,
  campos: [
    { id: 'quote', etiqueta: 'cont.cita', tipo: 'area', max: 400, requerido: true, en: true },
    { id: 'author', etiqueta: 'cont.autor', max: 80, requerido: true, en: true },
    { id: 'detail', etiqueta: 'cont.detalle', max: 120, en: true },
  ],
  titulo: (d) => d.author || '',
  detalle: (d) => (d.quote || '').slice(0, 90),
  vacio: ['testimonios.vacio', 'testimonios.vacioD'],
});

export const anuncios = crearModulo({
  id: 'anuncios',
  icono: 'anuncios',
  clave: 'anuncios.menu',
  coleccion: 'announcements',
  campos: [
    { id: 'title', etiqueta: 'adm.titulo', max: 120, requerido: true, en: true },
    { id: 'body', etiqueta: 'cont.cuerpo', tipo: 'area', max: 600, en: true },
    { id: 'link', etiqueta: 'adm.enlace', tipo: 'url', max: 300 },
  ],
  titulo: (d) => d.title || '',
  detalle: (d) => [fecha(d.createdAt), (d.body || '').slice(0, 70)].filter(Boolean).join(' · '),
  vacio: ['anuncios.vacio', 'anuncios.vacioD'],
});

registrarTextos({
  es: {
    'testimonios.menu': 'Testimonios',
    'testimonios.nuevo': 'Nuevo testimonio',
    'testimonios.ayuda': 'Se muestran en la landing en este orden. Arrastra para cambiarlo.',
    'testimonios.vacio': 'Aún no hay testimonios',
    'testimonios.vacioD': 'Mientras no publiques ninguno, la landing muestra las tres historias iniciales.',
    'anuncios.menu': 'Anuncios',
    'anuncios.nuevo': 'Nuevo anuncio',
    'anuncios.ayuda': 'Los clientes los ven en Inicio y en Comunidad, en este orden.',
    'anuncios.vacio': 'Aún no hay anuncios',
    'anuncios.vacioD': 'Usa los anuncios para avisar fechas límite, talleres o novedades a tus clientes.',
    'cont.cita': 'Testimonio',
    'cont.autor': 'Nombre',
    'cont.detalle': 'Detalle (ej. "Fundadora de Bouquets by Lucy")',
    'cont.cuerpo': 'Texto',
    'cont.subirFoto': 'Subir foto (opcional)',
    'cont.revisa': 'Revisa los campos marcados.',
    'cont.borrarTitulo': 'Eliminar definitivamente',
    'cont.borrarTexto': 'Se borrará para siempre. Esta acción no se puede deshacer.',
  },
  en: {
    'testimonios.menu': 'Testimonials',
    'testimonios.nuevo': 'New testimonial',
    'testimonios.ayuda': 'They appear on the landing page in this order. Drag to change it.',
    'testimonios.vacio': 'No testimonials yet',
    'testimonios.vacioD': 'Until you publish one, the landing page shows the three initial stories.',
    'anuncios.menu': 'Announcements',
    'anuncios.nuevo': 'New announcement',
    'anuncios.ayuda': 'Clients see them on Home and Community, in this order.',
    'anuncios.vacio': 'No announcements yet',
    'anuncios.vacioD': 'Use announcements to share deadlines, workshops or news with your clients.',
    'cont.cita': 'Testimonial',
    'cont.autor': 'Name',
    'cont.detalle': 'Detail (e.g. "Founder of Bouquets by Lucy")',
    'cont.cuerpo': 'Text',
    'cont.subirFoto': 'Upload photo (optional)',
    'cont.revisa': 'Please review the highlighted fields.',
    'cont.borrarTitulo': 'Delete permanently',
    'cont.borrarTexto': 'It will be deleted forever. This can’t be undone.',
  },
});
