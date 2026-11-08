import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { metaPixelConfig } from '../assets/js/config.js';
import { CONSENT_KEY, pixelIdForHost, readConsent, writeConsent, shouldLoadPixel, shouldShowBanner, storeLeadParams } from '../assets/js/meta-pixel-logic.js';
import { loadMetaPixel } from '../assets/js/meta-pixel.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const memStore = (init = {}) => { const m = { ...init }; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; } }; };

test('pixel por hostname: solo produccion', () => {
  assert.equal(pixelIdForHost('yoinit.app'), '2119366832274596');
  assert.equal(pixelIdForHost('WWW.yoinit.app'), '2119366832274596');
  for (const h of ['localhost', '127.0.0.1', 'x.joselinods-is.workers.dev', 'y.pages.dev', 'panel.yoinit.app', 'evil-yoinit.app', '', undefined]) {
    assert.equal(pixelIdForHost(h), null, String(h));
  }
});

test('enabled:false o sin id apaga el pixel', () => {
  assert.equal(pixelIdForHost('yoinit.app', { ...metaPixelConfig, enabled: false }), null);
  assert.equal(pixelIdForHost('yoinit.app', { ...metaPixelConfig, pixelId: '' }), null);
});

test('consentimiento: aceptado, rechazado, sin eleccion y sin storage', () => {
  assert.equal(readConsent(memStore({ [CONSENT_KEY]: 'accepted_v2' })), 'accepted');
  // 'accepted' del texto antiguo (sin publicidad) no vale: el banner vuelve a salir.
  assert.equal(readConsent(memStore({ [CONSENT_KEY]: 'accepted' })), null);
  assert.equal(shouldShowBanner(readConsent(memStore({ [CONSENT_KEY]: 'accepted' })), '1'), true);
  assert.equal(readConsent(memStore({ [CONSENT_KEY]: 'rejected' })), 'rejected');
  assert.equal(readConsent(memStore()), null);
  assert.equal(readConsent(memStore({ [CONSENT_KEY]: 'yes' })), null);
  assert.equal(readConsent(null), null);
  assert.equal(readConsent({ getItem() { throw new Error('blocked'); } }), null);
  const st = memStore();
  assert.equal(writeConsent(st, 'accepted'), true);
  assert.equal(st.getItem(CONSENT_KEY), 'accepted_v2');
  assert.equal(readConsent(st), 'accepted');
  assert.equal(writeConsent(st, 'rejected'), true);
  assert.equal(st.getItem(CONSENT_KEY), 'rejected');
  assert.equal(readConsent(st), 'rejected');
  assert.equal(shouldLoadPixel(readConsent(st), '1'), false);
  assert.equal(writeConsent(st, 'maybe'), false);
  assert.equal(writeConsent({ setItem() { throw new Error('quota'); } }, 'accepted'), false);
});

test('nada se carga sin aceptar', () => {
  assert.equal(shouldLoadPixel('accepted', '2119366832274596'), true);
  assert.equal(shouldLoadPixel('rejected', '2119366832274596'), false);
  assert.equal(shouldLoadPixel(null, '2119366832274596'), false);
  assert.equal(shouldLoadPixel('accepted', null), false);
  assert.equal(shouldShowBanner(null, '1'), true);
  assert.equal(shouldShowBanner('rejected', '1'), false);
  assert.equal(shouldShowBanner(null, null), false);
});

test('loadMetaPixel inyecta fbevents y encola init + PageView', () => {
  const appended = [];
  const doc = { createElement: () => ({}), head: { appendChild: (s) => appended.push(s) }, addEventListener() {} };
  const win = {};
  loadMetaPixel('123', win, doc);
  assert.equal(appended.length, 1);
  assert.equal(appended[0].src, 'https://connect.facebook.net/en_US/fbevents.js');
  assert.deepEqual(win.fbq.queue.map((a) => [...a]), [['consent', 'grant'], ['init', '123'], ['track', 'PageView']]);
  loadMetaPixel('123', win, doc);
  assert.equal(appended.length, 1);
});

test('evento Lead solo para botones de tienda ios/android', () => {
  assert.deepEqual(storeLeadParams('ios'), { content_name: 'store_click', content_category: 'ios' });
  assert.equal(storeLeadParams('web'), null);
});

const rules = () => {
  const out = {};
  let cur = null;
  for (const line of read('_headers').split('\n')) {
    if (/^\S/.test(line) && !line.startsWith('#')) { cur = line.trim(); out[cur] = out[cur] || {}; }
    else if (cur && /^\s+Content-Security-Policy:/.test(line)) out[cur].csp = line.split('Content-Security-Policy:')[1].trim();
    else if (cur && /^\s+! Content-Security-Policy/.test(line)) out[cur].detach = true;
  }
  return out;
};

test('CSP: facebook solo en rutas con pixel; global, /captcha/* y /auth/* cerrados', () => {
  const r = rules();
  assert.doesNotMatch(r['/*'].csp, /facebook/);
  assert.doesNotMatch(r['/captcha/*'].csp, /facebook|doubleclick|googleadservices/);
  assert.doesNotMatch(r['/*'].csp, /doubleclick|googleadservices/);
  assert.equal(Object.keys(r).some((k) => k.startsWith('/auth')), false);
  const px = ['/', '/index.html', '/partidas', '/partidas/*', '/grupos', '/grupos/*', '/r', '/r/*', '/privacidad/*', '/terminos/*', '/categorias/*', '/eliminar-cuenta/*', '/pelotas/*'];
  for (const p of px) {
    const c = r[p].csp;
    assert.ok(r[p].detach, p);
    assert.match(c, /script-src [^;]*https:\/\/connect\.facebook\.net/, p);
    assert.match(c, /img-src [^;]*https:\/\/www\.facebook\.com/, p);
    assert.match(c, /connect-src [^;]*https:\/\/www\.facebook\.com/, p);
    assert.match(c, /frame-ancestors 'none'/, p);
    assert.doesNotMatch(c, /frame-src [^;]*facebook/, p);
    assert.match(c, /script-src [^;]*https:\/\/www\.googleadservices\.com[^;]*https:\/\/googleads\.g\.doubleclick\.net/, p);
    assert.match(c, /img-src [^;]*https:\/\/googleads\.g\.doubleclick\.net[^;]*https:\/\/www\.google\.co\.ve[^;]*https:\/\/\*\.doubleclick\.net/, p);
    assert.match(c, /connect-src [^;]*https:\/\/www\.google\.com[^;]*https:\/\/\*\.doubleclick\.net/, p);
    assert.match(c, /frame-src [^;]*https:\/\/td\.doubleclick\.net https:\/\/www\.googletagmanager\.com/, p);
  }
  const withFb = Object.keys(r).filter((k) => /facebook/.test(r[k].csp || ''));
  assert.deepEqual(withFb.sort(), [...px].sort());
});

test('CSP /pelotas/* conserva Turnstile y Supabase', () => {
  const c = rules()['/pelotas/*'].csp;
  assert.match(c, /script-src [^;]*https:\/\/challenges\.cloudflare\.com/);
  assert.match(c, /connect-src [^;]*https:\/\/djpgmmibdcgklseiqxpj\.supabase\.co/);
  assert.match(c, /frame-src https:\/\/challenges\.cloudflare\.com/);
});

test('paginas con pixel cargan consent.js; captcha y auth no; ningun HTML referencia facebook', () => {
  for (const p of ['index.html', 'partidas.html', 'grupos.html', 'r.html', 'privacidad/index.html', 'terminos/index.html', 'eliminar-cuenta/index.html', 'pelotas/index.html', 'pelotas/como-conseguir/index.html']) {
    assert.match(read(p), /assets\/js\/consent\.js/, p);
  }
  for (const p of ['captcha/index.html', 'auth/confirm/index.html']) assert.doesNotMatch(read(p), /consent\.js|facebook|fbq/, p);
  for (const p of ['index.html', 'partidas.html', 'privacidad/index.html', 'pelotas/index.html']) assert.doesNotMatch(read(p), /facebook|fbq\(/, p);
});

test('consent.js: textos es-VE y sin hex sueltos en el banner', () => {
  const js = read('assets/js/consent.js');
  assert.match(js, /Aceptar/); assert.match(js, /Rechazar/); assert.match(js, /Preferencias de cookies/);
  assert.match(js, /medición y publicidad \(Google y Meta\)/);
  assert.doesNotMatch(js, /(?:textContent = |\[')[^;\n]*[¡!]/);
  const css = read('assets/css/styles.css');
  assert.match(js, /cookie-banner__btn--primary/);
  assert.match(css, /\.cookie-banner__btn--primary \{[^}]*var\(--yo-acid\)[^}]*var\(--yo-base\)/);
  const block = css.slice(css.indexOf('/* Cookies de medicion'));
  assert.doesNotMatch(block, /#[0-9a-fA-F]{3,8}\b/);
});

test('Lead store_click: ios/android tras cargar, con eventID; no antes de consentimiento ni tras revocar; ignora aria-disabled', async () => {
  const { loadMetaPixel, revokeMetaPixel } = await import('../assets/js/meta-pixel.js');
  const listeners = [];
  const doc = { createElement: () => ({}), head: { appendChild() {} }, addEventListener: (_t, f) => listeners.push(f) };
  const win = { crypto: { randomUUID: () => 'uuid-1' } };
  const link = (store, extra = {}) => ({ getAttribute: (k) => (k === 'href' ? 'https://x' : extra[k] ?? null), dataset: { store } });
  const click = (a) => listeners.forEach((f) => f({ target: { closest: () => a } }));
  click(link('ios')); // antes de cargar: no hay listener ni fbq
  assert.equal(win.fbq, undefined);
  loadMetaPixel('123', win, doc);
  assert.equal(listeners.length, 1);
  const n = win.fbq.queue.length;
  click(link('ios'));
  click(link('android'));
  const added = win.fbq.queue.slice(n).map((a) => [...a]);
  assert.deepEqual(added, [
    ['track', 'Lead', { content_name: 'store_click', content_category: 'ios' }, { eventID: 'uuid-1' }],
    ['track', 'Lead', { content_name: 'store_click', content_category: 'android' }, { eventID: 'uuid-1' }],
  ]);
  const n2 = win.fbq.queue.length;
  click(link('ios', { 'aria-disabled': 'true' }));
  click(link('web'));
  assert.equal(win.fbq.queue.length, n2);
  revokeMetaPixel(win);
  const n3 = win.fbq.queue.length;
  click(link('ios'));
  assert.equal(win.fbq.queue.length, n3);
});
