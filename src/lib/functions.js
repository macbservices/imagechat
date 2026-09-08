import { auth } from '../firebase.js';

// Backend das functions.
//
// Enquanto o Firebase (Blaze) está bloqueado, as 4 functions rodam como Vercel
// Functions. Aponte VITE_FUNCTIONS_BASE_URL (env var de build) para a base da
// Vercel, por exemplo:
//
//   VITE_FUNCTIONS_BASE_URL="https://<seu-projeto>.vercel.app/api"
//
// Fallback "/api" serve para dev local (proxy) e para o dia em que as Cloud
// Functions do Firebase forem reativadas por trás do Hosting.
const BASE = import.meta.env.VITE_FUNCTIONS_BASE_URL || '/api';

async function chamar(nome, payload) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Faça login primeiro.');
  }
  const token = await user.getIdToken();

  let res;
  try {
    res = await fetch(`${BASE}/${nome}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload ?? {}),
    });
  } catch {
    throw new Error('Não foi possível falar com o servidor. Tente de novo.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const erro = new Error(data?.error || `Erro ${res.status}.`);
    erro.code = data?.code;
    throw erro;
  }
  // Mantém o formato { data } que os componentes já esperam (era httpsCallable).
  return { data };
}

export const processarMensagem = (payload) => chamar('processarMensagem', payload);
export const souAdmin = (payload) => chamar('souAdmin', payload);
export const adminApagarMensagem = (payload) => chamar('adminApagarMensagem', payload);
export const adminDefinirBanido = (payload) => chamar('adminDefinirBanido', payload);
