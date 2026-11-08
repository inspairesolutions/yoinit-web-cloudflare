import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

// SEO: home, terminos y privacidad indexables; utilidades fuera del indice. node --test tests/
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('home, terminos y privacidad son indexables', () => {
  for (const p of ['index.html', 'terminos/index.html', 'privacidad/index.html']) {
    assert.doesNotMatch(read(p), /noindex/, p);
  }
});

test('home: canonical, Open Graph, app de Apple y JSON-LD valido', () => {
  const html = read('index.html');
  assert.match(html, /<link rel="canonical" href="https:\/\/yoinit\.app\/">/);
  assert.match(html, /property="og:image" content="https:\/\/yoinit\.app\//);
  assert.match(html, /apple-itunes-app" content="app-id=6824063226"/);
  const blocks = [...html.matchAll(/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  assert.deepEqual(blocks.map((b) => b['@type']), ['Organization', 'WebSite', 'MobileApplication', 'FAQPage']);
});

test('robots.txt cierra las utilidades y apunta al sitemap', () => {
  const robots = read('robots.txt');
  for (const p of ['/pelotas/', '/captcha/', '/auth/', '/r/', '/grupos/', '/partidas/', '/eliminar-cuenta/']) {
    assert.match(robots, new RegExp(`Disallow: ${p}\\n`));
  }
  assert.match(robots, /Sitemap: https:\/\/yoinit\.app\/sitemap\.xml/);
});

test('home: un solo h1 y las imagenes de producto vienen en el HTML estatico', () => {
  const html = read('index.html');
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  assert.doesNotMatch(html, /Imagen en preparaci/);
  const slots = [...html.matchAll(/<div[^>]*data-image="(\d\d)"[^>]*>(.*?)<\/div>/gs)].filter((m) => m[2].includes('<img'));
  assert.equal(slots.length, 10);
  for (const [, , inner] of slots) {
    const [, src, alt] = inner.match(/<img src="\.\/([^"]+)" alt="([^"]+)"/);
    assert.ok(existsSync(new URL(`../${src}`, import.meta.url)), src);
    assert.ok(alt.length > 5);
  }
});

test('home abre con una definicion citable y llms-full.txt existe y esta enlazado', () => {
  assert.match(read('index.html'), /YoinIt es una app para organizar partidos de pádel en Venezuela\./);
  assert.match(read('llms.txt'), /https:\/\/yoinit\.app\/llms-full\.txt/);
  const full = read('llms-full.txt');
  assert.match(full, /id6824063226/);
  assert.match(full, /hello@yoinit\.app/);
});

test('404.html: pagina propia, noindex, rutas absolutas y sin JS ni hex sueltos', () => {
  const html = read('404.html');
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /href="\/assets\/css\/styles\.css\?v=20261102"/);
  assert.match(html, /href="\/">Ir al inicio/);
  assert.doesNotMatch(html, /<script|#[0-9a-fA-F]{6}\b/);
});

test('/categorias: indexable, en el sitemap, con la tabla 1-7 y sin hex sueltos', () => {
  const html = read('categorias/index.html');
  assert.doesNotMatch(html, /noindex/);
  assert.match(html, /<link rel="canonical" href="https:\/\/yoinit\.app\/categorias\/">/);
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  for (let n = 1; n <= 7; n++) assert.match(html, new RegExp(`<th scope="row">${n}</th>`));
  assert.match(read('sitemap.xml'), /https:\/\/yoinit\.app\/categorias\//);
  assert.match(read('llms.txt'), /https:\/\/yoinit\.app\/categorias\//);
  assert.doesNotMatch(read('assets/css/categorias.css'), /#[0-9a-fA-F]{3,6}\b/);
});
