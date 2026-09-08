// Vercel Function — equivalente à Cloud Function `adminApagarMensagem`.
// POST { id } + Authorization: Bearer <ID token de um admin>  ->  { ok: true, id }

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

  const id = String(req.body?.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Informe o id da mensagem.', code: 'invalid-argument' });
    return;
  }

  await getDb().collection('mensagens').doc(id).delete();
  res.status(200).json({ ok: true, id });
}
