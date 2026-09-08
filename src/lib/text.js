/** Iniciais para o avatar quando o usuário não tem foto. */
export function iniciaisDoNome(nome = '') {
  const partes = String(nome).trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** Hora curta (HH:MM) em pt-BR; string vazia se não houver data. */
export function formatarHorario(date) {
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '';
  }
}
