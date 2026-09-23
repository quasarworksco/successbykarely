/* ==========================================================================
   Panel admin · Cursos
   CRUD de cursos con portada 16:9, publicado, acceso público/restringido,
   editor de lecciones (video, contenido con Quill, recursos) y reordenar
   cursos y lecciones arrastrando o con botones. Papelera con restauración.
   ========================================================================== */
import { ETAPAS, CONFIG } from './config.js';
import { $, $$, escaparHTML, toast, subirACloudinary, cloudinaryConfigurado, urlCloudinary, sanearHTML } from './util.js';
import { t, registrarTextos } from './i18n.js';
import {
  estado, puede, fs, col, ref, ahora, registrarActividad, fecha, ms, normalizar, campoTexto, idAleatorio,
  abrirCajon, cerrarCajon, marcarSucio, confirmar, conDeshacer, estadoVacio, hacerOrdenable, botonesMover,
  guardarOrden, recortarImagen, crearEditor, interruptor, esURLSegura, icono, actualizarTituloCajon,
} from './admin-nucleo.js';

let cursos = [];
let cargado = false;
let verPapelera = false;
let vistaActual = null;
let clientesAsignables = null;

const etapaNombre = (pillar) => { const e = ETAPAS.find((x) => x.id === pillar); return e ? `${e.n}. ${e[estado.idioma]}` : '—'; };

async function cargar(forzar = false) {
  if (cargado && !forzar) return cursos;
  const snap = await fs().getDocs(col('courses'));
  cursos = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  cargado = true;
  return cursos;
}

/* ---------- Lista ---------- */
function pintarLista() {
  const zona = $('#lista-cursos');
  if (!zona) return;
  const lista = cursos.filter((c) => Boolean(c.deletedAt) === verPapelera);
  $('#btn-papelera-cursos').textContent = verPapelera ? t('adm.verActivos') : `${t('adm.verPapelera')} (${cursos.filter((c) => c.deletedAt).length})`;
  if (!lista.length) {
    zona.innerHTML = verPapelera ? `<li class="lista-vacia">${escaparHTML(t('adm.papeleraVacia'))}</li>`
      : `<li>${estadoVacio(t('cur.vacio'), t('cur.vacioD'), icono('cursos'))}</li>`;
    return;
  }
  zona.innerHTML = lista.map((c) => `
    <li class="fila-contenido" data-id="${escaparHTML(c.id)}">
      ${verPapelera ? '' : botonesMover()}
      <span class="miniatura">${esURLSegura(c.coverUrl) ? `<img src="${escaparHTML(urlCloudinary(c.coverUrl, 'f_auto,q_auto,c_fill,w_160,h_90'))}" alt="" loading="lazy">` : '<span class="k-tipografica">K</span>'}</span>
      <div class="fila-texto">
        <strong>${escaparHTML(campoTexto(c, 'title') || t('cur.sinTitulo'))}</strong>
        <span>${escaparHTML([etapaNombre(c.pillar), t('ruta.lecciones', { n: (c.lessons || []).length }), c.access === 'restringido' ? t('cur.restringido') : t('cur.todos')].join(' · '))}</span>
      </div>
      ${verPapelera ? `
        <span class="texto-suave-app">${escaparHTML(fecha(c.deletedAt))}</span>
        <button type="button" class="btn btn-linea-app btn-sm" data-restaurar="${escaparHTML(c.id)}">${escaparHTML(t('adm.restaurar'))}</button>
        <button type="button" class="btn btn-peligro-suave btn-sm" data-borrar="${escaparHTML(c.id)}">${escaparHTML(t('adm.eliminarDef'))}</button>` : `
        <span class="estado-pub ${c.published ? 'pub' : ''}">${escaparHTML(c.published ? t('adm.publicado') : t('adm.oculto'))}</span>
        <a class="btn btn-linea-app btn-sm" href="#cursos/${encodeURIComponent(c.id)}">${escaparHTML(t('adm.editar'))}</a>`}
    </li>`).join('');
}

async function montar(vista, params) {
  vistaActual = vista;
  if (!vista.querySelector('#lista-cursos')) {
    vista.innerHTML = `
      <div class="barra-herramientas">
        <p class="texto-suave-app">${escaparHTML(t('cur.ayuda'))}</p>
        <span class="espaciador"></span>
        <button type="button" class="btn btn-linea-app btn-sm" id="btn-papelera-cursos"></button>
        <button type="button" class="btn btn-principal btn-sm" id="btn-nuevo-curso">${escaparHTML(t('cur.nuevo'))}</button>
      </div>
      <ul class="lista-contenido" id="lista-cursos"><li>${'<div class="esqueleto-fila"></div>'.repeat(3)}</li></ul>`;
    $('#btn-nuevo-curso').addEventListener('click', crearCurso);
    $('#btn-papelera-cursos').addEventListener('click', () => { verPapelera = !verPapelera; pintarLista(); });
    const lista = $('#lista-cursos');
    lista.addEventListener('click', (e) => {
      const r = e.target.closest('[data-restaurar]');
      const b = e.target.closest('[data-borrar]');
      if (r) restaurar(r.dataset.restaurar);
      if (b) borrarDefinitivo(b.dataset.borrar);
    });
    hacerOrdenable(lista, async (ids) => {
      ids.forEach((id, i) => { const c = cursos.find((x) => x.id === id); if (c) c.order = i; });
      cursos.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      try { await guardarOrden('courses', ids); } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
    });
    try { await cargar(); } catch (error) { console.error(error); vista.innerHTML = estadoVacio(t('adm.errCargar'), ''); return; }
    pintarLista();
  }
  if (params[0]) abrirEditor(params[0]);
}

async function crearCurso() {
  const datos = {
    title: t('cur.nuevoTitulo'), description: '', pillar: ETAPAS[0].id, level: '', duration: '',
    coverUrl: '', coverPublicId: '', published: false, access: 'todos', allowedUids: [],
    order: cursos.length, lessons: [], createdAt: ahora(), updatedAt: ahora(),
  };
  try {
    const nuevo = await fs().addDoc(col('courses'), datos);
    cursos.push({ id: nuevo.id, ...datos, createdAt: new Date() });
    registrarActividad('crear', 'courses', nuevo.id, datos.title);
    pintarLista();
    location.hash = `#cursos/${nuevo.id}`;
  } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
}

/* ---------- Papelera ---------- */
async function moverPapelera(id) {
  const c = cursos.find((x) => x.id === id);
  const estabaPublicado = c.published;
  try {
    await fs().updateDoc(ref('courses', id), { deletedAt: ahora(), published: false, updatedAt: ahora() });
    Object.assign(c, { deletedAt: new Date(), published: false });
    registrarActividad('papelera', 'courses', id, campoTexto(c, 'title'));
    cerrarCajon(true);
    pintarLista();
    conDeshacer(t('adm.movidoPapelera'), async () => {
      await fs().updateDoc(ref('courses', id), { deletedAt: fs().deleteField(), published: estabaPublicado });
      delete c.deletedAt; c.published = estabaPublicado;
      pintarLista();
      toast(t('adm.deshecho'));
    });
  } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
}
async function restaurar(id) {
  const c = cursos.find((x) => x.id === id);
  try {
    await fs().updateDoc(ref('courses', id), { deletedAt: fs().deleteField(), updatedAt: ahora() });
    delete c.deletedAt;
    registrarActividad('restaurar', 'courses', id, campoTexto(c, 'title'));
    toast(t('adm.restaurado'));
    pintarLista();
  } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
}
async function borrarDefinitivo(id) {
  const c = cursos.find((x) => x.id === id);
  const titulo = campoTexto(c, 'title') || id;
  const ok = await confirmar({ titulo: t('cur.borrarTitulo'), texto: t('cur.borrarTexto'), boton: t('adm.eliminarDef'), peligro: true, escribir: titulo });
  if (!ok) return;
  try {
    await fs().deleteDoc(ref('courses', id));
    cursos = cursos.filter((x) => x.id !== id);
    registrarActividad('eliminar', 'courses', id, titulo);
    toast(t('adm.eliminado'));
    pintarLista();
  } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
}

/* ==========================================================================
   Editor de curso (cajón)
   ========================================================================== */
async function abrirEditor(id) {
  await cargar();
  const original = cursos.find((x) => x.id === id);
  if (!original) { history.replaceState(null, '', '#cursos'); return; }
  const c = structuredClone({ ...original, createdAt: null, updatedAt: null, deletedAt: null });
  c.lessons = (c.lessons || []).map((l) => ({ resources: [], ...l }));
  let leccionActiva = null;
  let editor = null;

  const cuerpo = abrirCajon({
    titulo: campoTexto(c, 'title') || t('cur.sinTitulo'),
    subtitulo: t('cur.editando'),
    ancho: 'ancho',
    onCerrar: () => { if (location.hash.startsWith('#cursos/')) history.replaceState(null, '', '#cursos'); },
    html: `
      <form class="formulario form-app editor-curso" id="form-curso" novalidate>
        <div class="bloque-editor">
          <div class="portada-editor" id="portada-curso">
            ${portadaHTML(c)}
            <label class="btn btn-linea-app btn-sm">${escaparHTML(t('cur.subirPortada'))}<input type="file" accept="image/jpeg,image/png,image/webp" id="archivo-portada" hidden></label>
            ${c.coverUrl ? `<button type="button" class="btn btn-sm btn-peligro-suave" id="quitar-portada">${escaparHTML(t('adm.quitar'))}</button>` : ''}
          </div>
          <div class="campo"><label for="c-titulo">${escaparHTML(t('adm.titulo'))} *</label><input id="c-titulo" maxlength="120" required value="${escaparHTML(c.title || '')}"></div>
          <div class="campo"><label for="c-desc">${escaparHTML(t('adm.descripcion'))}</label><textarea id="c-desc" rows="3" maxlength="600">${escaparHTML(c.description || '')}</textarea></div>
          <div class="campos-3">
            <div class="campo"><label for="c-pilar">${escaparHTML(t('cur.pilar'))}</label><select id="c-pilar">${ETAPAS.map((e) => `<option value="${e.id}"${e.id === c.pillar ? ' selected' : ''}>${e.n}. ${escaparHTML(e[estado.idioma])}</option>`).join('')}</select></div>
            <div class="campo"><label for="c-nivel">${escaparHTML(t('cur.nivel'))}</label><input id="c-nivel" maxlength="30" list="niveles" value="${escaparHTML(c.level || '')}"><datalist id="niveles"><option value="${escaparHTML(t('cur.basico'))}"><option value="${escaparHTML(t('cur.intermedio'))}"><option value="${escaparHTML(t('cur.avanzado'))}"></datalist></div>
            <div class="campo"><label for="c-duracion">${escaparHTML(t('cur.duracion'))}</label><input id="c-duracion" maxlength="30" placeholder="45 min" value="${escaparHTML(c.duration || '')}"></div>
          </div>
          <details class="version-en"${c.title_en ? ' open' : ''}>
            <summary>${escaparHTML(t('adm.version'))}</summary>
            <div class="campo"><label for="c-titulo-en">Title</label><input id="c-titulo-en" maxlength="120" value="${escaparHTML(c.title_en || '')}"></div>
            <div class="campo"><label for="c-desc-en">Description</label><textarea id="c-desc-en" rows="2" maxlength="600">${escaparHTML(c.description_en || '')}</textarea></div>
          </details>
          <div class="fila-interruptores">
            ${interruptor('c-publicado', c.published, t('cur.publicado'))}
            <div class="campo campo-en-linea"><label for="c-acceso">${escaparHTML(t('cur.acceso'))}</label>
              <select id="c-acceso"><option value="todos"${c.access !== 'restringido' ? ' selected' : ''}>${escaparHTML(t('cur.todos'))}</option><option value="restringido"${c.access === 'restringido' ? ' selected' : ''}>${escaparHTML(t('cur.restringido'))}</option></select>
            </div>
          </div>
          <div id="zona-asignados"></div>
        </div>

        <div class="bloque-editor">
          <div class="cabecera-bloque"><h3>${escaparHTML(t('curso.lecciones'))}</h3><button type="button" class="btn btn-suave btn-sm" id="agregar-leccion">${escaparHTML(t('cur.agregarLeccion'))}</button></div>
          <ol class="lista-lecciones-admin" id="lecciones-admin"></ol>
          <div id="editor-leccion" class="editor-leccion" hidden></div>
        </div>

        <div class="barra-guardar-cajon">
          <button type="button" class="btn btn-sm btn-peligro-suave" id="curso-papelera">${escaparHTML(t('adm.moverPapelera'))}</button>
          <span class="espaciador"></span>
          <span class="texto-suave-app" id="estado-guardado"></span>
          <button type="submit" class="btn btn-principal btn-sm" id="guardar-curso">${escaparHTML(t('adm.guardar'))}</button>
        </div>
      </form>`,
  });

  const form = $('#form-curso', cuerpo);
  form.addEventListener('input', () => marcarSucio(true));
  form.addEventListener('change', () => marcarSucio(true));

  /* --- Asignados (solo visible si es restringido) --- */
  const pintarAsignados = async () => {
    const zona = $('#zona-asignados');
    if ($('#c-acceso').value !== 'restringido') { zona.innerHTML = ''; return; }
    if (!puede.staff()) {
      zona.innerHTML = `<p class="nota-privada">${escaparHTML(t('cur.asignadosN', { n: (c.allowedUids || []).length }))} ${escaparHTML(t('cur.asignarDesdeCrm'))}</p>`;
      return;
    }
    if (!clientesAsignables) {
      const snap = await fs().getDocs(col('users')).catch(() => ({ docs: [] }));
      clientesAsignables = snap.docs.map((d) => ({ id: d.id, nombre: `${d.data().firstName || ''} ${d.data().lastName || ''}`.trim(), email: d.data().email }));
    }
    zona.innerHTML = `
      <fieldset class="campo"><legend>${escaparHTML(t('cur.asignados'))}</legend>
        <input type="search" class="campo-buscar" id="buscar-asignar" placeholder="${escaparHTML(t('crm.buscar'))}">
        <ul class="lista-asignar alto-limitado">${clientesAsignables.map((u) => `<li data-texto="${escaparHTML(normalizar(`${u.nombre} ${u.email}`))}"><label><input type="checkbox" value="${escaparHTML(u.id)}"${(c.allowedUids || []).includes(u.id) ? ' checked' : ''}><span>${escaparHTML(u.nombre || u.email)}</span></label><span class="texto-suave-app">${escaparHTML(u.email || '')}</span></li>`).join('')}</ul>
      </fieldset>`;
    $('#buscar-asignar').addEventListener('input', (e) => { const q = normalizar(e.target.value); $$('.lista-asignar li', zona).forEach((li) => { li.hidden = q && !li.dataset.texto.includes(q); }); });
    zona.addEventListener('change', (e) => {
      if (e.target.type !== 'checkbox') return;
      const set = new Set(c.allowedUids || []);
      if (e.target.checked) set.add(e.target.value); else set.delete(e.target.value);
      c.allowedUids = [...set];
    });
  };
  $('#c-acceso').addEventListener('change', pintarAsignados);
  pintarAsignados();

  /* --- Portada 16:9 --- */
  $('#archivo-portada').addEventListener('change', async (e) => {
    const archivo = e.target.files[0];
    e.target.value = '';
    if (!archivo) return;
    if (!/^image\/(jpeg|png|webp)$/.test(archivo.type) || archivo.size > CONFIG.cloudinary.maxBytes) { toast(t('adm.errImagen'), { tipo: 'error' }); return; }
    if (!cloudinaryConfigurado()) { toast(t('docs.sinConfig'), { tipo: 'info' }); return; }
    const blob = await recortarImagen(archivo, { ratio: 16 / 9, anchoMax: 1600, tipo: 'image/jpeg' });
    if (!blob) return;
    const zona = $('#portada-curso .portada-vista');
    zona.dataset.progreso = '0%';
    try {
      const r = await subirACloudinary(blob, { carpeta: `cursos/${id}`, tipo: 'image', onProgreso: (p) => { zona.dataset.progreso = `${p}%`; } });
      c.coverUrl = r.url; c.coverPublicId = r.publicId;
      $('#portada-curso .portada-vista').outerHTML = portadaHTML(c);
      marcarSucio(true);
    } catch { toast(t('docs.errSubida', { nombre: archivo.name }), { tipo: 'error' }); delete zona.dataset.progreso; }
  });
  $('#quitar-portada')?.addEventListener('click', () => { c.coverUrl = ''; c.coverPublicId = ''; $('#portada-curso .portada-vista').outerHTML = portadaHTML(c); marcarSucio(true); });

  /* --- Lecciones --- */
  const guardarLeccionActiva = async () => {
    if (!leccionActiva) return;
    const l = c.lessons.find((x) => x.id === leccionActiva);
    if (!l) return;
    const zona = $('#editor-leccion');
    l.title = $('#l-titulo', zona).value.trim();
    l.title_en = $('#l-titulo-en', zona).value.trim();
    l.videoUrl = $('#l-video', zona).value.trim();
    if (editor) l.content = editor.root.innerHTML === '<p><br></p>' ? '' : editor.root.innerHTML;
    l.resources = $$('.recurso-fila', zona).map((f) => ({ name: $('[data-r="name"]', f).value.trim(), url: $('[data-r="url"]', f).value.trim() })).filter((r) => r.url);
  };
  const pintarLecciones = () => {
    const lista = $('#lecciones-admin');
    lista.innerHTML = c.lessons.length ? c.lessons.map((l, i) => `
      <li class="fila-contenido compacta${l.id === leccionActiva ? ' activa' : ''}" data-id="${escaparHTML(l.id)}">
        ${botonesMover()}
        <span class="num-leccion">${i + 1}</span>
        <button type="button" class="fila-texto boton-fila" data-editar-leccion="${escaparHTML(l.id)}"><strong>${escaparHTML(l.title || t('cur.leccionSinTitulo'))}</strong><span>${escaparHTML([l.videoUrl ? 'Video' : '', (l.resources || []).length ? t('cur.recursosN', { n: l.resources.length }) : ''].filter(Boolean).join(' · ') || '—')}</span></button>
        <button type="button" class="btn-mini" data-borrar-leccion="${escaparHTML(l.id)}" aria-label="${escaparHTML(t('adm.eliminar'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>
      </li>`).join('') : `<li class="lista-vacia">${escaparHTML(t('cur.sinLecciones'))}</li>`;
  };
  const abrirLeccion = async (lid) => {
    await guardarLeccionActiva();
    leccionActiva = lid;
    pintarLecciones();
    const l = c.lessons.find((x) => x.id === lid);
    const zona = $('#editor-leccion');
    zona.hidden = false;
    zona.innerHTML = `
      <h4>${escaparHTML(t('cur.editarLeccion'))}</h4>
      <div class="campo"><label for="l-titulo">${escaparHTML(t('adm.titulo'))}</label><input id="l-titulo" maxlength="140" value="${escaparHTML(l.title || '')}"></div>
      <div class="campos-2">
        <div class="campo"><label for="l-titulo-en">Title (English)</label><input id="l-titulo-en" maxlength="140" value="${escaparHTML(l.title_en || '')}"></div>
        <div class="campo"><label for="l-video">${escaparHTML(t('cur.video'))}</label><input id="l-video" type="url" maxlength="300" placeholder="https://youtu.be/…" value="${escaparHTML(l.videoUrl || '')}"></div>
      </div>
      <div class="campo"><span class="etiqueta-campo">${escaparHTML(t('cur.contenido'))}</span><div class="editor-quill" id="quill-leccion"></div></div>
      <fieldset class="campo"><legend>${escaparHTML(t('curso.recursos'))}</legend>
        <div id="recursos-leccion">${(l.resources || []).map(filaRecurso).join('')}</div>
        <div class="fila-botones">
          <button type="button" class="btn btn-linea-app btn-sm" id="agregar-recurso">${escaparHTML(t('cur.agregarRecurso'))}</button>
          <label class="btn btn-linea-app btn-sm">${escaparHTML(t('cur.subirRecurso'))}<input type="file" id="archivo-recurso" hidden></label>
        </div>
      </fieldset>`;
    editor = null;
    try { editor = await crearEditor($('#quill-leccion'), { html: l.content || '', placeholder: t('cur.contenidoPh'), alCambiar: () => marcarSucio(true) }); }
    catch { $('#quill-leccion').innerHTML = `<textarea id="l-contenido-simple" rows="6">${escaparHTML(l.content || '')}</textarea>`; }
    $('#agregar-recurso').addEventListener('click', () => { $('#recursos-leccion').insertAdjacentHTML('beforeend', filaRecurso({})); });
    $('#recursos-leccion').addEventListener('click', (e) => { if (e.target.closest('[data-quitar-recurso]')) { e.target.closest('.recurso-fila').remove(); marcarSucio(true); } });
    $('#archivo-recurso').addEventListener('change', async (e) => {
      const archivo = e.target.files[0];
      e.target.value = '';
      if (!archivo) return;
      if (archivo.size > CONFIG.cloudinary.maxBytes) { toast(t('docs.errTamano', { nombre: archivo.name }), { tipo: 'error' }); return; }
      if (!cloudinaryConfigurado()) { toast(t('docs.sinConfig'), { tipo: 'info' }); return; }
      try {
        toast(t('docs.subiendo', { nombre: archivo.name }), { tipo: 'info' });
        const r = await subirACloudinary(archivo, { carpeta: `cursos/${id}`, tipo: archivo.type.startsWith('image/') ? 'image' : 'auto' });
        $('#recursos-leccion').insertAdjacentHTML('beforeend', filaRecurso({ name: archivo.name.replace(/\.[^.]+$/, ''), url: r.url }));
        marcarSucio(true);
        toast(t('docs.subido'));
      } catch { toast(t('docs.errSubida', { nombre: archivo.name }), { tipo: 'error' }); }
    });
    $('#l-titulo').focus();
  };
  $('#agregar-leccion').addEventListener('click', async () => {
    await guardarLeccionActiva();
    const nueva = { id: idAleatorio(), title: '', videoUrl: '', content: '', resources: [] };
    c.lessons.push(nueva);
    marcarSucio(true);
    abrirLeccion(nueva.id);
  });
  const lista = $('#lecciones-admin');
  lista.addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-editar-leccion]');
    const bo = e.target.closest('[data-borrar-leccion]');
    if (ed) abrirLeccion(ed.dataset.editarLeccion);
    if (bo) {
      await guardarLeccionActiva();
      const i = c.lessons.findIndex((x) => x.id === bo.dataset.borrarLeccion);
      const [quitada] = c.lessons.splice(i, 1);
      if (leccionActiva === quitada.id) { leccionActiva = null; editor = null; $('#editor-leccion').hidden = true; }
      marcarSucio(true);
      pintarLecciones();
      conDeshacer(t('cur.leccionQuitada'), () => { c.lessons.splice(i, 0, quitada); pintarLecciones(); toast(t('adm.deshecho')); });
    }
  });
  hacerOrdenable(lista, async (ids) => {
    await guardarLeccionActiva();
    c.lessons.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    marcarSucio(true);
    pintarLecciones();
  });
  pintarLecciones();

  /* --- Guardar --- */
  const guardar = async (e) => {
    e?.preventDefault();
    await guardarLeccionActiva();
    const titulo = $('#c-titulo').value.trim();
    if (!titulo) { $('#c-titulo').setAttribute('aria-invalid', 'true'); $('#c-titulo').focus(); toast(t('cur.errTitulo'), { tipo: 'error' }); return; }
    const simple = $('#l-contenido-simple');
    if (simple && leccionActiva) c.lessons.find((x) => x.id === leccionActiva).content = simple.value;
    const lecciones = await Promise.all(c.lessons.map(async (l) => ({
      id: l.id,
      title: (l.title || t('cur.leccionSinTitulo')).slice(0, 140),
      title_en: (l.title_en || '').slice(0, 140),
      videoUrl: (l.videoUrl || '').slice(0, 300),
      content: await sanearHTML(l.content || ''),
      resources: (l.resources || []).filter((r) => esURLSegura(r.url)).map((r) => ({ name: (r.name || r.url).slice(0, 120), url: r.url })),
    })));
    const datos = {
      title: titulo.slice(0, 120),
      title_en: $('#c-titulo-en').value.trim().slice(0, 120),
      description: $('#c-desc').value.trim().slice(0, 600),
      description_en: $('#c-desc-en').value.trim().slice(0, 600),
      pillar: $('#c-pilar').value,
      level: $('#c-nivel').value.trim().slice(0, 30),
      duration: $('#c-duracion').value.trim().slice(0, 30),
      coverUrl: c.coverUrl || '',
      coverPublicId: c.coverPublicId || '',
      published: $('#c-publicado').checked,
      access: $('#c-acceso').value,
      allowedUids: c.allowedUids || [],
      lessons: lecciones,
      updatedAt: ahora(),
    };
    const boton = $('#guardar-curso');
    boton.disabled = true;
    try {
      await fs().updateDoc(ref('courses', id), datos);
      Object.assign(original, datos, { updatedAt: new Date() });
      c.lessons = lecciones;
      marcarSucio(false);
      $('#estado-guardado').textContent = t('cur.guardadoHace');
      actualizarTituloCajon(titulo);
      toast(t('adm.guardado'));
      registrarActividad('editar', 'courses', id, titulo);
      pintarLista();
      pintarLecciones();
    } catch (error) {
      console.error(error);
      toast(t('adm.errGuardar'), { tipo: 'error' });
    } finally { boton.disabled = false; }
  };
  form.addEventListener('submit', guardar);
  const atajo = () => { if (document.body.contains(form)) guardar(); else document.removeEventListener('admin:guardar', atajo); };
  document.addEventListener('admin:guardar', atajo);
  $('#curso-papelera').addEventListener('click', () => { marcarSucio(false); moverPapelera(id); });
}

const portadaHTML = (c) => `<div class="portada-vista">${esURLSegura(c.coverUrl) ? `<img src="${escaparHTML(urlCloudinary(c.coverUrl, 'f_auto,q_auto,c_fill,w_640,h_360'))}" alt="">` : `<span class="marcador"><span class="marcador-k">K</span><span class="marcador-marca">16:9 · 1600×900</span></span>`}</div>`;
const filaRecurso = (r) => `
  <div class="recurso-fila">
    <input data-r="name" maxlength="120" placeholder="${escaparHTML(t('cur.recursoNombre'))}" value="${escaparHTML(r.name || '')}" aria-label="${escaparHTML(t('cur.recursoNombre'))}">
    <input data-r="url" type="url" maxlength="400" placeholder="https://…" value="${escaparHTML(r.url || '')}" aria-label="URL">
    <button type="button" class="btn-mini" data-quitar-recurso aria-label="${escaparHTML(t('adm.quitar'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
  </div>`;

export default {
  id: 'cursos',
  icono: 'cursos',
  clave: 'cur.menu',
  acceso: 'editor',
  montar,
  repintar: () => { if (vistaActual) { vistaActual.innerHTML = ''; montar(vistaActual, []); } },
  alCerrarSesion: () => { cursos = []; cargado = false; clientesAsignables = null; },
  buscar: async (q) => {
    await cargar();
    const n = normalizar(q);
    return cursos.filter((c) => !c.deletedAt && normalizar(`${c.title} ${c.title_en}`).includes(n))
      .map((c) => ({ titulo: campoTexto(c, 'title'), sub: etapaNombre(c.pillar), href: `#cursos/${encodeURIComponent(c.id)}` }));
  },
};

registrarTextos({
  es: {
    'cur.menu': 'Cursos',
    'cur.ayuda': 'Arrastra o usa las flechas para cambiar el orden en que los clientes ven los cursos.',
    'cur.nuevo': 'Nuevo curso',
    'cur.nuevoTitulo': 'Curso sin título',
    'cur.sinTitulo': 'Curso sin título',
    'cur.vacio': 'Aún no hay cursos',
    'cur.vacioD': 'Crea tu primer curso: aparecerá en "Mi ruta" de tus clientes cuando lo publiques.',
    'cur.editando': 'Editor de curso',
    'cur.subirPortada': 'Subir portada',
    'cur.pilar': 'Etapa',
    'cur.nivel': 'Nivel',
    'cur.basico': 'Básico',
    'cur.intermedio': 'Intermedio',
    'cur.avanzado': 'Avanzado',
    'cur.duracion': 'Duración',
    'cur.publicado': 'Publicado',
    'cur.acceso': 'Acceso',
    'cur.todos': 'Todos los clientes',
    'cur.restringido': 'Solo clientes asignados',
    'cur.asignados': 'Clientes con acceso',
    'cur.asignadosN': '{n} clientes con acceso.',
    'cur.asignarDesdeCrm': 'El equipo puede asignarlos desde la ficha de cada cliente.',
    'cur.agregarLeccion': 'Agregar lección',
    'cur.sinLecciones': 'Este curso aún no tiene lecciones.',
    'cur.leccionSinTitulo': 'Lección sin título',
    'cur.editarLeccion': 'Editar lección',
    'cur.video': 'Video (YouTube o Vimeo)',
    'cur.contenido': 'Contenido',
    'cur.contenidoPh': 'Escribe el contenido de la lección…',
    'cur.agregarRecurso': 'Agregar enlace',
    'cur.subirRecurso': 'Subir archivo',
    'cur.recursoNombre': 'Nombre del recurso',
    'cur.recursosN': '{n} recursos',
    'cur.leccionQuitada': 'Lección quitada (se aplica al guardar)',
    'cur.errTitulo': 'El curso necesita un título.',
    'cur.guardadoHace': 'Guardado hace un momento',
    'cur.borrarTitulo': 'Eliminar curso definitivamente',
    'cur.borrarTexto': 'El curso y sus lecciones se borrarán para siempre. El progreso de los clientes en este curso dejará de mostrarse.',
  },
  en: {
    'cur.menu': 'Courses',
    'cur.ayuda': 'Drag or use the arrows to change the order in which clients see courses.',
    'cur.nuevo': 'New course',
    'cur.nuevoTitulo': 'Untitled course',
    'cur.sinTitulo': 'Untitled course',
    'cur.vacio': 'No courses yet',
    'cur.vacioD': 'Create your first course: it will appear in your clients’ "My path" once you publish it.',
    'cur.editando': 'Course editor',
    'cur.subirPortada': 'Upload cover',
    'cur.pilar': 'Stage',
    'cur.nivel': 'Level',
    'cur.basico': 'Beginner',
    'cur.intermedio': 'Intermediate',
    'cur.avanzado': 'Advanced',
    'cur.duracion': 'Duration',
    'cur.publicado': 'Published',
    'cur.acceso': 'Access',
    'cur.todos': 'All clients',
    'cur.restringido': 'Assigned clients only',
    'cur.asignados': 'Clients with access',
    'cur.asignadosN': '{n} clients with access.',
    'cur.asignarDesdeCrm': 'The team can assign them from each client’s profile.',
    'cur.agregarLeccion': 'Add lesson',
    'cur.sinLecciones': 'This course has no lessons yet.',
    'cur.leccionSinTitulo': 'Untitled lesson',
    'cur.editarLeccion': 'Edit lesson',
    'cur.video': 'Video (YouTube or Vimeo)',
    'cur.contenido': 'Content',
    'cur.contenidoPh': 'Write the lesson content…',
    'cur.agregarRecurso': 'Add link',
    'cur.subirRecurso': 'Upload file',
    'cur.recursoNombre': 'Resource name',
    'cur.recursosN': '{n} resources',
    'cur.leccionQuitada': 'Lesson removed (applies when you save)',
    'cur.errTitulo': 'The course needs a title.',
    'cur.guardadoHace': 'Saved a moment ago',
    'cur.borrarTitulo': 'Permanently delete course',
    'cur.borrarTexto': 'The course and its lessons will be deleted forever. Clients’ progress in this course will no longer show.',
  },
});
