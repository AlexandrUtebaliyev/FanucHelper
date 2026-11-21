import { navHtml, topHtml, segHtml, toast } from './kit.js';
import { esc } from './highlight.js';
import { parseNum } from '../gcode/format.js';
import * as store from '../store.js';

const seg = (k, options, v) => segHtml({ k, options }, { [k]: v });
const item = (title, sub, control) => `<div class="it"><div class="x"><b>${title}</b><span>${sub}</span></div>${control}</div>`;
const numInput = (k, val, w = 110) => `<input class="inp" data-num="${k}" inputmode="decimal" value="${esc(val ?? '')}" style="width:${w}px;text-align:right">`;

export function render(root, ctx) {
  const s = store.getSettings();
  const mf = s.profile === 'MF';
  root.innerHTML = `${topHtml('Настройки', mf ? '0i-MF' : `0i-TF · ${s.gsys}`, 'gray')}
  <div class="page" style="gap:18px">
    <section><h2 class="h2">Профиль</h2><div class="grp">
      ${item('Станок', 'Набор модулей и правила генератора', seg('profile', [['TF', '0i-TF'], ['MF', '0i-MF']], s.profile))}
    </div></section>
    <section><h2 class="h2">Стойка</h2><div class="grp">
      ${item('Система G-кодов', 'A: G90 — цикл точения, U/W — приращения. B/C: циклы пока не выводятся', seg('gsys', [['A', 'A'], ['B', 'B'], ['C', 'C']], s.gsys))}
      ${item('Резцедержатель', 'Влияет на G02/G03 и эскизы', seg('holder', [['rear', 'Задний'], ['front', 'Передний']], s.holder))}
      ${item('Подача по умолчанию', 'TF: мм/об G99 или мм/мин G98', seg('feedMode', [['G99', 'G99'], ['G98', 'G98']], s.feedMode))}
      ${item('Граница патрона по Z', 'Отрицательное число, мм. Пусто — не проверять', numInput('chuckZ', s.chuckZ ?? ''))}
      ${item('Предел оборотов', 'об/мин, для G50', numInput('spindleMax', s.spindleMax))}
      ${item('Точка привязки канавочного', 'G75: левая или правая кромка', seg('anchor', [['left', 'Левая'], ['right', 'Правая']], s.anchor))}
    </div></section>
    <section><h2 class="h2">Вывод G-кода</h2><div class="grp">
      ${item('Знаков после точки', 'X25.123 · хвостовые нули убираются', seg('decimals', [['2', '2'], ['3', '3'], ['4', '4']], String(s.decimals)))}
      ${item('Номер программы', 'O-номер по умолчанию', numInput('progNo', s.progNo, 90))}
      ${item('Нумерация кадров N', 'Номера контуров G71 не затрагиваются', `<button type="button" class="tg ${s.numbering ? 'on' : ''}" data-tog="numbering">${s.numbering ? 'Вкл' : 'Выкл'}</button>`)}
      ${item('Шаг нумерации', '', numInput('numStep', s.numStep, 80))}
      ${item(mf ? 'G28 X0 Y0 в концовке' : 'G28 U0 W0 в шапке', 'Опционально', `<button type="button" class="tg ${s.refTrim ? 'on' : ''}" data-tog="refTrim">${s.refTrim ? 'Вкл' : 'Выкл'}</button>`)}
    </div></section>
    <section>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><h2 class="h2" style="margin:0">Инструменты</h2></div>
      <div class="grp">${s.tools.length ? s.tools.map((t, i) => `<div class="it"><div class="x"><b><span class="mono" style="color:#F5A524">T${esc(t.t)}</span> ${esc(t.name)}</b><span>r ${esc(t.r)} · T${esc(t.tip)} · ${esc(t.type)}</span></div><button type="button" class="ib" data-deltool="${i}" aria-label="Удалить">×</button></div>`).join('') : '<div class="it"><div class="x"><span>Библиотека пуста</span></div></div>'}</div>
      <div class="card pad" style="margin-top:10px"><div class="mini" style="grid-template-columns:repeat(2,minmax(0,1fr))">
        <label>Номер T (0101)<input id="tn" inputmode="numeric"></label><label>Название<input id="tname" class="inp"></label>
        <label>Радиус r<input id="tr" inputmode="decimal"></label><label>Направление вершины (1–4, 9)<input id="ttip" inputmode="numeric"></label>
        <label>Тип<select id="ttype"><option>проходной</option><option>резьбовой</option><option>канавочный</option><option>расточной</option><option>сверло</option><option>фреза</option></select></label>
      </div><button type="button" class="btn sm" id="addtool" style="margin-top:10px;width:100%">+ Добавить инструмент</button></div>
    </section>
    <section><h2 class="h2">Резервная копия</h2><div class="btns">
      <button class="btn sm" type="button" id="exp">Экспорт .json</button>
      <label class="btn sm" style="cursor:pointer">Импорт .json<input type="file" id="imp" accept=".json,application/json" hidden></label></div></section>
    <p style="margin:0;font-size:12px;line-height:1.5;color:#9AA4B1">Настройки и библиотека хранятся на этом устройстве.</p>
  </div>${navHtml('#/settings')}`;
  const redo = () => ctx.rerender();
  root.onclick = (e) => {
    const b = e.target.closest('[data-seg],[data-tog],[data-deltool],#addtool,#exp');
    if (!b) return;
    if (b.dataset.seg) {
      const k = b.dataset.seg;
      const val = k === 'decimals' ? +b.dataset.v : b.dataset.v;
      store.setSettings({ [k]: val });
      redo();
    } else if (b.dataset.tog) { store.setSettings({ [b.dataset.tog]: !s[b.dataset.tog] }); redo(); }
    else if (b.dataset.deltool) { const t = s.tools.slice(); t.splice(+b.dataset.deltool, 1); store.setSettings({ tools: t }); redo(); }
    else if (b.id === 'addtool') {
      const q = (id) => root.querySelector('#' + id).value;
      const tip = parseInt(q('ttip'), 10);
      if (!q('tn')) { toast('Укажите номер T'); return; }
      if (![1, 2, 3, 4, 9].includes(tip) && q('ttip') !== '') { toast('Направление вершины: 1–4 или 9 (5–8 — нет данных)'); return; }
      store.setSettings({ tools: [...s.tools, { t: q('tn'), name: q('tname'), r: q('tr'), tip: q('ttip') || '3', type: q('ttype') }] });
      redo();
    } else if (b.id === 'exp') {
      const data = {};
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('fh.')) data[k] = localStorage.getItem(k); } } catch { /* нет доступа */ }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
      a.download = 'fanuc-helper-backup.json';
      a.click();
    }
  };
  root.onchange = async (e) => {
    const n = e.target.dataset && e.target.dataset.num;
    if (n) {
      const v = parseNum(e.target.value);
      store.setSettings({ [n]: Number.isFinite(v) ? v : (n === 'chuckZ' ? null : s[n]) });
      toast('Сохранено');
    }
    if (e.target.id === 'imp' && e.target.files[0]) {
      try {
        const data = JSON.parse(await e.target.files[0].text());
        for (const [k, val] of Object.entries(data)) if (k.startsWith('fh.')) localStorage.setItem(k, val);
        toast('Импортировано');
        redo();
      } catch { toast('Файл не подходит'); }
    }
  };
}
export default { id: 'settings', render };
