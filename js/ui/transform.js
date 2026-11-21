import { polarToCart, cartToPolar, solveTriangle, rotatePoints } from '../core/mill/transform.js';
import { rotateLines } from '../gcode/millCycles.js';
import { fmt, word, join, parseNum } from '../gcode/format.js';
import { nn } from './kit.js';

function parsePts(text) {
  return String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const [x, y] = l.split(/[;\s]+/).map(parseNum);
    return { x, y };
  });
}

export function calc(p, s) {
  const dec = s.decimals;
  const f = (n) => fmt(n, dec);
  if (p.mode === 'pc') {
    if (!nn(p.angle) || !nn(p.len)) return { err: 'Задайте угол и длину' };
    const q = polarToCart(nn(p.x0) ? p.x0 : 0, nn(p.y0) ? p.y0 : 0, p.angle, p.len);
    return { results: [['Точка', `X${f(q.x)} Y${f(q.y)}`]], code: [join('G00', word('X', q.x, dec), word('Y', q.y, dec))], tag: 'G00', title: `Полярная → X${f(q.x)} Y${f(q.y)}` };
  }
  if (p.mode === 'cp') {
    if (![p.x1, p.y1, p.x2, p.y2].every(nn)) return { err: 'Задайте две точки' };
    const r = cartToPolar({ x: p.x1, y: p.y1 }, { x: p.x2, y: p.y2 });
    return { results: [['Угол', f(r.angle) + '°'], ['Длина', f(r.length)]] };
  }
  if (p.mode === 'tri') {
    const r = solveTriangle({ a: p.a, b: p.b, c: p.c, A: p.A, B: p.B, C: p.C });
    if (r.error) return { err: r.error };
    return { results: [['a', f(r.a)], ['b', f(r.b)], ['c', f(r.c)], ['A', f(r.A) + '°'], ['B', f(r.B) + '°'], ['C', f(r.C) + '°']] };
  }
  const pts = parsePts(p.pts);
  if (!pts.length || pts.some((q) => !nn(q.x) || !nn(q.y))) return { err: 'Список точек: по строке «X Y»' };
  if (!nn(p.angle)) return { err: 'Задайте угол' };
  const cx = nn(p.x0) ? p.x0 : 0;
  const cy = nn(p.y0) ? p.y0 : 0;
  const out = rotatePoints(pts, cx, cy, p.angle);
  const body = pts.map((q) => join('G01', word('X', q.x, dec), word('Y', q.y, dec)));
  return {
    results: out.map((q, i) => [`Точка ${i + 1} после поворота`, `X${f(q.x)} Y${f(q.y)}`]),
    code: rotateLines(body, { x: cx, y: cy, angle: p.angle, dec }),
    warn: ['G68 поворачивает уже запрограммированные точки вокруг центра. Отмена — G69. Подачу F и Z задайте до блоков.'],
    tag: 'G68', title: `Поворот на ${f(p.angle)}°`,
  };
}

export default {
  id: 'transform', title: 'Полярные · поворот', cat: 'geo', tag: 'G68',
  defaults: { mode: 'pc', x0: '0', y0: '0', angle: '30', len: '50', x1: '0', y1: '0', x2: '30', y2: '40', a: '3', b: '4', c: '5', A: '', B: '', C: '', pts: '10 0\n20 0' },
  form: [
    { type: 'seg', k: 'mode', options: [['pc', 'Угол+длина'], ['cp', 'Две точки'], ['tri', 'Треуг.'], ['rot', 'Поворот']] },
    { type: 'num', k: 'x0', label: 'База / центр X', unit: 'мм', show: (v) => v.mode === 'pc' || v.mode === 'rot' },
    { type: 'num', k: 'y0', label: 'База / центр Y', unit: 'мм', show: (v) => v.mode === 'pc' || v.mode === 'rot' },
    { type: 'num', k: 'angle', label: 'Угол', unit: '°', show: (v) => v.mode === 'pc' || v.mode === 'rot' },
    { type: 'num', k: 'len', label: 'Длина', unit: 'мм', show: (v) => v.mode === 'pc' },
    { type: 'num', k: 'x1', label: 'Точка 1: X', unit: 'мм', show: (v) => v.mode === 'cp' },
    { type: 'num', k: 'y1', label: 'Точка 1: Y', unit: 'мм', show: (v) => v.mode === 'cp' },
    { type: 'num', k: 'x2', label: 'Точка 2: X', unit: 'мм', show: (v) => v.mode === 'cp' },
    { type: 'num', k: 'y2', label: 'Точка 2: Y', unit: 'мм', show: (v) => v.mode === 'cp' },
    { type: 'num', k: 'a', label: 'Сторона a', unit: 'мм', show: (v) => v.mode === 'tri' },
    { type: 'num', k: 'b', label: 'Сторона b', unit: 'мм', show: (v) => v.mode === 'tri' },
    { type: 'num', k: 'c', label: 'Сторона c', unit: 'мм', show: (v) => v.mode === 'tri' },
    { type: 'num', k: 'A', label: 'Угол A', unit: '°', show: (v) => v.mode === 'tri' },
    { type: 'num', k: 'B', label: 'Угол B', unit: '°', show: (v) => v.mode === 'tri' },
    { type: 'num', k: 'C', label: 'Угол C', unit: '°', show: (v) => v.mode === 'tri' },
    { type: 'text', k: 'pts', label: 'Точки (X Y по строке)', full: true, show: (v) => v.mode === 'rot' },
  ],
  calc,
};
