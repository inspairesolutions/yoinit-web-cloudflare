import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('landing /crear: noindex, copy exacto, tiendas y sin enlace a la app', () => {
  const html = read('crear.html');
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /<title>Crea tu partida \| YoinIt<\/title>/);
  assert.match(html, /<h1 class="partida-title">Arma tu partida<\/h1>/);
  assert.match(html, /Abre YoinIt, entra en Partidas y toca Crear\. Eliges cancha, día y hora, y los demás se suman\./);
  assert.match(html, /<li>Abre YoinIt en tu teléfono\.<\/li>\s*<li>Entra en Partidas\.<\/li>\s*<li>Toca Crear y deja la partida pública\.<\/li>/);
  assert.match(html, /¿Todavía no tienes la app\? Descárgala y entra con tu cuenta\./);
  assert.match(html, /data-store="ios"/);
  assert.match(html, /data-store="android"/);
  assert.doesNotMatch(html, /open-app|com\.yoinit\.app:\/\/|intent:\/\/|Abrir en la app/);
  assert.doesNotMatch(html.replace(/<svg[\s\S]*?<\/svg>/g, ''), /#[0-9a-fA-F]{3,8}\b/);
});

test('/crear: fuera del sitemap, cerrada en robots y sin regla en _redirects (crear.html con URLs limpias)', () => {
  assert.doesNotMatch(read('sitemap.xml'), /crear/);
  assert.match(read('robots.txt'), /Disallow: \/crear\n/);
  assert.doesNotMatch(read('_redirects'), /crear/);
});

test('/crear no se anuncia a la app todavia: AASA y assetlinks no la mencionan', () => {
  assert.doesNotMatch(read('.well-known/apple-app-site-association'), /crear/);
  assert.doesNotMatch(read('.well-known/assetlinks.json'), /crear/);
});
