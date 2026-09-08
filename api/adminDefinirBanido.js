// Vercel Function — equivalente à Cloud Function `adminDefinirBanido`.
// POST { uid, banido } + Authorization: Bearer <ID token de um admin>
//   -> { ok: true, uid, banido }

import { aplicarCors } from './_lib/cors.js';
import { getDb, verificarAuth } from './_lib/firebaseAdmin.js';
import { ehAdmin } from './_lib/admin.js';

export default async function handler(req, res) {
  aplicarCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido. Use POST.' });
    return;
  }

  let decoded;
  try {
    decoded = await verificarAuth(req);
  } catch (err) {
    console.error('Admin mal configurado', err);
    res.status(500).json({ error: 'Servidor mal configurado.' });
    return;
  }
  if (!ehAdmin(decoded)) {
    res.status(403).json({ error: 'Acesso restrito a administradores.', code: 'permission-denied' });
    return;
  }

  const uid = String(req.body?.uid ?? '').trim();
  const banido = Boolean(req.body?.banido);
  if (!uid) {
    res.status(400).json({ error: 'Informe o uid do usuário.', code: 'invalid-argument' });
    return;
  }

  await getDb().collection('usuarios').doc(uid).set({ banido }, { merge: true });
  res.status(200).json({ ok: true, uid, banido });
}
