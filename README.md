# Success by Karely

Plataforma web de **Success by Karely**, marca de 6SGS Consultants: sitio público, blog, portal de clientes con plataforma educativa y panel de administración (CMS + CRM).

- Sitio **100 % estático** (HTML, CSS y JavaScript, sin compilación) publicado en **GitHub Pages**.
- **Firebase** (cuentas y base de datos), **Cloudinary** (imágenes y archivos) y **Telegram** (avisos).
- Dominio: **https://successbykarely.dgp-link.com**
- Toda la configuración está en un solo archivo: **`assets/js/config.js`**.
- La especificación completa está en `CLAUDE.md`.

> Estado: **las 7 fases están construidas.** Esta guía está pensada para que cualquier persona, sin conocimientos técnicos, pueda ponerla en marcha paso a paso.

---

## Índice

0. [Qué hay en cada carpeta](#0-qué-hay-en-cada-carpeta)
1. [Firebase: cuentas y base de datos](#1-firebase-cuentas-y-base-de-datos)
2. [Publicar las reglas y los índices](#2-publicar-las-reglas-y-los-índices)
3. [Crear el primer administrador y el equipo](#3-crear-el-primer-administrador-y-el-equipo)
4. [Cloudinary: imágenes y archivos](#4-cloudinary-imágenes-y-archivos)
5. [Telegram: comunidad y avisos](#5-telegram-comunidad-y-avisos)
6. [Blog estático con GitHub Action](#6-blog-estático-con-github-action)
7. [GitHub Pages y dominio propio](#7-github-pages-y-dominio-propio)
8. [Subir las imágenes del sitio](#8-subir-las-imágenes-del-sitio)
9. [Opcional: Google Analytics](#9-opcional-google-analytics)
10. [Valores pendientes](#10-valores-pendientes)
11. [Lista de pruebas](#11-lista-de-pruebas)
12. [Si algo no funciona](#12-si-algo-no-funciona)

---

## Probar en tu computadora

1. Abre una terminal en la carpeta del proyecto.
2. Ejecuta `python3 -m http.server 8000`
3. Abre `http://localhost:8000` (sitio), `/blog/`, `/portal/` y `/admin/`.

No hace falta instalar nada: no hay pasos de compilación.

---

## 0. Qué hay en cada carpeta

| Ruta | Qué es |
|---|---|
| `index.html` | Sitio público (landing) |
| `blog/` | Blog: `index.html` (listado), `articulo.html?slug=…` (artículo), `feed.xml` (RSS) y las páginas `blog/{slug}/` que genera el Action |
| `portal/` | Acceso y espacio del cliente (cursos, plan de acción, documentos, mensajes…) |
| `admin/` | Panel de administración (no aparece en buscadores) |
| `propuesta/` | Propuesta comercial de DGP Group USA |
| `assets/css/` | `styles.css` (marca, vidrio, landing), `blog.css`, `app.css` (portal) y `admin.css` |
| `assets/js/config.js` | **Único archivo de configuración** |
| `assets/js/` | Resto del código (un archivo por página o módulo, comentado en español) |
| `firestore.rules`, `firestore.indexes.json` | Seguridad e índices de la base de datos |
| `functions/` | Cloud Functions de los avisos por Telegram |
| `integraciones/telegram-apps-script.gs` | Alternativa gratuita a las Cloud Functions |
| `scripts/generar-blog.mjs` + `.github/workflows/blog-estatico.yml` | Páginas estáticas del blog, `sitemap.xml` y RSS |

---

## 1. Firebase: cuentas y base de datos

La configuración web del proyecto `successbykarely-ef4a0` ya está en `assets/js/config.js`.
Estas claves son **públicas por diseño**: lo que protege los datos son las **reglas de Firestore** (paso 2).

En la [consola de Firebase](https://console.firebase.google.com/):

1. **Firestore Database → Crear base de datos** → modo **producción** → ubicación `nam5 (United States)`.
2. **Authentication → Comenzar → Correo electrónico/contraseña → Habilitar.**
3. **Authentication → Configuración → Dominios autorizados → Agregar dominio:** `successbykarely.dgp-link.com` (`localhost` ya viene autorizado para pruebas).
4. Opcional: **Authentication → Plantillas** → cambia el idioma de los correos a español y el nombre del remitente a "Success by Karely".

## 2. Publicar las reglas y los índices

**Opción A: desde la consola (sin instalar nada)**

1. Firestore → pestaña **Reglas** → borra todo, pega el contenido completo de `firestore.rules` → **Publicar**.
2. Firestore → pestaña **Índices → Compuestos → Crear índice**, uno por fila (ámbito: colección):

| Colección | Campos |
|---|---|
| `posts` | `status` ↑, `publishAt` ↓ |
| `posts` | `slug` ↑, `status` ↑, `publishAt` ↓ |
| `posts` | `category` ↑, `status` ↑, `publishAt` ↓ |
| `posts` | `visibility` ↑, `status` ↑, `publishAt` ↓ |
| `testimonials` | `published` ↑, `order` ↑ |
| `courses` | `published` ↑, `access` ↑ |
| `courses` | `published` ↑, `allowedUids` (arreglo, "contiene") |

↑ = ascendente, ↓ = descendente. Si faltara alguno, la consola del navegador (F12) muestra un enlace que lo crea con un clic. Los índices tardan unos minutos en quedar "Habilitados".

**Opción B: con Firebase CLI**

```bash
npm install -g firebase-tools
firebase login
firebase use successbykarely-ef4a0
firebase deploy --only firestore:rules,firestore:indexes
```

**Qué protegen las reglas (resumen):**
- Nadie sin sesión puede leer clientes, CRM, leads, mensajes ni documentos.
- Cada cliente solo ve y edita sus propios datos; nunca su etapa del CRM ni las notas internas.
- El cliente solo puede marcar tareas como hechas y guardar su progreso; no cambia el estado de sus documentos.
- Nadie edita ni borra mensajes del chat.
- El **staff** ve clientes, leads, mensajes y documentos; el **editor** ve blog, cursos, imágenes, testimonios y anuncios, pero **no** clientes, leads ni mensajes.
- Los artículos "Solo miembros" guardan su cuerpo aparte (`posts/{id}/privado/cuerpo`): el público ve título, portada y extracto; el cuerpo solo se lee con sesión.
- Los artículos programados se hacen públicos solos cuando llega su fecha y hora.

## 3. Crear el primer administrador y el equipo

1. Regístrate en `…/portal/?registro=1` con tu correo.
2. En Firebase **Authentication → Usuarios**, copia tu **UID** (identificador de usuario).
3. En **Firestore → Iniciar colección** `admins` → **ID del documento:** tu UID → campos:
   - `role` (string): `owner`
   - `name` (string): `Karely Paredes`
   - `email` (string): tu correo
4. Entra a `…/admin/` con tu correo y contraseña.

Para sumar a alguien del equipo: esa persona se registra en el portal y tú, desde **Admin → Equipo**, pegas su UID y eliges su rol:

| Rol | Puede |
|---|---|
| **Dueña (owner)** | Todo, incluido Equipo y Actividad |
| **Staff** | Clientes (CRM), leads, mensajes, documentos, tareas y exportar |
| **Editor** | Blog, cursos, imágenes del sitio, testimonios y anuncios |

## 4. Cloudinary: imágenes y archivos

Ya configurado en `config.js`: nube `successbykarely`, preset `bzrjdfnu`.
En Cloudinary → **Settings → Upload → Upload presets → bzrjdfnu**, revisa:

- **Signing mode:** Unsigned
- **Folder:** `success-by-karely` (el sitio crea dentro `sitio/`, `blog/{id}`, `cursos/{id}`, `testimonios/`, `clientes/{uid}/documentos`)
- **Unique filename:** activado (nombres aleatorios)
- **Allowed formats:** `jpg, jpeg, png, webp, gif, svg, pdf, docx`
- **Max file size:** 10 MB (10485760 bytes)

> ⚠️ **Importante sobre privacidad:** con un preset sin firma, las URLs de los archivos son públicas (aunque imposibles de adivinar). El portal avisa a los clientes que no suban su número de Seguro Social completo. Para documentos muy sensibles se recomienda, a futuro, pasar a URLs firmadas mediante una Cloud Function.

## 5. Telegram: comunidad y avisos

### 5.1 Botón de comunidad
Pon el enlace de tu canal o grupo en `config.js → contacto.telegram`. Mientras no esté, el botón muestra "Muy pronto".

### 5.2 Crear el bot y obtener el chat
1. En Telegram abre **@BotFather** → `/newbot` → elige nombre y usuario → copia el **token** (algo como `123456:ABC…`). **Nunca lo pongas en el sitio ni en GitHub.**
2. Crea un grupo privado para el equipo (o usa tu chat) y **agrega el bot**.
3. Escribe cualquier mensaje en el grupo y abre en el navegador:
   `https://api.telegram.org/bot<TOKEN>/getUpdates` → busca `"chat":{"id":-100…}` y copia ese número (**chat ID**; en grupos empieza con `-100`).

### 5.3 Opción recomendada: Cloud Functions (plan Blaze)
Las funciones usan la capa gratuita, pero Firebase exige el plan **Blaze** (con tarjeta). Pon un **presupuesto con alerta** de 1 USD en Google Cloud para estar tranquila.

```bash
npm install -g firebase-tools
firebase login
firebase use successbykarely-ef4a0
cd functions && npm install && cd ..
firebase functions:secrets:set TELEGRAM_TOKEN      # pega el token
firebase functions:secrets:set TELEGRAM_CHAT_ID    # pega el chat ID
firebase deploy --only functions                   # te pedirá URL_SITIO: deja la sugerida
```

Avisos que llegan al grupo (con enlace directo al panel):
- 🆕 Nuevo lead (nombre, correo, teléfono, servicios, mensaje)
- 👤 Nuevo registro en el portal
- 💬 Mensaje de un cliente
- 📎 Documento subido por un cliente
- 📰 Nuevo suscriptor del blog

**Opcional: responder desde Telegram.** Si respondes (función "Responder" de Telegram) a un aviso 💬, tu respuesta llega al chat del cliente en el portal:

```bash
firebase functions:secrets:set TELEGRAM_WEBHOOK_SECRET   # inventa una clave larga (letras y números)
firebase deploy --only functions:telegramWebhook
# Registra el webhook (cambia TOKEN, CLAVE y la URL que mostró el deploy):
curl "https://api.telegram.org/botTOKEN/setWebhook?url=URL_DE_telegramWebhook&secret_token=CLAVE"
```

### 5.4 Alternativa sin Blaze: Google Apps Script
Sigue las instrucciones al inicio de `integraciones/telegram-apps-script.gs` y pega la URL de la web app en `config.js → integraciones.appsScriptTelegram`.

| | Cloud Functions | Apps Script |
|---|---|---|
| Costo | Capa gratuita (requiere Blaze) | Gratis |
| Seguridad | Alta: se dispara desde la base de datos; nadie externo puede falsear avisos | Media: la URL es pública; tiene un límite de 30 avisos/hora |
| Fiabilidad | Llega aunque el visitante cierre la página | Depende del navegador del visitante |
| Responder desde Telegram | Sí | No |

> Usa **solo una** de las dos opciones para no recibir avisos duplicados.

## 6. Blog estático con GitHub Action

WhatsApp y Facebook no ejecutan JavaScript: para que un artículo compartido muestre su título e imagen, un GitHub Action genera cada 6 horas (o cuando tú lo pidas) una página `blog/{slug}/` por artículo, además de `sitemap.xml` y `blog/feed.xml` (RSS).

1. **Crear la cuenta de servicio (solo lectura):**
   Google Cloud Console → proyecto `successbykarely-ef4a0` → **IAM y administración → Cuentas de servicio → Crear** → nombre `blog-estatico` → rol **Cloud Datastore Viewer** (solo lectura) → **Listo**.
   Abre la cuenta → **Claves → Agregar clave → JSON**. Se descarga un archivo: **no lo subas al repositorio**.
2. **Guardar el secreto en GitHub:** repositorio → **Settings → Secrets and variables → Actions → New repository secret** → nombre `FIREBASE_SERVICE_ACCOUNT` → pega **todo** el contenido del JSON.
3. **Permitir que el Action guarde cambios:** **Settings → Actions → General → Workflow permissions → Read and write permissions**.
4. **Probarlo:** pestaña **Actions → Blog estático → Run workflow**. Al terminar verás un commit "Blog: actualizar páginas estáticas…".
5. Cuando funcione, en `config.js` cambia `blog.paginasEstaticas` a `true`: los botones de compartir usarán `…/blog/{slug}/`.

> Un artículo nuevo tarda como máximo 6 horas en tener su página estática (o ejecuta el Action a mano). Mientras tanto se lee perfecto en `blog/articulo.html?slug=…`. Para refrescar la vista previa en Facebook/WhatsApp usa el [Sharing Debugger](https://developers.facebook.com/tools/debug/) → "Volver a extraer".

## 7. GitHub Pages y dominio propio

1. En GitHub: **Settings → Pages → Source: Deploy from a branch** → rama **`main`**, carpeta **`/ (root)`**.
2. El archivo `CNAME` ya contiene `successbykarely.dgp-link.com` y existe `.nojekyll`.
3. En el DNS de `dgp-link.com` crea un registro **CNAME**: nombre `successbykarely` → valor `quasarworksco.github.io`.
4. En **Settings → Pages** espera la verificación y activa **Enforce HTTPS**.
5. Si cambias de dominio: actualiza `CNAME`, `config.js → sitio.url`, los `canonical`/`og:url` de los HTML y el dominio autorizado en Firebase.

## 8. Subir las imágenes del sitio

Ninguna imagen está fija en el código: todo se sube desde **Admin → Imágenes del sitio**. Cada tarjeta indica dónde aparece, medidas y formato, y su estado (**Pendiente** en coral / **Lista** en dorado).

1. Arrastra o elige la imagen → recórtala con la proporción guiada → escribe el texto alternativo (ES/EN) → listo. El cambio se ve en el sitio sin tocar código.
2. **Reemplazar** guarda la anterior en el historial ("Restaurar anterior"); **Quitar** vuelve al marcador elegante.
3. Galerías (logos de prensa, eventos): sube varias y ordénalas arrastrando.
4. **Favicon e imagen para compartir:** buscadores y redes no ejecutan JavaScript, así que además necesitan copia estática. Al subirlas, el panel ofrece **descargar el archivo listo**; cópialo en `assets/img/` con estos nombres y súbelo a GitHub:
   - `og-image.jpg` (1200×630)
   - `favicon.png` (512×512), `favicon-32.png` (32×32) y `apple-touch-icon.png` (180×180)

Portadas de cursos, imágenes del blog y fotos de testimonios se suben desde sus propias pantallas.

## 9. Opcional: Google Analytics

1. Crea una propiedad GA4 y copia el **ID de medición** (`G-XXXXXXXXXX`).
2. Pégalo en `config.js → integraciones.ga4`.
3. Aparecerá un aviso de cookies; Analytics solo se carga si la persona pulsa **Aceptar**. En las páginas legales aparece "Preferencias de cookies" para cambiar la decisión.

---

## 10. Valores pendientes

En `assets/js/config.js`:

| Marcador | Qué poner |
|---|---|
| `PENDIENTE_WHATSAPP` | Número solo con dígitos y código de país (ej. `17135550000`) |
| `PENDIENTE_TELEFONO` | Teléfono visible (ej. `+1 713 555 0000`) |
| `PENDIENTE_CORREO` | Correo oficial (también en `privacidad.html` y `terminos.html`, en ES y EN) |
| `PENDIENTE_AGENDA` | Enlace de Calendly, Google Calendar, etc. |
| `PENDIENTE_TELEGRAM` | Enlace al canal o grupo de la comunidad |
| `PENDIENTE_FACEBOOK_*` | URLs de las páginas de Facebook |
| `PENDIENTE_TIKTOK_CAREERCOLLEGE` | Confirmar el usuario @6sgs.careercolleg |
| `PENDIENTE_GA4` | ID de Google Analytics (opcional) |
| `PENDIENTE_APPS_SCRIPT` | Solo si usas la alternativa sin Blaze |
| `contacto.ciudad` | Confirmar "Houston, Texas" |

Fuera del código (secretos, nunca en el repositorio): `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET` (Firebase) y `FIREBASE_SERVICE_ACCOUNT` (GitHub).

Mientras un valor siga pendiente, el sitio oculta ese botón o muestra "Muy pronto", nunca un enlace roto.

---

## 11. Lista de pruebas

**Sitio y blog**
- [ ] Con todos los espacios de imagen vacíos, el sitio se ve completo y elegante.
- [ ] ES/EN cambia todos los textos (sitio, blog, portal, panel y páginas legales) y se recuerda; `?lang=en` abre en inglés.
- [ ] Un visitante envía el formulario: aparece en **Admin → Leads** y llega el aviso 🆕 a Telegram.
- [ ] Suscripción al boletín: aparece en Leads con origen "Boletín del blog" y llega 📰.
- [ ] Blog: filtros por categoría, búsqueda, etiquetas y "Cargar más" funcionan; el artículo muestra tabla de contenido, progreso de lectura y compartir.
- [ ] Un artículo "Solo miembros" muestra solo el extracto al público y completo con sesión iniciada (también en Portal → Artículos exclusivos).

**Portal**
- [ ] Un cliente se registra, verifica su correo, completa lecciones, cierra sesión y al volver su progreso sigue intacto.
- [ ] Sube un documento; el admin cambia su estado y el cliente lo ve (llega 📎 a Telegram).
- [ ] Chat en tiempo real en ambos sentidos, con no leídos (llega 💬 a Telegram).

**Panel**
- [ ] El admin cambia la etapa del CRM y agrega notas que el cliente nunca ve.
- [ ] El editor crea un artículo con portada e imágenes, lo **programa** y se publica solo a esa hora.
- [ ] Los artículos se reordenan arrastrando (Fijados), se duplican, se archivan, van a la papelera y se restauran; "Deshacer" funciona 6 segundos.
- [ ] El admin sube, recorta, reemplaza y quita cualquier imagen del sitio y el cambio se ve sin tocar código.
- [ ] Atajos: Ctrl/Cmd+S guarda, Esc cierra, "/" enfoca la búsqueda global.

**Seguridad (Firestore → Reglas → Simulador)**
- [ ] Sin sesión, leer `leads/cualquiera` o `users/cualquiera` → **denegado**.
- [ ] Con un usuario cliente, leer `crm/{su UID}` o `users/{otro UID}` → **denegado**.
- [ ] Con un usuario editor, leer `leads` o `chats/{uid}/messages` → **denegado**.

**Dispositivos**
- [ ] Se ve bien a 360 px, tableta y escritorio, en Chrome, Safari (incluido iPhone) y Firefox; con "reducir movimiento" no hay animaciones.

---

## 12. Si algo no funciona

| Síntoma | Qué revisar |
|---|---|
| "Firebase no configurado" | `config.js → firebase` completo y dominio autorizado en Authentication |
| El blog o los cursos salen vacíos | Índices del paso 2 en estado "Habilitado"; consola del navegador (F12) |
| "Esta cuenta no tiene acceso al panel" | Existe `admins/{UID}` con `role` válido (`owner`, `staff` o `editor`) |
| No se suben imágenes | Preset `bzrjdfnu` en modo **Unsigned** y formatos permitidos |
| No llegan avisos a Telegram | `firebase functions:log`; el bot debe estar en el grupo y el chat ID ser correcto |
| El Action del blog falla | Secreto `FIREBASE_SERVICE_ACCOUNT` completo y permisos "Read and write" |
