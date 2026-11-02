// Logica pura del Pixel de Meta y del consentimiento (sin DOM), testeable con node --test.
import { metaPixelConfig } from './config.js';

export const CONSENT_KEY = 'yoinit_cookie_consent';

// ID del pixel segun el hostname; null si esta apagado o el host no es de produccion.
export function pixelIdForHost(hostname, cfg = metaPixelConfig) {
  if (!cfg || !cfg.enabled || !cfg.pixelId) return null;
  const host = String(hostname || '').toLowerCase();
  return Array.isArray(cfg.hosts) && cfg.hosts.includes(host) ? String(cfg.pixelId) : null;
}

// Valor guardado al aceptar. Versionado: el texto anterior del banner no pedia permiso para
// publicidad, asi que un 'accepted' viejo cuenta como sin eleccion y el banner vuelve a salir.
export const ACCEPTED_STORED = 'accepted_v2';

// 'accepted' | 'rejected' | null (sin eleccion, 'accepted' antiguo, o sin localStorage).
export function readConsent(storage) {
  try {
    const value = storage && storage.getItem(CONSENT_KEY);
    if (value === ACCEPTED_STORED) return 'accepted';
    return value === 'rejected' ? 'rejected' : null;
  } catch { return null; }
}

export function writeConsent(storage, value) {
  if (value !== 'accepted' && value !== 'rejected') return false;
  try { storage.setItem(CONSENT_KEY, value === 'accepted' ? ACCEPTED_STORED : value); return true; } catch { return false; }
}

// El pixel solo se carga con host de produccion Y consentimiento aceptado.
export function shouldLoadPixel(consent, pixelId) {
  return Boolean(pixelId) && consent === 'accepted';
}

// El banner solo tiene sentido donde el pixel existe y mientras no haya eleccion.
export function shouldShowBanner(consent, pixelId) {
  return Boolean(pixelId) && consent === null;
}

// Parametros del evento Lead al pulsar un boton de tienda (data-store="ios"|"android").
export function storeLeadParams(store) {
  if (store !== 'ios' && store !== 'android') return null;
  return { content_name: 'store_click', content_category: store };
}
