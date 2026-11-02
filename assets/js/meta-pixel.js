// Carga el Pixel de Meta. Solo se importa/ejecuta tras consentimiento (consent.js).
import { storeLeadParams } from './meta-pixel-logic.js';

export const FBEVENTS_SRC = 'https://connect.facebook.net/en_US/fbevents.js';

let active = false;
let clickBound = false;

export function loadMetaPixel(pixelId, win = window, doc = document) {
  if (!pixelId || win.fbq) { active = Boolean(win.fbq); return; }
  const fbq = function () { fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
  win.fbq = fbq;
  if (!win._fbq) win._fbq = fbq;
  fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; fbq.queue = [];
  const s = doc.createElement('script');
  s.async = true;
  s.src = FBEVENTS_SRC;
  doc.head.appendChild(s);
  // Solo se llega aqui con consentimiento (medicion y publicidad) ya dado.
  win.fbq('consent', 'grant');
  win.fbq('init', pixelId);
  win.fbq('track', 'PageView');
  active = true;
  if (!clickBound) {
    clickBound = true;
    doc.addEventListener('click', (e) => {
      if (!active) return;
      const a = e.target && e.target.closest ? e.target.closest('a[data-store]') : null;
      if (!a || a.getAttribute('aria-disabled') === 'true' || !a.getAttribute('href')) return;
      const params = storeLeadParams(a.dataset.store);
      if (params) win.fbq('track', 'Lead', params);
    });
  }
}

// Si la persona retira el consentimiento tras haber aceptado: se deja de enviar eventos.
export function revokeMetaPixel(win = window) {
  active = false;
  if (win.fbq) win.fbq('consent', 'revoke');
}
