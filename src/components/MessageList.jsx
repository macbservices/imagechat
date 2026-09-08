import { useEffect, useRef } from 'react';
import Message from './Message.jsx';

export default function MessageList({ mensagens }) {
  const fimRef = useRef(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens.length]);

  if (mensagens.length === 0) {
    return <p className="muted center">Ninguém falou nada ainda. Manda a primeira!</p>;
  }

  return (
    <div className="mensagens">
      {mensagens.map((m) => (
        <Message key={m.id} mensagem={m} />
      ))}
      <div ref={fimRef} />
    </div>
  );
}
