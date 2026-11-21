import { topHtml, navHtml, copyText, ICONS } from './kit.js';
import { highlight, esc } from './highlight.js';
import { MACROS, MACRO_WARN } from '../data/macros.js';

export function render(root) {
  root.innerHTML = `${topHtml('Макросы G65', 'Custom Macro B', 'mac')}<div class="page">
    <div class="note warn"><div>${MACRO_WARN.map((w) => `<div>• ${esc(w)}</div>`).join('')}</div></div>
    ${MACROS.map((m, i) => `<section class="grp" style="padding-bottom:12px">
      <div class="it" style="border-bottom:0"><div class="x"><b><span class="mono" style="color:#F5A524">${m.id}</span> ${esc(m.title)}</b><span>вызов через G65 P${m.id.slice(1)}</span></div></div>
      <div style="display:grid;grid-template-columns:36px 1fr;gap:4px 10px;padding:0 14px 10px;font-size:13px;color:#C7CED8">${m.args.map(([a, d]) => `<b class="mono" style="color:#ECEFF3">${a}</b><span>${esc(d)}</span>`).join('')}</div>
      <div style="padding:0 14px 6px"><h2 class="h2">Пример вызова</h2><div class="code" style="padding:8px 10px">${highlight([m.example])}</div></div>
      <div style="padding:6px 14px"><h2 class="h2">Текст макроса</h2><div class="code" style="font-size:13px;line-height:1.6">${highlight(m.lines)}</div></div>
      <div class="btns" style="padding:6px 14px 0"><button class="btn sm" type="button" data-copy="${i}">${ICONS.copy}Копировать макрос</button><button class="btn sm" type="button" data-copyex="${i}">${ICONS.copy}Копировать вызов</button></div>
    </section>`).join('')}
  </div>${navHtml('#/')}`;
  root.onclick = (e) => {
    const b = e.target.closest('[data-copy],[data-copyex]');
    if (!b) return;
    if (b.dataset.copy !== undefined) copyText(MACROS[+b.dataset.copy].lines.join('\n'));
    else copyText(MACROS[+b.dataset.copyex].example);
  };
}
export default { id: 'macros', render };
