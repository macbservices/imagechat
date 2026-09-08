import { useEffect, useState } from 'react';
import { collection, limitToLast, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase.js';
import MessageList from './MessageList.jsx';
import MessageInput from './MessageInput.jsx';

export default function Chat() {
  const [mensagens, setMensagens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'mensagens'), orderBy('timestamp'), limitToLast(200));
    return onSnapshot(
      q,
      (snap) => {
        setMensagens(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setCarregando(false);
      },
      (err) => {
        console.error(err);
        setErro('Não foi possível carregar as mensagens.');
        setCarregando(false);
      },
    );
  }, []);

  return (
    <div className="chat">
      {carregando ? (
        <p className="muted center">Carregando mensagens…</p>
      ) : erro ? (
        <p className="erro center">{erro}</p>
      ) : (
        <MessageList mensagens={mensagens} />
      )}
      <MessageInput />
    </div>
  );
}
