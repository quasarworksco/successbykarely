# PROYECTO: Plataforma web "Success by Karely"

## 0. Tu rol y forma de trabajar

Actúa como un equipo senior: arquitecto front-end, diseñador UI/UX de marcas de lujo, especialista en Firebase y en seguridad. Vas a construir la plataforma web completa de "Success by Karely", sub-marca de 6SGS Consultants, con cuatro partes:

1. Sitio público (landing de marca personal y captación de clientes).
2. Blog profesional administrable.
3. Portal de clientes con registro, espacio personal y plataforma educativa con progreso guardado.
4. Panel de administración tipo CMS + CRM: clientes, leads, cursos, blog, imágenes, documentos y chat.

Debe sentirse premium, elegante, cálido y confiable, digno de una plataforma profesional: una experiencia, no una página.

Reglas de trabajo:
- Lo primero: guarda este prompt completo en la raíz del repositorio como `CLAUDE.md` y úsalo como fuente de verdad en todas las sesiones.
- Trabaja una fase a la vez (sección 15). Antes de escribir código en cada fase, muéstrame un plan breve y espera mi aprobación.
- Haz un commit de git al terminar cada fase con mensaje en español. No hagas push salvo que te lo pida.
- No inventes claves, IDs ni enlaces. Usa marcadores visibles (`TU_API_KEY`, `PENDIENTE_WHATSAPP`) y lístalos al final de cada fase.
- Todavía no hay imágenes en el repositorio. Todas las imágenes se subirán al final desde el panel admin (sección 4.4). Construye todo con marcadores elegantes y no bloquees ninguna fase por falta de imágenes.
- Entrega código completo, nunca "…resto del código aquí".
- Al terminar cada fase: resumen, cómo probarlo paso a paso y pendientes.

---

## 1. Restricciones técnicas (obligatorias)

- Hosting: GitHub Pages. Sitio 100 % estático: HTML, CSS y JavaScript vanilla con ES Modules. Sin Vercel, sin Next.js, sin frameworks ni pasos de compilación.
- Rutas siempre relativas (debe funcionar en `usuario.github.io/repo/` y en dominio propio). Incluir `.nojekyll`.
- Para probar en local: `python3 -m http.server 8000`.
- Firebase (SDK modular v10+ desde `https://www.gstatic.com/firebasejs/...`): Authentication (correo y contraseña, verificación de correo, recuperación) y Cloud Firestore.
- Cloudinary con upload preset sin firma (unsigned) desde el navegador para todas las imágenes y archivos.
- Librerías permitidas por CDN (cdnjs o jsdelivr, versión fija): Quill 2 (editor), DOMPurify (sanitizar HTML), Cropper.js (recorte), SortableJS (arrastrar y ordenar), Chart.js (gráficos), canvas-confetti (celebraciones).
- Telegram para comunidad y notificaciones (sección 11).
- Toda la configuración en un solo archivo: `assets/js/config.js`.
- Nunca poner secretos en el front-end (token del bot, API secret de Cloudinary, cuentas de servicio). Las claves web de Firebase son públicas por diseño; la seguridad va en Firestore Security Rules.

---

## 2. Estructura de archivos

```
/
├── index.html                ← sitio público
├── blog/index.html           ← listado de artículos
├── blog/articulo.html        ← artículo (?slug=...)
├── portal/index.html         ← acceso + espacio del cliente
├── admin/index.html          ← panel admin (noindex)
├── privacidad.html, terminos.html, 404.html
├── assets/
│   ├── css/styles.css        ← tokens, clases glass, landing, blog
│   ├── css/app.css           ← portal y admin
│   ├── js/config.js          ← ÚNICO archivo de configuración
│   ├── js/firebase.js
│   ├── js/util.js            ← escape HTML, fechas, Cloudinary, CSV, toasts, medios
│   ├── js/i18n.js            ← textos ES/EN
│   ├── js/landing.js, blog.js, portal.js, admin.js
│   └── img/                  ← solo copias estáticas de favicon y og-image (al final)
├── firestore.rules, firestore.indexes.json, firebase.json
├── functions/                ← Cloud Functions (Telegram)
├── .github/workflows/        ← GitHub Action del blog (fase final)
├── robots.txt, sitemap.xml, .nojekyll
├── CLAUDE.md
└── README.md                 ← guía de instalación en español
```

---

## 3. Información de la marca (contenido real)

### 3.1 Marcas
- Marca madre: 6SGS Consultants (6Sigma Global Services Consultants). Slogan: "Helping you build a solid future".
- Sub-marca de este sitio: Success by Karely.
- Metodología propietaria: Success in the USA by 6SGS™ (Éxito en USA por 6SGS™).
- Tagline: Engineering Success in the USA™.
- Sello discreto en footer y portal: "Parte de 6SGS Consultants".

### 3.2 La fundadora
- Karely Rhosalin Paredes Ugarte (usar "Karely Paredes"). MBA, Lean Six Sigma Black Belt (LSSBB), licenciatura en Justicia Criminal, certificaciones en atención a niños y familias. Cuatro títulos académicos. Bilingüe.
- Se define como "Immigrant systems architect".
- Llegó a EE. UU. con poco inglés y pocos recursos. Más de 20 años en servicio gubernamental y sin fines de lucro (inmigración, respuesta a desastres, desarrollo comunitario), impactando a más de un millón de personas. Gestionó programas multimillonarios.
- Formación con Tony Robbins, Dan Martell, Brendon Burchard, Dean Graziosi y Ed Mylett.
- Prueba del método: su hija Kamila Posada estudia Neurociencia y Pre-medicina en la Universidad de Rochester con la beca completa Alan and Jane Handler; es la primera venezolana-estadounidense en recibirla.
- Origen venezolano, base en Houston, Texas (marcar como pendiente de confirmar).

### 3.3 Mensajes clave
- Firma: "El éxito en Estados Unidos no debería depender de la suerte. Debe diseñarse." (EN: "Success in America should not depend on luck. It should be engineered.")
- "El éxito no ocurre por casualidad, ocurre cuando entiendes el sistema."
- "Esto no es una guía universitaria. Es un sistema."
- "Construimos sistemas que funcionan."
- Posicionamiento: aplicar Lean Six Sigma (creado para fábricas) al futuro de familias inmigrantes: menos errores, menos años perdidos, pasos medibles.

### 3.4 Metodología: ruta de 4 etapas
1. Planificación universitaria: admisiones, becas, FAFSA, ayuda financiera, préstamos, empezar temprano.
2. Carreras profesionales: equivalencia de títulos, traducciones, currículum estándar EE. UU., inserción laboral.
3. Optimización de crédito personal: construir y ordenar el crédito con estrategia, incluso recién llegados o desde el extranjero.
4. Centro empresarial: LLC, cumplimiento federal/estatal/local, cuenta bancaria y crédito empresarial en el orden correcto.

### 3.5 Servicios (ids para formularios y CRM)
`universidad` Universidad, becas y FAFSA · `carrera` Carrera y currículum en EE. UU. · `equivalencia` Equivalencia de títulos y traducciones · `credito_personal` Crédito personal · `credito_empresa` Crédito empresarial · `empresa` Abrir mi negocio (LLC) · `toolkits` Toolkits bilingües de 6SGS

### 3.6 Reconocimientos
- Best Consultancy for Immigrant Success in the USA of 2026 — Best of Best Review.
- 2026 Global Recognition Award — Innovation & Enterprise.

### 3.7 Prensa
Associated Press, Business Insider Markets, Forbes Scotland, Fast Company Philippines, USA News, Women's Insider, El Venezolano de Houston, Barchart, StreetInsider, NewsBreak.
Enlaces:
- https://bestofbestreview.com/awards/6sgs-consultants-best-consultancy-for-immigrant-success-in-the-usa-of-2026
- https://globalrecognitionawards.org/winners/2026/6sgs-consultants-recognized-with-a-2026-global-recognition-award/
- https://forbesscotland.com/from-process-optimization-to-community-impact-the-work-behind-6sgs-consultants/
- https://fastcompany.ph/karely-paredes-didnt-reinvent-consulting-she-just-aimed-it-at-the-right-people/

### 3.8 Testimonios iniciales (luego administrables desde el panel)
- Graduado de University of Houston–Downtown a los 46 años tras recibir ayuda con FAFSA, préstamos y plan de estudios.
- Lucy, fundadora de "Bouquets by Lucy": su negocio estuvo operando en un par de meses.
- A. Martínez, ingeniero de Venezuela: equivalencia, traducciones y currículum listos en menos de 3 meses.

### 3.9 Redes y enlaces
- Tienda: https://6sgsconsultants.shop
- TikTok: @successbykarely, @6sgsconsultants, @6sgs.careercolleg (confirmar)
- Instagram: @successbykarely, @6sgs_consultants, @6sgs_careercollegesuccess
- Facebook: Success by Karely, 6SGS Consultants, 6SGS Career & College Success
- Pendientes: correo oficial, WhatsApp, teléfono, ciudad, precios, enlace de Telegram, enlace de agenda.

---

## 4. Identidad visual

### 4.1 Paleta (muestreada del logo oficial)
| Token | Hex | Uso |
|---|---|---|
| --vino | #56172C | Principal |
| --vino-profundo | #3A0E1D | Fondos profundos, menú lateral |
| --vino-suave | #7A2A45 | Brillos en degradados |
| --oro | #D3AE7A | Bordes, líneas, foco |
| --oro-medio | #E4C692 | Texto dorado |
| --oro-claro | #F6DCB9 | Texto claro sobre vino |
| --marfil | #F8EFEA | Fondo claro |
| --blanco | #FFFCFA | Superficies |
| --tinta | #2B1219 | Texto principal |
| --tinta-suave | #6B4B55 | Texto secundario |

Degradado dorado metálico: `linear-gradient(115deg, #C99F66 0%, #E9CD98 38%, #F6DCB9 55%, #D8B47E 80%, #C99F66 100%)`
6SGS (solo sello): azul #355062, blanco #FEFCFB, coral #F17377.

### 4.2 Logo
Monograma: K entrelazada con flor de loto dorada. Wordmark: "SUCCESS" sans geométrica gruesa + "BY" en círculo dorado + "Karely" serif caligráfica de alto contraste. Mientras no se suba el logo, usar un wordmark tipográfico: "Success by Karely" en Fraunces con degradado dorado y una K tipográfica como monograma.

### 4.3 Tipografía
- Títulos: Fraunces (300–600), evoca el "Karely" del logo.
- Texto e interfaz: Outfit (300–600), evoca "SUCCESS".
- Google Fonts con fallbacks reales. Líneas de máximo ~72 caracteres. Para artículos del blog, escala editorial con más interlineado.

### 4.4 Imágenes administrables desde el panel
- Ninguna imagen del sitio va fija en el código. Todas se suben y se cambian desde el panel admin, se guardan en Cloudinary y sus URLs se registran en Firestore.
- Mientras un espacio no tenga imagen, mostrar un marcador elegante de vidrio con las proporciones correctas (wordmark dorado y K tipográfica). El diseño nunca debe verse roto ni desalineado.
- Catálogo `ESPACIOS_IMAGEN` en config.js con: id, nombre legible, dónde aparece, proporción, medidas recomendadas, formatos y si es obligatorio. Como mínimo:
  - logo_completo: logo Success by Karely (1200×1200)
  - monograma: K dorada con fondo transparente (PNG, 600×520)
  - favicon: icono del sitio (PNG, 512×512)
  - retrato_karely: foto de Mi historia (4:5, 1200×1500)
  - hero_karely: foto opcional del hero (1400×1750)
  - autora_blog: foto circular para la caja de autora (800×800)
  - og_imagen: imagen para compartir en redes (1200×630)
  - fondo_acceso: imagen opcional del login del portal (1920×1080)
  - logos_prensa: galería opcional de logos de medios (PNG transparente)
  - galeria_eventos: galería opcional de conferencias y talleres
- Portadas de cursos, imágenes del blog y fotos de testimonios se suben desde sus propias pantallas del admin.
- Las páginas leen siteMedia al cargar, aplican transformaciones de Cloudinary (f_auto, q_auto, srcset responsivo) y cachean las URLs en sessionStorage para evitar parpadeos.
- Limitación a documentar: buscadores y redes sociales no ejecutan JavaScript, así que el favicon y og_imagen necesitan además una copia estática en assets/img/. Al subirlas en el panel, ofrecer el archivo listo para descargar con instrucciones claras.

---

## 5. Dirección de diseño: glassmorphism de lujo

El estilo es "vidrio esmerilado sobre terciopelo vino con filos de oro".

### 5.1 Fondo vivo
- Degradados radiales de vino (#3A0E1D → #56172C → #7A2A45) con 3 o 4 orbes de luz difusa (blur 80–120px) en vino suave, oro tenue (#D3AE7A al 25 %) y rosa vino, moviéndose muy lento (20–30 s).
- Textura de grano sutil (ruido SVG al 3–4 %) para sensación de terciopelo.
- Secciones claras: marfil con orbes muy suaves en dorado y rosa.

### 5.2 Paneles de vidrio (clases reutilizables)
- `.glass` (sobre oscuro): `background: rgba(255,252,250,.08)`, `backdrop-filter: blur(18px) saturate(140%)` (+ `-webkit-`), borde `1px solid rgba(246,220,185,.22)`, `box-shadow: inset 0 1px 0 rgba(255,255,255,.18), 0 30px 60px -30px rgba(20,4,10,.6)`.
- `.glass-claro` (sobre marfil): `rgba(255,255,255,.55)`, blur 16px, borde `rgba(211,174,122,.35)`.
- `.glass-oro`: borde en degradado dorado (pseudo-elemento con máscara) para premios, CTA principal y progreso.
- Reflejo: pseudo-elemento con degradado diagonal blanco al 10 % en la parte superior.
- Radios con jerarquía: 28px paneles grandes, 16px tarjetas, 999px botones y chips.
- Fallback con `@supports not (backdrop-filter: blur(1px))`: fondo más opaco y legible.
- Contraste AA sobre vidrio; si el fondo es muy variable, subir opacidad.
- Máximo 6–8 elementos con blur visibles a la vez; en móviles de gama baja reducir a 10px.

### 5.3 Dónde usar glass
Navegación (cápsula flotante al hacer scroll), hero, tarjetas de etapas, servicios, premios, testimonios, formulario, tarjetas del blog, menú lateral del portal y admin, tarjetas de cursos, chat, modales, cajones y toasts.

### 5.4 Elemento memorable del hero
Ruta dorada en SVG que se dibuja sola subiendo en zigzag con las 4 paradas numeradas (inspirada en la infografía oficial donde un camino sube hasta un cohete), rematando en el monograma K que brilla suavemente. Cada parada aparece en secuencia como cápsula de vidrio con su nombre.

### 5.5 Qué evitar
Etiquetas en MAYÚSCULAS espaciadas sobre cada título, flechas "→" en botones, tarjetas idénticas con la misma sombra gris, animaciones de entrada repetidas en todas las secciones. Respetar `prefers-reduced-motion` (desactivar orbes animados, trazos y efectos 3D).

---

## 6. Experiencia de usuario

- Transiciones suaves entre vistas (fade + ligero desplazamiento, 250 ms).
- Brillo dorado (shimmer) solo en el CTA principal al pasar el cursor.
- Tarjetas con leve inclinación 3D al mover el mouse (máx. 4°), solo escritorio.
- Halo de luz dorada tenue que sigue el cursor en secciones oscuras (escritorio).
- Onboarding al registrarse: 3 pantallas de vidrio ("Bienvenida a tu ruta", "Elige tu etapa", "Así guardas tu progreso") y luego lleva a la etapa recomendada según los servicios elegidos.
- Celebraciones: check animado al completar una lección; confeti dorado discreto y mensaje de Karely al completar un curso o etapa ("Un paso más hacia tu futuro").
- Anillos de progreso dorados por etapa, racha de días de estudio, "continúa donde lo dejaste".
- Skeletons de carga en vidrio, nunca pantallas en blanco.
- Estados vacíos con dirección clara ("Aún no tienes documentos. Sube tu diploma para empezar tu equivalencia.").
- Toasts con el mismo verbo del botón ("Solicitud enviada", "Artículo publicado").
- Microcopia cálida en primera persona de Karely en landing, blog y portal.
- Modo claro/oscuro en portal y admin, guardado en localStorage.

---

## 7. Sitio público (index.html)

1. Navegación: monograma + "Success by Karely", enlaces (Mi historia, El método, Servicios, Blog, Contacto), botón "Mi espacio" → `portal/`, selector ES/EN. Cápsula de vidrio al hacer scroll; menú móvil en panel de vidrio.
2. Hero: mensaje firma en degradado dorado, bajada, CTA "Crear mi cuenta gratis" (→ `portal/?registro=1`) y "Agendar una consulta" (→ #contacto), firma "Karely Paredes, MBA, Lean Six Sigma Black Belt", ruta dorada animada.
3. Mi historia: retrato con marco de vidrio y filo dorado, cita grande, relato en primera persona, credenciales en chips.
4. El método: 4 etapas numeradas unidas por una línea dorada que se ilumina con el scroll.
5. Servicios: 6 servicios en tarjetas de vidrio con icono lineal dorado.
6. Reconocimientos y prensa: 2 premios en `.glass-oro` + carrusel lento de medios con enlaces.
7. Testimonios desde Firestore (con respaldo estático) en carrusel de vidrio.
8. Últimos artículos del blog: destacado en grande + 3 recientes.
9. Recursos y comunidad: Telegram y tienda de toolkits.
10. Formulario de contacto en vidrio → `leads`:
    - Nombre, apellido, correo, teléfono/WhatsApp, país de origen, estado de residencia, servicios (chips), mensaje, cómo nos conoció, idioma preferido.
    - Consentimiento obligatorio. Anti-spam: honeypot + tiempo mínimo de llenado + validación en reglas.
    - Mensaje de éxito personalizado y animado.
11. Footer vino profundo: marca, redes, sello "Parte de 6SGS Consultants", aviso legal, privacidad y términos.

SEO:
- Title y description orientados a "Karely Paredes", "éxito para inmigrantes en EE. UU.", "becas y FAFSA en español", "crédito para inmigrantes", "abrir LLC en español".
- Importante: "Success by Karely" hoy lo domina en Google una influencer sin relación; posicionar fuerte el nombre completo "Karely Paredes" junto a la marca.
- JSON-LD: Person (Karely Paredes) + ProfessionalService (Success by Karely, parentOrganization 6SGS Consultants, premios, idiomas).
- Open Graph, Twitter cards, sitemap.xml, robots.txt (bloquear /admin/ y /portal/), hreflang es/en.

---

## 8. Blog profesional

### 8.1 Sitio público
- blog/index.html:
  - Artículo destacado en portada tipo revista.
  - Rejilla: portada, categoría, título, extracto, fecha, tiempo de lectura y autora.
  - Filtros por categoría (las 4 etapas + Inmigración y vida en EE. UU. + Historias de éxito + Noticias de 6SGS), búsqueda y etiquetas.
  - "Cargar más", skeletons y estado vacío con dirección.
- blog/articulo.html?slug=...:
  - Portada a ancho completo con título en Fraunces sobre degradado vino.
  - Barra de progreso de lectura dorada.
  - Tabla de contenido automática desde los subtítulos (flotante en escritorio).
  - Tipografía editorial: subtítulos, citas destacadas, listas, imágenes con pie, videos embebidos, botones de llamada a la acción.
  - Caja de autora con foto, bio corta y redes.
  - Compartir: WhatsApp, Facebook, LinkedIn, X, copiar enlace.
  - Artículos relacionados por categoría.
  - Llamada a la acción final configurable por artículo ("Agenda tu consulta" / "Crea tu cuenta gratis").
  - Suscripción al boletín → leads con source "blog-newsletter".
  - Actualizar título, meta description y JSON-LD Article al cargar.
- Visibilidad por artículo: "Público" o "Solo miembros". Los de solo miembros muestran al público título, portada y extracto con un panel de vidrio "Crea tu cuenta gratis para leer el artículo completo". Los miembros los ven completos y también en el portal ("Artículos exclusivos").
- Contador de lecturas.

### 8.2 SEO del blog (limitación de sitio estático)
WhatsApp y Facebook no ejecutan JavaScript al generar vistas previas. En la fase final, crear un GitHub Action (manual y programado cada 6 horas) que lea los artículos publicados desde Firestore con una cuenta de servicio guardada en GitHub Secrets y genere páginas estáticas `blog/{slug}/index.html` con meta tags y Open Graph correctos, más sitemap.xml y feed RSS. Documentarlo paso a paso en el README.

---

## 9. Portal del cliente (portal/)

### 9.1 Acceso
- Fondo vino animado y panel central de vidrio con pestañas "Crear cuenta / Iniciar sesión". Con `?registro=1` abrir "Crear cuenta".
- Registro en 2 pasos con barra de progreso (datos de acceso → perfil). Campos para el CRM: Nombre*, Apellido*, Correo*, Contraseña* (mín. 8, indicador de fuerza), Teléfono/WhatsApp*, País de origen, Estado/Ciudad en EE. UU., Idioma preferido, Fecha de nacimiento (opcional), Situación actual (estudiante, padre/madre de estudiante, profesional, emprendedor, otro), Servicios de interés, Cómo nos conoció, Consentimiento de comunicaciones*, Aceptación de términos y privacidad*.
- Al registrar: crear usuario, `updateProfile`, enviar verificación de correo, crear `users/{uid}` y `chats/{uid}`, lanzar onboarding.
- Recuperar contraseña. Errores en español claros y accionables. Aviso no bloqueante si el correo no está verificado con "Reenviar verificación".

### 9.2 Secciones (menú lateral de vidrio)
1. Inicio: saludo con su nombre, anillos de progreso por etapa, progreso global, "continúa donde lo dejaste", próximo paso recomendado, tareas pendientes, últimos mensajes y anuncios.
2. Mi ruta / Cursos:
   - Cursos por pilar, filtrables, en tarjetas de vidrio con portada, nivel, duración, lecciones y % completado.
   - Visor: lista de lecciones con check, video YouTube/Vimeo, contenido con formato, recursos descargables, "Marcar como completada" y "Siguiente lección".
   - Progreso en Firestore; reanuda en la última lección.
   - Cursos públicos para todos o restringidos a clientes asignados.
3. Plan de acción: checklist del equipo con fechas límite; el cliente marca como hecho.
4. Documentos: arrastrar y soltar (PDF, JPG, PNG, WEBP, DOCX; máx. 10 MB), progreso de subida, estados (recibido, en revisión, aprobado, requiere corrección) y comentarios del equipo. Archivos del equipo hacia el cliente. Aviso: no subir el número de Seguro Social completo.
5. Mensajes: chat en tiempo real (onSnapshot), burbujas, hora, no leídos, envío con Enter.
6. Artículos exclusivos del blog.
7. Comunidad: Telegram, WhatsApp y anuncios.
8. Mi perfil: editar datos (sin acceso a etapa del CRM ni notas internas), idioma, modo claro/oscuro, cerrar sesión.

---

## 10. Panel de administración (admin/)

`<meta name="robots" content="noindex, nofollow">`. Mismo lenguaje de vidrio, más denso y funcional. Acceso solo si existe `admins/{uid}`; si no: "Esta cuenta no tiene acceso al panel" y cerrar sesión.

### 10.1 Secciones
1. Resumen: clientes registrados, leads sin atender, mensajes sin leer, clientes por etapa, registros por semana (Chart.js), servicios más solicitados, artículos más leídos, aviso "Faltan X imágenes del sitio" con acceso directo.
2. Clientes (CRM): tabla con búsqueda y filtros (etapa, servicio, idioma, fecha); columnas nombre, correo, teléfono, servicios, etapa editable en línea, progreso, fecha. Cajón lateral con ficha completa, pipeline, etiquetas, responsable, próxima acción y fecha de seguimiento, notas internas con historial, progreso por curso, documentos (cambiar estado y comentar), tareas, cursos asignados y botones rápidos (chat, WhatsApp wa.me, mailto).
3. Leads: estados (nuevo, contactado, convertido, descartado), notas, vincular con cliente registrado por correo.
4. Mensajes: bandeja en tiempo real con no leídos destacados.
5. Cursos: CRUD (título, descripción, pilar, nivel, duración, portada con recorte 16:9, publicado, acceso público/restringido), editor de lecciones (título, video, contenido, recursos), reordenar arrastrando cursos y lecciones.
6. Blog:
   - Lista con miniatura, título, estado, categoría, visibilidad, fecha, lecturas y autora; búsqueda y filtros.
   - Estados: Borrador, Programado (fecha y hora), Publicado, Archivado.
   - Acciones: Editar, Vista previa, Duplicar, Publicar/Despublicar, Destacar, Archivar, Mover a papelera, Restaurar.
   - Reordenar arrastrando (SortableJS) artículos fijados y destacado de la landing, con botones subir/bajar accesibles por teclado.
   - Selección múltiple para acciones masivas.
   - Editor a pantalla completa: título, slug automático editable y único, extracto, categoría, etiquetas, autora; portada con recorte 16:9 y texto alternativo; Quill 2 con H2/H3, negrita, cursiva, enlaces, listas, citas, imágenes subidas a Cloudinary, videos embebidos y botón de llamada a la acción; DOMPurify al guardar y al mostrar; tiempo de lectura automático; pestaña SEO (título SEO, meta descripción con contador, imagen para compartir, vista previa en Google y WhatsApp); versión en inglés opcional; autoguardado cada 20 s con "Guardado hace X s"; historial de las últimas 10 versiones con restaurar; Vista previa exacta.
   - Gestión de categorías (crear, renombrar, ordenar, eliminar).
7. Testimonios y anuncios: CRUD con foto opcional, publicar/ocultar y reordenar.
8. Imágenes del sitio:
   - Todos los espacios de ESPACIOS_IMAGEN en tarjetas de vidrio con vista previa, estado (Pendiente en coral / Lista en dorado), medidas recomendadas y dónde aparece.
   - Subir por arrastrar o elegir, recorte guiado con la proporción correcta (Cropper.js), validación de tamaño y formato, barra de progreso, texto alternativo ES/EN, Reemplazar y Quitar.
   - Vista previa "así se verá" dentro del diseño real.
   - Historial para restaurar la imagen anterior.
   - Galerías con reordenar arrastrando.
9. Exportar: CSV con BOM UTF-8 de clientes, leads y suscriptores.
10. Equipo (solo owner): administradores y roles.
11. Actividad (solo owner): registro de acciones.

### 10.2 Estándar profesional (aplica a TODO el panel)
- Roles: owner (todo), staff (clientes, leads, mensajes, documentos), editor (blog, cursos, imágenes, testimonios, anuncios). El menú y las acciones se adaptan al rol y las reglas de Firestore lo hacen cumplir.
- Todo contenido (artículos, cursos, lecciones, testimonios, anuncios, imágenes de galerías) se puede crear, editar, publicar/ocultar, reordenar arrastrando y eliminar.
- Nada se borra de golpe: papelera con restauración; borrado definitivo con confirmación escribiendo el título.
- Tras eliminar o archivar: toast con "Deshacer" durante 6 segundos.
- Registro de actividad en auditLog: quién hizo qué y cuándo.
- Validaciones en vivo, contadores de caracteres, aviso antes de salir con cambios sin guardar.
- Atajos: Ctrl/Cmd + S guardar, Esc cerrar, / enfocar búsqueda.
- Búsqueda global en la barra superior (clientes, leads, artículos, cursos).
- Mismas acciones con los mismos nombres en todo el panel.

---

## 11. Integraciones

### 11.1 Cloudinary
- Preset unsigned con formatos permitidos, máximo 10 MB, carpeta base `success-by-karely/`, nombres únicos aleatorios.
- Carpetas: `sitio/`, `blog/{postId}`, `cursos/{courseId}`, `testimonios/`, `clientes/{uid}/documentos`.
- Subida con XMLHttpRequest para mostrar progreso; guardar secure_url, public_id, width, height, format y bytes.
- Imágenes con `f_auto,q_auto` y srcset responsivo.
- En el README advertir que con preset sin firma las URLs son públicas aunque no adivinables; para documentos sensibles proponer en el futuro URLs firmadas vía Cloud Function.

### 11.2 Telegram
- Comunidad: botón al canal/grupo configurable.
- Notificaciones con Firebase Cloud Functions v2 (plan Blaze con capa gratuita), secretos TELEGRAM_TOKEN y TELEGRAM_CHAT_ID; el token nunca en el navegador:
  - Nuevo lead → "🆕 Nuevo lead: nombre, correo, teléfono, servicios, mensaje".
  - Nuevo registro → "👤 Nuevo registro en el portal".
  - Mensaje de cliente → "💬 Mensaje de X: …".
  - Documento subido por cliente → "📎 Nuevo documento".
  - Nuevo suscriptor del blog → "📰 Nuevo suscriptor".
  - Escapar HTML e incluir enlace al panel.
- Alternativa sin Blaze: Google Apps Script como web app (documentar pros y contras).
- Opcional: responder al chat desde Telegram vía webhook.

### 11.3 Otros
Botón flotante de WhatsApp en vidrio (configurable), enlace de agenda configurable, Google Analytics 4 opcional con banner de cookies.

---

## 12. Modelo de datos en Firestore

```
admins/{uid}            role (owner|staff|editor), name, email, createdAt
users/{uid}             firstName, lastName, email, phone, country, state, city,
                        language, birthDate?, situation, services[], referral,
                        consentMarketing, acceptedTermsAt, theme, onboardingDone,
                        streak, lastActiveAt, createdAt, updatedAt
  progress/{courseId}   completed[], lastLessonId, updatedAt
  documents/{docId}     name, url, publicId, format, bytes, uploadedBy,
                        status, adminComment, createdAt
  tasks/{taskId}        title, detail, dueDate, done, createdBy, createdAt
crm/{uid}               stage (nuevo|contactado|consulta|cliente|completado|pausa),
                        tags[], owner, nextAction, followUpAt, updatedAt
  notes/{noteId}        text, author, createdAt
leads/{leadId}          firstName, lastName, email, phone, country, state, services[],
                        message, referral, language, source, status, consent,
                        createdAt, linkedUid?
courses/{courseId}      title, description, pillar, level, duration, coverUrl,
                        published, access (todos|restringido), allowedUids[], order,
                        lessons[{id, title, videoUrl, content, resources[{name,url}]}],
                        deletedAt?, createdAt, updatedAt
posts/{postId}          title, title_en?, slug, excerpt, excerpt_en?, contentHtml,
                        contentHtml_en?, coverUrl, coverPublicId, coverAlt, category,
                        tags[], author, status (borrador|programado|publicado|archivado|papelera),
                        visibility (publico|miembros), featured, pinned, order,
                        publishAt, readingMinutes, views, ctaType, ctaText, ctaUrl,
                        seoTitle, seoDescription, ogImageUrl,
                        createdAt, updatedAt, updatedBy, deletedAt?
  versions/{versionId}  snapshot, savedAt, savedBy
postCategories/{id}     name, name_en, slug, order
siteMedia/{espacioId}   url, publicId, width, height, format, alt_es, alt_en,
                        previous?, updatedAt, updatedBy
  items/{id}            (galerías) url, publicId, alt_es, alt_en, order
chats/{uid}             clientName, lastMessage, updatedAt, unreadByAdmin, unreadByClient
  messages/{msgId}      text, from (client|admin), authorName, createdAt
testimonials/{id}       quote, author, detail, photoUrl?, published, order, deletedAt?
announcements/{id}      title, body, link, published, createdAt, deletedAt?
auditLog/{id}           uid, name, action, collection, docId, summary, createdAt
```

### Reglas de seguridad (firestore.rules)
- Funciones: signedIn(), isOwner(uid), role(), isAdmin() (cualquier rol), isOwnerRole(), isStaff() (owner o staff), isEditor() (owner o editor).
- users: dueño o isStaff; validar campos permitidos con keys().hasOnly() y tipos/longitudes.
- progress y tasks: el cliente solo actualiza completed/lastLessonId y done; isStaff todo; isEditor puede leer progress para estadísticas de cursos.
- documents: el cliente crea y lee los suyos, no cambia status ni adminComment.
- crm/** y leads (lectura/edición): solo isStaff. leads create público validado (campos exactos, longitudes, status == "nuevo", createdAt == request.time).
- chats: cliente solo en su chat con from == "client"; isStaff con from == "admin"; nadie edita mensajes ajenos.
- courses: leer si published y (access "todos" o uid en allowedUids) o isAdmin; escribir isEditor.
- posts: lectura pública si status == "publicado", publishAt <= request.time y visibility == "publico"; usuarios registrados además leen visibility == "miembros"; cualquiera puede actualizar SOLO views sumando exactamente 1; crear/editar/borrar isEditor. Las consultas del sitio deben incluir esos mismos filtros.
- postCategories, siteMedia, testimonials, announcements: lectura pública (publicados cuando aplique); escritura isEditor.
- admins y auditLog: lectura solo owner; auditLog create por cualquier admin sin update ni delete.
- Todo lo demás denegado. Incluir firestore.indexes.json con los índices compuestos.

---

## 13. Idiomas
Español por defecto con opción inglés en todo el sitio, blog, portal y admin. Textos en i18n.js; idioma en localStorage y en el perfil. Contenido con campos opcionales _es / _en.

## 14. Calidad obligatoria
- Responsive desde 360 px; menú lateral deslizable en móvil; respetar env(safe-area-inset-*).
- Accesibilidad WCAG 2.1 AA: contraste sobre vidrio, foco visible dorado, labels, aria-current, teclado, reduced-motion, alternativas de teclado para todo lo que se arrastra.
- Seguridad: escapar todo texto de usuario antes de insertarlo en el DOM; HTML del blog siempre pasado por DOMPurify; validar en cliente y en reglas.
- Rendimiento: Lighthouse ≥ 90 en landing y blog, fuentes con display=swap, JS por página, lazy loading de imágenes, límite de elementos con blur.
- Código comentado en español.
- Legal: privacidad y términos (mencionando Firebase, Cloudinary y Telegram), aviso "información educativa, no constituye asesoría legal, financiera ni migratoria", registro de aceptación y consentimiento. Success in the USA by 6SGS™ y Engineering Success in the USA™ son marcas de 6SGS Consultants.

---

## 15. Fases
1. Base y sistema visual: estructura, config.js, tokens, clases glass, fondos con orbes, marcadores de imagen, landing completa con formulario de leads y reglas para leads.
2. Portal: registro en 2 pasos, login, recuperación, onboarding, perfil, inicio con anillos de progreso.
3. Plataforma educativa: cursos, lecciones, progreso, celebraciones, plan de acción.
4. Documentos y chat.
5. Admin completo: CRM, leads, mensajes, cursos, testimonios, anuncios, imágenes del sitio, roles, papelera, deshacer y registro de actividad.
6. Blog: páginas públicas, sección en la landing, artículos exclusivos en el portal y editor completo en el admin.
7. Telegram (Cloud Functions), inglés, SEO, GitHub Action del blog, legal, pulido, pruebas y subida guiada de todas las imágenes desde el panel.

## 16. README (obligatorio, en español y para no técnicos)
1. Crear proyecto Firebase, activar Auth (correo/contraseña) y Firestore; copiar configuración a config.js; autorizar el dominio de GitHub Pages.
2. Publicar reglas e índices.
3. Crear el primer admin: registrarse en el portal → copiar UID → crear admins/{UID} con role "owner".
4. Crear el preset unsigned en Cloudinary.
5. Crear el bot con @BotFather, obtener chat ID, configurar secretos y desplegar funciones.
6. Configurar el GitHub Action del blog con la cuenta de servicio en GitHub Secrets.
7. Subir a GitHub y activar Pages; dominio propio opcional.
8. Subir las imágenes desde Admin > Imágenes del sitio y copiar favicon y og-image a assets/img/.
9. Lista de pruebas.

## 17. Criterios de aceptación
- Un visitante envía una solicitud: aparece en Admin > Leads y llega aviso a Telegram.
- Un cliente se registra, verifica su correo, completa lecciones, cierra sesión y al volver su progreso sigue intacto.
- Un cliente sube un documento; el admin cambia su estado y el cliente lo ve.
- Chat en tiempo real en ambos sentidos con no leídos.
- El admin cambia la etapa del CRM y agrega notas que el cliente nunca ve.
- El editor crea un artículo con portada e imágenes, lo programa y se publica solo a esa hora.
- Los artículos se reordenan arrastrando, se duplican, se archivan, van a la papelera y se restauran.
- Un artículo "solo miembros" muestra solo el extracto al público y completo a usuarios registrados.
- El admin sube, recorta, reemplaza y quita cualquier imagen del sitio desde el panel y el cambio se ve sin tocar código.
- Con todos los espacios de imagen vacíos, el sitio sigue viéndose completo y elegante.
- Un usuario no admin no puede leer crm, leads ni datos de otros; un editor no ve clientes, leads ni mensajes (probar con el simulador de reglas).
- El glassmorphism se ve bien en Chrome, Safari (incluido iPhone) y Firefox, con fallback legible.
- Todo funciona en GitHub Pages sin compilación.
