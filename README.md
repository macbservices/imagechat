# ImageChat

Chat multiusuário em tempo real onde **qualquer mensagem pode virar uma imagem
gerada por IA**. Você escreve normalmente; se a mensagem for um pedido de imagem
(“desenha um gato astronauta”), uma Cloud Function detecta isso com o Gemini,
gera a imagem via [Pollinations.ai](https://pollinations.ai) e publica no chat.

## Stack

- **React 18 + Vite** (build em `dist/`)
- **Firebase**: Authentication (login com Google), Firestore (chat em tempo real
  com `onSnapshot`), Cloud Functions (Node 20, 2ª geração), Hosting
- **Vitest** para os helpers puros

## Como funciona

| Peça | Papel |
|------|-------|
| `src/auth.jsx` | Login com Google, mantém o perfil em `usuarios/{uid}` |
| `src/components/Chat.jsx` | Assina `mensagens` ordenadas por `timestamp` via `onSnapshot` |
| `src/components/MessageInput.jsx` | Envia **toda** mensagem para a function `processarMensagem` |
| `functions/index.js` → `processarMensagem` | Classifica texto vs. imagem com o Gemini; salva a mensagem no Firestore |
| `functions/index.js` → `souAdmin` / `adminApagarMensagem` / `adminDefinirBanido` | Moderação (checa `ADMIN_EMAILS`) |
| `src/pages/AdminPage.jsx` | Página `/admin`, liberada só para os e-mails de `ADMIN_EMAILS` |
| `firestore.rules` | Cliente só **lê** `mensagens`; escrita é sempre via Cloud Function |

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

- **Front-end**: copie `.env.example` para `.env` e preencha os `VITE_FIREBASE_*`.
- **Functions**: copie `functions/.env.example` para `functions/.env` e preencha:
  - `GEMINI_API_KEY` — a mesma chave usada no Honeless (restrita à Generative
    Language API). Para produção, registre como secret:
    ```bash
    firebase functions:secrets:set GEMINI_API_KEY
    ```
    (aí pode remover a linha do `functions/.env`.)
  - `ADMIN_EMAILS` — e-mails de admin separados por vírgula.

### 3. Rodar

```bash
npm run dev          # front-end em http://localhost:5173
npm run emulators    # Auth + Firestore + Functions + Hosting locais
npm test             # helpers puros
npm run build        # gera dist/
```

Para o front falar com os emuladores, use `VITE_USE_EMULATORS=true` no `.env`.

### 4. Deploy

```bash
firebase deploy --only firestore:rules
firebase deploy --only functions      # requer plano Blaze
npm run build && firebase deploy --only hosting
# ou tudo de uma vez:
npm run deploy
```

## Notas / simplificações

- Toda escrita em `mensagens` passa pela Cloud Function (Admin SDK), então o
  rate limit e o ban não têm como ser burlados pelo cliente.
- `usuarios` é legível por qualquer usuário autenticado (a página `/admin`
  precisa listar todo mundo). Se quiser fechar isso, troque a regra de leitura
  por “dono ou admin” e liste os usuários por uma callable.
- O ban bloqueia **geração de imagem**, conforme o requisito; mensagens de texto
  de um usuário banido ainda passam.
