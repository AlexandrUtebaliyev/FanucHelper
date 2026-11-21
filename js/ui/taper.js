import { solveTaper } from '../core/taper.js';
import { fmt, word, join } from '../gcode/format.js';
import { assertSystemA } from '../gcode/cycles.js';
import { taperSketch } from './sketch.js';
import { nn } from './kit.js';

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
  const start = bigAtChuck ? small : { x: sol.D, z: z0 };
  const end = bigAtChuck ? big : { x: sol.d, z: z0 - sol.L };
  const warn = [];
  const res = [
    ['Угол α/2', fmt(sol.half, 3) + '°'], ['Угол α', fmt(sol.full, 3) + '°'], ['Конусность 1:k', '1:' + fmt(sol.k, 3).replace(/\.$/, '')],
    ['D', fmt(sol.D, dec)], ['d', fmt(sol.d, dec)], ['L', fmt(sol.L, dec)],
    ['Начало (Ø / Z)', `Ø${fmt(start.x, dec)} / Z${fmt(start.z, dec)}`], ['Конец (Ø / Z)', `Ø${fmt(end.x, dec)} / Z${fmt(end.z, dec)}`],
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
  defaults: { mode: 'ddl', D: '40', d: '30', L: '50', half: '5.711', k: '5', z0: '0', pos: 'chuck', f: '0.2' },
  form: [
    { type: 'seg', k: 'mode', options: [['ddl', 'D · d · L'], ['dla', 'D · L · угол'], ['k', '1:k']] },
    { type: 'num', k: 'D', label: 'Больший Ø, D', unit: 'мм' },
    { type: 'num', k: 'd', label: 'Меньший Ø, d', unit: 'мм', show: (v) => v.mode === 'ddl' },
    { type: 'num', k: 'L', label: 'Длина, L', unit: 'мм' },
    { type: 'num', k: 'half', label: 'Угол α/2', unit: '°', show: (v) => v.mode === 'dla' },
    { type: 'num', k: 'k', label: 'Конусность 1:k, k', unit: '', show: (v) => v.mode === 'k' },
    { type: 'num', k: 'z0', label: 'Z малого торца', unit: 'мм' },
    { type: 'num', k: 'f', label: 'Подача F', unit: 'мм/об' },
    { type: 'seg', k: 'pos', options: [['chuck', 'Большой Ø у патрона'], ['face', 'Большой Ø у торца']] },
  ],
  calc,
};
