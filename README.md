# Success by Karely

Plataforma web de **Success by Karely**, marca de 6SGS Consultants: sitio público, blog, portal de clientes y panel de administración.
Sitio 100 % estático (HTML, CSS y JavaScript) publicado en **GitHub Pages**, con **Firebase** (cuentas y base de datos) y **Cloudinary** (imágenes y archivos).

- Dominio: **https://successbykarely.dgp-link.com**
- Toda la configuración está en un solo archivo: `assets/js/config.js`
- La especificación completa del proyecto está en `CLAUDE.md`

> Esta guía crece con cada fase. Estado actual: **Fase 2** (portal: registro, acceso, onboarding, inicio y perfil).

---

## Probar en tu computadora

1. Abre una terminal en la carpeta del proyecto.
2. Ejecuta `python3 -m http.server 8000`
3. Abre `http://localhost:8000` en el navegador.

No hace falta instalar nada más: no hay pasos de compilación.

---

## 1. Firebase (cuentas y base de datos)

La configuración web del proyecto `successbykarely-ef4a0` ya está en `assets/js/config.js`.
Estas claves son **públicas por diseño**: lo que protege los datos son las **reglas de Firestore** (paso 2).

En la [consola de Firebase](https://console.firebase.google.com/):

1. **Firestore Database → Crear base de datos** → modo **producción** → ubicación `nam5 (United States)`.
2. **Authentication → Comenzar → Correo electrónico/contraseña → Habilitar** (se usará en la Fase 2).
3. **Authentication → Configuración → Dominios autorizados → Agregar dominio:** `successbykarely.dgp-link.com`
   (`localhost` ya viene autorizado para pruebas).

## 2. Publicar reglas e índices

**Opción A: desde la consola (sin instalar nada)**

1. Firestore → pestaña **Reglas** → borra todo, pega el contenido de `firestore.rules` → **Publicar**.
2. Firestore → pestaña **Índices** → **Crear índice** para cada uno de los que aparecen en `firestore.indexes.json`:
   - Colección `posts`: `status` ascendente, `visibility` ascendente, `publishAt` descendente.
   - Colección `testimonials`: `published` ascendente, `order` ascendente.

   Si falta un índice, la consola del navegador muestra un enlace que lo crea con un clic.

**Opción B: con Firebase CLI**

```bash
npm install -g firebase-tools
firebase login
firebase use successbykarely-ef4a0
firebase deploy --only firestore:rules,firestore:indexes
```

## 3. Crear el primer administrador

Regístrate en el portal → en Firebase **Authentication** copia tu **UID** → en Firestore crea el documento `admins/{TU_UID}` con los campos `role: "owner"`, `name`, `email` y `createdAt`.

## 4. Cloudinary (imágenes y archivos)

Ya configurado en `config.js`: nube `successbykarely`, preset `bzrjdfnu`.
Revisa en **Settings → Upload → Upload presets → bzrjdfnu** que tenga:

- **Signing mode:** Unsigned
- **Folder:** `success-by-karely`
- **Use filename / Unique filename:** nombres únicos aleatorios
- **Allowed formats:** `jpg, jpeg, png, webp, svg, pdf, docx`
- **Max file size:** 10 MB (10485760 bytes)

> ⚠️ Con un preset sin firma, las URLs de los archivos son públicas aunque imposibles de adivinar. Para documentos sensibles de clientes, más adelante se recomienda usar URLs firmadas mediante una Cloud Function.

## 5. Publicar en GitHub Pages con tu dominio

1. En GitHub: **Settings → Pages → Source: Deploy from a branch** → rama `main`, carpeta `/ (root)`.
2. El archivo `CNAME` ya contiene `successbykarely.dgp-link.com`.
3. En el proveedor DNS de `dgp-link.com` crea un registro:
   - Tipo **CNAME**, nombre **successbykarely**, valor **`<tu-usuario-u-organización>.github.io`** (para este repositorio: `quasarworksco.github.io`).
4. Vuelve a **Settings → Pages**, espera a que el dominio se verifique y activa **Enforce HTTPS**.

## 6. Imágenes y vista previa en redes

- Todas las imágenes del sitio se administrarán desde **Admin → Imágenes del sitio** (Fase 5). Mientras falten, el sitio muestra marcadores elegantes.
- WhatsApp, Facebook y X **no ejecutan JavaScript**: por eso el favicon y la imagen para compartir también existen como copia estática en `assets/img/`:
  - `og-image.jpg` (1200×630): imagen provisional de marca, lista para compartir.
  - `favicon.png`, `favicon-32.png`, `apple-touch-icon.png`: monograma K provisional.
- Cuando subas las definitivas desde el panel, reemplaza esos archivos con los mismos nombres.
- Para refrescar la vista previa después de cambiarla: [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) → “Volver a extraer”.

---

## Valores pendientes en `config.js`

| Marcador | Qué poner |
|---|---|
| `PENDIENTE_WHATSAPP` | Número solo con dígitos y código de país (ej. `17135550000`) |
| `PENDIENTE_TELEFONO` | Teléfono visible (ej. `+1 713 555 0000`) |
| `PENDIENTE_CORREO` | Correo oficial (también en `privacidad.html` y `terminos.html`) |
| `PENDIENTE_AGENDA` | Enlace de Calendly, Google Calendar, etc. |
| `PENDIENTE_TELEGRAM` | Enlace al canal o grupo |
| `PENDIENTE_FACEBOOK_*` | URLs de las páginas de Facebook |
| `PENDIENTE_TIKTOK_CAREERCOLLEGE` | Confirmar el usuario @6sgs.careercolleg |

Mientras un valor siga pendiente, el sitio oculta ese botón o muestra “Muy pronto”, nunca un enlace roto.

---

## Lista de pruebas (Fase 2: portal)

- [ ] `portal/?registro=1` abre "Crear cuenta"; el paso 1 valida nombre, correo, teléfono y contraseña (mínimo 8, con indicador de fuerza).
- [ ] Al crear la cuenta llega el correo de verificación y aparecen `users/{uid}` y `chats/{uid}` en Firestore.
- [ ] El onboarding muestra 3 pantallas y recomienda la etapa según los servicios elegidos.
- [ ] Inicio muestra el saludo, los anillos por etapa, la racha y el aviso "Confirma tu correo" (con "Reenviar" y "Ya lo confirmé").
- [ ] Mi perfil guarda los cambios; el modo claro/oscuro se recuerda al volver.
- [ ] Cerrar sesión y volver a entrar mantiene todos los datos.
- [ ] "¿Olvidaste tu contraseña?" envía el enlace de recuperación.
- [ ] En celular, el menú lateral se abre y se cierra (también con Esc).

## Lista de pruebas (Fase 1)

- [ ] La landing se ve completa y elegante sin ninguna imagen subida.
- [ ] Navegación: al bajar se convierte en cápsula de vidrio; en móvil el menú abre y cierra (también con Esc).
- [ ] ES/EN cambia todos los textos y se recuerda al recargar; `?lang=en` abre en inglés.
- [ ] La ruta dorada del hero se dibuja sola; con “reducir movimiento” activado aparece ya dibujada.
- [ ] La línea del método se ilumina al bajar.
- [ ] “Quiero este servicio” lleva al formulario con ese servicio marcado.
- [ ] El formulario valida en vivo; al enviarlo aparece el mensaje de éxito y el lead queda en Firestore → `leads`.
- [ ] Enviar dos veces seguidas muestra el aviso de espera.
- [ ] Desde otra pestaña sin sesión, leer `leads` en el simulador de reglas debe ser **denegado**.
- [ ] Se ve bien a 360 px, tableta y escritorio, en Chrome, Safari (iPhone) y Firefox.
