// Origens autorizadas a chamar as functions da Vercel.
const ALLOWED = [
  'https://imagechat-eccfb.web.app',
  'https://imagechat-eccfb.firebaseapp.com',
  'https://imagechat-seven.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

export function aplicarCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', ALLOWED.includes(origin) ? origin : ALLOWED[0]);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}
