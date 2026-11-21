import { boltCircle, grid } from '../core/mill/boltCircle.js';
import { holeLines } from '../gcode/millCycles.js';
import { fmt } from '../gcode/format.js';
import { holesSketch } from './sketch.js';
import { nn } from './kit.js';

export function calc(p, s) {
  const dec = s.decimals;
  let res;
  const center = { x: nn(p.xc) ? p.xc : 0, y: nn(p.yc) ? p.yc : 0 };
  if (p.type === 'grid') res = grid({ x0: p.x0, y0: p.y0, dx: p.dx, dy: p.dy, nx: Math.round(p.nx), ny: Math.round(p.ny), angle: nn(p.ang) ? p.ang : 0, snake: p.snake });
  else res = boltCircle({ xc: center.x, yc: center.y, R: p.rd === 'D' ? p.D / 2 : p.R, n: Math.round(p.n), a0: nn(p.a0) ? p.a0 : 0, step: nn(p.step) ? p.step : undefined });
  if (res.error) return { err: res.error };
  const holes = res.holes;
  if (holes.some((h) => !Number.isFinite(h.x) || !Number.isFinite(h.y))) return { err: 'Заполните все размеры' };
  const rows = holes.map((h, i) => [`Отверстие ${i + 1}${h.angle !== undefined ? ` (${fmt(h.angle, 2)}°)` : ''}`, `X${fmt(h.x, dec)} Y${fmt(h.y, dec)}`]);
  let code = [], err = null;
  const warn = [];
  try {
    code = holeLines({
      dec, code: p.code, holes, z: p.z, r: p.r, q: p.q, p: p.dwell, f: p.f, s: p.s, pitch: p.pitch, initZ: p.initZ,
      format: p.type === 'grid' ? 'xy' : p.format, center, R: res.R,
    });
  } catch (e) { err = e.message; }
  if (p.code === 'G84') warn.push('G84 жёсткое нарезание: перед циклом M29 S, подача F = S × шаг (G94). Проверьте, что включено жёсткое нарезание.');
  warn.push('G99 между отверстиями, G98 на последнем: в конце инструмент вернётся в исходную плоскость.');
  return { err, warn, results: rows, code, tag: p.code, title: p.type === 'grid' ? `Сетка ${p.nx}×${p.ny}, ${p.code}` : `Окружность R${fmt(res.R, 3)} ×${holes.length}, ${p.code}`, sketch: holesSketch(holes, { R: res.R, center }) };
}

export default {
  id: 'bolt', title: 'Отверстия', cat: 'geo', tag: 'G81',
  defaults: { type: 'circle', xc: '0', yc: '0', rd: 'R', R: '50', D: '100', n: '6', a0: '0', step: '', x0: '0', y0: '0', dx: '20', dy: '15', nx: '4', ny: '3', ang: '0', snake: false, code: 'G81', z: '-10', r: '2', q: '3', dwell: '500', f: '100', s: '500', pitch: '1.25', initZ: '50', format: 'xy' },
  form: [
    { type: 'seg', k: 'type', options: [['circle', 'По окружности'], ['grid', 'Сетка / линия']] },
    { type: 'num', k: 'xc', label: 'Центр XC', unit: 'мм', show: (v) => v.type === 'circle' },
    { type: 'num', k: 'yc', label: 'Центр YC', unit: 'мм', show: (v) => v.type === 'circle' },
    { type: 'seg', k: 'rd', options: [['R', 'Радиус'], ['D', 'Диаметр']], show: (v) => v.type === 'circle' },
    { type: 'num', k: 'R', label: 'Радиус окружности', unit: 'мм', show: (v) => v.type === 'circle' && v.rd === 'R' },
    { type: 'num', k: 'D', label: 'Диаметр окружности', unit: 'мм', show: (v) => v.type === 'circle' && v.rd === 'D' },
    { type: 'num', k: 'n', label: 'Количество', unit: 'шт', show: (v) => v.type === 'circle' },
    { type: 'num', k: 'a0', label: 'Начальный угол', unit: '°', show: (v) => v.type === 'circle' },
    { type: 'num', k: 'step', label: 'Шаг угла (пусто = 360/n)', unit: '°', show: (v) => v.type === 'circle' },
    { type: 'num', k: 'x0', label: 'Старт X', unit: 'мм', show: (v) => v.type === 'grid' },
    { type: 'num', k: 'y0', label: 'Старт Y', unit: 'мм', show: (v) => v.type === 'grid' },
    { type: 'num', k: 'dx', label: 'Шаг по X', unit: 'мм', show: (v) => v.type === 'grid' },
    { type: 'num', k: 'dy', label: 'Шаг по Y', unit: 'мм', show: (v) => v.type === 'grid' },
    { type: 'num', k: 'nx', label: 'Кол-во по X', unit: 'шт', show: (v) => v.type === 'grid' },
    { type: 'num', k: 'ny', label: 'Кол-во по Y', unit: 'шт', show: (v) => v.type === 'grid' },
    { type: 'num', k: 'ang', label: 'Поворот ряда', unit: '°', show: (v) => v.type === 'grid' },
    { type: 'check', k: 'snake', label: 'Обход змейкой', show: (v) => v.type === 'grid' },
    { type: 'select', k: 'code', label: 'Цикл', options: [['G81', 'G81 сверление'], ['G82', 'G82 с выдержкой'], ['G83', 'G83 глубокое'], ['G73', 'G73 с дроблением'], ['G84', 'G84 метчик'], ['G85', 'G85 развёртка'], ['G86', 'G86 расточка']] },
    { type: 'num', k: 'z', label: 'Глубина Z', unit: 'мм' },
    { type: 'num', k: 'r', label: 'Плоскость R', unit: 'мм' },
    { type: 'num', k: 'initZ', label: 'Исходная плоскость Z', unit: 'мм' },
    { type: 'num', k: 'q', label: 'Шаг Q', unit: 'мм', show: (v) => v.code === 'G83' || v.code === 'G73' },
    { type: 'num', k: 'dwell', label: 'Выдержка P', unit: 'мс', show: (v) => v.code === 'G82' },
    { type: 'num', k: 'f', label: 'Подача F', unit: 'мм/мин', show: (v) => v.code !== 'G84' },
    { type: 'num', k: 's', label: 'Обороты S', unit: 'об/мин', show: (v) => v.code === 'G84' },
    { type: 'num', k: 'pitch', label: 'Шаг резьбы P', unit: 'мм', show: (v) => v.code === 'G84' },
    { type: 'seg', k: 'format', options: [['xy', 'X Y'], ['polar', 'G16 полярные'], ['macro', 'G65 P9010']], show: (v) => v.type === 'circle' },
  ],
  calc,
};
