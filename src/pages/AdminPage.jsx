import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../auth.jsx';
import { adminApagarMensagem, adminDefinirBanido, souAdmin } from '../lib/functions.js';
import { formatarHorario } from '../lib/text.js';

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [status, setStatus] = useState('checando'); // checando | ok | negado
  const [mensagens, setMensagens] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [acao, setAcao] = useState('');

  // Verifica se o usuário logado é admin (lista ADMIN_EMAILS vive na Cloud Function).
  useEffect(() => {
    if (loading) return;
    if (!user) {
      setStatus('negado');
      return;
    }
    let vivo = true;
    souAdmin()
      .then((r) => vivo && setStatus(r.data?.admin ? 'ok' : 'negado'))
      .catch(() => vivo && setStatus('negado'));
    return () => {
      vivo = false;
    };
  }, [user, loading]);

  // Assina mensagens e usuários só depois de confirmar acesso.
  useEffect(() => {
    if (status !== 'ok') return;
    const unsubMensagens = onSnapshot(
      query(collection(db, 'mensagens'), orderBy('timestamp', 'desc'), limit(50)),
      (snap) => setMensagens(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    );
    const unsubUsuarios = onSnapshot(
      query(collection(db, 'usuarios'), orderBy('nome'), limit(100)),
      (snap) => setUsuarios(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    );
    return () => {
      unsubMensagens();
      unsubUsuarios();
    };
  }, [status]);

  async function apagar(id) {
    setAcao('');
    try {
      await adminApagarMensagem({ id });
    } catch (e) {
      setAcao(e?.message || 'Falha ao apagar a mensagem.');
    }
  }

  async function alternarBanido(uid, banido) {
    setAcao('');
    try {
      await adminDefinirBanido({ uid, banido });
    } catch (e) {
      setAcao(e?.message || 'Falha ao atualizar o usuário.');
    }
  }

  if (loading || status === 'checando') {
    return <p className="muted center">Verificando acesso…</p>;
  }

  if (status === 'negado') {
    return (
      <div className="admin">
        <h1>/admin</h1>
        <p className="erro">Acesso restrito a administradores.</p>
      </div>
    );
  }

  return (
    <div className="admin">
      <h1>/admin</h1>
      {acao && <p className="erro">{acao}</p>}

      <section>
        <h2>Mensagens recentes</h2>
        {mensagens.length === 0 ? (
          <p className="muted">Nada por aqui.</p>
        ) : (
          <ul className="lista">
            {mensagens.map((m) => (
              <li key={m.id}>
                <div className="lista-info">
                  <strong>{m.nome}</strong>
                  <span className="muted"> {formatarHorario(m.timestamp?.toDate?.())}</span>
                  <span className={`tag ${m.tipo === 'imagem' ? 'tag-img' : ''}`}>{m.tipo}</span>
                  <div className="prev">{m.tipo === 'imagem' ? m.url : m.texto}</div>
                </div>
                <button className="linkbtn erro" onClick={() => apagar(m.id)}>
                  apagar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Usuários</h2>
        {usuarios.length === 0 ? (
          <p className="muted">Nenhum usuário ainda.</p>
        ) : (
          <ul className="lista">
            {usuarios.map((u) => (
              <li key={u.id}>
                <div className="lista-info">
                  <strong>{u.nome}</strong> <span className="muted">{u.email}</span>
                  {u.banido && <span className="tag tag-ban">banido</span>}
                </div>
                <button className="linkbtn" onClick={() => alternarBanido(u.uid || u.id, !u.banido)}>
                  {u.banido ? 'desbanir' : 'banir'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
