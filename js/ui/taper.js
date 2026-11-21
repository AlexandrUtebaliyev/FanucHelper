import { solveTaper } from '../core/taper.js';
import { fmt, word, join } from '../gcode/format.js';
import { assertSystemA } from '../gcode/cycles.js';
import { taperSketch } from './sketch.js';
import { nn } from './kit.js';
import { compensateContour } from '../core/noseRadius.js';

const MODES = { ddl: ['D', 'd', 'L'], dla: ['D', 'L', 'half'], k: ['D', 'L', 'k'] };

export function calc(p, s) {
  const use = MODES[p.mode] || MODES.ddl;
  const inp = {};
  for (const key of use) inp[key] = p[key];
  const sol = solveTaper(inp);
  if (sol.error) return { err: sol.error, sketch: taperSketch({ D: 0, d: 0, L: 0 }) };
  const dec = s.decimals;
  const z0 = nn(p.z0) ? p.z0 : 0;
  const bigAtChuck = p.pos !== 'face';
  const small = { x: sol.d, z: z0 }, big = { x: sol.D, z: z0 - sol.L };
  let start = bigAtChuck ? small : { x: sol.D, z: z0 };
  let end = bigAtChuck ? big : { x: sol.d, z: z0 - sol.L };
  const warn = [];
  const extra = [];
  if (p.comp) {
    // контур: цилиндр у начала → конус → цилиндр у конца (наружная обработка к патрону)
    const a = { x: start.z, y: start.x / 2 }, b = { x: end.z, y: end.x / 2 };
    const c = compensateContour([
      { type: 'line', p: { x: a.x + 5, y: a.y }, q: a },
      { type: 'line', p: a, q: b },
      { type: 'line', p: b, q: { x: b.x - 5, y: b.y } },
    ], { r: p.r, tip: parseInt(p.tip, 10), side: 'right' });
    if (c.error) return { err: c.error, sketch: taperSketch({ D: sol.D, d: sol.d, L: sol.L, bigAtChuck }) };
    const s1 = c.points[1], e1 = c.points[2];
    extra.push(['Компенсация: начало ΔZ / ΔØ', `${fmt(c.deltas[1].dz, dec)} / ${fmt(c.deltas[1].dd, dec)}`], ['Компенсация: конец ΔZ / ΔØ', `${fmt(c.deltas[2].dz, dec)} / ${fmt(c.deltas[2].dd, dec)}`]);
    start = { x: s1.y * 2, z: s1.x }; end = { x: e1.y * 2, z: e1.x };
    warn.push('Включена ручная компенсация r: координаты — положение воображаемой вершины. Не используйте G41/G42.');
  }
  const res = [
    ['Угол α/2', fmt(sol.half, 3) + '°'], ['Угол α', fmt(sol.full, 3) + '°'], ['Конусность 1:k', '1:' + fmt(sol.k, 3).replace(/\.$/, '')],
    ['D', fmt(sol.D, dec)], ['d', fmt(sol.d, dec)], ['L', fmt(sol.L, dec)],
    ['Начало (Ø / Z)', `Ø${fmt(start.x, dec)} / Z${fmt(start.z, dec)}`], ['Конец (Ø / Z)', `Ø${fmt(end.x, dec)} / Z${fmt(end.z, dec)}`], ...extra,
  ];
  let code = [];
  let err = null;
  try {
    assertSystemA(s.gsys);
    const f = nn(p.f) && p.f > 0 ? word('F', p.f, dec) : '';
    if (!f) warn.push('Подача F не задана — в блок она не попала');
    code = [join('G01', word('X', start.x, dec), word('Z', start.z, dec), f), join('G01', word('X', end.x, dec), word('Z', end.z, dec))];
  } catch (e) { err = e.message; }
  return { err, warn, results: res, code, tag: 'G01', title: `Конус Ø${fmt(sol.D, 3)} → Ø${fmt(sol.d, 3)}, L${fmt(sol.L, 3)}`, sketch: taperSketch({ D: sol.D, d: sol.d, L: sol.L, bigAtChuck }) };
}

export default {
  id: 'taper', title: 'Конус', cat: 'geo', tag: 'G01',
  defaults: { mode: 'ddl', D: '40', d: '30', L: '50', half: '5.711', k: '5', z0: '0', pos: 'chuck', f: '0.2', comp: false, r: '0.8', tip: '3' },
  form: [
    { type: 'seg', k: 'mode', options: [['ddl', 'D · d · L'], ['dla', 'D · L · угол'], ['k', '1:k']] },
    { type: 'num', k: 'D', label: 'Больший Ø, D', unit: 'мм' },
    { type: 'num', k: 'd', label: 'Меньший Ø, d', unit: 'мм', show: (v) => v.mode === 'ddl' },
    { type: 'num', k: 'L', label: 'Длина, L', unit: 'мм' },
    { type: 'num', k: 'half', label: 'Угол α/2', unit: '°', show: (v) => v.mode === 'dla' },
    { type: 'num', k: 'k', label: 'Конусность 1:k, k', unit: '', show: (v) => v.mode === 'k' },
    { type: 'num', k: 'z0', label: 'Z малого торца', unit: 'мм' },
    { type: 'num', k: 'f', label: 'Подача F', unit: 'мм/об' },
    { type: 'check', k: 'comp', label: 'Компенсация радиуса пластины' },
    { type: 'num', k: 'r', label: 'Радиус пластины r', unit: 'мм', show: (v) => v.comp },
    { type: 'seg', k: 'tip', options: [['1', 'T1'], ['2', 'T2'], ['3', 'T3'], ['4', 'T4'], ['9', 'T9']], show: (v) => v.comp },
    { type: 'seg', k: 'pos', options: [['chuck', 'Большой Ø у патрона'], ['face', 'Большой Ø у торца']] },
  ],
  calc,
};
