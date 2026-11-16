import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('landing /crear: noindex, copy exacto, tiendas y boton para abrir la app', () => {
  const html = read('crear.html');
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /<title>Crea tu partida \| YoinIt<\/title>/);
  assert.match(html, /<h1 class="partida-title">Arma tu partida<\/h1>/);
  assert.match(html, /Abre YoinIt, entra en Partidas y toca Crear\. Eliges cancha, día y hora, y los demás se suman\./);
  assert.match(html, /<li>Abre YoinIt en tu teléfono\.<\/li>\s*<li>Entra en Partidas\.<\/li>\s*<li>Toca Crear y deja la partida pública\.<\/li>/);
  assert.match(html, /¿Todavía no tienes la app\? Descárgala y entra con tu cuenta\./);
  assert.match(html, /data-store="ios"/);
  assert.match(html, /data-store="android"/);
  assert.match(html, /<button type="button" class="primary-button partida-cta" data-action="open-app">Abrir YoinIt<\/button>/);
  assert.ok(html.indexOf('data-action="open-app"') < html.indexOf('<ol class="partida-steps">'));
  // Abre la app en su inicio con una ruta que aceptan todas las versiones publicadas.
  assert.match(html, /var deepLink = 'com\.yoinit\.app:\/\/auth\/confirmed';/);
  assert.match(html, /intent:\/\/auth\/confirmed#Intent;scheme=com\.yoinit\.app;package=com\.yoinit\.app;/);
  assert.match(html, /S\.browser_fallback_url=' \+ encodeURIComponent\(playUrl\)/);
  assert.doesNotMatch(html, /open\/crear/);
  assert.match(html, /setTimeout\(function \(\) \{ window\.location\.href = deepLink; \}, 50\);/);
  assert.match(html, /from '\/assets\/js\/deferred-link\.js'/);
  assert.doesNotMatch(html.replace(/<svg[\s\S]*?<\/svg>/g, ''), /#[0-9a-fA-F]{3,8}\b/);
});

test('/crear: fuera del sitemap, cerrada en robots y sin regla en _redirects (crear.html con URLs limpias)', () => {
  assert.doesNotMatch(read('sitemap.xml'), /crear/);
  assert.match(read('robots.txt'), /Disallow: \/crear\n/);
  assert.doesNotMatch(read('_redirects'), /crear/);
});

test('/crear NO esta en el AASA: el https carga siempre la pagina, que abre la app en el inicio', () => {
  const aasa = JSON.parse(read('.well-known/apple-app-site-association'));
  const paths = aasa.applinks.details[0].components.map((c) => c['/']);
  assert.ok(!paths.some((p) => p.startsWith('/crear')));
  assert.doesNotMatch(read('.well-known/assetlinks.json'), /crear/);
});

test('CSP de /crear igual que la de /grupos', () => {
  const h = read('_headers');
  const csp = (route) => h.match(new RegExp(`^${route}\\n[^\\n]*\\n\\s+(Content-Security-Policy: [^\\n]+)`, 'm'))[1];
  assert.equal(csp('/crear'), csp('/grupos'));
});
