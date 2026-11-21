// Компенсация радиуса пластины без G41/G42: эквидистанта контура на r, затем положение воображаемой вершины.
// Точки {x: Z, y: радиус}. Контур задаётся в порядке резания (от торца к патрону). При наружной обработке
// материал слева по ходу, свободная сторона — справа (side 'right'); при внутренней — наоборот ('left').
import { sub, add, mul, unit, normal, dist, lineLine, circleLine, circleCircle, EPS } from './geometry.js';

// Направление воображаемой вершины от центра пластины в осях станка (Z, радиус).
// Реализованы T1–T4 и T9; T5–T8 — нет данных (TODO_DATA.md).
const TIP = { 1: [1, 1], 2: [-1, 1], 3: [-1, -1], 4: [1, -1], 9: [0, 0] };

export function tipVector(tip, r) {
  const t = TIP[tip];
  if (!t) throw new Error(`Направление вершины T${tip}: нет данных (реализованы T1–T4 и T9)`);
  return { x: t[0] * r, y: t[1] * r };
}

// segs: [{type:'line', p, q} | {type:'arc', p, q, c, ccw}]
function offsetSeg(s, r, side) {
  if (s.type === 'line') {
    const d = unit(sub(s.q, s.p));
    return { kind: 'line', p: add(s.p, mul(normal(d, side), r)), d, len: dist(s.p, s.q) };
  }
  const R = dist(s.c, s.p);
  // справа от хода при ccw — наружу от центра; при cw — внутрь. Для side 'left' наоборот.
  const outward = (s.ccw && side === 'right') || (!s.ccw && side === 'left');
  const R2 = outward ? R + r : R - r;
  if (R2 <= EPS) throw new Error('Радиус дуги меньше радиуса пластины — компенсация невозможна');
  return { kind: 'arc', c: s.c, R: R2 };
}

const startOf = (s, o) => (o.kind === 'line' ? o.p : add(s.c, mul(unit(sub(s.p, s.c)), o.R)));
const endOf = (s, o) => (o.kind === 'line' ? add(o.p, mul(o.d, o.len)) : add(s.c, mul(unit(sub(s.q, s.c)), o.R)));

function intersect(a, b, near) {
  let pts = [];
  if (a.kind === 'line' && b.kind === 'line') {
    const p = lineLine(a.p, a.d, b.p, b.d);
    pts = p ? [p] : [];
  } else if (a.kind === 'line') pts = circleLine(b.c, b.R, a.p, a.d);
  else if (b.kind === 'line') pts = circleLine(a.c, a.R, b.p, b.d);
  else pts = circleCircle(a.c, a.R, b.c, b.R);
  if (!pts.length) return null;
  return pts.reduce((best, p) => (dist(p, near) < dist(best, near) ? p : best));
}

// Возвращает скорректированные точки вершины (программируются на воображаемой вершине), разницу с исходными
// и пересчитанные сегменты.
export function compensateContour(segs, { r, tip = 3, side = 'right' }) {
  if (!(r > 0)) return { error: 'Радиус пластины должен быть больше 0' };
  if (!segs.length) return { error: 'Пустой контур' };
  let v;
  let off;
  try {
    v = tipVector(tip, r);
    off = segs.map((s) => offsetSeg(s, r, side));
  } catch (e) { return { error: e.message }; }
  const pts = [add(startOf(segs[0], off[0]), v)];
  for (let i = 1; i < segs.length; i++) {
    const prevEnd = endOf(segs[i - 1], off[i - 1]);
    pts.push(add(intersect(off[i - 1], off[i], prevEnd) || prevEnd, v));
  }
  pts.push(add(endOf(segs[segs.length - 1], off[off.length - 1]), v));
  const deltas = pts.map((p, i) => {
    const orig = i === 0 ? segs[0].p : segs[i - 1].q;
    return { dz: p.x - orig.x, dd: (p.y - orig.y) * 2 };
  });
  const outSegs = segs.map((s, i) => ({ ...s, p: pts[i], q: pts[i + 1], c: s.c ? add(s.c, v) : undefined }));
  return { points: pts, deltas, segs: outSegs };
}

export const compensateLine = (p, q, opts) => compensateContour([{ type: 'line', p, q }], opts);
