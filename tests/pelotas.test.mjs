import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  checkoutAvailability, copyPhone, displayPhone, errorMessage, formatCountdown, formatUsd, formatVes, isSalesDisabled,
  isValidEmail, isValidIdDoc, isValidOtp, isValidPhone, normalizeIdDoc, normalizePhone, pelotasLabel, pickRate,
  pricePerMatch, purchaseState, vesForCopy,
} from '../assets/js/pelotas-logic.js';

// CRED-004: logica de /pelotas/. node --test tests/

test('correo', () => {
  assert.ok(isValidEmail(' Ana@Correo.com '));
  assert.ok(!isValidEmail('ana@correo'));
  assert.ok(!isValidEmail('ana correo@x.com'));
  assert.ok(!isValidEmail(''));
  assert.ok(!isValidEmail(undefined));
});

test('codigo de correo: 6 a 8 digitos', () => {
  assert.ok(isValidOtp('123456'));
  assert.ok(isValidOtp('123 456 78'));
  assert.ok(!isValidOtp('12345'));
  assert.ok(!isValidOtp('abcdef'));
});

test('telefono: mismas reglas que save_payment_profile', () => {
  assert.equal(normalizePhone('0414-1234567'), '584141234567');
  assert.equal(normalizePhone('+58 414 1234567'), '584141234567');
  assert.equal(normalizePhone('584141234567'), '584141234567');
  assert.equal(normalizePhone('00584141234567'), '584141234567');
  assert.equal(normalizePhone('414123456'), null);
  assert.equal(normalizePhone('04141234'), null);
  assert.equal(normalizePhone('0414123456789'), null);
  assert.equal(normalizePhone(''), null);
  assert.ok(isValidPhone('04241234567'));
  assert.ok(!isValidPhone('abc'));
});

test('cedula o RIF: V, E o J y 6 a 9 digitos', () => {
  assert.equal(normalizeIdDoc('v-12.345.678'), 'V12345678');
  assert.equal(normalizeIdDoc('J123456789'), 'J123456789');
  assert.equal(normalizeIdDoc('E-123456'), 'E123456');
  assert.equal(normalizeIdDoc('G12345678'), null);
  assert.equal(normalizeIdDoc('V12345'), null);
  assert.equal(normalizeIdDoc('V1234567890'), null);
  assert.equal(normalizeIdDoc('12345678'), null);
  assert.ok(isValidIdDoc('v 9876543'));
});

test('telefono para mostrar y copiar', () => {
  assert.equal(displayPhone('584141234567'), '0414-1234567');
  assert.equal(copyPhone('584141234567'), '04141234567');
  assert.equal(displayPhone('123'), '123');
});

test('montos en USD: $8, $12,50', () => {
  assert.equal(formatUsd(8), '$8');
  assert.equal(formatUsd(8.0), '$8');
  assert.equal(formatUsd(12.5), '$12,50');
  assert.equal(formatUsd('12.50'), '$12,50');
  assert.equal(formatUsd(1250), '$1.250');
  assert.equal(formatUsd(0.8), '$0,80');
  assert.equal(formatUsd('x'), '');
});

test('montos en Bs: dos decimales y coma', () => {
  assert.equal(formatVes(9420.83), 'Bs. 9.420,83');
  assert.equal(formatVes(800), 'Bs. 800,00');
  assert.equal(formatVes(1234567.5), 'Bs. 1.234.567,50');
  assert.equal(vesForCopy(9420.83), '9420,83');
  assert.equal(vesForCopy(800), '800,00');
});

test('pelotas y precio por partida', () => {
  assert.equal(pelotasLabel(1), '1 pelota');
  assert.equal(pelotasLabel(10), '10 pelotas');
  assert.equal(pricePerMatch(8, 8), '$1');
  assert.equal(pricePerMatch(10, 8), '$1,25');
  assert.equal(pricePerMatch(10, 0), '');
});

test('cuenta atras', () => {
  assert.equal(formatCountdown(125000), '02:05');
  assert.equal(formatCountdown(-5), '00:00');
});

test('tasa: ultima fila valida o null', () => {
  assert.equal(pickRate([{ rate: '9.5' }]), 9.5);
  assert.equal(pickRate([]), null);
  assert.equal(pickRate([{ rate: 0 }]), null);
  assert.equal(pickRate(null), null);
});

test('disponibilidad del checkout: sin config o apagado no se pinta', () => {
  assert.equal(checkoutAvailability({ supabaseUrl: '', anonKey: '', enabled: false }).available, false);
  assert.equal(checkoutAvailability(undefined).available, false);
  const ok = { supabaseUrl: 'https://djpgmmibdcgklseiqxpj.supabase.co', anonKey: 'k', enabled: true };
  assert.equal(checkoutAvailability({ ...ok, enabled: false }).available, false);
  assert.equal(checkoutAvailability({ ...ok, anonKey: '' }).reason, 'not_configured');
  assert.equal(checkoutAvailability({ ...ok, supabaseUrl: 'http://x.supabase.co' }).available, false);
  assert.equal(checkoutAvailability(ok).available, true);
  assert.equal(checkoutAvailability(ok, true).reason, 'web_sales_disabled');
});

test('errores: copy es-VE y deteccion de ventas apagadas', () => {
  assert.equal(errorMessage('web_sales_disabled'), 'La compra por la web aún no está disponible.');
  assert.ok(isSalesDisabled({ code: 'web_sales_disabled' }));
  assert.ok(!isSalesDisabled({ code: 'unauthorized' }));
  assert.match(errorMessage({ code: 'no_exchange_rate' }), /tasa/);
  assert.match(errorMessage({ code: 'bank_not_available_for_p2p' }), /banco/i);
  assert.match(errorMessage({ message: 'invalid_payment_profile' }), /cédula/);
  assert.match(errorMessage({ code: 'network', status: 0 }), /conectar/);
  assert.match(errorMessage({ status: 429 }), /demasiados/);
  assert.match(errorMessage('algo raro'), /Inténtalo/);
  for (const c of ['web_sales_disabled', 'unauthorized', 'no_exchange_rate', 'similar_payment_pending', 'x']) {
    assert.ok(!errorMessage(c).includes('!'), c);
  }
});

test('estado de la compra', () => {
  assert.equal(purchaseState({ status: 'paid' }, null).kind, 'credited');
  assert.equal(purchaseState({ status: 'rejected' }, null).kind, 'rejected');
  assert.equal(purchaseState({ status: 'cancelled' }, null).kind, 'expired');
  assert.equal(purchaseState({ status: 'pending' }, { status: 'instructions' }).kind, 'instructions');
  assert.equal(purchaseState({ status: 'pending' }, { status: 'waiting' }).kind, 'waiting');
  assert.equal(purchaseState({ status: 'pending' }, { status: 'expired' }).kind, 'expired');
  assert.equal(purchaseState({ status: 'pending' }, { status: 'cancelled' }).terminal, true);
  assert.equal(purchaseState({ status: 'pending' }, { status: 'late' }).kind, 'late');
  assert.equal(purchaseState({ status: 'pending' }, null).kind, 'review');
  assert.equal(purchaseState({ status: 'pending' }, { status: 'waiting' }).terminal, false);
  assert.equal(purchaseState(null, null).kind, 'loading');
});

// Sin enlaces hacia /pelotas/ desde el resto del sitio (la pagina es noindex y sin descubrimiento).
const OUTSIDE = ['index.html', 'grupos.html', 'partidas.html', 'r.html', 'privacidad/index.html', 'eliminar-cuenta/index.html'];
test('ninguna pagina publica enlaza a /pelotas/', () => {
  for (const f of OUTSIDE) {
    const html = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.ok(!/href=["'][^"']*pelotas/i.test(html), `${f} enlaza a pelotas`);
  }
});

test('config.js: pelotasConfig separado y vacio; siteConfig sin pelotas', () => {
  const cfg = readFileSync(new URL('../assets/js/config.js', import.meta.url), 'utf8');
  assert.match(cfg, /export const pelotasConfig = \{\s*supabaseUrl: '',[^}]*anonKey: '',\s*enabled: false,\s*\};/);
  const site = cfg.slice(cfg.indexOf('export const siteConfig'), cfg.indexOf('// CRED-004'));
  assert.ok(!/pelotas/i.test(site));
});

test('paginas de pelotas: noindex y la informativa sin checkout ni enlace a /pelotas/', () => {
  const main = readFileSync(new URL('../pelotas/index.html', import.meta.url), 'utf8');
  const info = readFileSync(new URL('../pelotas/como-conseguir/index.html', import.meta.url), 'utf8');
  for (const html of [main, info]) assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  // Solo se permite el modulo de consentimiento de cookies (Meta Pixel); ningun otro script.
  assert.deepEqual(info.match(/<script[^>]*>/gi), ['<script type="module" src="../../assets/js/consent.js">']);
  assert.ok(!/<form/i.test(info));
  assert.ok(!/href=["'](\.\.\/)?(\.\.\/)?pelotas|href=["']\.\.\/["']/i.test(info.replace(/href="\.\.\/\.\.\/"/g, '')));
  assert.ok(!/comprar|checkout|pack/i.test(info.replace(/<title>.*<\/title>/, '')));
});

test('_headers: CSP de /pelotas/ abre solo Supabase de prod; la global no cambia', () => {
  const h = readFileSync(new URL('../_headers', import.meta.url), 'utf8');
  const [global, rest] = h.split('/pelotas/*');
  assert.ok(!global.includes('supabase.co'));
  assert.match(rest.split('/assets/*')[0], /connect-src 'self' https:\/\/djpgmmibdcgklseiqxpj\.supabase\.co https:\/\/challenges\.cloudflare\.com(?: https:\/\/www\.facebook\.com https:\/\/connect\.facebook\.net(?: https:\/\/www\.google-analytics\.com https:\/\/\*\.google-analytics\.com https:\/\/\*\.analytics\.google\.com https:\/\/www\.googletagmanager\.com(?: https:\/\/www\.google\.com https:\/\/googleads\.g\.doubleclick\.net https:\/\/www\.googleadservices\.com https:\/\/\*\.doubleclick\.net)?)?)?;/);
});

test('sin hex sueltos ni signos de admiracion en los archivos nuevos', () => {
  for (const f of ['assets/css/pelotas.css']) {
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')), f);
  }
  for (const f of ['pelotas/index.html', 'pelotas/como-conseguir/index.html']) {
    const text = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/<!DOCTYPE html>/i, '');
    assert.ok(!/!(?!--)/.test(text.replace(/<!--[\s\S]*?-->/g, '')), f);
  }
  assert.ok(existsSync(new URL('../assets/js/pelotas.js', import.meta.url)));
});

// ---------- APP-SEC-002: Turnstile ----------
import { buildOtpBody, isCaptchaError, parseCaptchaParams, siteKeyForHost, captchaMessage } from '../assets/js/captcha-logic.js';

test('captcha: cuerpo de /auth/v1/otp con y sin token', () => {
  assert.deepEqual(buildOtpBody('a@b.com', 'tok123'), { email: 'a@b.com', create_user: false, gotrue_meta_security: { captcha_token: 'tok123' } });
  assert.deepEqual(buildOtpBody('a@b.com', null), { email: 'a@b.com', create_user: false });
  assert.ok(!('gotrue_meta_security' in buildOtpBody('a@b.com', '')));
});

test('captcha: site key por hostname; host desconocido sin captcha', () => {
  assert.equal(siteKeyForHost('yoinit.app'), '0x4AAAAAAFoOB9AoraeQQoPG');
  assert.equal(siteKeyForHost('panel.yoinit.app'), '0x4AAAAAAFoOB9AoraeQQoPG');
  for (const h of ['localhost', 'dev.yoinit.app', 'yoinit-web-cloudflare-pages-dev.pages.dev', 'yoinit-backend-dev.vercel.app']) {
    assert.equal(siteKeyForHost(h), '0x4AAAAAAFoN5z-Z2V-FxJfj', h);
  }
  assert.equal(siteKeyForHost('otro.com'), null);
  assert.equal(siteKeyForHost(''), null);
});

test('captcha: errores y parametros de /captcha/', () => {
  assert.ok(isCaptchaError({ code: 'captcha_failed' }));
  assert.ok(!isCaptchaError({ code: 'over_email_send_rate_limit' }));
  assert.deepEqual(parseCaptchaParams('?theme=dark&action=login'), { theme: 'dark', action: 'login' });
  assert.deepEqual(parseCaptchaParams('?theme=raro'), { theme: 'auto', action: undefined });
  assert.equal(parseCaptchaParams('?action=<x>').action, 'x');
});

test('captcha: contrato de mensajes hacia la app', () => {
  assert.deepEqual(JSON.parse(captchaMessage.token('t')), { type: 'token', token: 't' });
  assert.deepEqual(JSON.parse(captchaMessage.expired()), { type: 'expired' });
  assert.deepEqual(JSON.parse(captchaMessage.error('110200')), { type: 'error', code: '110200' });
  assert.deepEqual(JSON.parse(captchaMessage.ready()), { type: 'ready' });
});

test('captcha: CSP abre Turnstile solo en /pelotas/* y /captcha/*, la global no; pagina noindex', () => {
  const h = readFileSync(new URL('../_headers', import.meta.url), 'utf8');
  const blocks = h.split(/\n\n/);
  for (const b of blocks) {
    const path = b.trim().split('\n')[0];
    const has = b.includes('challenges.cloudflare.com');
    assert.equal(has, path === '/pelotas/*' || path === '/captcha/*', path);
    if (has) assert.match(b, /frame-ancestors 'none'/);
  }
  const page = readFileSync(new URL('../captcha/index.html', import.meta.url), 'utf8');
  assert.match(page, /<meta name="robots" content="noindex">/);
  assert.ok(!/!(?!--)/.test(page.replace(/<!DOCTYPE html>/i, '')));
});
