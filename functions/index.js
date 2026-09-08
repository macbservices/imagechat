import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

// GEMINI_API_KEY: mesma chave do Honeless (restrita à Generative Language API).
// Registre como secret:  firebase functions:secrets:set GEMINI_API_KEY
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// ADMIN_EMAILS: lista separada por vírgula, vinda de functions/.env (ou prompt no deploy).
const ADMIN_EMAILS = defineString('ADMIN_EMAILS');

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const GENERATIVE_LANGUAGE_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models';

const RATE_LIMIT_MS = 15_000; // 1 imagem a cada 15s por usuário
const MAX_TEXTO = 2000;

const REGION = 'us-central1';

const CLASSIFY_SYSTEM = `Você classifica mensagens de um chat em português.
Decida se a mensagem é um PEDIDO EXPLÍCITO para gerar, criar, desenhar ou imaginar uma imagem/foto/arte.
Exemplos de pedido de imagem: "desenha um gato astronauta", "gera uma imagem de uma praia ao pôr do sol", "cria uma arte cyberpunk".
Não é pedido de imagem: perguntas, conversa normal, opiniões, links.

Responda SOMENTE com JSON: {"ehPedidoImagem": boolean, "descricaoImagem": string}
- "descricaoImagem": se ehPedidoImagem for true, uma descrição visual rica em INGLÊS para um gerador de imagens; caso contrário, string vazia.`;

// ---------------------------------------------------------------------------
// processarMensagem: recebe { texto }. Classifica via Gemini. Se for pedido de
// imagem, aplica ban + rate limit e salva a mensagem tipo "imagem" com a URL do
// Pollinations. Caso contrário, salva a mensagem tipo "texto".
// ---------------------------------------------------------------------------
export const processarMensagem = onCall(
  { region: REGION, secrets: [GEMINI_API_KEY], memory: '256MiB', timeoutSeconds: 60 },
  async (request) => {
    const auth = request.auth;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Faça login para enviar mensagens.');
    }

    const texto = String(request.data?.texto ?? '').trim();
    if (!texto) {
      throw new HttpsError('invalid-argument', 'Mensagem vazia.');
    }
    if (texto.length > MAX_TEXTO) {
      throw new HttpsError('invalid-argument', `Mensagem muito longa (máx. ${MAX_TEXTO} caracteres).`);
    }

    const uid = auth.uid;
    const nome = auth.token.name || auth.token.email || 'Anônimo';
    const foto = auth.token.picture || null;

    let classificacao;
    try {
      classificacao = await classificarComGemini(texto, GEMINI_API_KEY.value());
    } catch (err) {
      logger.error('Falha ao classificar mensagem com o Gemini', err);
      throw new HttpsError('unavailable', 'Não foi possível processar a mensagem agora.');
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
      return { tipo: 'texto' };
    }

    // Pedido de imagem: ban + rate limiting numa transação (evita corrida).
    const descricao = classificacao.descricaoImagem.trim() || texto;
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(descricao)}`;
    const userRef = db.collection('usuarios').doc(uid);
    const novaMsgRef = db.collection('mensagens').doc();

    const resultado = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const u = snap.exists ? snap.data() : {};

      if (u.banido === true) {
        return { ok: false, code: 'permission-denied', msg: 'Você está banido e não pode gerar imagens.' };
      }

      const ultima = toMillis(u.ultimaGeracao);
      const agora = Date.now();
      if (ultima && agora - ultima < RATE_LIMIT_MS) {
        const faltam = Math.ceil((RATE_LIMIT_MS - (agora - ultima)) / 1000);
        return {
          ok: false,
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
      throw new HttpsError(resultado.code, resultado.msg);
    }
    return { tipo: 'imagem', url };
  },
);

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export const souAdmin = onCall({ region: REGION }, async (request) => {
  try {
    assertAdmin(request);
    return { admin: true };
  } catch {
    return { admin: false };
  }
});

export const adminApagarMensagem = onCall({ region: REGION }, async (request) => {
  assertAdmin(request);
  const id = String(request.data?.id ?? '').trim();
  if (!id) {
    throw new HttpsError('invalid-argument', 'Informe o id da mensagem.');
  }
  await db.collection('mensagens').doc(id).delete();
  return { ok: true, id };
});

export const adminDefinirBanido = onCall({ region: REGION }, async (request) => {
  assertAdmin(request);
  const uid = String(request.data?.uid ?? '').trim();
  const banido = Boolean(request.data?.banido);
  if (!uid) {
    throw new HttpsError('invalid-argument', 'Informe o uid do usuário.');
  }
  await db.collection('usuarios').doc(uid).set({ banido }, { merge: true });
  return { ok: true, uid, banido };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function listaAdmins() {
  return String(ADMIN_EMAILS.value() || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function assertAdmin(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Faça login.');
  }
  const email = String(request.auth.token.email || '').toLowerCase();
  const verificado = request.auth.token.email_verified === true;
  if (!email || !verificado || !listaAdmins().includes(email)) {
    throw new HttpsError('permission-denied', 'Acesso restrito a administradores.');
  }
  return email;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value._seconds === 'number') return value._seconds * 1000;
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return 0;
}

async function classificarComGemini(texto, apiKey) {
  const url = `${GENERATIVE_LANGUAGE_ENDPOINT}/${encodeURIComponent(MODEL)}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: CLASSIFY_SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: texto }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            ehPedidoImagem: { type: 'BOOLEAN' },
            descricaoImagem: { type: 'STRING' },
          },
          required: ['ehPedidoImagem', 'descricaoImagem'],
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Generative Language API HTTP ${response.status}: ${detail.slice(0, 500)}`);
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const raw = Array.isArray(parts) ? parts.map((p) => p?.text || '').join('') : '';

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.warn('Resposta do Gemini não era JSON; tratando como texto normal.', { raw });
    return { ehPedidoImagem: false, descricaoImagem: '' };
  }

  return {
    ehPedidoImagem: Boolean(parsed.ehPedidoImagem),
    descricaoImagem: String(parsed.descricaoImagem || ''),
  };
}
