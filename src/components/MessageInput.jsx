import { useState } from 'react';
import { processarMensagem } from '../lib/functions.js';

export default function MessageInput() {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');

  async function enviar(e) {
    e.preventDefault();
    const t = texto.trim();
    if (!t || enviando) return;

    setEnviando(true);
    setAviso('');
    try {
      await processarMensagem({ texto: t });
      setTexto('');
    } catch (err) {
      // FunctionsError.message já vem com o texto amigável definido na function
      // (ban, rate limit, etc.).
      setAviso(err?.message || 'Não foi possível enviar a mensagem.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="input" onSubmit={enviar}>
      <div className="input-row">
        <input
          type="text"
          placeholder='Escreva algo… ou peça: "desenha um gato astronauta"'
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={2000}
          disabled={enviando}
        />
        <button className="btn" type="submit" disabled={enviando || !texto.trim()}>
          {enviando ? '…' : 'Enviar'}
        </button>
      </div>
      {aviso && <p className="erro">{aviso}</p>}
    </form>
  );
}
