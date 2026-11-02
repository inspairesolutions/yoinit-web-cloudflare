import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ga4Config } from '../assets/js/config.js';
import { ga4IdForHost, storeClickParams, CONSENT_DEFAULT } from '../assets/js/ga4-logic.js';
import { shouldLoadPixel } from '../assets/js/meta-pixel-logic.js';
import { loadGa4, revokeGa4 } from '../assets/js/ga4.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ID = 'G-L26QPPWL11';

test('ga4 por hostname: solo produccion', () => {
  assert.equal(ga4IdForHost('yoinit.app'), ID);
  assert.equal(ga4IdForHost('WWW.yoinit.app'), ID);
  for (const h of ['localhost', '127.0.0.1', 'x.joselinods-is.workers.dev', 'y.pages.dev', 'panel.yoinit.app', 'evil-yoinit.app', '', undefined]) {
    assert.equal(ga4IdForHost(h), null, String(h));
  }
  assert.equal(ga4IdForHost('yoinit.app', { ...ga4Config, enabled: false }), null);
  assert.equal(ga4IdForHost('yoinit.app', { ...ga4Config, measurementId: '' }), null);
});

test('nada de Google sin aceptar', () => {
  const id = ga4IdForHost('yoinit.app');
  assert.equal(shouldLoadPixel('accepted', id), true);
  assert.equal(shouldLoadPixel('rejected', id), false);
  assert.equal(shouldLoadPixel(null, id), false);
  const js = read('assets/js/consent.js');
  assert.doesNotMatch(js, /^import .*ga4\.js/m); // ga4.js solo por import() dinamico tras aceptar
  assert.match(js, /shouldLoadPixel\(consent, ga4Id\)\)[^\n]*import\('\.\/ga4\.js'\)/);
  assert.doesNotMatch(read('index.html'), /googletagmanager|gtag\(/);
});

function fakeEnv() {
  const appended = []; const listeners = [];
  const doc = { createElement: () => ({}), head: { appendChild: (s) => appended.push(s) }, addEventListener: (_, f) => listeners.push(f) };
  return { appended, listeners, doc, win: {} };
}

test('loadGa4: consentimiento denied por defecto antes de cargar, granted medicion y publicidad', () => {
  const { appended, doc, win } = fakeEnv();
  loadGa4(ID, win, doc);
  const calls = win.dataLayer.map((a) => [...a]);
  assert.deepEqual(calls[0], ['consent', 'default', CONSENT_DEFAULT]);
  assert.deepEqual(Object.values(CONSENT_DEFAULT), ['denied', 'denied', 'denied', 'denied']);
  // El consentimiento se concede antes de 'config' para que el page_view inicial cuente.
  assert.deepEqual(calls[1], ['consent', 'update', { analytics_storage: 'granted', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' }]);
  assert.equal(calls[2][0], 'js');
  assert.deepEqual(calls[3], ['config', ID]);
  assert.equal(appended.length, 1);
  assert.equal(appended[0].src, `https://www.googletagmanager.com/gtag/js?id=${ID}`);
  loadGa4(ID, win, doc);
  assert.equal(appended.length, 1);
});

test('revocacion: consent update a denied y store_click deja de enviarse', () => {
  const { listeners, doc, win } = fakeEnv();
  loadGa4(ID, win, doc);
  const a = { getAttribute: (k) => (k === 'href' ? 'https://x' : null), dataset: { store: 'ios' } };
  const click = () => listeners.forEach((f) => f({ target: { closest: () => a } }));
  const n0 = win.dataLayer.length;
  click();
  assert.deepEqual([...win.dataLayer[n0]], ['event', 'store_click', { platform: 'ios' }]);
  revokeGa4(win);
  const last = [...win.dataLayer[win.dataLayer.length - 1]];
  assert.deepEqual(last, ['consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }]);
  const n1 = win.dataLayer.length;
  click();
  assert.equal(win.dataLayer.length, n1);
});

test('store_click solo ios/android y no con enlace desactivado', () => {
  assert.deepEqual(storeClickParams('android'), { platform: 'android' });
  assert.equal(storeClickParams('web'), null);
  const { listeners, doc, win } = fakeEnv();
  loadGa4(ID, win, doc);
  const n = win.dataLayer.length;
  const off = { getAttribute: (k) => (k === 'aria-disabled' ? 'true' : 'https://x'), dataset: { store: 'ios' } };
  listeners.forEach((f) => f({ target: { closest: () => off } }));
  assert.equal(win.dataLayer.length, n);
});

const rules = () => {
  const out = {}; let cur = null;
  for (const line of read('_headers').split('\n')) {
    if (/^\S/.test(line) && !line.startsWith('#')) { cur = line.trim(); out[cur] = out[cur] || {}; }
    else if (cur && /^\s+Content-Security-Policy:/.test(line)) out[cur].csp = line.split('Content-Security-Policy:')[1].trim();
  }
  return out;
};

test('CSP: Google solo en las rutas con medicion; no en /*, /captcha/* ni /auth/*', () => {
  const r = rules();
  assert.doesNotMatch(r['/*'].csp, /google-analytics|googletagmanager|analytics\.google/);
  assert.doesNotMatch(r['/captcha/*'].csp, /google-analytics|googletagmanager|analytics\.google/);
  const px = ['/', '/index.html', '/partidas', '/partidas/*', '/grupos', '/grupos/*', '/r', '/r/*', '/privacidad/*', '/terminos/*', '/eliminar-cuenta/*', '/pelotas/*'];
  for (const p of px) {
    const c = r[p].csp;
    assert.match(c, /script-src [^;]*https:\/\/www\.googletagmanager\.com/, p);
    for (const h of ['www.google-analytics.com', '*.google-analytics.com', '*.analytics.google.com', 'www.googletagmanager.com']) {
      assert.ok(c.match(/connect-src [^;]*/)[0].includes(`https://${h}`), `${p} connect ${h}`);
    }
    assert.match(c, /img-src [^;]*https:\/\/www\.google-analytics\.com [^;]*https:\/\/www\.googletagmanager\.com|img-src [^;]*https:\/\/www\.googletagmanager\.com [^;]*https:\/\/www\.google-analytics\.com|img-src [^;]*https:\/\/www\.google-analytics\.com https:\/\/www\.googletagmanager\.com/, p);
    assert.match(c, /frame-ancestors 'none'/, p);
    assert.match(c, /https:\/\/connect\.facebook\.net/, p);
  }
  assert.deepEqual(Object.keys(r).filter((k) => /googletagmanager/.test(r[k].csp || '')).sort(), [...px].sort());
  assert.equal(Object.keys(r).some((k) => k.startsWith('/auth') || k.includes(' ')), false);
});

test('CSP /pelotas/* conserva Turnstile y Supabase con GA4', () => {
  const c = rules()['/pelotas/*'].csp;
  assert.match(c, /script-src [^;]*https:\/\/challenges\.cloudflare\.com/);
  assert.match(c, /connect-src [^;]*https:\/\/djpgmmibdcgklseiqxpj\.supabase\.co/);
  assert.match(c, /frame-src https:\/\/challenges\.cloudflare\.com/);
});
