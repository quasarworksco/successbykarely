/* ==========================================================================
   Textos ES / EN
   - data-i18n="clave"            → textContent
   - data-i18n-html="clave"       → innerHTML (solo textos de este archivo, nunca de usuarios)
   - data-i18n-attr="attr:clave;attr2:clave2" → atributos
   El idioma se elige por ?lang=en, luego localStorage, luego español.
   ========================================================================== */

const CLAVE_IDIOMA = 'sbk-idioma';
export const IDIOMAS = ['es', 'en'];

const TEXTOS = {
  es: {
    // Navegación
    'nav.saltar': 'Saltar al contenido',
    'nav.historia': 'Mi historia',
    'nav.metodo': 'El método',
    'nav.servicios': 'Servicios',
    'nav.contacto': 'Contacto',
    'nav.miEspacio': 'Mi espacio',
    'nav.abrirMenu': 'Abrir menú',
    'nav.cerrarMenu': 'Cerrar menú',
    'idioma.cambiar': 'Ver el sitio en inglés',

    // Hero
    'hero.titulo1': 'El éxito en Estados Unidos no debería depender de la suerte.',
    'hero.titulo2': 'Debe diseñarse.',
    'hero.bajada': 'Soy Karely Paredes. Llevo Lean Six Sigma, el método que nació para las fábricas, al futuro de tu familia: universidad, carrera, crédito y negocio, con pasos claros y medibles.',
    'hero.ctaCuenta': 'Crear mi cuenta gratis',
    'hero.ctaConsulta': 'Agendar una consulta',
    'ruta.aria': 'La ruta de 4 etapas: universidad, carrera, crédito y empresa',
    'ruta.1': 'Universidad',
    'ruta.2': 'Carrera',
    'ruta.3': 'Crédito',
    'ruta.4': 'Empresa',

    // Mi historia
    'historia.titulo': 'Llegué sin mapa. Por eso diseñé uno.',
    'historia.cita': '“El éxito no ocurre por casualidad, ocurre cuando entiendes el sistema.”',
    'historia.p1': 'Llegué a Estados Unidos con poco inglés, pocos recursos y muchas preguntas. Nadie me explicó cómo funcionaba el sistema: lo aprendí paso a paso, a veces equivocándome.',
    'historia.p2': 'Durante más de 20 años trabajé en servicio gubernamental y organizaciones sin fines de lucro, en inmigración, respuesta a desastres y desarrollo comunitario. Gestioné programas multimillonarios que impactaron a más de un millón de personas.',
    'historia.p3': 'Como Lean Six Sigma Black Belt aprendí que los mejores resultados no dependen de la suerte, sino de procesos bien diseñados. Ese método nació para las fábricas. Yo lo llevé al futuro de las familias inmigrantes.',
    'historia.p4': 'La prueba más importante está en casa: mi hija Kamila estudia Neurociencia y Pre-medicina en la Universidad de Rochester con la beca completa Alan and Jane Handler. Es la primera venezolana-estadounidense en recibirla. No fue suerte. Fue un sistema.',
    'historia.credenciales': 'Credenciales',
    'historia.chipJusticia': 'Lic. en Justicia Criminal',
    'historia.chipFamilias': 'Certificaciones en atención a niños y familias',
    'historia.chipTitulos': '4 títulos académicos',
    'historia.chipBilingue': 'Bilingüe ES · EN',
    'historia.cifra1': 'años en servicio público y sin fines de lucro',
    'historia.cifra2': 'personas impactadas',
    'historia.cifra3': 'títulos académicos',
    'historia.formacion': 'Formación con Tony Robbins, Dan Martell, Brendon Burchard, Dean Graziosi y Ed Mylett.',

    // Método
    'metodo.titulo': 'Esto no es una guía universitaria. Es un sistema.',
    'metodo.intro': 'Ordeno tu camino en cuatro etapas. Cada una tiene pasos, tiempos y resultados medibles: menos errores y menos años perdidos.',
    'metodo.e1t': 'Planificación universitaria',
    'metodo.e1d': 'Admisiones, becas, FAFSA, ayuda financiera y préstamos. Empezar temprano cambia todo.',
    'metodo.e2t': 'Carreras profesionales',
    'metodo.e2d': 'Equivalencia de títulos, traducciones, currículum estándar de EE. UU. e inserción laboral.',
    'metodo.e3t': 'Optimización de crédito personal',
    'metodo.e3d': 'Construir y ordenar tu crédito con estrategia, incluso si acabas de llegar o vives en el extranjero.',
    'metodo.e4t': 'Centro empresarial',
    'metodo.e4d': 'LLC, cumplimiento federal, estatal y local, cuenta bancaria y crédito empresarial en el orden correcto.',
    'metodo.cierre': 'Construimos sistemas que funcionan.',

    // Servicios
    'servicios.titulo': '¿Por dónde quieres empezar?',
    'servicios.intro': 'Cada servicio aplica el mismo rigor: entender tu caso, diseñar el plan y acompañarte en cada paso.',
    'servicios.universidad.t': 'Universidad, becas y FAFSA',
    'servicios.universidad.d': 'Elige universidad con estrategia, llena la FAFSA sin errores y busca becas que sí te corresponden.',
    'servicios.carrera.t': 'Carrera y currículum en EE. UU.',
    'servicios.carrera.d': 'Tu experiencia traducida al idioma de los reclutadores: currículum estándar, LinkedIn y búsqueda enfocada.',
    'servicios.equivalencia.t': 'Equivalencia de títulos y traducciones',
    'servicios.equivalencia.d': 'Evalúa tu título extranjero y prepara traducciones correctas para estudiar o ejercer tu profesión.',
    'servicios.credito_personal.t': 'Crédito personal',
    'servicios.credito_personal.d': 'Construye tu historial desde cero y ordena tu puntaje con decisiones que suman, no que restan.',
    'servicios.credito_empresa.t': 'Crédito empresarial',
    'servicios.credito_empresa.d': 'Separa tus finanzas y construye el perfil de crédito de tu empresa en el orden correcto.',
    'servicios.empresa.t': 'Abrir mi negocio (LLC)',
    'servicios.empresa.d': 'Tu LLC, permisos, EIN y cuenta bancaria con cumplimiento federal, estatal y local desde el primer día.',
    'servicios.solicitar': 'Quiero este servicio',

    // Reconocimientos
    'premios.titulo': 'Un método reconocido',
    'premios.intro': '6SGS Consultants, la firma detrás de Success by Karely, recibió en 2026 dos reconocimientos internacionales.',
    'premios.ver': 'Ver reconocimiento',
    'premios.prensa': 'Han escrito sobre nuestro trabajo',
    'premios.eventos': 'En conferencias y talleres',

    // Testimonios
    'testimonios.titulo': 'Historias reales, resultados medibles',
    'testimonios.anterior': 'Historia anterior',
    'testimonios.siguiente': 'Historia siguiente',

    // Blog
    'blog.titulo': 'Guías claras para decidir mejor',
    'blog.intro': 'Lo que me hubiera gustado saber cuando llegué, explicado paso a paso.',
    'blog.verTodos': 'Ver todos los artículos',
    'blog.vacioT': 'Estoy preparando los primeros artículos',
    'blog.vacioD': 'Crea tu cuenta gratis y te aviso cuando publique guías sobre becas, crédito y cómo abrir tu negocio.',
    'blog.vacioBtn': 'Crear mi cuenta gratis',
    'blog.minutos': '{n} min de lectura',
    'blog.destacado': 'Destacado',
    'blog.exclusivo': 'Solo miembros',

    // Comunidad
    'comunidad.titulo': 'No tienes que recorrer este camino en soledad',
    'comunidad.intro': 'Únete a la comunidad, aprende con herramientas bilingües y avanza a tu ritmo.',
    'comunidad.telegramT': 'Comunidad en Telegram',
    'comunidad.telegramD': 'Anuncios, fechas límite de becas y FAFSA, y respuestas a las preguntas más comunes.',
    'comunidad.telegramBtn': 'Unirme a la comunidad',
    'comunidad.pronto': 'Muy pronto',
    'comunidad.tiendaT': 'Toolkits bilingües de 6SGS',
    'comunidad.tiendaD': 'Guías y plantillas en español e inglés para avanzar por tu cuenta con el mismo método.',
    'comunidad.tiendaBtn': 'Ir a la tienda',

    // Contacto
    'contacto.titulo': 'Cuéntame dónde estás y diseñemos tu ruta',
    'contacto.intro': 'Déjame tus datos y lo que quieres lograr. Mi equipo y yo revisaremos tu caso y te contactaremos por el medio que prefieras.',
    'contacto.aviso': 'La información que comparto es educativa y no constituye asesoría legal, financiera ni migratoria.',
    'contacto.whatsapp': 'Escríbeme por WhatsApp',
    'contacto.correo': 'Escríbeme un correo',
    'contacto.telefono': 'Llámanos',
    'contacto.agenda': 'Reserva tu consulta en mi agenda',
    'whatsapp.aria': 'Escríbeme por WhatsApp',
    'whatsapp.mensaje': 'Hola Karely, vengo de tu sitio web y quiero información.',

    // Formulario
    'form.nombre': 'Nombre',
    'form.apellido': 'Apellido',
    'form.correo': 'Correo electrónico',
    'form.telefono': 'Teléfono o WhatsApp',
    'form.pais': 'País de origen',
    'form.estado': 'Estado donde vives',
    'form.fueraEEUU': 'Todavía no vivo en EE. UU.',
    'form.elegir': 'Elige una opción',
    'form.servicios': '¿En qué te puedo ayudar?',
    'form.mensaje': 'Cuéntame tu situación',
    'form.opcional': '(opcional)',
    'form.referencia': '¿Cómo me conociste?',
    'form.idioma': 'Idioma preferido',
    'form.consentimiento': 'Acepto que Success by Karely y 6SGS Consultants me contacten sobre mi solicitud y he leído la <a href="privacidad.html">política de privacidad</a>.',
    'form.enviar': 'Enviar solicitud',
    'form.enviando': 'Enviando…',
    'form.errRequerido': 'Este dato es necesario para contactarte.',
    'form.errCorreo': 'Revisa tu correo: debe verse como nombre@ejemplo.com.',
    'form.errTelefono': 'Escribe tu número con código de área (ej. +1 713 555 0000).',
    'form.errConsentimiento': 'Necesito tu permiso para poder contactarte.',
    'form.errRevisar': 'Revisa los campos marcados.',
    'form.esperaTiempo': 'Tómate un momento para revisar tus datos antes de enviar.',
    'form.esperaReenvio': 'Ya recibí una solicitud tuya hace un momento. Espera un minuto antes de enviar otra.',
    'form.errEnvio': 'No pude enviar tu solicitud. Revisa tu conexión e inténtalo de nuevo.',
    'form.demo': 'El formulario aún no está conectado: falta configurar Firebase en config.js.',
    'form.exitoTitulo': '¡Gracias, {nombre}!',
    'form.exitoTexto': 'Recibí tu solicitud. Mi equipo y yo revisaremos tu caso y te contactaremos pronto. Mientras tanto, crea tu cuenta gratis y empieza a avanzar.',
    'form.toastEnviada': 'Solicitud enviada',
    'form.otra': 'Enviar otra solicitud',

    // Pie
    'pie.texto': 'Universidad, carrera, crédito y negocio para familias inmigrantes, con un método que se puede medir.',
    'pie.sello': 'Parte de 6SGS Consultants',
    'pie.explora': 'Explora',
    'pie.siguenos': 'Sígueme',
    'pie.aviso': 'La información de este sitio es educativa y no constituye asesoría legal, financiera ni migratoria.',
    'pie.marcas': 'Success in the USA by 6SGS™ y Engineering Success in the USA™ son marcas de 6SGS Consultants.',
    'pie.privacidad': 'Privacidad',
    'pie.terminos': 'Términos',
  },

  en: {
    'nav.saltar': 'Skip to content',
    'nav.historia': 'My story',
    'nav.metodo': 'The method',
    'nav.servicios': 'Services',
    'nav.contacto': 'Contact',
    'nav.miEspacio': 'My space',
    'nav.abrirMenu': 'Open menu',
    'nav.cerrarMenu': 'Close menu',
    'idioma.cambiar': 'Ver el sitio en español',

    'hero.titulo1': 'Success in America should not depend on luck.',
    'hero.titulo2': 'It should be engineered.',
    'hero.bajada': 'I’m Karely Paredes. I bring Lean Six Sigma, the method born in factories, to your family’s future: college, career, credit and business, with clear, measurable steps.',
    'hero.ctaCuenta': 'Create my free account',
    'hero.ctaConsulta': 'Book a consultation',
    'ruta.aria': 'The 4-stage path: college, career, credit and business',
    'ruta.1': 'College',
    'ruta.2': 'Career',
    'ruta.3': 'Credit',
    'ruta.4': 'Business',

    'historia.titulo': 'I arrived without a map. So I designed one.',
    'historia.cita': '“Success doesn’t happen by chance. It happens when you understand the system.”',
    'historia.p1': 'I came to the United States with little English, few resources and many questions. Nobody explained how the system worked: I learned it step by step, sometimes by making mistakes.',
    'historia.p2': 'For more than 20 years I worked in government service and nonprofits, in immigration, disaster response and community development. I managed multimillion-dollar programs that reached more than a million people.',
    'historia.p3': 'As a Lean Six Sigma Black Belt I learned that the best results don’t depend on luck, but on well-designed processes. That method was born in factories. I brought it to the future of immigrant families.',
    'historia.p4': 'The most important proof is at home: my daughter Kamila studies Neuroscience and Pre-medicine at the University of Rochester on the full Alan and Jane Handler scholarship. She is the first Venezuelan-American to receive it. It wasn’t luck. It was a system.',
    'historia.credenciales': 'Credentials',
    'historia.chipJusticia': 'B.S. in Criminal Justice',
    'historia.chipFamilias': 'Child & family services certifications',
    'historia.chipTitulos': '4 academic degrees',
    'historia.chipBilingue': 'Bilingual ES · EN',
    'historia.cifra1': 'years in public and nonprofit service',
    'historia.cifra2': 'people impacted',
    'historia.cifra3': 'academic degrees',
    'historia.formacion': 'Trained with Tony Robbins, Dan Martell, Brendon Burchard, Dean Graziosi and Ed Mylett.',

    'metodo.titulo': 'This is not a college guide. It’s a system.',
    'metodo.intro': 'I organize your path into four stages. Each one has steps, timelines and measurable results: fewer mistakes and fewer lost years.',
    'metodo.e1t': 'College planning',
    'metodo.e1d': 'Admissions, scholarships, FAFSA, financial aid and loans. Starting early changes everything.',
    'metodo.e2t': 'Professional careers',
    'metodo.e2d': 'Degree evaluation, translations, a U.S.-standard résumé and getting hired.',
    'metodo.e3t': 'Personal credit optimization',
    'metodo.e3d': 'Build and organize your credit strategically, even if you just arrived or live abroad.',
    'metodo.e4t': 'Business center',
    'metodo.e4d': 'LLC, federal, state and local compliance, bank account and business credit in the right order.',
    'metodo.cierre': 'We build systems that work.',

    'servicios.titulo': 'Where would you like to start?',
    'servicios.intro': 'Every service follows the same rigor: understand your case, design the plan and walk with you every step.',
    'servicios.universidad.t': 'College, scholarships & FAFSA',
    'servicios.universidad.d': 'Choose colleges strategically, complete the FAFSA without mistakes and find scholarships that actually fit you.',
    'servicios.carrera.t': 'U.S. career & résumé',
    'servicios.carrera.d': 'Your experience translated into recruiter language: a standard résumé, LinkedIn and a focused job search.',
    'servicios.equivalencia.t': 'Degree evaluation & translations',
    'servicios.equivalencia.d': 'Get your foreign degree evaluated and prepare proper translations to study or practice your profession.',
    'servicios.credito_personal.t': 'Personal credit',
    'servicios.credito_personal.d': 'Build your history from scratch and organize your score with decisions that add up, not subtract.',
    'servicios.credito_empresa.t': 'Business credit',
    'servicios.credito_empresa.d': 'Separate your finances and build your company’s credit profile in the right order.',
    'servicios.empresa.t': 'Start my business (LLC)',
    'servicios.empresa.d': 'Your LLC, permits, EIN and bank account with federal, state and local compliance from day one.',
    'servicios.solicitar': 'I want this service',

    'premios.titulo': 'A recognized method',
    'premios.intro': '6SGS Consultants, the firm behind Success by Karely, received two international awards in 2026.',
    'premios.ver': 'View award',
    'premios.prensa': 'Featured in',
    'premios.eventos': 'At conferences and workshops',

    'testimonios.titulo': 'Real stories, measurable results',
    'testimonios.anterior': 'Previous story',
    'testimonios.siguiente': 'Next story',

    'blog.titulo': 'Clear guides for better decisions',
    'blog.intro': 'What I wish I had known when I arrived, explained step by step.',
    'blog.verTodos': 'See all articles',
    'blog.vacioT': 'I’m preparing the first articles',
    'blog.vacioD': 'Create your free account and I’ll let you know when I publish guides on scholarships, credit and starting your business.',
    'blog.vacioBtn': 'Create my free account',
    'blog.minutos': '{n} min read',
    'blog.destacado': 'Featured',
    'blog.exclusivo': 'Members only',

    'comunidad.titulo': 'You don’t have to walk this path alone',
    'comunidad.intro': 'Join the community, learn with bilingual tools and move forward at your own pace.',
    'comunidad.telegramT': 'Telegram community',
    'comunidad.telegramD': 'Announcements, scholarship and FAFSA deadlines, and answers to the most common questions.',
    'comunidad.telegramBtn': 'Join the community',
    'comunidad.pronto': 'Coming soon',
    'comunidad.tiendaT': '6SGS bilingual toolkits',
    'comunidad.tiendaD': 'Guides and templates in Spanish and English to move forward on your own with the same method.',
    'comunidad.tiendaBtn': 'Visit the store',

    'contacto.titulo': 'Tell me where you are and let’s design your path',
    'contacto.intro': 'Share your details and what you want to achieve. My team and I will review your case and reach out the way you prefer.',
    'contacto.aviso': 'The information I share is educational and does not constitute legal, financial or immigration advice.',
    'contacto.whatsapp': 'Message me on WhatsApp',
    'contacto.correo': 'Send me an email',
    'contacto.telefono': 'Call us',
    'contacto.agenda': 'Book your consultation on my calendar',
    'whatsapp.aria': 'Message me on WhatsApp',
    'whatsapp.mensaje': 'Hi Karely, I found your website and would like more information.',

    'form.nombre': 'First name',
    'form.apellido': 'Last name',
    'form.correo': 'Email',
    'form.telefono': 'Phone or WhatsApp',
    'form.pais': 'Country of origin',
    'form.estado': 'State where you live',
    'form.fueraEEUU': 'I don’t live in the U.S. yet',
    'form.elegir': 'Choose an option',
    'form.servicios': 'How can I help you?',
    'form.mensaje': 'Tell me about your situation',
    'form.opcional': '(optional)',
    'form.referencia': 'How did you find me?',
    'form.idioma': 'Preferred language',
    'form.consentimiento': 'I agree that Success by Karely and 6SGS Consultants may contact me about my request, and I have read the <a href="privacidad.html">privacy policy</a>.',
    'form.enviar': 'Send request',
    'form.enviando': 'Sending…',
    'form.errRequerido': 'I need this to contact you.',
    'form.errCorreo': 'Check your email: it should look like name@example.com.',
    'form.errTelefono': 'Include your area code (e.g. +1 713 555 0000).',
    'form.errConsentimiento': 'I need your permission to contact you.',
    'form.errRevisar': 'Please review the highlighted fields.',
    'form.esperaTiempo': 'Take a moment to review your details before sending.',
    'form.esperaReenvio': 'I just received a request from you. Please wait a minute before sending another.',
    'form.errEnvio': 'I couldn’t send your request. Check your connection and try again.',
    'form.demo': 'The form isn’t connected yet: Firebase still needs to be set up in config.js.',
    'form.exitoTitulo': 'Thank you, {nombre}!',
    'form.exitoTexto': 'I received your request. My team and I will review your case and contact you soon. In the meantime, create your free account and start moving forward.',
    'form.toastEnviada': 'Request sent',
    'form.otra': 'Send another request',

    'pie.texto': 'College, career, credit and business for immigrant families, with a method you can measure.',
    'pie.sello': 'Part of 6SGS Consultants',
    'pie.explora': 'Explore',
    'pie.siguenos': 'Follow me',
    'pie.aviso': 'The information on this site is educational and does not constitute legal, financial or immigration advice.',
    'pie.marcas': 'Success in the USA by 6SGS™ and Engineering Success in the USA™ are trademarks of 6SGS Consultants.',
    'pie.privacidad': 'Privacy',
    'pie.terminos': 'Terms',
  },
};

/* Devuelve el idioma activo */
export function idiomaActual() {
  const parametro = new URLSearchParams(location.search).get('lang');
  if (IDIOMAS.includes(parametro)) return parametro;
  try {
    const guardado = localStorage.getItem(CLAVE_IDIOMA);
    if (IDIOMAS.includes(guardado)) return guardado;
  } catch { /* almacenamiento bloqueado */ }
  return 'es';
}

/* Traduce una clave; {variables} se reemplazan con vars */
export function t(clave, vars = {}, idioma = idiomaActual()) {
  const texto = TEXTOS[idioma]?.[clave] ?? TEXTOS.es[clave] ?? clave;
  return texto.replace(/\{(\w+)\}/g, (_, nombre) => vars[nombre] ?? '');
}

/* Aplica traducciones a todos los elementos marcados */
export function aplicarTraducciones(raiz = document, idioma = idiomaActual()) {
  raiz.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n, {}, idioma); });
  raiz.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml, {}, idioma); });
  raiz.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(';').forEach((par) => {
      const [atributo, clave] = par.split(':').map((s) => s.trim());
      if (atributo && clave) el.setAttribute(atributo, t(clave, {}, idioma));
    });
  });
  document.documentElement.lang = idioma;
}

/* Cambia el idioma, lo guarda y avisa a la página con el evento "idioma" */
export function cambiarIdioma(nuevo) {
  if (!IDIOMAS.includes(nuevo)) return;
  try { localStorage.setItem(CLAVE_IDIOMA, nuevo); } catch { /* sin almacenamiento */ }
  const url = new URL(location.href);
  if (url.searchParams.has('lang')) {
    url.searchParams.delete('lang');
    history.replaceState(null, '', url);
  }
  aplicarTraducciones(document, nuevo);
  document.dispatchEvent(new CustomEvent('idioma', { detail: nuevo }));
}

/* Enlaza los botones [data-cambiar-idioma] (muestran el idioma al que se cambia) */
export function iniciarI18n() {
  const idioma = idiomaActual();
  if (idioma !== 'es') aplicarTraducciones(document, idioma);
  const actualizarBotones = (actual) => {
    document.querySelectorAll('[data-cambiar-idioma]').forEach((boton) => {
      const destino = actual === 'es' ? 'en' : 'es';
      boton.textContent = destino.toUpperCase();
      boton.setAttribute('aria-label', t('idioma.cambiar', {}, actual));
      boton.setAttribute('lang', destino);
    });
  };
  actualizarBotones(idioma);
  document.querySelectorAll('[data-cambiar-idioma]').forEach((boton) => {
    boton.addEventListener('click', () => {
      const destino = idiomaActual() === 'es' ? 'en' : 'es';
      cambiarIdioma(destino);
      actualizarBotones(destino);
    });
  });
  return idioma;
}
