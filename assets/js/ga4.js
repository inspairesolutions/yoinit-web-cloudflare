// Carga Google Analytics 4. Solo se importa/ejecuta tras consentimiento (consent.js).
import { storeClickParams, CONSENT_DEFAULT, CONSENT_GRANTED, CONSENT_DENIED } from './ga4-logic.js';

export const GTAG_SRC = 'https://www.googletagmanager.com/gtag/js?id=';

let active = false;
const boundDocs = new WeakSet();

export function loadGa4(measurementId, win = window, doc = document) {
  if (!measurementId || win.gtag) { active = Boolean(win.gtag); return; }
  win.dataLayer = win.dataLayer || [];
  win.gtag = function () { win.dataLayer.push(arguments); };
  // Consent Mode v2: denegado por defecto ANTES de cargar nada; luego granted (medicion y publicidad) al aceptar.
  win.gtag('consent', 'default', { ...CONSENT_DEFAULT });
  // Solo se llega aqui con consentimiento ya dado: se concede ANTES de 'config' para que el
  // page_view inicial salga ya con analytics_storage granted y cuente (si no, sale como ping sin cookies).
  win.gtag('consent', 'update', { ...CONSENT_GRANTED });
  win.gtag('js', new Date());
  win.gtag('config', measurementId);
  const s = doc.createElement('script');
  s.async = true;
  s.src = GTAG_SRC + encodeURIComponent(measurementId);
  doc.head.appendChild(s);
  active = true;
  if (!boundDocs.has(doc)) {
    boundDocs.add(doc);
    doc.addEventListener('click', (e) => {
      if (!active) return;
      const a = e.target && e.target.closest ? e.target.closest('a[data-store]') : null;
      if (!a || a.getAttribute('aria-disabled') === 'true' || !a.getAttribute('href')) return;
      const params = storeClickParams(a.dataset.store);
      if (params) win.gtag('event', 'store_click', params);
    });
  }
}

// Si la persona retira el consentimiento tras haber aceptado: se revoca y se deja de enviar.
export function revokeGa4(win = window) {
  active = false;
  if (win.gtag) win.gtag('consent', 'update', { ...CONSENT_DENIED });
}
