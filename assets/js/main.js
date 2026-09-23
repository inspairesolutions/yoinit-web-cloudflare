import { siteConfig } from './config.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Public-facing copy uses the product name as YoinIt. Technical identifiers
// such as yoinit.app, routes and asset paths remain lowercase in source code.
function normalizeBrandCopy() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const skip = new Set(['SCRIPT', 'STYLE']);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (skip.has(node.parentElement?.tagName)) continue;
    node.textContent = node.textContent.replace(/\byoinit\b/gi, 'YoinIt');
  }
  document.title = document.title.replace(/\byoinit\b/gi, 'YoinIt');
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = description.content.replace(/\byoinit\b/gi, 'YoinIt');
}

normalizeBrandCopy();

function setMode(mode, scroll = false) {
  $$('[data-view]').forEach(panel => { panel.hidden = panel.dataset.view !== mode; });
  $$('[data-yo-tab]').forEach(tab => {
    const active = tab.dataset.yoTab === mode;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  if (scroll) window.scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' });
}

$$('[data-mode]').forEach(button => button.addEventListener('click', () => {
  setMode(button.dataset.mode, true);
  history.replaceState(null, '', button.dataset.mode === 'club' ? '#club-top' : '#top');
}));
$('[role="tablist"]').addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const current = $('[data-yo-tab][aria-selected="true"]').dataset.yoTab;
  const mode = event.key === 'Home' ? 'player' : event.key === 'End' ? 'club' : current === 'player' ? 'club' : 'player';
  $(`[data-yo-tab="${mode}"]`).click();
  $(`[data-yo-tab="${mode}"]`).focus();
});

function activateAnchor(hash, scroll = false) {
  if (!hash || hash === '#') return;
  const target = document.getElementById(hash.slice(1));
  if (!target) return;
  const panel = target.closest('[data-view]');
  if (panel) setMode(panel.dataset.view);
  if (scroll) target.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth' });
}
$$('a[href^="#"]').forEach(link => link.addEventListener('click', () => activateAnchor(link.hash)));
window.addEventListener('hashchange', () => activateAnchor(location.hash, true));
activateAnchor(location.hash, true);

// Every selection advances the simulation. Only the fourth click creates it.
const demo = { step: 1, day: '', hour: '', visibility: '', invited: false };
const dayFormatter = new Intl.DateTimeFormat('es-VE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Caracas' });
const now = new Date();
const days = Array.from({ length: 5 }, (_, index) => dayFormatter.format(new Date(now.getTime() + (index + 1) * 86400000)));
const hours = ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30'];
const demoContent = $('#demo-content');
const backButton = '<button class="demo-back" type="button" data-demo-back>← Volver</button>';
const summary = () => `<div class="demo-summary"><p><strong>${demo.day} · ${demo.hour}</strong></p><p>Tu cancha habitual · Pádel · 90 min</p><p>${demo.visibility === 'public' ? 'Público: otros jugadores podrán apuntarse.' : 'Privado: solo podrán entrar tus invitados.'}</p></div>`;

function renderDemo(focus = false) {
  $$('[data-progress]').forEach(item => {
    const step = Number(item.dataset.progress);
    item.classList.toggle('is-done', step < demo.step);
    if (step === demo.step) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  });
  let content = '';
  if (demo.step === 1) {
    content = `<h3 tabindex="-1">¿Qué día juegas?</h3><div class="demo-options">${days.map((day, index) => `<button type="button" class="demo-choice" data-day="${index}"><strong>${day.split(',')[0]}</strong><small>${day.includes(',') ? day.split(',').slice(1).join(',') : 'Elegir día'}</small></button>`).join('')}</div>`;
  } else if (demo.step === 2) {
    content = `<h3 tabindex="-1">Ponle hora al partido</h3><p class="demo-description">${demo.day} · Usaremos tu cancha habitual como ejemplo. Estos horarios no indican disponibilidad real.</p><div class="demo-options">${hours.map(hour => `<button type="button" class="demo-choice" data-hour="${hour}"><strong>${hour}</strong><small>90 minutos</small></button>`).join('')}</div>${backButton}`;
  } else if (demo.step === 3) {
    content = `<h3 tabindex="-1">¿Con quién quieres jugar?</h3><div class="demo-options stacked"><button type="button" class="demo-choice" data-visibility="public"><strong>Abierto a la comunidad</strong><small>Publica los tres cupos libres. También puedes invitar a tus compañeros.</small></button><button type="button" class="demo-choice" data-visibility="private"><strong>Solo con mi grupo</strong><small>Partido privado. Solo entran los jugadores que invites.</small></button></div>${backButton}`;
  } else if (demo.step === 4) {
    content = `<h3 tabindex="-1">Crea el partido e invita</h3>${summary()}<p class="demo-description">Daniela R. es nuestra compañera de ejemplo. Al crear el partido, quedará invitada y pendiente de responder.</p><div class="demo-actions"><button type="button" class="primary-button" data-create="invite">Crear e invitar a Daniela</button><button type="button" class="secondary-button" data-create="alone">Crear e invitar después</button></div>${backButton}`;
  } else {
    content = `<h3 tabindex="-1">Partido creado. Ya hay plan.</h3>${summary()}<p class="demo-description">${demo.invited ? 'Daniela R. · Invitación pendiente de respuesta.' : 'Puedes invitar a tus compañeros desde el detalle del partido.'}</p><p class="demo-description">Tú estás dentro. Quedan 3 cupos.${demo.visibility === 'private' ? ' El partido sigue siendo privado.' : ' El partido está abierto a la comunidad.'}</p><p class="demo-description">Así se vería en la app. En esta demo no se ha creado ningún partido ni enviado invitaciones.</p><div class="demo-actions"><a class="primary-button" href="#descargas">Quiero jugar con YoinIt</a><button type="button" class="secondary-button" data-demo-reset>Volver a probar</button></div>`;
  }
  demoContent.innerHTML = `${demo.step <= 4 ? `<p class="step-label">Paso ${demo.step} de 4</p>` : '<p class="step-label">Simulación completada</p>'}${content}`;
  if (focus) {
    $('h3', demoContent).focus({ preventScroll: true });
    $('#demo-status').textContent = demo.step <= 4 ? `Paso ${demo.step} de 4` : 'Simulación completada';
  }
}

demoContent.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.hasAttribute('data-day')) { demo.day = days[Number(button.dataset.day)]; demo.step = 2; }
  else if (button.hasAttribute('data-hour')) { demo.hour = button.dataset.hour; demo.step = 3; }
  else if (button.hasAttribute('data-visibility')) { demo.visibility = button.dataset.visibility; demo.step = 4; }
  else if (button.hasAttribute('data-create')) { demo.invited = button.dataset.create === 'invite'; demo.step = 5; }
  else if (button.hasAttribute('data-demo-back')) demo.step = Math.max(1, demo.step - 1);
  else if (button.hasAttribute('data-demo-reset')) Object.assign(demo, { step: 1, day: '', hour: '', visibility: '', invited: false });
  renderDemo(true);
});
renderDemo();

// Desktop follows the reading position; mobile pairs every screen with its copy.
const features = $$('[data-yo-feat]');
const featureScreens = $$('[data-yo-screen]');
const desktopFeatures = matchMedia('(min-width: 861px)');
const screenStack = $('[data-feature-screens]');
let manualFeatureScrollY = null;
let featureFrame = null;
function showFeature(index) {
  featureScreens.forEach(screen => {
    const active = screen.dataset.yoScreen === index;
    screen.classList.toggle('is-active', active);
    screen.setAttribute('aria-hidden', String(desktopFeatures.matches && !active));
  });
  features.forEach(feature => {
    feature.classList.toggle('is-active', feature.dataset.yoFeat === index);
    if (desktopFeatures.matches) feature.setAttribute('aria-pressed', String(feature.dataset.yoFeat === index));
    else feature.removeAttribute('aria-pressed');
  });
  $('[data-feature-position]').textContent = `${String(Number(index) + 1).padStart(2, '0')} / 04`;
  $('[data-feature-caption]').textContent = $('h3', features[Number(index)]).textContent;
}
features.forEach((feature, index) => {
  const step = document.createElement('div');
  step.className = 'feature-step';
  feature.before(step);
  step.append(feature);
  const heading = $('h3', feature);
  heading.id = `feature-heading-${index}`;
  feature.insertAdjacentHTML('afterbegin', `<span class="feature-number" aria-hidden="true">0${index + 1} / 04</span>`);
  feature.insertAdjacentHTML('beforeend', '<span class="feature-action" aria-hidden="true"><span class="feature-action-label">Ver pantalla</span><span>→</span></span>');
  const mobilePreview = document.createElement('div');
  mobilePreview.className = 'feature-mobile-preview';
  feature.append(mobilePreview);
  featureScreens[index].id = `feature-screen-${index}`;
  const chooseFeature = () => {
    if (!desktopFeatures.matches) return;
    manualFeatureScrollY = window.scrollY;
    showFeature(feature.dataset.yoFeat);
  };
  feature.addEventListener('click', chooseFeature);
  feature.addEventListener('keydown', event => {
    if (desktopFeatures.matches && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); chooseFeature(); }
  });
});
function syncFeatureToScroll() {
  featureFrame = null;
  if (!desktopFeatures.matches || $('#player').hidden) return;
  // A click remains selected while stationary. Normal scrolling resumes the tour.
  if (manualFeatureScrollY !== null && Math.abs(window.scrollY - manualFeatureScrollY) < 8) return;
  manualFeatureScrollY = null;
  const readingLine = 112 + (window.innerHeight - 112) / 2;
  let nearest = 0;
  let distance = Infinity;
  features.forEach((feature, index) => {
    const bounds = feature.getBoundingClientRect();
    const currentDistance = Math.abs(bounds.top + bounds.height / 2 - readingLine);
    if (currentDistance < distance) { nearest = index; distance = currentDistance; }
  });
  showFeature(String(nearest));
}
function scheduleFeatureSync() {
  if (featureFrame === null) featureFrame = requestAnimationFrame(syncFeatureToScroll);
}
function layoutFeatureScreens() {
  manualFeatureScrollY = null;
  features.forEach((feature, index) => {
    if (desktopFeatures.matches) {
      feature.tabIndex = 0;
      feature.setAttribute('role', 'button');
      feature.setAttribute('aria-labelledby', `feature-heading-${index}`);
      feature.setAttribute('aria-controls', `feature-screen-${index}`);
      screenStack.append(featureScreens[index]);
    } else {
      for (const attribute of ['tabindex', 'role', 'aria-labelledby', 'aria-controls', 'aria-pressed']) feature.removeAttribute(attribute);
      $('.feature-mobile-preview', feature).append(featureScreens[index]);
    }
  });
  showFeature('0');
  scheduleFeatureSync();
}
desktopFeatures.addEventListener('change', layoutFeatureScreens);
window.addEventListener('scroll', scheduleFeatureSync, { passive: true });
window.addEventListener('resize', scheduleFeatureSync);
layoutFeatureScreens();

function publicUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; }
  catch { return ''; }
}
$$('[data-store]').forEach(badge => {
  const url = publicUrl(siteConfig.downloads[badge.dataset.store]);
  if (!url) return;
  badge.href = url;
  badge.removeAttribute('aria-disabled');
  badge.setAttribute('aria-label', badge.dataset.store === 'ios' ? 'Descargar en App Store' : 'Descargar en Google Play');
  $('.store-pending', badge).remove();
});
const activeStores = Object.values(siteConfig.downloads).filter(publicUrl).length;
if (activeStores) {
  $('.download-note').textContent = activeStores === 2 ? 'Disponible para iOS y Android.' : 'La otra versión estará disponible próximamente.';
  const faq = $$('.faq-item').at(-1);
  $('p', faq).textContent = 'Usa los botones de descarga de esta página para acceder a las versiones disponibles. Si un botón indica «Pronto», esa versión todavía no está disponible.';
}

const contactForm = $('#contact-form');
const contactSubmit = $('button[type="submit"]', contactForm);
const contactStatus = $('#contact-status');
contactForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!contactForm.reportValidity()) return;
  contactSubmit.disabled = true;
  contactSubmit.textContent = 'Enviando…';
  contactStatus.textContent = 'Estamos enviando tu mensaje…';
  try {
    const response = await fetch(contactForm.action, {
      method: 'POST',
      body: new FormData(contactForm),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('Formspree rechazó el envío');
    contactForm.reset();
    contactStatus.textContent = '¡Gracias! Recibimos tu mensaje y te responderemos pronto.';
  } catch {
    contactStatus.textContent = 'No pudimos enviar tu mensaje. Inténtalo de nuevo en unos minutos.';
  } finally {
    contactSubmit.disabled = false;
    contactSubmit.textContent = 'Enviar mensaje';
  }
});

if (/^\d{8,15}$/.test(siteConfig.contact.whatsapp)) {
  const link = document.createElement('a');link.href = `https://wa.me/${siteConfig.contact.whatsapp}`;link.textContent = 'Escríbenos por WhatsApp';
  $('[data-contact="whatsapp"] span:last-child').replaceWith(link);
}
const legalKeys = { 'Términos': 'terms', 'Privacidad': 'privacy', 'Cookies': 'cookies' };
$$('[data-legal]').forEach(item => {
  const url = publicUrl(siteConfig.legal[legalKeys[item.dataset.legal]]);
  if (!url) return;
  const link = document.createElement('a');link.href = url;link.textContent = item.dataset.legal;item.replaceWith(link);
});
const imageAlts = {
  '01': 'Vista de partidos en la app YoinIt', '02': 'Buscador de clubes de ejemplo en YoinIt',
  '03': 'Crear un partido en tu cancha', '04': 'Invitar jugadores al partido',
  '05': 'Perfil de jugador en YoinIt', '06': 'Concepto de pago individual, función futura',
  '07': 'Retrato ilustrativo de una jugadora de pádel', '08': 'Cuatro jugadores al terminar un partido de pádel',
  '09': 'Vista previa de la agenda del club', '10': 'Vista previa del seguimiento de pagos',
  '11': 'Panel de un club en un teléfono',
};
$$('[data-image]').forEach(slot => {
  const path = siteConfig.images[slot.dataset.image];
  if (!path) return;
  const image = new Image();image.alt = imageAlts[slot.dataset.image];
  image.loading = slot.dataset.image === '01' ? 'eager' : 'lazy';
  image.addEventListener('load', () => slot.classList.add('has-image'));
  image.addEventListener('error', () => image.remove());
  image.src = path;slot.append(image);
});
