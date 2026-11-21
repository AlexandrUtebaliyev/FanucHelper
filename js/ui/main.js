import { navHtml, disclaimerHtml, CATS } from './kit.js';
import { esc } from './highlight.js';
import * as store from '../store.js';
import { profileOf, findModule } from '../profiles/index.js';

const COLOR = { geo: '#6FB3FF', cyc: '#F5A524', mode: '#5FD08A', mac: '#B79CFF', set: '#5FD3D3' };
const icon = (inner, cat) => `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${COLOR[cat]}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export function render(root, ctx) {
  const s = ctx.settings;
  const prof = profileOf(s.profile);
  const recent = store.getRecent().filter((r) => findModule(r.screen));
  const favs = store.getFavs().filter((r) => findModule(r.screen));
  const recRow = (r, i, kind) => `<a class="rec" href="#/${r.screen}" data-restore="${kind}:${i}"><span class="badge ${r.cat}">${esc(r.tag || '•')}</span><span style="flex:1;font-size:15px">${esc(r.title)}</span></a>`;
  root.innerHTML = `
  <header style="display:flex;align-items:flex-end;justify-content:space-between;padding:24px 20px 12px">
    <div>
      <div style="display:inline-flex;gap:2px;padding:2px;background:#0E1013;border:1px solid #2C323A;border-radius:8px;font:600 12px var(--mono)">
        ${['TF', 'MF'].map((id) => `<button type="button" data-prof="${id}" style="min-height:40px;padding:6px 12px;border:0;border-radius:6px;background:${s.profile === id ? '#F5A524' : 'transparent'};color:${s.profile === id ? '#141210' : '#C7CED8'};font:inherit">0i-${id}</button>`).join('')}
      </div>
      <h1 style="margin:6px 0 0;font-size:26px;font-weight:700;letter-spacing:-0.01em">Стоечный помощник</h1>
    </div>
    <a href="#/settings" aria-label="Настройки" style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;border:1px solid #2C323A;border-radius:12px;color:#ECEFF3"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/></svg></a>
  </header>
  <div aria-label="Категории" style="display:flex;flex-wrap:wrap;gap:14px;padding:0 20px 10px;font-size:12px;color:#C7CED8">
    ${Object.entries(CATS).filter(([k]) => prof.modules.some((m) => m.cat === k)).map(([k, n]) => `<span style="display:flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:3px;background:${COLOR[k]}"></span>${n}</span>`).join('')}
  </div>
  <nav class="tiles" aria-label="Модули" style="padding:4px 20px 20px">
    ${prof.modules.map((m) => `<a class="tile" href="#/${m.id}">${icon(m.icon, m.cat)}<b>${esc(m.title)}</b><span>${esc(m.sub)}</span></a>`).join('')}
  </nav>
  ${favs.length ? `<section style="padding:0 20px 16px"><h2 class="h2">Избранное</h2><div class="grp">${favs.map((r, i) => recRow(r, i, 'fav')).join('')}</div></section>` : ''}
  <section style="padding:0 20px"><h2 class="h2">Последние расчёты</h2>
    <div class="grp">${recent.length ? recent.slice(0, 6).map((r, i) => recRow(r, i, 'rec')).join('') : '<div class="rec" style="color:#9AA4B1;font-size:14px">Пока пусто — расчёты появятся здесь после «Копировать» или «В программу»</div>'}</div>
  </section>
  <section style="padding:0 20px"><button type="button" class="btn" data-install hidden style="width:100%">Установить приложение на устройство</button></section>
  <section style="padding:20px">${disclaimerHtml()}</section>
  <div style="flex:1"></div>
  ${navHtml('#/')}`;
  root.onclick = (e) => {
    const p = e.target.closest('[data-prof]');
    if (p) { store.setSettings({ profile: p.dataset.prof }); ctx.rerender(); return; }
    const r = e.target.closest('[data-restore]');
    if (r) {
      const [kind, i] = r.dataset.restore.split(':');
      const item = (kind === 'fav' ? favs : recent)[+i];
      if (item && item.values) store.setScreenValues(item.screen, item.values);
    }
  };
}
export default { id: 'main', render };
