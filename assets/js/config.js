/* ==========================================================================
   Success by Karely — ÚNICO archivo de configuración
   --------------------------------------------------------------------------
   Todo lo que se puede cambiar sin tocar código vive aquí.
   Los valores que empiezan por "TU_" o "PENDIENTE" son marcadores: el sitio
   los detecta y oculta (o desactiva con elegancia) lo que dependa de ellos.
   Nunca pongas aquí secretos: token del bot de Telegram, API secret de
   Cloudinary ni cuentas de servicio. Las claves web de Firebase SÍ son
   públicas por diseño; la seguridad la dan las reglas de Firestore.
   ========================================================================== */

export const CONFIG = {
  sitio: {
    nombre: 'Success by Karely',
    // Dominio final con https y sin barra al final (ej. https://successbykarely.com)
    url: 'https://successbykarely.dgp-link.com',
    idiomaPorDefecto: 'es',
  },

  // Firebase > Configuración del proyecto > Tus apps > App web
  firebase: {
    apiKey: 'AIzaSyD3YTQ9wxATsRSLwfpuelu3XHqPwLrexMs',
    authDomain: 'successbykarely-ef4a0.firebaseapp.com',
    projectId: 'successbykarely-ef4a0',
    storageBucket: 'successbykarely-ef4a0.firebasestorage.app',
    messagingSenderId: '895436564251',
    appId: '1:895436564251:web:bf4afb0fd9fc119b2a95be',
  },

  // Cloudinary con upload preset SIN firma (unsigned)
  cloudinary: {
    cloudName: 'successbykarely',
    uploadPreset: 'bzrjdfnu',
    carpetaBase: 'success-by-karely',
    maxBytes: 10 * 1024 * 1024,
  },

  contacto: {
    whatsapp: 'PENDIENTE_WHATSAPP', // solo dígitos con código de país, ej. 13465550000
    telefono: 'PENDIENTE_TELEFONO',
    correo: 'PENDIENTE_CORREO',
    agenda: 'PENDIENTE_AGENDA', // enlace de Calendly, Google Calendar, etc.
    telegram: 'PENDIENTE_TELEGRAM', // enlace al canal o grupo
    ciudad: 'Houston, Texas', // pendiente de confirmar
  },

  tienda: 'https://6sgsconsultants.shop',

  redes: {
    successbykarely: {
      instagram: 'https://www.instagram.com/successbykarely/',
      tiktok: 'https://www.tiktok.com/@successbykarely',
      facebook: 'PENDIENTE_FACEBOOK_SUCCESS',
    },
    sgs: {
      instagram: 'https://www.instagram.com/6sgs_consultants/',
      tiktok: 'https://www.tiktok.com/@6sgsconsultants',
      facebook: 'PENDIENTE_FACEBOOK_6SGS',
    },
    careerCollege: {
      instagram: 'https://www.instagram.com/6sgs_careercollegesuccess/',
      tiktok: 'PENDIENTE_TIKTOK_CAREERCOLLEGE', // @6sgs.careercolleg sin confirmar
      facebook: 'PENDIENTE_FACEBOOK_CAREERCOLLEGE',
    },
  },

  // Anti-spam del formulario: segundos mínimos antes de poder enviar
  formulario: { segundosMinimos: 4, esperaEntreEnvios: 60 },
};

/* --------------------------------------------------------------------------
   Servicios (ids fijos: los usan formularios, CRM y reglas de Firestore)
   -------------------------------------------------------------------------- */
export const SERVICIOS = [
  { id: 'universidad', es: 'Universidad, becas y FAFSA', en: 'College, scholarships & FAFSA', etapa: 1 },
  { id: 'carrera', es: 'Carrera y currículum en EE. UU.', en: 'U.S. career & résumé', etapa: 2 },
  { id: 'equivalencia', es: 'Equivalencia de títulos y traducciones', en: 'Degree evaluation & translations', etapa: 2 },
  { id: 'credito_personal', es: 'Crédito personal', en: 'Personal credit', etapa: 3 },
  { id: 'credito_empresa', es: 'Crédito empresarial', en: 'Business credit', etapa: 4 },
  { id: 'empresa', es: 'Abrir mi negocio (LLC)', en: 'Start my business (LLC)', etapa: 4 },
  { id: 'toolkits', es: 'Toolkits bilingües de 6SGS', en: '6SGS bilingual toolkits', etapa: null },
];

/* Las 4 etapas del método Success in the USA by 6SGS™ */
export const ETAPAS = [
  { n: 1, id: 'universidad', es: 'Planificación universitaria', en: 'College planning' },
  { n: 2, id: 'carrera', es: 'Carreras profesionales', en: 'Professional careers' },
  { n: 3, id: 'credito', es: 'Crédito personal', en: 'Personal credit' },
  { n: 4, id: 'empresa', es: 'Centro empresarial', en: 'Business center' },
];

/* Opciones de "¿Cómo nos conociste?" */
export const REFERENCIAS = [
  { id: 'instagram', es: 'Instagram', en: 'Instagram' },
  { id: 'tiktok', es: 'TikTok', en: 'TikTok' },
  { id: 'facebook', es: 'Facebook', en: 'Facebook' },
  { id: 'google', es: 'Google', en: 'Google' },
  { id: 'recomendacion', es: 'Me lo recomendaron', en: 'Someone referred me' },
  { id: 'evento', es: 'Evento o conferencia', en: 'Event or conference' },
  { id: 'prensa', es: 'Prensa o medios', en: 'Press or media' },
  { id: 'otro', es: 'Otro', en: 'Other' },
];

/* Estados de EE. UU. para el formulario */
export const ESTADOS_EEUU = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Carolina del Norte', 'Carolina del Sur',
  'Colorado', 'Connecticut', 'Dakota del Norte', 'Dakota del Sur', 'Delaware', 'Distrito de Columbia',
  'Florida', 'Georgia', 'Hawái', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Luisiana', 'Maine', 'Maryland', 'Massachusetts', 'Míchigan', 'Minnesota', 'Misisipi', 'Misuri',
  'Montana', 'Nebraska', 'Nevada', 'Nueva Jersey', 'Nueva York', 'Nuevo Hampshire', 'Nuevo México',
  'Ohio', 'Oklahoma', 'Oregón', 'Pensilvania', 'Puerto Rico', 'Rhode Island', 'Tennessee', 'Texas',
  'Utah', 'Vermont', 'Virginia', 'Virginia Occidental', 'Washington', 'Wisconsin', 'Wyoming',
];

export const PAISES_SUGERIDOS = [
  'Argentina', 'Bolivia', 'Brasil', 'Chile', 'Colombia', 'Costa Rica', 'Cuba', 'Ecuador',
  'El Salvador', 'España', 'Estados Unidos', 'Guatemala', 'Haití', 'Honduras', 'México',
  'Nicaragua', 'Panamá', 'Paraguay', 'Perú', 'Puerto Rico', 'República Dominicana',
  'Uruguay', 'Venezuela',
];

/* Respaldo estático de testimonios (se reemplaza por Firestore si hay publicados) */
export const TESTIMONIOS_RESPALDO = [
  {
    quote: 'Se graduó de University of Houston–Downtown a los 46 años, después de ordenar su FAFSA, sus préstamos y su plan de estudios.',
    quote_en: 'Graduated from the University of Houston–Downtown at 46, after getting FAFSA, loans and a study plan in order.',
    author: 'Graduado de UH–Downtown',
    author_en: 'UH–Downtown graduate',
    detail: 'Etapa 1 · Planificación universitaria',
    detail_en: 'Stage 1 · College planning',
  },
  {
    quote: 'Su negocio, Bouquets by Lucy, estuvo operando en un par de meses, con cada trámite hecho en el orden correcto.',
    quote_en: 'Her business, Bouquets by Lucy, was up and running within a couple of months, every step done in the right order.',
    author: 'Lucy',
    detail: 'Fundadora de Bouquets by Lucy',
    detail_en: 'Founder of Bouquets by Lucy',
  },
  {
    quote: 'Ingeniero venezolano con equivalencia, traducciones y currículum estándar de EE. UU. listos en menos de 3 meses.',
    quote_en: 'Venezuelan engineer with degree evaluation, translations and a U.S.-standard résumé ready in under 3 months.',
    author: 'A. Martínez',
    detail: 'Ingeniero · Venezuela',
    detail_en: 'Engineer · Venezuela',
  },
];

/* --------------------------------------------------------------------------
   ESPACIOS_IMAGEN: catálogo de todas las imágenes administrables del sitio.
   Se suben desde Admin > Imágenes del sitio (Cloudinary) y se guardan en
   Firestore en siteMedia/{id}. Mientras falten, se ve un marcador elegante.
   -------------------------------------------------------------------------- */
export const ESPACIOS_IMAGEN = [
  {
    id: 'logo_completo', nombre: 'Logo Success by Karely', donde: 'Pie de página y acceso al portal',
    proporcion: '1:1', ratio: 1, ancho: 1200, alto: 1200, formatos: ['png', 'webp', 'svg'], obligatorio: true,
  },
  {
    id: 'monograma', nombre: 'Monograma K (fondo transparente)', donde: 'Navegación, hero y favicon de respaldo',
    proporcion: '15:13', ratio: 600 / 520, ancho: 600, alto: 520, formatos: ['png'], obligatorio: true,
  },
  {
    id: 'favicon', nombre: 'Icono del sitio', donde: 'Pestaña del navegador (copia estática en assets/img/)',
    proporcion: '1:1', ratio: 1, ancho: 512, alto: 512, formatos: ['png'], obligatorio: true,
  },
  {
    id: 'retrato_karely', nombre: 'Retrato de Karely', donde: 'Sección "Mi historia"',
    proporcion: '4:5', ratio: 4 / 5, ancho: 1200, alto: 1500, formatos: ['jpg', 'png', 'webp'], obligatorio: true,
  },
  {
    id: 'hero_karely', nombre: 'Foto del hero (opcional)', donde: 'Detrás de la ruta dorada del inicio',
    proporcion: '4:5', ratio: 4 / 5, ancho: 1400, alto: 1750, formatos: ['jpg', 'png', 'webp'], obligatorio: false,
  },
  {
    id: 'autora_blog', nombre: 'Foto de autora (circular)', donde: 'Caja de autora en cada artículo del blog',
    proporcion: '1:1', ratio: 1, ancho: 800, alto: 800, formatos: ['jpg', 'png', 'webp'], obligatorio: true,
  },
  {
    id: 'og_imagen', nombre: 'Imagen para compartir', donde: 'Vista previa en WhatsApp, Facebook y X (copia estática en assets/img/)',
    proporcion: '1.91:1', ratio: 1200 / 630, ancho: 1200, alto: 630, formatos: ['jpg', 'png'], obligatorio: true,
  },
  {
    id: 'fondo_acceso', nombre: 'Fondo del acceso al portal (opcional)', donde: 'Pantalla de inicio de sesión',
    proporcion: '16:9', ratio: 16 / 9, ancho: 1920, alto: 1080, formatos: ['jpg', 'webp'], obligatorio: false,
  },
  {
    id: 'logos_prensa', nombre: 'Logos de medios (galería opcional)', donde: 'Franja de prensa en "Reconocimientos"',
    proporcion: 'libre', ratio: null, ancho: 400, alto: 160, formatos: ['png', 'svg', 'webp'], obligatorio: false, galeria: true,
  },
  {
    id: 'galeria_eventos', nombre: 'Conferencias y talleres (galería opcional)', donde: 'Galería bajo "Reconocimientos"',
    proporcion: '4:3', ratio: 4 / 3, ancho: 1200, alto: 900, formatos: ['jpg', 'webp'], obligatorio: false, galeria: true,
  },
];

/* Devuelve true si un valor sigue siendo un marcador sin configurar */
export function esPendiente(valor) {
  return typeof valor !== 'string' || !valor.trim() || /(TU_|PENDIENTE)/.test(valor);
}
