import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { androidIntentUrl, cleanCode, cleanGroupCode, cleanMatchId, isAndroid, playStoreUrl, referrerValue } from '../assets/js/deferred-link.js';

// APP-SHARE-004: referrer de Play, intent de Chrome y assetlinks.json. node --test tests/
const ID = '123e4567-e89b-12d3-a456-426614174000';
const STORE = 'https://play.google.com/store/apps/details?id=com.yoinit.app';

test('referrer con partida y codigo', () => {
  assert.equal(referrerValue({ matchId: ID, code: 'ab12cd' }), `link=/partidas/${ID}&ref=AB12CD`);
  assert.equal(referrerValue({ matchId: ID }), `link=/partidas/${ID}`);
});

test('referrer solo con codigo usa la ruta /r', () => {
  assert.equal(referrerValue({ code: 'ab12cd' }), 'link=/r/AB12CD');
});

test('entradas invalidas se descartan', () => {
  assert.equal(cleanMatchId('no-uuid'), '');
  assert.equal(cleanMatchId(undefined), '');
  assert.equal(cleanCode('<script>'), '');
  assert.equal(cleanCode('a b'), '');
  assert.equal(referrerValue({ matchId: 'x', code: '!' }), '');
  assert.equal(referrerValue(), '');
});

test('URL de Play: el referrer va codificado como un solo parametro', () => {
  const url = new URL(playStoreUrl(STORE, { matchId: ID, code: 'AB12CD' }));
  assert.equal(url.searchParams.get('id'), 'com.yoinit.app');
  assert.equal(url.searchParams.get('referrer'), `link=/partidas/${ID}&ref=AB12CD`);
  assert.ok(url.search.includes('referrer=link%3D%2Fpartidas%2F'));
  assert.ok(!url.search.includes('&ref='));
});

test('sin URL de tienda configurada no hay enlace', () => {
  assert.equal(playStoreUrl('', { matchId: ID }), '');
  assert.equal(playStoreUrl('no es url', { matchId: ID }), '');
});

test('sin datos, la URL de Play queda tal cual', () => {
  assert.equal(playStoreUrl(STORE, {}), STORE);
});

test('intent de Chrome con y sin destino de reserva', () => {
  assert.equal(
    androidIntentUrl(`/partidas/${ID}`, STORE),
    `intent://open/partidas/${ID}#Intent;scheme=com.yoinit.app;package=com.yoinit.app;S.browser_fallback_url=${encodeURIComponent(STORE)};end`,
  );
  assert.equal(
    androidIntentUrl('/r/AB12CD', ''),
    'intent://open/r/AB12CD#Intent;scheme=com.yoinit.app;package=com.yoinit.app;end',
  );
});

test('deteccion de Android', () => {
  assert.equal(isAndroid('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120'), true);
  assert.equal(isAndroid('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), false);
  assert.equal(isAndroid(undefined), false);
});

test('assetlinks.json: paquete, relacion y las dos huellas del brief', () => {
  const links = JSON.parse(readFileSync(new URL('../.well-known/assetlinks.json', import.meta.url), 'utf8'));
  assert.equal(links.length, 1);
  assert.deepEqual(links[0].relation, ['delegate_permission/common.handle_all_urls']);
  assert.equal(links[0].target.namespace, 'android_app');
  assert.equal(links[0].target.package_name, 'com.yoinit.app');
  const fp = links[0].target.sha256_cert_fingerprints;
  assert.equal(fp.length, 2);
  for (const f of fp) assert.match(f, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
});

test('_headers sirve assetlinks.json como application/json', () => {
  const headers = readFileSync(new URL('../_headers', import.meta.url), 'utf8');
  assert.match(headers, /\/\.well-known\/assetlinks\.json\n\s+Content-Type: application\/json/);
});

// APP-GROUP-008: enlaces de grupo.
test('referrer de grupo con codigo valido', () => {
  assert.equal(referrerValue({ groupCode: 'k7mp4rxw' }), 'link=/grupos/K7MP4RXW');
  const url = new URL(playStoreUrl(STORE, { groupCode: 'K7MP4RXW' }));
  assert.equal(url.searchParams.get('referrer'), 'link=/grupos/K7MP4RXW');
  assert.ok(url.search.includes('referrer=link%3D%2Fgrupos%2FK7MP4RXW'));
});

test('codigo de grupo: solo 8 caracteres A-Z 2-9 sin 0 O 1 I', () => {
  for (const bad of ['K7MP4RX', 'K7MP4RXWA', 'K7MP4RX0', 'K7MP4RXO', 'K7MP4RX1', 'K7MP4RXI', 'K7MP-4RX', '../home', '<script>', '', undefined, 12345678]) {
    assert.equal(cleanGroupCode(bad), '', String(bad));
    assert.equal(referrerValue({ groupCode: bad }), '', String(bad));
  }
});

test('intent de Chrome para grupo', () => {
  assert.equal(
    androidIntentUrl('/grupos/K7MP4RXW', STORE),
    `intent://open/grupos/K7MP4RXW#Intent;scheme=com.yoinit.app;package=com.yoinit.app;S.browser_fallback_url=${encodeURIComponent(STORE)};end`,
  );
});

test('landing de grupo: noindex, copy generico, redirect y sin hex sueltos', () => {
  const html = readFileSync(new URL('../grupos.html', import.meta.url), 'utf8');
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /Te invitaron a un grupo en YoinIt/);
  assert.match(html, /Abrir en la app/);
  assert.match(html, /store-badge/);
  // Sin hex fuera de los logos SVG de las tiendas (los colores salen de los tokens --yo-*).
  assert.doesNotMatch(html.replace(/<svg[\s\S]*?<\/svg>/g, ''), /#[0-9a-fA-F]{3,8}\b/);
  // Sin datos privados del grupo ni endpoint inventado.
  assert.doesNotMatch(html, /fetch\(|supabase/i);
  const redirects = readFileSync(new URL('../_redirects', import.meta.url), 'utf8');
  assert.match(redirects, /^\/grupos\/\*\s+\/grupos\s+200$/m);
});

test('assetlinks.json es por dominio y app: /grupos/ no requiere cambio', () => {
  const raw = readFileSync(new URL('../.well-known/assetlinks.json', import.meta.url), 'utf8');
  assert.ok(!raw.includes('grupos'));
});

// APP-APPLE-003 / APP-SHARE-004 (iOS): AASA y copiado al portapapeles.
import { copyToClipboard, isIos, shareUrl } from '../assets/js/deferred-link.js';

test('AASA: JSON valido, appID y rutas de las tres landings', () => {
  const aasa = JSON.parse(readFileSync(new URL('../.well-known/apple-app-site-association', import.meta.url), 'utf8'));
  const [detail] = aasa.applinks.details;
  assert.deepEqual(detail.appIDs, ['MC2TL5C499.com.yoinit.app']);
  assert.deepEqual(detail.components.map((c) => c['/']), ['/partidas/*', '/grupos/*', '/r/*']);
});

test('_headers sirve el AASA como application/json', () => {
  const headers = readFileSync(new URL('../_headers', import.meta.url), 'utf8');
  assert.match(headers, /\/\.well-known\/apple-app-site-association\n\s+Content-Type: application\/json/);
});

test('_redirects no toca /.well-known', () => {
  const redirects = readFileSync(new URL('../_redirects', import.meta.url), 'utf8');
  assert.doesNotMatch(redirects, /^[^#\n]*well-known/m);
});

test('isIos: iPhone, iPad, iPadOS como Mac tactil; no Android ni Mac de escritorio', () => {
  assert.equal(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), true);
  assert.equal(isIos('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'), true);
  assert.equal(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5), true);
  assert.equal(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0), false);
  assert.equal(isIos('Mozilla/5.0 (Linux; Android 14)'), false);
  assert.equal(isIos(undefined), false);
});

test('shareUrl: URL canonica por tipo y vacia si el dato es invalido', () => {
  assert.equal(shareUrl({ matchId: ID, code: 'ab12cd' }), `https://yoinit.app/partidas/${ID}`);
  assert.equal(shareUrl({ groupCode: 'abcd2345' }), 'https://yoinit.app/grupos/ABCD2345');
  assert.equal(shareUrl({ code: 'ab12cd' }), 'https://yoinit.app/r/AB12CD');
  assert.equal(shareUrl({ matchId: 'x', code: '!' }), '');
  assert.equal(shareUrl(), '');
});

test('copyToClipboard usa navigator.clipboard.writeText', () => {
  const calls = [];
  const env = { navigator: { clipboard: { writeText: (t) => { calls.push(t); return Promise.resolve(); } } } };
  assert.equal(copyToClipboard('https://yoinit.app/r/AB12CD', env), true);
  assert.deepEqual(calls, ['https://yoinit.app/r/AB12CD']);
});

test('copyToClipboard cae a execCommand si no hay Clipboard API o falla', async () => {
  const mk = () => {
    const log = { copied: 0, appended: 0, removed: 0 };
    const area = { setAttribute() {}, style: {}, select() {}, setSelectionRange() {} };
    const document = {
      body: { appendChild: () => { log.appended++; }, removeChild: () => { log.removed++; } },
      createElement: () => area,
      execCommand: (cmd) => { if (cmd === 'copy') log.copied++; return true; },
    };
    return { log, document };
  };
  const a = mk();
  assert.equal(copyToClipboard('x', { navigator: {}, document: a.document }), true);
  assert.deepEqual(a.log, { copied: 1, appended: 1, removed: 1 });
  const b = mk();
  const rejecting = { clipboard: { writeText: () => Promise.reject(new Error('denied')) } };
  copyToClipboard('x', { navigator: rejecting, document: b.document });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(b.log.copied, 1);
});

test('copyToClipboard sin texto o sin ningun metodo no lanza', () => {
  assert.equal(copyToClipboard('', {}), false);
  assert.equal(copyToClipboard('x', {}), false);
});

test('las tres landings copian en el click del boton de iOS solo en iOS', () => {
  for (const f of ['partidas.html', 'r.html', 'grupos.html']) {
    const html = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.match(html, /isIos\(navigator\.userAgent, navigator\.maxTouchPoints\)/, f);
    assert.match(html, /iosBadge\.addEventListener\('click', function \(\) \{ copyToClipboard\(copyText\); \}\)/, f);
    assert.match(html, /siteConfig\.downloads\.ios/, f);
  }
});
