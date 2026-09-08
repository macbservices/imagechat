import { useAuth } from '../auth.jsx';
import { iniciaisDoNome, formatarHorario } from '../lib/text.js';

export default function Message({ mensagem }) {
  const { user } = useAuth();
  const meu = user?.uid === mensagem.uid;
  const data = mensagem.timestamp?.toDate?.() ?? null;

  return (
    <div className={`msg ${meu ? 'msg-meu' : ''}`}>
      <div className="avatar" title={mensagem.nome}>
        {mensagem.foto ? (
          <img src={mensagem.foto} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span>{iniciaisDoNome(mensagem.nome)}</span>
        )}
      </div>

      <div className="bolha">
        <div className="meta">
          <span className="nome">{mensagem.nome}</span>
          <span className="hora">{formatarHorario(data)}</span>
        </div>

        {mensagem.tipo === 'imagem' ? (
          <figure className="figura">
            <img src={mensagem.url} alt={mensagem.texto} loading="lazy" />
            <figcaption>{mensagem.texto}</figcaption>
          </figure>
        ) : (
          <p className="texto">{mensagem.texto}</p>
        )}
      </div>
    </div>
  );
}
