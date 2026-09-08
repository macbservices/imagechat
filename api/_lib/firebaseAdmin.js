// Firebase Admin para as Vercel Functions.
//
// Credencial: env var FIREBASE_SERVICE_ACCOUNT no painel da Vercel, contendo o
// JSON completo da chave de service account (Firebase Console -> Configurações do
// projeto -> Contas de serviço -> Gerar nova chave privada). Nunca commitar.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

let cachedApp;

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT ausente no ambiente.');
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT não é um JSON válido.');
  }
  // Aceita \n escapado dentro da private_key (comum ao colar em painéis).
  if (typeof parsed.private_key === 'string') {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }
  return parsed;
}

function getAdminApp() {
  if (!cachedApp) {
    cachedApp = getApps()[0] || initializeApp({ credential: cert(serviceAccount()) });
  }
  return cachedApp;
}

export function getDb() {
  return getFirestore(getAdminApp());
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export { FieldValue };

/** Verifica o header Authorization: Bearer <ID token>. Retorna o token decodificado ou null. */
export async function verificarAuth(req) {
  const header = req.headers.authorization || '';
  const match = /^Bearer (.+)$/i.exec(header);
  if (!match) return null;
  try {
    return await getAdminAuth().verifyIdToken(match[1]);
  } catch {
    return null;
  }
}

export function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value._seconds === 'number') return value._seconds * 1000;
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return 0;
}
