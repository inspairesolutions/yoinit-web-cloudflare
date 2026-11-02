// Banner de consentimiento de cookies de medicion y publicidad (Google y Meta). Sin eleccion o con "Rechazar" no se
// carga nada de Meta ni de Google. La eleccion vive en localStorage (la web funciona sin el).
import { pixelIdForHost, readConsent, writeConsent, shouldLoadPixel, shouldShowBanner } from './meta-pixel-logic.js';
import { ga4IdForHost } from './ga4-logic.js';

const pixelId = pixelIdForHost(location.hostname);
const ga4Id = ga4IdForHost(location.hostname);
// Hay banner si al menos un modulo de medicion aplica a este host.
const anyId = pixelId || ga4Id;

function storage() { try { return window.localStorage; } catch { return null; } }

if (!anyId) {
  document.querySelectorAll('[data-cookie-prefs]').forEach((el) => { el.hidden = true; });
} else {
  let consent = readConsent(storage());
  let banner = null;

  const apply = async () => {
    if (shouldLoadPixel(consent, pixelId)) (await import('./meta-pixel.js')).loadMetaPixel(pixelId);
    if (shouldLoadPixel(consent, ga4Id)) (await import('./ga4.js')).loadGa4(ga4Id);
  };

  const closeBanner = () => { if (banner) { banner.remove(); banner = null; } };

  const choose = async (value) => {
    const previous = consent;
    consent = value;
    writeConsent(storage(), value);
    closeBanner();
    if (value === 'accepted') await apply();
    else if (previous === 'accepted') {
      if (window.fbq) (await import('./meta-pixel.js')).revokeMetaPixel();
      if (window.gtag) (await import('./ga4.js')).revokeGa4();
    }
  };

  const openBanner = () => {
    if (banner) return;
    banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookies de medición y publicidad');
    const text = document.createElement('p');
    text.className = 'cookie-banner__text';
    text.textContent = 'Usamos cookies de medición y publicidad (Google y Meta) para saber qué anuncios y páginas ayudan a llegar a la app. Tú decides.';
    const actions = document.createElement('div');
    actions.className = 'cookie-banner__actions';
    for (const [value, label] of [['accepted', 'Aceptar'], ['rejected', 'Rechazar']]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = value === 'accepted' ? 'cookie-banner__btn cookie-banner__btn--primary' : 'cookie-banner__btn cookie-banner__btn--secondary';
      b.textContent = label;
      b.addEventListener('click', () => choose(value));
      actions.append(b);
    }
    banner.append(text, actions);
    document.body.append(banner);
  };

  // Enlace "Preferencias de cookies" en el pie (o al final de la pagina si no hay pie).
  let links = [...document.querySelectorAll('[data-cookie-prefs]')];
  if (!links.length) {
    const wrap = document.createElement('p');
    wrap.className = 'cookie-prefs-wrap';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cookie-prefs';
    b.dataset.cookiePrefs = '';
    b.textContent = 'Preferencias de cookies';
    wrap.append(b);
    document.body.append(wrap);
    links = [b];
  }
  links.forEach((l) => l.addEventListener('click', (e) => { e.preventDefault(); openBanner(); }));

  if (shouldShowBanner(consent, anyId)) openBanner();
  apply();
}
