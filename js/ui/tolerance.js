import { parseTol, tolerance, programSize, fitWithBase } from '../core/tolerance.js';
import { LETTERS, GRADES } from '../data/iso286.js';
import { fmt, word } from '../gcode/format.js';
import { wrap } from './sketch.js';
import { toast, go } from './kit.js';
import * as store from '../store.js';

function fieldSketch(t) {
  const sc = 120 / Math.max(Math.abs(t.es - t.ei) * 4, 0.001);
  const y0 = 80, up = (v) => y0 - (v - 0) * sc * 1; // отклонения от номинала
  const top = up(t.es), bot = up(t.ei);
  return wrap(340, 160, `<line x1="30" y1="${y0}" x2="320" y2="${y0}" stroke="#9AA4B1" stroke-dasharray="6 3"/><text x="34" y="${y0 - 6}" fill="#9AA4B1" font-size="11" font-family="monospace">номинал</text>`
    + `<rect x="130" y="${Math.min(top, bot)}" width="80" height="${Math.max(Math.abs(bot - top), 2)}" fill="#6FB3FF" fill-opacity=".35" stroke="#6FB3FF"/>`
    + `<text x="220" y="${top + 4}" fill="#ECEFF3" font-size="12" font-family="monospace">${fmt(t.es, 4)}</text><text x="220" y="${bot + 4}" fill="#ECEFF3" font-size="12" font-family="monospace">${fmt(t.ei, 4)}</text>`, 'Поле допуска');
}

export function calc(p, s) {
  const dec = s.decimals;
  const pt = parseTol(p.text);
  if (pt.error) return { err: pt.error };
  const t = tolerance(pt);
  if (t.error) return { err: t.error, warn: t.noData ? ['Таблица ISO 286 заполняется только из стандарта (TODO_DATA.md). Значения вручную не подставляются.'] : [] };
  const pick = p.pick || 'mid';
  const size = programSize(t, pick);
  const fit = fitWithBase(pt.size, t, pt.grade);
  const f4 = (n) => (n >= 0 ? '+' : '') + fmt(n, 4).replace(/^(-?)0?\./, '$1.').replace(/^(\+?)\./, '$10.');
  const sg = (n) => (n > 0 ? '+' : '') + fmt(n, 4);
  const res = [
    ['Тип', pt.kind === 'shaft' ? 'вал' : 'отверстие'], ['Квалитет IT' + pt.grade, fmt(t.it, 4)],
    ['Верхнее отклонение', sg(t.es)], ['Нижнее отклонение', sg(t.ei)], ['Наибольший размер', fmt(t.max, 4)], ['Наименьший размер', fmt(t.min, 4)], ['Середина', fmt(t.mid, 5)],
  ];
  if (fit) res.push(['Посадка с основной парой', `${fit.type}: ${fmt(fit.min, 4)} … ${fmt(fit.max, 4)}`]);
  const label = pick === 'max' ? 'верх' : pick === 'min' ? 'низ' : 'середина';
  res.push([`Размер для программы (${label})`, word('X', size, dec)]);
  void f4;
  return {
    results: res, code: [word('X', size, dec)], tag: 'X', title: `Допуск ${p.text.trim()}`, sketch: fieldSketch(t), progSize: size,
    extra: `<div class="btns"><button class="btn" type="button" data-act="x:contour">В контур</button></div>`,
  };
}

export default {
  id: 'tolerance', title: 'Допуски ISO', cat: 'geo', tag: 'X',
  defaults: { text: '20 h7', pick: 'mid' },
  form: [
    { type: 'text', k: 'text', label: 'Размер и поле, например 20 h7 / Ø50 H7', full: true },
    { type: 'chips', id: 'letters', options: LETTERS, apply: (v, l) => { const m = String(v.text).match(/^(D*d+(?:[.,]d+)?)s*([A-Za-z]{1,2})(d{1,2})$/); const up = m && m[2] === m[2].toUpperCase(); v.text = (m ? m[1] : String(v.text).trim()) + ' ' + (up ? l.toUpperCase() : l) + (m ? m[3] : '7'); }, fmt: (l) => l },
    { type: 'chips', id: 'grades', options: GRADES.map(String), apply: (v, g) => { const m = String(v.text).match(/^(.*d)s*([A-Za-z]{1,2})d{0,2}$/); v.text = m ? m[1] + ' ' + m[2] + g : String(v.text).trim() + ' h' + g; }, fmt: (g) => 'IT' + g },
    { type: 'seg', k: 'pick', options: [['max', 'Верх'], ['mid', 'Середина'], ['min', 'Низ']] },
    { type: 'note', text: 'В таблице пока только значения, проверенные тестами ТЗ (20 h7/H7, 50 g6, 10 js7). Для остальных размеров — «нет данных для этого размера».' },
  ],
  letters: LETTERS, grades: GRADES,
  calc,
  onAct(act, { r, ctx }) {
    if (act !== 'contour' || !r || r.progSize === undefined) return;
    const cell = store.load('cell', { r: 0, c: 'd' });
    const v = store.getScreenValues('contour') || {};
    const rows = v.rows || [{ d: '20', z: '0', tag: 'C1' }, { d: '20', z: '-15', tag: '' }, { d: '30', z: '-15', tag: 'R0.5' }, { d: '30', z: '-40', tag: '' }, { d: '42', z: '-40', tag: '' }];
    const row = rows[Math.min(cell.r, rows.length - 1)];
    row[cell.c === 'z' ? 'z' : 'd'] = String(Math.round(r.progSize * 1e4) / 1e4);
    store.setScreenValues('contour', { ...v, rows });
    toast(`Подставлено в точку ${cell.r + 1}`);
    go('#/contour');
    void ctx;
  },
};
