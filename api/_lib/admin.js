// Lista de administradores, vinda da env var ADMIN_EMAILS (separada por vírgula)
// no painel da Vercel.

export function listaAdmins() {
  return String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function ehAdmin(decodedToken) {
  if (!decodedToken) return false;
  const email = String(decodedToken.email || '').toLowerCase();
  if (!email || decodedToken.email_verified !== true) return false;
  return listaAdmins().includes(email);
}
