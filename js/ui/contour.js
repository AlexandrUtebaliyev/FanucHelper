// Конструктор контура → G71 / G70 / G72 / G73 (п. 3.6)
import { topHtml, navHtml, codeSection, resultsHtml, actionHandlers, segHtml, parseValues, nn } from './kit.js';
import { esc } from './highlight.js';
import { parseNum, fmt } from '../gcode/format.js';
import { roughingLines } from '../gcode/cycles.js';
import { buildContour, checkMonotonic, reverseSegs } from '../core/contour.js';
import { compensateContour } from '../core/noseRadius.js';
import { profileSketch } from './sketch.js';
import * as store from '../store.js';

const ID = 'contour';
const DEF = { id: ID, title: 'Контур', cat: 'cyc', tag: 'G71' };
const DEFAULTS = {
  rows: [
    { d: '20', z: '0', tag: 'C1' }, { d: '20', z: '-15', tag: '' }, { d: '30', z: '-15', tag: 'R0.5' }, { d: '30', z: '-40', tag: '' }, { d: '42', z: '-40', tag: '' },
  ],
  cycle: 'G71', side: 'ext', dd: '1.5', e: '0.5', blank: '42', u: '0.4', w: '0.1', fr: '0.25', ff: '0.1', ns: '10', nf: '60', zApp: '2', comp: false, r: '0.8', tip: '3',
};
const PARAMS = [
  ['dd', 'Δd, на сторону'], ['e', 'Отвод e'], ['blank', 'Ø заготовки'], ['u', 'Припуск Δu (Ø)'], ['w', 'Припуск Δw'], ['zApp', 'Z подхода'],
  ['fr', 'F черновая'], ['ff', 'F чистовая'], ['ns', 'N начала'], ['nf', 'N конца'],
];

export function calcContour(v, s) {
  const rows = v.rows.map((r) => ({ d: parseNum(r.d), z: parseNum(r.z), tag: r.tag }));
  const P = (k) => parseNum(v[k]);
  const built = buildContour(rows, { holder: s.holder, side: v.side });
  const out = { warn: [], ok: [] };
  if (built.errors.length) { out.err = built.errors[0]; return out; }
  const stockR = nn(P('blank')) ? P('blank') / 2 : null;
  out.sketch = profileSketch(built.segs, { stockR, pts: rows.map((r) => ({ x: r.z, y: r.d / 2 })) });
  const mono = checkMonotonic(v.cycle === 'G72' ? reverseSegs(built.segs) : built.segs, { mode: v.cycle === 'G72' ? 'G72' : 'G71', side: v.side });
  if (v.cycle !== 'G73') {
    if (mono.ok) out.ok.push(`Профиль монотонный — подходит для ${v.cycle} тип I`);
    else out.warn.push(`${mono.issues[0].text}. Выберите G73 — для карманов G71/G72 не подходят.`);
  }
  let transform = null;
  if (v.comp) {
    const r = P('r');
    transform = (segs) => {
      const c = compensateContour(segs, { r, tip: parseInt(v.tip, 10), side: v.side === 'int' ? 'left' : 'right' });
      if (c.error) throw new Error(c.error);
      return c.segs;
    };
    out.warn.push(`Ручная компенсация r${fmt(r, 2)} T${v.tip} включена: в G70/G71 идут координаты воображаемой вершины. G41/G42 не использовать.`);
  }
  try {
    const g = roughingLines({
      gsys: s.gsys, dec: s.decimals, holder: s.holder, rows, cycle: v.cycle, side: v.side, dd: P('dd'), e: P('e'), u: P('u'), w: P('w'),
      fRough: P('fr'), fFinish: P('ff'), blank: P('blank'), ns: P('ns'), nf: P('nf'), zApproach: nn(P('zApp')) ? P('zApp') : 2, transform,
    });
    out.code = g.lines;
    out.warn.push(...g.warn);
    out.stock = { d: P('blank'), zFace: 0 };
    out.title = `Контур, ${rows.length} точек, ${v.cycle}`;
    out.tag = v.cycle;
    const minZ = Math.min(...rows.map((r) => r.z));
    out.results = [['Сегментов контура', String(built.segs.length)], ['Длина по Z', fmt(Math.max(...rows.map((r) => r.z)) - minZ, 3)]];
  } catch (e) { out.err = e.message; }
  return out;
}

export function render(root, ctx) {
  const s = ctx.settings;
  const saved = store.getScreenValues(ID);
  const v = { ...DEFAULTS, ...(saved || {}), rows: (saved && saved.rows) || DEFAULTS.rows.map((r) => ({ ...r })) };
  let r = {};
  root.innerHTML = `${topHtml('Контур', v.cycle + ' · тип I', 'cyc')}<div class="page" style="gap:12px">
    <div id="sk"></div><div id="tb"></div><div id="pr"></div><div id="rs" style="display:flex;flex-direction:column;gap:14px"></div></div>${navHtml('#/')}`;
  const $ = (q) => root.querySelector(q);
  const save = () => store.setScreenValues(ID, v);
  const drawTable = () => {
    $('#tb').innerHTML = `<section class="card" style="overflow:hidden"><table class="tbl"><thead><tr><th style="width:28px">№</th><th>Ø X</th><th>Z</th><th>Угол / дуга</th></tr></thead><tbody>
      ${v.rows.map((row, i) => `<tr><td style="padding-left:8px;color:#9AA4B1">${i + 1}</td><td><input data-r="${i}" data-c="d" inputmode="decimal" aria-label="Ø точки ${i + 1}" value="${esc(row.d)}"></td><td><input data-r="${i}" data-c="z" inputmode="decimal" aria-label="Z точки ${i + 1}" value="${esc(row.z)}"></td><td><input data-r="${i}" data-c="tag" aria-label="Угол точки ${i + 1}" placeholder="C1 / R0.5 / G03 R5" value="${esc(row.tag)}"></td></tr>`).join('')}</tbody></table>
      <div style="display:flex"><button type="button" data-add class="btn sm" style="border:0;border-top:1px solid #2C323A;border-radius:0;background:#16191D;color:#F5A524">+ Добавить точку</button><button type="button" data-del class="btn sm" style="border:0;border-top:1px solid #2C323A;border-left:1px solid #2C323A;border-radius:0;background:#16191D;color:#FF8A8A">− Убрать последнюю</button></div></section>
      <div class="hint" style="margin-top:6px">Точки слева направо: от торца к патрону. Ø и Z — размеры вершины. «C1» — фаска, «R0.5» — скругление угла, «G03 R5» — дуга к следующей точке.</div>`;
  };
  const drawParams = () => {
    $('#pr').innerHTML = `<div style="display:flex;flex-direction:column;gap:12px">
      ${segHtml({ k: 'cycle', options: [['G71', 'G71'], ['G72', 'G72 (торец)'], ['G73', 'G73']] }, v)}
      ${segHtml({ k: 'side', options: [['ext', 'Наружный'], ['int', 'Внутренний']] }, v)}
      <div class="mini">${PARAMS.map(([k, l]) => `<label>${l}<input data-p="${k}" inputmode="decimal" value="${esc(v[k])}"></label>`).join('')}</div>
      <div><button type="button" class="tg ${v.comp ? 'on' : ''}" data-comp>Компенсация r пластины (вручную)</button></div>
      ${v.comp ? `<div class="mini" style="grid-template-columns:repeat(2,minmax(0,1fr))"><label>Радиус r<input data-p="r" inputmode="decimal" value="${esc(v.r)}"></label><label>Вершина T<input data-p="tip" inputmode="numeric" value="${esc(v.tip)}"></label></div>` : ''}</div>`;
  };
  const drawResult = () => {
    try { r = calcContour(v, s); } catch (e) { r = { err: e.message }; }
    $('#sk').innerHTML = r.sketch ? `<div class="card sketch">${r.sketch}</div>` : '';
    $('#rs').innerHTML = resultsHtml(r) + (r.err ? '' : codeSection(r.code));
  };
  const act = actionHandlers(DEF, ctx, () => ({ r, v }));
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.r !== undefined) v.rows[+t.dataset.r][t.dataset.c] = t.value;
    else if (t.dataset.p) v[t.dataset.p] = t.value;
    else return;
    save(); drawResult();
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-seg],[data-add],[data-del],[data-comp],[data-act]');
    if (!b) return;
    if (b.dataset.seg) { v[b.dataset.seg] = b.dataset.v; save(); drawParams(); drawResult(); }
    else if (b.dataset.add !== undefined) { const last = v.rows[v.rows.length - 1]; v.rows.push({ d: last ? last.d : '', z: last ? last.z : '', tag: '' }); save(); drawTable(); drawResult(); }
    else if (b.dataset.del !== undefined) { if (v.rows.length > 2) v.rows.pop(); save(); drawTable(); drawResult(); }
    else if (b.dataset.comp !== undefined) { v.comp = !v.comp; save(); drawParams(); drawResult(); }
    else if (b.dataset.act) act(b.dataset.act);
  });
  drawTable(); drawParams(); drawResult();
  void parseValues;
}
export default { id: ID, render };
