// Роутинг по hash, инициализация.
import { renderScreen, navHtml, topHtml } from './ui/kit.js';
import { getSettings } from './store.js';

const ROUTES = {
  '': () => import('./ui/main.js'),
  taper: () => import('./ui/taper.js'),
  chamfer: () => import('./ui/chamfer.js'),
  thread: () => import('./ui/thread.js'),
  modes: () => import('./ui/modes.js'),
  nose: () => import('./ui/nose.js'),
  bolt: () => import('./ui/bolt.js'),
  tangent: () => import('./ui/tangent.js'),
  transform: () => import('./ui/transform.js'),
  pocket: () => import('./ui/pocket.js'),
  facing: () => import('./ui/facing.js'),
  millmodes: () => import('./ui/millmodes.js'),
  macros: () => import('./ui/macros.js'),
  program: () => import('./ui/program.js'),
  groove: () => import('./ui/groove.js'),
  drill: () => import('./ui/drill.js'),
  tolerance: () => import('./ui/tolerance.js'),
  importcheck: () => import('./ui/importcheck.js'),
  library: () => import('./ui/library.js'),
  probing: () => import('./ui/probing.js'),
  threadmill: () => import('./ui/threadmill.js'),
  contour: () => import('./ui/contour.js'),
  backplot: () => import('./ui/backplot.js'),
  backplotmf: () => import('./ui/backplot.js'),
  settings: () => import('./ui/settings.js'),
};

const app = document.getElementById('app');

// Кнопка «Установить» (Chrome/Android): событие приходит только на https или localhost
let installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; document.querySelectorAll('[data-install]').forEach((b) => { b.hidden = false; }); });
window.addEventListener('click', (e) => {
  if (e.target.closest('[data-install]') && installEvt) { installEvt.prompt(); installEvt = null; document.querySelectorAll('[data-install]').forEach((b) => { b.hidden = true; }); }
});
window.addEventListener('appinstalled', () => { installEvt = null; });
export const canInstall = () => !!installEvt;

async function route() {
  const key = location.hash.replace(/^#\/?/, '').split('?')[0];
  const ctx = { settings: getSettings(), rerender: route };
  // каждый экран получает свежий контейнер, старые слушатели уходят вместе с ним
  const host = document.createElement('div');
  host.style.cssText = 'flex:1;display:flex;flex-direction:column;min-width:0';
  app.replaceChildren(host);
  const loader = ROUTES[key];
  if (!loader) {
    host.innerHTML = `${topHtml('Не найдено')}<div class="page"><div class="note info">Экрана «${key.replace(/[<>&"]/g, '')}» нет.</div></div>${navHtml('#/')}`;
    return;
  }
  try {
    const mod = (await loader()).default;
    if (mod.render) mod.render(host, ctx);
    else renderScreen(host, mod, ctx);
  } catch (e) {
    host.innerHTML = `${topHtml('Ошибка')}<div class="page"><div class="note bad">${String(e.message).replace(/[<>&]/g, '')}</div></div>`;
  }
  if (installEvt) host.querySelectorAll('[data-install]').forEach((b) => { b.hidden = false; });
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* офлайн недоступен (например, file://) */ });
}
