import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/email-unsubscribe.js';

// Proxy de baja de correos (functions/email-unsubscribe.js). node --test tests/
// fetch simulado: nunca se toca la red.
const BASE = 'https://backend.test/functions/v1';
const env = { SUPABASE_FUNCTIONS_URL: BASE };
const TOKEN = 'abc_DEF-123.xyz_456';
const realFetch = globalThis.fetch;
let calls = [];

function mock(impl) {
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return impl(url, init);
  };
}
afterEach(() => { globalThis.fetch = realFetch; });

const html = '<!doctype html><html><body><form method="post"><button>Confirmar</button></form></body></html>';
const plainHtml = () => new Response(html, { status: 200, headers: { 'Content-Type': 'text/plain' } });
const call = (path, init, e = env) => onRequest({ request: new Request(`https://dev.yoinit.app${path}`, init), env: e });

test('metodo no permitido: 405 con Allow y sin llamar al backend', async () => {
  mock(plainHtml);
  for (const m of ['PUT', 'DELETE', 'PATCH']) {
    const res = await call(`/email-unsubscribe?t=${TOKEN}`, { method: m });
    assert.equal(res.status, 405);
    assert.equal(res.headers.get('allow'), 'GET, POST');
  }
  assert.equal(calls.length, 0);
});

test('t invalido o ausente: 400 sin llamar al backend', async () => {
  mock(plainHtml);
  for (const q of ['', '?t=', '?t=a%20b', '?t=<x>', `?t=${'a'.repeat(301)}`, '?t=a/b']) {
    const res = await call(`/email-unsubscribe${q}`);
    assert.equal(res.status, 400, q);
  }
  assert.equal(calls.length, 0);
});

test('GET fuerza text/html aunque el backend responda text/plain', async () => {
  mock(plainHtml);
  const res = await call(`/email-unsubscribe?t=${TOKEN}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(await res.text(), html);
  assert.equal(calls[0].url, `${BASE}/email-unsubscribe?t=${TOKEN}`);
  assert.equal(calls[0].init.method, 'GET');
});

test('cabeceras de seguridad propias', async () => {
  mock(plainHtml);
  const res = await call(`/email-unsubscribe?t=${TOKEN}`);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(
    res.headers.get('content-security-policy'),
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  );
});

test('respuestas no HTML (400 del backend) salen como text/plain', async () => {
  mock(() => new Response('invalid token', { status: 400, headers: { 'Content-Type': 'text/plain' } }));
  const res = await call(`/email-unsubscribe?t=${TOKEN}`);
  assert.equal(res.status, 400);
  assert.match(res.headers.get('content-type'), /^text\/plain/);
});

test('POST one-click: reenvia cuerpo y Content-Type, devuelve estado del backend', async () => {
  mock(() => new Response('<html><body>Listo</body></html>', { status: 200, headers: { 'Content-Type': 'text/plain' } }));
  const res = await call(`/email-unsubscribe?t=${TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Otra': 'no' , Cookie: 'a=b' },
    body: 'List-Unsubscribe=One-Click',
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(new TextDecoder().decode(calls[0].init.body), 'List-Unsubscribe=One-Click');
  assert.deepEqual(calls[0].init.headers, { 'Content-Type': 'application/x-www-form-urlencoded' });
});

test('POST con t en el cuerpo y sin query se reenvia', async () => {
  mock(plainHtml);
  const res = await call('/email-unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `t=${TOKEN}`,
  });
  assert.equal(res.status, 200);
  assert.equal(calls[0].url, `${BASE}/email-unsubscribe`);
});

test('limite de cuerpo: mas de 4 KB da 413 sin llamar al backend', async () => {
  mock(plainHtml);
  const res = await call(`/email-unsubscribe?t=${TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'x'.repeat(4097),
  });
  assert.equal(res.status, 413);
  assert.equal(calls.length, 0);
  const ok = await call(`/email-unsubscribe?t=${TOKEN}`, { method: 'POST', body: 'x'.repeat(4096) });
  assert.equal(ok.status, 200);
});

test('solo se reenvia t: otros parametros se descartan', async () => {
  mock(plainHtml);
  await call(`/email-unsubscribe?t=${TOKEN}&url=https://evil.test&x=1`);
  assert.equal(calls[0].url, `${BASE}/email-unsubscribe?t=${TOKEN}`);
});

test('backend caido: 502 con pagina es-VE', async () => {
  mock(() => { throw new TypeError('network'); });
  const res = await call(`/email-unsubscribe?t=${TOKEN}`);
  assert.equal(res.status, 502);
  assert.match(res.headers.get('content-type'), /^text\/html/);
  assert.match(await res.text(), /No pudimos procesar tu solicitud\. Inténtalo de nuevo en unos minutos\./);
});

test('timeout: se aborta y da 502', async () => {
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms, ...a) => realSetTimeout(fn, ms === 8000 ? 5 : ms, ...a);
  try {
    mock((_u, init) => new Promise((_res, rej) => {
      init.signal.addEventListener('abort', () => rej(Object.assign(new Error('abort'), { name: 'AbortError' })));
    }));
    const res = await call(`/email-unsubscribe?t=${TOKEN}`);
    assert.equal(res.status, 502);
  } finally {
    globalThis.setTimeout = realSetTimeout;
  }
});

test('5xx del backend se oculta tras 502 generico', async () => {
  mock(() => new Response('boom', { status: 500 }));
  const res = await call(`/email-unsubscribe?t=${TOKEN}`);
  assert.equal(res.status, 502);
});

test('sin SUPABASE_FUNCTIONS_URL: 503 sin detalles y sin llamar', async () => {
  mock(plainHtml);
  const res = await call(`/email-unsubscribe?t=${TOKEN}`, undefined, {});
  assert.equal(res.status, 503);
  assert.match(res.headers.get('content-type'), /^text\/plain/);
  assert.ok(!/SUPABASE/i.test(await res.text()));
  assert.equal(calls.length, 0);
});

test('_redirects y _headers no capturan /email-unsubscribe', async () => {
  const { readFileSync } = await import('node:fs');
  const red = readFileSync(new URL('../_redirects', import.meta.url), 'utf8');
  assert.ok(!/email-unsubscribe/.test(red));
  assert.ok(!/^\/\*\s/m.test(red.replace(/^#.*$/gm, '')));
});
