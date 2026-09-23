/* ==========================================================================
   Panel admin · Equipo y Actividad (solo owner)
   Equipo: administradores y roles. Actividad: registro de acciones (auditLog).
   ========================================================================== */
import { $, escaparHTML, toast } from './util.js';
import { t, registrarTextos } from './i18n.js';
import { estado, fs, col, ref, ahora, registrarActividad, fechaHora, relativo, ms, normalizar, confirmar, estadoVacio, icono } from './admin-nucleo.js';

const ROLES = ['owner', 'staff', 'editor'];

/* ---------------------------- Equipo ---------------------------- */
let admins = [];

async function montarEquipo(vista) {
  vista.innerHTML = `
    <div class="rejilla-dos">
      <section class="panel">
        <h3>${escaparHTML(t('eq.miembros'))}</h3>
        <ul class="lista-equipo" id="lista-equipo"><li class="texto-suave-app">…</li></ul>
      </section>
      <section class="panel">
        <h3>${escaparHTML(t('eq.agregar'))}</h3>
        <ol class="pasos-lista texto-suave-app">
          <li>${escaparHTML(t('eq.paso1'))}</li>
          <li>${escaparHTML(t('eq.paso2'))}</li>
          <li>${escaparHTML(t('eq.paso3'))}</li>
        </ol>
        <form class="formulario form-app" id="form-equipo" novalidate>
          <div class="campo"><label for="eq-uid">UID *</label><input id="eq-uid" required maxlength="128" autocomplete="off" spellcheck="false"></div>
          <div class="campos-2">
            <div class="campo"><label for="eq-nombre">${escaparHTML(t('reg.nombre'))} *</label><input id="eq-nombre" required maxlength="80"></div>
            <div class="campo"><label for="eq-correo">${escaparHTML(t('acc.correo'))} *</label><input id="eq-correo" type="email" required maxlength="120"></div>
          </div>
          <fieldset class="campo"><legend>${escaparHTML(t('eq.rol'))}</legend>
            <div class="opciones-rol">${ROLES.map((r) => `<label class="opcion-rol"><input type="radio" name="rol" value="${r}"${r === 'staff' ? ' checked' : ''}><span><strong>${escaparHTML(t(`adm.rol.${r}`))}</strong><small>${escaparHTML(t(`eq.rolD.${r}`))}</small></span></label>`).join('')}</div>
          </fieldset>
          <div class="fila-botones"><button type="submit" class="btn btn-principal btn-sm">${escaparHTML(t('eq.agregarBtn'))}</button></div>
        </form>
      </section>
    </div>`;
  const pintar = () => {
    $('#lista-equipo').innerHTML = admins.length ? admins.map((a) => `
      <li data-uid="${escaparHTML(a.id)}">
        <span class="avatar">${escaparHTML((a.name || a.email || '?')[0].toUpperCase())}</span>
        <div class="fila-texto"><strong>${escaparHTML(a.name || '—')}${a.id === estado.usuario.uid ? ` <small>(${escaparHTML(t('eq.tu'))})</small>` : ''}</strong><span>${escaparHTML(a.email || a.id)}</span></div>
        <select data-rol aria-label="${escaparHTML(t('eq.rol'))}"${a.id === estado.usuario.uid ? ' disabled' : ''}>${ROLES.map((r) => `<option value="${r}"${r === a.role ? ' selected' : ''}>${escaparHTML(t(`adm.rol.${r}`))}</option>`).join('')}</select>
        ${a.id === estado.usuario.uid ? '' : `<button type="button" class="btn-mini" data-quitar aria-label="${escaparHTML(t('eq.quitar'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>`}
      </li>`).join('') : `<li class="lista-vacia">—</li>`;
  };
  try {
    const snap = await fs().getDocs(col('admins'));
    admins = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role));
  } catch (error) { console.error(error); toast(t('adm.errCargar'), { tipo: 'error' }); }
  pintar();

  $('#lista-equipo').addEventListener('change', async (e) => {
    const s = e.target.closest('[data-rol]');
    if (!s) return;
    const uid = s.closest('[data-uid]').dataset.uid;
    const a = admins.find((x) => x.id === uid);
    const anterior = a.role;
    try {
      await fs().updateDoc(ref('admins', uid), { role: s.value });
      a.role = s.value;
      registrarActividad('rol', 'admins', uid, `${a.name}: ${anterior} → ${s.value}`);
      toast(t('eq.rolCambiado'));
    } catch { s.value = anterior; toast(t('adm.errGuardar'), { tipo: 'error' }); }
  });
  $('#lista-equipo').addEventListener('click', async (e) => {
    if (!e.target.closest('[data-quitar]')) return;
    const uid = e.target.closest('[data-uid]').dataset.uid;
    const a = admins.find((x) => x.id === uid);
    const ok = await confirmar({ titulo: t('eq.quitarTitulo'), texto: t('eq.quitarTexto', { nombre: a.name || a.email }), boton: t('eq.quitar'), peligro: true, escribir: a.email || a.id });
    if (!ok) return;
    try {
      await fs().deleteDoc(ref('admins', uid));
      admins = admins.filter((x) => x.id !== uid);
      registrarActividad('quitar', 'admins', uid, a.name || a.email);
      toast(t('eq.quitado'));
      pintar();
    } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
  });
  $('#form-equipo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const uid = $('#eq-uid').value.trim();
    const nombre = $('#eq-nombre').value.trim();
    const correo = $('#eq-correo').value.trim().toLowerCase();
    const rol = e.target.querySelector('input[name="rol"]:checked').value;
    const faltan = [['#eq-uid', uid && /^[\w-]{10,128}$/.test(uid)], ['#eq-nombre', nombre], ['#eq-correo', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)]].filter(([, ok]) => !ok);
    faltan.forEach(([s]) => $(s).setAttribute('aria-invalid', 'true'));
    if (faltan.length) { $(faltan[0][0]).focus(); toast(t('cont.revisa'), { tipo: 'error' }); return; }
    try {
      await fs().setDoc(ref('admins', uid), { role: rol, name: nombre, email: correo, createdAt: ahora() });
      admins = admins.filter((x) => x.id !== uid).concat({ id: uid, role: rol, name: nombre, email: correo });
      registrarActividad('agregar', 'admins', uid, `${nombre} (${rol})`);
      toast(t('eq.agregado'));
      e.target.reset();
      pintar();
    } catch { toast(t('adm.errGuardar'), { tipo: 'error' }); }
  });
}

export const equipo = { id: 'equipo', icono: 'equipo', clave: 'eq.menu', acceso: 'owner', montar: montarEquipo };

/* ---------------------------- Actividad ---------------------------- */
let registros = [];
let filtro = { q: '', coleccion: '' };

function pintarActividad() {
  const cuerpo = $('#tabla-actividad tbody');
  if (!cuerpo) return;
  const q = normalizar(filtro.q);
  const lista = registros.filter((r) => (!filtro.coleccion || r.collection === filtro.coleccion)
    && (!q || normalizar(`${r.name} ${r.action} ${r.summary} ${r.docId}`).includes(q)));
  cuerpo.innerHTML = lista.length ? lista.map((r) => `
    <tr>
      <td class="nowrap" title="${escaparHTML(fechaHora(r.createdAt))}">${escaparHTML(relativo(r.createdAt))}</td>
      <td>${escaparHTML(r.name || r.uid)}</td>
      <td><span class="etiqueta-accion">${escaparHTML(r.action)}</span></td>
      <td>${escaparHTML(r.collection)}</td>
      <td class="celda-resumen">${escaparHTML(r.summary || r.docId || '')}</td>
    </tr>`).join('') : `<tr><td colspan="5" class="celda-vacia">${escaparHTML(t('act.vacio'))}</td></tr>`;
}

async function montarActividad(vista) {
  vista.innerHTML = `
    <div class="barra-herramientas">
      <input type="search" class="campo-buscar" id="act-q" placeholder="${escaparHTML(t('act.buscar'))}" aria-label="${escaparHTML(t('act.buscar'))}">
      <select id="act-col" aria-label="${escaparHTML(t('act.seccion'))}"><option value="">${escaparHTML(t('act.todas'))}</option></select>
    </div>
    <div class="panel panel-tabla"><div class="tabla-scroll">
      <table class="tabla tabla-tarjetas" id="tabla-actividad">
        <thead><tr><th scope="col">${escaparHTML(t('adm.fecha'))}</th><th scope="col">${escaparHTML(t('act.quien'))}</th><th scope="col">${escaparHTML(t('act.accion'))}</th><th scope="col">${escaparHTML(t('act.seccion'))}</th><th scope="col">${escaparHTML(t('act.detalle'))}</th></tr></thead>
        <tbody><tr><td colspan="5">…</td></tr></tbody>
      </table>
    </div></div>`;
  try {
    const snap = await fs().getDocs(fs().query(col('auditLog'), fs().orderBy('createdAt', 'desc'), fs().limit(300)));
    registros = snap.docs.map((d) => d.data()).sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
  } catch (error) { console.error(error); vista.insertAdjacentHTML('afterbegin', estadoVacio(t('adm.errCargar'), '', icono('actividad'))); }
  const colecciones = [...new Set(registros.map((r) => r.collection))].sort();
  $('#act-col').insertAdjacentHTML('beforeend', colecciones.map((c) => `<option value="${escaparHTML(c)}">${escaparHTML(c)}</option>`).join(''));
  $('#act-q').addEventListener('input', (e) => { filtro.q = e.target.value; pintarActividad(); });
  $('#act-col').addEventListener('change', (e) => { filtro.coleccion = e.target.value; pintarActividad(); });
  pintarActividad();
}

export const actividad = { id: 'actividad', icono: 'actividad', clave: 'act.menu', acceso: 'owner', montar: montarActividad };

registrarTextos({
  es: {
    'eq.menu': 'Equipo',
    'eq.miembros': 'Administradores',
    'eq.agregar': 'Agregar a alguien al equipo',
    'eq.paso1': 'La persona crea su cuenta en el portal (/portal) con su correo.',
    'eq.paso2': 'En Firebase → Authentication copia su UID.',
    'eq.paso3': 'Pégalo aquí, elige su rol y guarda. Ya podrá entrar a /admin.',
    'eq.rol': 'Rol',
    'eq.rolD.owner': 'Todo, incluido equipo y actividad.',
    'eq.rolD.staff': 'Clientes, leads, mensajes y documentos.',
    'eq.rolD.editor': 'Blog, cursos, imágenes, testimonios y anuncios.',
    'eq.agregarBtn': 'Agregar al equipo',
    'eq.agregado': 'Persona agregada al equipo',
    'eq.tu': 'tú',
    'eq.quitar': 'Quitar del equipo',
    'eq.quitarTitulo': 'Quitar acceso al panel',
    'eq.quitarTexto': '{nombre} ya no podrá entrar al panel. Su cuenta del portal sigue existiendo.',
    'eq.quitado': 'Acceso retirado',
    'eq.rolCambiado': 'Rol actualizado',
    'act.menu': 'Actividad',
    'act.buscar': 'Buscar en la actividad',
    'act.seccion': 'Sección',
    'act.todas': 'Todas las secciones',
    'act.quien': 'Quién',
    'act.accion': 'Acción',
    'act.detalle': 'Detalle',
    'act.vacio': 'Sin actividad registrada con estos filtros.',
  },
  en: {
    'eq.menu': 'Team',
    'eq.miembros': 'Administrators',
    'eq.agregar': 'Add someone to the team',
    'eq.paso1': 'The person creates an account in the portal (/portal) with their email.',
    'eq.paso2': 'In Firebase → Authentication, copy their UID.',
    'eq.paso3': 'Paste it here, choose a role and save. They can now enter /admin.',
    'eq.rol': 'Role',
    'eq.rolD.owner': 'Everything, including team and activity.',
    'eq.rolD.staff': 'Clients, leads, messages and documents.',
    'eq.rolD.editor': 'Blog, courses, images, testimonials and announcements.',
    'eq.agregarBtn': 'Add to team',
    'eq.agregado': 'Person added to the team',
    'eq.tu': 'you',
    'eq.quitar': 'Remove from team',
    'eq.quitarTitulo': 'Remove panel access',
    'eq.quitarTexto': '{nombre} will no longer be able to enter the panel. Their portal account still exists.',
    'eq.quitado': 'Access removed',
    'eq.rolCambiado': 'Role updated',
    'act.menu': 'Activity',
    'act.buscar': 'Search activity',
    'act.seccion': 'Section',
    'act.todas': 'All sections',
    'act.quien': 'Who',
    'act.accion': 'Action',
    'act.detalle': 'Detail',
    'act.vacio': 'No activity recorded with these filters.',
  },
});
