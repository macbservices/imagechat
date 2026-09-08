// Vercel Function — equivalente à Cloud Function `processarMensagem`.
// Enquanto o billing do Firebase (Blaze) está bloqueado, o backend do chat roda
// aqui. functions/index.js segue intacto para quando o Blaze voltar.
//
// Contrato: POST { texto }  +  header Authorization: Bearer <Firebase ID token>
//   -> { tipo: "texto" }  ou  { tipo: "imagem", url }

import { aplicarCors } from './_lib/cors.js';
import { getDb, verificarAuth, toMillis, FieldValue } from './_lib/firebaseAdmin.js';
import { classificarComGemini } from './_lib/gemini.js';

const RATE_LIMIT_MS = 15_000; // 1 imagem a cada 15s por usuário
const MAX_TEXTO = 2000;

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
    res.status(500).json({ error: 'Servidor mal configurado (credencial ausente).' });
    return;
  }
  if (!decoded) {
    res.status(401).json({ error: 'Faça login para enviar mensagens.', code: 'unauthenticated' });
    return;
  }

  const texto = String(req.body?.texto ?? '').trim();
  if (!texto) {
    res.status(400).json({ error: 'Mensagem vazia.', code: 'invalid-argument' });
    return;
  }
  if (texto.length > MAX_TEXTO) {
    res.status(400).json({ error: `Mensagem muito longa (máx. ${MAX_TEXTO}).`, code: 'invalid-argument' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY ausente no ambiente da Vercel.');
    res.status(500).json({ error: 'Servidor sem credencial configurada.' });
    return;
  }

  const uid = decoded.uid;
  const nome = decoded.name || decoded.email || 'Anônimo';
  const foto = decoded.picture || null;
  const db = getDb();

  let classificacao;
  try {
    classificacao = await classificarComGemini(texto, apiKey);
  } catch (err) {
    console.error('Falha ao classificar com o Gemini', err);
    res.status(502).json({ error: 'Não foi possível processar a mensagem agora.', code: 'unavailable' });
    return;
  }

  // Mensagem de texto normal.
  if (!classificacao.ehPedidoImagem) {
    await db.collection('mensagens').add({
      uid,
      nome,
      foto,
      texto,
      tipo: 'texto',
      url: null,
      timestamp: FieldValue.serverTimestamp(),
    });
    res.status(200).json({ tipo: 'texto' });
    return;
  }

  // Pedido de imagem: ban + rate limiting numa transação.
  const descricao = classificacao.descricaoImagem.trim() || texto;
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(descricao)}`;
  const userRef = db.collection('usuarios').doc(uid);
  const novaMsgRef = db.collection('mensagens').doc();

  const resultado = await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const u = snap.exists ? snap.data() : {};

    if (u.banido === true) {
      return {
        ok: false,
        status: 403,
        code: 'permission-denied',
        msg: 'Você está banido e não pode gerar imagens.',
      };
    }

    const ultima = toMillis(u.ultimaGeracao);
    const agora = Date.now();
    if (ultima && agora - ultima < RATE_LIMIT_MS) {
      const faltam = Math.ceil((RATE_LIMIT_MS - (agora - ultima)) / 1000);
      return {
        ok: false,
        status: 429,
        code: 'resource-exhausted',
        msg: `Aguarde ${faltam}s antes de gerar outra imagem.`,
      };
    }

    tx.set(novaMsgRef, {
      uid,
      nome,
      foto,
      texto,
      tipo: 'imagem',
      url,
      timestamp: FieldValue.serverTimestamp(),
    });
    tx.set(userRef, { ultimaGeracao: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true };
  });

  if (!resultado.ok) {
    res.status(resultado.status).json({ error: resultado.msg, code: resultado.code });
    return;
  }
  res.status(200).json({ tipo: 'imagem', url });
}
