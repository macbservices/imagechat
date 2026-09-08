import { useState } from 'react';
import { useAuth } from '../auth.jsx';

export default function LoginButton() {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');

  async function entrar() {
    setBusy(true);
    setErro('');
    try {
      await signInWithGoogle();
    } catch (e) {
      if (e?.code !== 'auth/popup-closed-by-user' && e?.code !== 'auth/cancelled-popup-request') {
        setErro('Não foi possível entrar. Tente de novo.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <h1>
        Image<span>Chat</span>
      </h1>
      <p className="muted">
        Chat em tempo real onde qualquer mensagem pode virar uma imagem gerada por IA.
        Peça <em>“desenha um gato astronauta”</em> e veja acontecer.
      </p>
      <button className="btn google" onClick={entrar} disabled={busy}>
        {busy ? 'Entrando…' : 'Entrar com Google'}
      </button>
      {erro && <p className="erro">{erro}</p>}
    </div>
  );
}
