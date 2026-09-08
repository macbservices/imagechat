# ImageChat

Chat multiusuário em tempo real onde **qualquer mensagem pode virar uma imagem
gerada por IA**. Você escreve normalmente; se a mensagem for um pedido de imagem
(“desenha um gato astronauta”), o backend detecta isso com o Gemini, gera a
imagem via [Pollinations.ai](https://pollinations.ai) e publica no chat.

> **Backend hoje: Vercel.** O plano Blaze do projeto Firebase está bloqueado por
> billing, então as 4 functions rodam como **Vercel Functions** (`api/*.js`),
> escrevendo no Firestore via `firebase-admin`. As Cloud Functions equivalentes
> continuam em `functions/index.js`, prontas para quando o Blaze voltar — aí
> basta apagar `VITE_FUNCTIONS_BASE_URL` do build. Ver "Deploy" abaixo.

## Stack

- **React 18 + Vite** (build em `dist/`)
- **Firebase**: Authentication (login com Google), Firestore (chat em tempo real
  com `onSnapshot`), Hosting
- **Backend das functions**: Vercel Functions hoje (`api/`), Cloud Functions
  (`functions/`) como alvo futuro — ver nota acima
- **Vitest** para os helpers puros

## Como funciona

| Peça | Papel |
|------|-------|
| `src/auth.jsx` | Login com Google, mantém o perfil em `usuarios/{uid}` |
| `src/components/Chat.jsx` | Assina `mensagens` ordenadas por `timestamp` via `onSnapshot` |
| `src/lib/functions.js` | Chama o backend por HTTP com o **Firebase ID token** no header `Authorization` |
| `src/components/MessageInput.jsx` | Envia **toda** mensagem para `processarMensagem` |
| `api/processarMensagem.js` (mirror: `functions/index.js`) | Classifica texto vs. imagem com o Gemini; salva a mensagem no Firestore |
| `api/souAdmin.js` / `api/adminApagarMensagem.js` / `api/adminDefinirBanido.js` | Moderação (checa `ADMIN_EMAILS`, valida o ID token) |
| `src/pages/AdminPage.jsx` | Página `/admin`, liberada só para os e-mails de `ADMIN_EMAILS` |
| `firestore.rules` | Cliente só **lê** `mensagens`; escrita é sempre via backend (`firebase-admin`) |

### Documento de mensagem (`mensagens/{id}`)

```
uid, nome, foto, texto, tipo ("texto" | "imagem"), url (string | null), timestamp
```

### Regras de negócio na `processarMensagem`

1. Exige login.
2. Pergunta ao **Gemini (`gemini-3.6-flash`, `generateContent`)** se é pedido de
   imagem; se for, extrai a descrição visual.
3. Se **não** for imagem → salva `tipo: "texto"`.
4. Se **for** imagem:
   - rejeita se o usuário tiver `banido: true`;
   - **rate limit**: 1 imagem a cada **15s** por `uid` (campo `ultimaGeracao` no
     doc do usuário, checado dentro de uma transação);
   - monta `https://image.pollinations.ai/prompt/{descricao-encoded}` e salva
     `tipo: "imagem"` com a `url`.

## Configuração

### 1. Projeto Firebase

```bash
npm install
cd functions && npm install && cd ..

firebase login
firebase use --add          # selecione/registre o projeto; troca o placeholder de .firebaserc
```

No Console do Firebase, ative **Authentication → Sign-in method → Google** e crie
um **Web app** para pegar a config.

### 2. Variáveis de ambiente

- **Front-end** (`.env`, a partir de `.env.example`): os `VITE_FIREBASE_*` e
  `VITE_FUNCTIONS_BASE_URL=https://<projeto>.vercel.app/api`.
- **Backend na Vercel** (painel → Settings → Environment Variables):
  - `GEMINI_API_KEY` — a mesma chave do Honeless (restrita à Generative Language API).
  - `ADMIN_EMAILS` — e-mails de admin separados por vírgula.
  - `FIREBASE_SERVICE_ACCOUNT` — JSON completo da chave de service account
    (Firebase Console → Configurações → Contas de serviço → Gerar nova chave privada).
- **Cloud Functions do Firebase** (`functions/.env`, só quando o Blaze voltar):
  `ADMIN_EMAILS` e `GEMINI_API_KEY` (ou `firebase functions:secrets:set GEMINI_API_KEY`).

### 3. Rodar

```bash
npm run dev          # front em http://localhost:5173 (proxy /api -> vercel dev :3000)
vercel dev           # backend local, se for testar as functions
npm run emulators    # Auth + Firestore locais (VITE_USE_EMULATORS=true no .env)
npm test             # helpers puros
npm run build        # gera dist/
```

### 4. Deploy

**Backend (Vercel):** conecte o repo na Vercel ou rode `vercel --prod`. Configure
as 3 env vars acima. Pegue a URL e coloque em `VITE_FUNCTIONS_BASE_URL`.

**Firestore rules (Firebase, não precisa de Blaze):**

```bash
firebase deploy --only firestore:rules   # exige o banco Firestore já criado no console
```

**Front (Firebase Hosting):**

```bash
npm run build && firebase deploy --only hosting
```

**Quando o Blaze voltar:** `firebase deploy --only functions` (as `onCall` em
`functions/index.js`) e reverta `src/lib/functions.js` para a versão com
`httpsCallable` (fica no histórico do git, commit anterior à migração pra Vercel);
volte também `getFunctions` em `src/firebase.js`. Depois rebuilde o Hosting.

## Notas / simplificações

- Toda escrita em `mensagens` passa pela Cloud Function (Admin SDK), então o
  rate limit e o ban não têm como ser burlados pelo cliente.
- `usuarios` é legível por qualquer usuário autenticado (a página `/admin`
  precisa listar todo mundo). Se quiser fechar isso, troque a regra de leitura
  por “dono ou admin” e liste os usuários por uma callable.
- O ban bloqueia **geração de imagem**, conforme o requisito; mensagens de texto
  de um usuário banido ainda passam.
