// Vercel Function — equivalente à Cloud Function `souAdmin`.
// POST + Authorization: Bearer <ID token>  ->  { admin: boolean }

import { aplicarCors } from './_lib/cors.js';
import { verificarAuth } from './_lib/firebaseAdmin.js';
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

  try {
    const decoded = await verificarAuth(req);
    res.status(200).json({ admin: ehAdmin(decoded) });
  } catch (err) {
    console.error('Admin mal configurado', err);
    res.status(200).json({ admin: false });
  }
}
