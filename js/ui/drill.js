import { g74Lines } from '../gcode/cycles.js';
import { fmt } from '../gcode/format.js';
import { wrap } from './sketch.js';
import { nn } from './kit.js';

export function calc(p, s) {
  const dec = s.decimals;
  let code = [], err = null;
  try {
    code = g74Lines({ gsys: s.gsys, dec, D: p.D, depth: p.depth, peck: p.peck, e: p.e, f: p.f, vc: p.vc, rpm: nn(p.rpm) ? p.rpm : undefined });
  } catch (e) { err = e.message; }
  const tip = nn(p.D) ? 0.3 * p.D : NaN;
  const res = [['Заборный конус 0.3·D (118°)', fmt(tip, dec)], ['Конечный Z (с конусом)', nn(p.depth) ? fmt(-(p.depth + tip), dec) : '—']];
  const sketch = wrap(340, 120, `<line x1="10" y1="60" x2="330" y2="60" stroke="#3A414B" stroke-dasharray="8 4 2 4"/><path d="M120 30 H250 V90 H120" fill="none" stroke="#ECEFF3" stroke-width="2"/><path d="M250 54 H130 L120 60 L130 66 H250" fill="#F5A524" fill-opacity=".3" stroke="#F5A524"/>`, 'Эскиз сверления');
  return { err, results: res, code, tag: 'G74', title: `Сверление Ø${fmt(p.D || 0, 3)}, глубина ${fmt(p.depth || 0, 3)}`, sketch, warn: ['Глубина — «по полному диаметру»: к ней добавляется заборный конус 0.3·D. Клевок Δk выводится в микронах.'] };
}

export default {
  id: 'drill', title: 'Сверление по оси', cat: 'cyc', tag: 'G74',
  defaults: { D: '10', depth: '30', peck: '5', e: '1', f: '0.1', vc: '40', rpm: '' },
  form: [
    { type: 'num', k: 'D', label: 'Ø сверла', unit: 'мм' },
    { type: 'num', k: 'depth', label: 'Глубина по полному Ø', unit: 'мм' },
    { type: 'num', k: 'peck', label: 'Клевок Δk', unit: 'мм' },
    { type: 'num', k: 'e', label: 'Отвод e', unit: 'мм' },
    { type: 'num', k: 'f', label: 'Подача F', unit: 'мм/об' },
    { type: 'num', k: 'vc', label: 'Скорость Vc', unit: 'м/мин' },
    { type: 'num', k: 'rpm', label: 'или обороты S', unit: 'об/мин', hint: 'пусто — из Vc' },
  ],
  calc,
};
