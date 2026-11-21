// Фаска и радиус в углу между двумя прямыми. Точки {x: Z, y: радиус}.
import { sub, add, mul, unit, cross, dot, dist, rad, EPS } from './geometry.js';

// Направление движения до угла uIn и после угла uOut (единичные векторы).
// Катеты: l1 — по входной прямой (от угла назад), l2 — по выходной.
export function chamferCorner(V, uIn, uOut, l1, l2) {
  if (!(l1 > 0) || !(l2 > 0)) return { error: 'Размер фаски должен быть больше 0' };
  const p1 = sub(V, mul(uIn, l1));
  const p2 = add(V, mul(uOut, l2));
  return { kind: 'chamfer', p1, p2, length: dist(p1, p2) };
}

// Радиус скругления в углу. Дуга всегда меньше 180°, выводится через R.
export function filletCorner(V, uIn, uOut, R) {
  if (!(R > 0)) return { error: 'Радиус должен быть больше 0' };
  const a = unit(mul(uIn, -1)); // от угла назад по входной
  const b = unit(uOut);
  const cosT = dot(a, b);
  const theta = Math.acos(Math.max(-1, Math.min(1, cosT))); // внутренний угол между прямыми
  if (theta < 1e-6 || Math.PI - theta < 1e-6) return { error: 'Прямые параллельны — скруглять нечего' };
  const t = R / Math.tan(theta / 2);
  const p1 = add(V, mul(a, t));
  const p2 = add(V, mul(b, t));
  const bis = unit(add(a, b));
  const center = add(V, mul(bis, R / Math.sin(theta / 2)));
  const ccw = cross(uIn, uOut) > 0; // поворот налево = против часовой
  return { kind: 'fillet', p1, p2, center, R, ccw, t, theta };
}

// «Длина × угол»: длина по оси Z, угол к оси → катет по радиусу = длина·tg(угол).
export function legsFromLenAngle(len, angleDeg) {
  if (!(len > 0) || !(angleDeg > 0) || !(angleDeg < 90)) return { error: 'Длина > 0, угол 0…90°' };
  return { z: len, r: len * Math.tan(rad(angleDeg)) };
}

// Размещения: направления входа/выхода в плоскости (Z горизонтально, радиус вверх), движение от торца к патрону.
export function directions(placement, coneHalfDeg = 0) {
  switch (placement) {
    case 'face-dia': return { uIn: { x: 0, y: 1 }, uOut: { x: -1, y: 0 } };
    case 'dia-face': return { uIn: { x: -1, y: 0 }, uOut: { x: 0, y: 1 } };
    case 'dia-cone': {
      const a = rad(coneHalfDeg);
      return { uIn: { x: -1, y: 0 }, uOut: { x: -Math.cos(a), y: Math.sin(a) } };
    }
    default: return null;
  }
}
export { EPS };
