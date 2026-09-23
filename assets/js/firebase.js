/* ==========================================================================
   Firebase: carga perezosa del SDK modular desde gstatic.
   Si config.js aún tiene marcadores, el sitio funciona en "modo demo":
   las funciones devuelven null y cada página decide cómo degradar.
   ========================================================================== */
import { CONFIG, esPendiente } from './config.js';

export const VERSION_FIREBASE = '10.12.2';
const BASE = `https://www.gstatic.com/firebasejs/${VERSION_FIREBASE}`;

/* ¿Está Firebase configurado en config.js? */
export const firebaseConfigurado =
  !esPendiente(CONFIG.firebase.apiKey) && !esPendiente(CONFIG.firebase.projectId);

let promesaApp = null;
let promesaFirestore = null;

/* Inicializa la app una sola vez */
async function cargarApp() {
  if (!firebaseConfigurado) return null;
  promesaApp ??= import(`${BASE}/firebase-app.js`).then(({ initializeApp }) => initializeApp(CONFIG.firebase));
  return promesaApp;
}

let promesaAuth = null;

/* Devuelve { auth, fa } donde fa son las funciones de Authentication, o null */
export async function cargarAuth() {
  if (!firebaseConfigurado) return null;
  promesaAuth ??= (async () => {
    const [app, fa] = await Promise.all([cargarApp(), import(`${BASE}/firebase-auth.js`)]);
    return { auth: fa.getAuth(app), fa };
  })().catch((error) => {
    console.error('[firebase] No se pudo cargar Authentication:', error);
    promesaAuth = null;
    return null;
  });
  return promesaAuth;
}

/* Devuelve { db, fs } donde fs son las funciones de Firestore, o null en modo demo */
export async function cargarFirestore() {
  if (!firebaseConfigurado) return null;
  promesaFirestore ??= (async () => {
    const [app, fs] = await Promise.all([cargarApp(), import(`${BASE}/firebase-firestore.js`)]);
    return { db: fs.getFirestore(app), fs };
  })().catch((error) => {
    console.error('[firebase] No se pudo cargar Firestore:', error);
    promesaFirestore = null;
    return null;
  });
  return promesaFirestore;
}
