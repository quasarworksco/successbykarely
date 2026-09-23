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
