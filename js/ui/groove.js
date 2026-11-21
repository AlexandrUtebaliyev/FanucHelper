import { g75Lines } from '../gcode/cycles.js';
import { fmt } from '../gcode/format.js';
import { wrap } from './sketch.js';
import { nn } from './kit.js';

function sketch(p) {
  if (![p.d0, p.dBottom, p.grooveW, p.width].every(nn)) return wrap(340, 130, '');
  const sc = Math.min(200 / Math.max(p.grooveW * 2, 1), 60 / Math.max(p.d0 / 2, 1));
  const x0 = 90, y0 = 100, gw = p.grooveW * sc, depth = ((p.d0 - p.dBottom) / 2) * sc;
  return wrap(340, 130, `<line x1="10" y1="${y0}" x2="330" y2="${y0}" stroke="#3A414B" stroke-dasharray="8 4 2 4"/>
    <path d="M20 ${y0 - 60} L${x0} ${y0 - 60} L${x0} ${y0 - 60 + depth} L${x0 + gw} ${y0 - 60 + depth} L${x0 + gw} ${y0 - 60} L320 ${y0 - 60}" fill="none" stroke="#ECEFF3" stroke-width="2"/>
    <rect x="${p.anchor === 'left' ? x0 : x0 + gw - p.width * sc}" y="${y0 - 76}" width="${p.width * sc}" height="${depth + 10}" fill="#F5A524" fill-opacity=".35" stroke="#F5A524"/>`, 'Эскиз канавки');
}

export function calc(p, s) {
  const dec = s.decimals;
  const anchor = p.anchor || s.anchor;
  let code = [], err = null;
  try {
    code = g75Lines({ gsys: s.gsys, dec, width: p.width, d0: p.d0, dBottom: p.dBottom, z: p.z, grooveW: p.grooveW, dI: p.dI, dK: p.dK, e: p.e, f: p.f, anchor, relief: nn(p.relief) ? p.relief : 0 });
  } catch (e) { err = e.message; }
  const res = [['Точка привязки', anchor === 'left' ? 'левая кромка' : 'правая кромка'], ['Глубина канавки (на радиус)', fmt((p.d0 - p.dBottom) / 2, dec)]];
  return { err, results: res, code, tag: 'G75', title: `Канавка Ø${fmt(p.dBottom, 3)}, ширина ${fmt(p.grooveW, 3)}`, sketch: sketch({ ...p, anchor }), warn: ['Δi и Δk выводятся целыми в микронах. Привязку по кромке пластины проверьте в коррекции инструмента.'] };
}

export default {
  id: 'groove', title: 'Канавка / отрезка', cat: 'cyc', tag: 'G75',
  defaults: { width: '3', d0: '40', dBottom: '34', z: '-20', grooveW: '8', dI: '1.5', dK: '2.5', e: '0.5', relief: '0', f: '0.08', anchor: 'left' },
  form: [
    { type: 'num', k: 'width', label: 'Ширина пластины', unit: 'мм' },
    { type: 'num', k: 'd0', label: 'Ø начала', unit: 'мм' },
    { type: 'num', k: 'dBottom', label: 'Ø дна канавки', unit: 'мм' },
    { type: 'num', k: 'z', label: 'Z правого края канавки', unit: 'мм' },
    { type: 'num', k: 'grooveW', label: 'Ширина канавки', unit: 'мм' },
    { type: 'num', k: 'dI', label: 'Врезание за клюв Δi (радиус)', unit: 'мм' },
    { type: 'num', k: 'dK', label: 'Шаг по Z Δk', unit: 'мм' },
    { type: 'num', k: 'e', label: 'Отвод e', unit: 'мм' },
    { type: 'num', k: 'relief', label: 'Отвод на дне Δd (только 0)', unit: 'мм' },
    { type: 'num', k: 'f', label: 'Подача F', unit: 'мм/об' },
    { type: 'seg', k: 'anchor', options: [['left', 'Привязка слева'], ['right', 'Привязка справа']] },
  ],
  calc,
};
