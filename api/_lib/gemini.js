// Classificação de mensagem via Gemini (Generative Language API).
// Mesma lógica de functions/index.js — mantidos em sincronia.

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const GENERATIVE_LANGUAGE_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models';

const CLASSIFY_SYSTEM = `Você classifica mensagens de um chat em português.
Decida se a mensagem é um PEDIDO EXPLÍCITO para gerar, criar, desenhar ou imaginar uma imagem/foto/arte.
Exemplos de pedido de imagem: "desenha um gato astronauta", "gera uma imagem de uma praia ao pôr do sol", "cria uma arte cyberpunk".
Não é pedido de imagem: perguntas, conversa normal, opiniões, links.

Responda SOMENTE com JSON: {"ehPedidoImagem": boolean, "descricaoImagem": string}
- "descricaoImagem": se ehPedidoImagem for true, uma descrição visual rica em INGLÊS para um gerador de imagens; caso contrário, string vazia.`;

export async function classificarComGemini(texto, apiKey) {
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
    console.warn('Resposta do Gemini não era JSON; tratando como texto normal.', raw);
    return { ehPedidoImagem: false, descricaoImagem: '' };
  }

  return {
    ehPedidoImagem: Boolean(parsed.ehPedidoImagem),
    descricaoImagem: String(parsed.descricaoImagem || ''),
  };
}
