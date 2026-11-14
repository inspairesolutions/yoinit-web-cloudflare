// /email-unsubscribe — proxy estricto hacia la edge function `email-unsubscribe` de Supabase.
//
// Por qué existe: Supabase fuerza `Content-Type: text/plain` (y un CSP restrictivo) a las respuestas
// HTML de las Edge Functions servidas desde *.supabase.co, así que el navegador descarga un .txt en
// vez de pintar la página de confirmación. El backend arma el enlace de baja con
// `${UNSUBSCRIBE_BASE_URL}/email-unsubscribe?t=<token>`; este archivo sirve esa ruta desde el dominio
// propio y devuelve el HTML con el tipo correcto.
//
// Variable de entorno (Pages > Settings > Environment variables, una por proyecto/entorno):
//   SUPABASE_FUNCTIONS_URL  base de las funciones, sin barra final, p. ej.
//                           https://<ref>.supabase.co/functions/v1
// Sin ella responde 503.
//
// No es un proxy abierto: ruta fija, solo GET/POST, solo el parámetro `t`, solo `Content-Type`
// de entrada, cuerpo de hasta 4 KB.

const TIMEOUT_MS = 8000;
const MAX_BODY = 4096;
const MAX_RESPONSE = 65536;
const TOKEN_RE = /^[A-Za-z0-9_.-]{1,300}$/;

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};

function reply(status, body, type, extra = {}) {
  return new Response(body, {
    status,
    headers: { ...SECURITY_HEADERS, 'Content-Type': type, ...extra },
  });
}

const text = (status, body, extra) => reply(status, body, 'text/plain; charset=utf-8', extra);

function errorPage(status, message) {
  const html =
    '<!doctype html><html lang="es-VE"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex"><title>YoinIt</title>' +
    '<style>body{font-family:system-ui,sans-serif;max-width:28rem;margin:4rem auto;padding:0 1rem;line-height:1.5}</style>' +
    `</head><body><h1>YoinIt</h1><p>${message}</p></body></html>`;
  return reply(status, html, 'text/html; charset=utf-8');
}

function looksLikeHtml(body) {
  return /^\s*<(!doctype html|html|head|body|!--)/i.test(body.slice(0, 256));
}

async function readLimited(request) {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY) return null;
  const buf = new Uint8Array(await request.arrayBuffer());
  return buf.byteLength > MAX_BODY ? null : buf;
}

export async function onRequest({ request, env }) {
  const method = request.method.toUpperCase();
  if (method !== 'GET' && method !== 'POST' && method !== 'HEAD') {
    return text(405, 'Método no permitido', { Allow: 'GET, POST' });
  }

  const base = String(env?.SUPABASE_FUNCTIONS_URL ?? '').replace(/\/+$/, '');
  if (!base) return text(503, 'Servicio no disponible');

  const token = new URL(request.url).searchParams.get('t');
  // El token también puede venir en el cuerpo de un POST (formulario); en ese caso lo valida el backend.
  if (token !== null && !TOKEN_RE.test(token)) return text(400, 'Enlace inválido');
  if (token === null && method !== 'POST') return text(400, 'Enlace inválido');

  const upstream = new URL(`${base}/email-unsubscribe`);
  if (token !== null) upstream.searchParams.set('t', token);

  const init = { method: method === 'HEAD' ? 'GET' : method, headers: {}, redirect: 'manual' };
  if (method === 'POST') {
    const body = await readLimited(request);
    if (body === null) return text(413, 'Solicitud demasiado grande');
    init.body = body;
    const ct = request.headers.get('content-type');
    if (ct) init.headers['Content-Type'] = ct;
  }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(upstream, { ...init, signal: ctl.signal });
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_RESPONSE) throw new Error('respuesta demasiado grande');
    const body = new TextDecoder().decode(buf);
    const type = looksLikeHtml(body) ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8';
    // Un 5xx del backend se oculta tras la página genérica; el resto de estados se conserva.
    if (res.status >= 500 && res.status !== 503) {
      return errorPage(502, 'No pudimos procesar tu solicitud. Inténtalo de nuevo en unos minutos.');
    }
    return reply(res.status, method === 'HEAD' ? null : body, type);
  } catch (err) {
    // Sin el token en el log: solo el tipo de fallo.
    console.error('email-unsubscribe: fallo del backend', err?.name ?? 'Error');
    return errorPage(502, 'No pudimos procesar tu solicitud. Inténtalo de nuevo en unos minutos.');
  } finally {
    clearTimeout(timer);
  }
}
