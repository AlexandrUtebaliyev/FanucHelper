// Сопряжения и точки касания в плоскости XY. Точки {x, y}.
import { sub, add, mul, unit, dist, leftNormal, circleLine, circleCircle, tangentPoints, cross, angleOf, arcSweep, deg } from '../geometry.js';
import { filletCorner } from '../chamfer.js';

const info = (p1, p2, center, ccw) => ({ p1, p2, center, ccw, R: dist(center, p1), I: center.x - p1.x, J: center.y - p1.y, sweep: deg(arcSweep(p1, p2, center, ccw)) });

// Прямая–прямая: путь A → C (угол) → B, радиус R
export function filletLineLine(A, C, B, R) {
  const f = filletCorner(C, unit(sub(C, A)), unit(sub(B, C)), R);
  if (f.error) return f;
  return info(f.p1, f.p2, f.center, f.ccw);
}

// Прямая (точка P, направление d) – окружность (c0, r0), скругляющая дуга R.
// side: на какой стороне прямой центр сопрягающей дуги; kind: 'ext' (снаружи окружности) | 'int' (внутри)
export function filletLineCircle(P, d, c0, r0, R, side = 'left', kind = 'ext') {
  const n = side === 'left' ? leftNormal(unit(d)) : mul(leftNormal(unit(d)), -1);
  const Poff = add(P, mul(n, R));
  const rc = kind === 'ext' ? r0 + R : Math.abs(r0 - R);
  const cs = circleLine(c0, rc, Poff, d);
  return cs.map((center) => {
    const u = unit(d);
    const tl = add(P, mul(u, (center.x - P.x) * u.x + (center.y - P.y) * u.y)); // проекция центра на прямую
    const dir = unit(sub(center, c0));
    const tc = kind === 'ext' || R < r0 ? add(c0, mul(dir, r0)) : sub(c0, mul(dir, r0));
    return { center, tLine: tl, tCircle: tc, R };
  });
}

// Окружность–окружность
export function filletCircleCircle(c1, r1, c2, r2, R, k1 = 'ext', k2 = 'ext') {
  const a = k1 === 'ext' ? r1 + R : Math.abs(r1 - R);
  const b = k2 === 'ext' ? r2 + R : Math.abs(r2 - R);
  return circleCircle(c1, a, c2, b).map((center) => {
    const t1 = add(c1, mul(unit(sub(center, c1)), k1 === 'ext' || R < r1 ? r1 : -r1));
    const t2 = add(c2, mul(unit(sub(center, c2)), k2 === 'ext' || R < r2 ? r2 : -r2));
    return { center, t1, t2, R };
  });
}

// Касательная из точки P к окружности (c, R): две точки касания
export function tangentFromPoint(P, c, R) {
  const pts = tangentPoints(P, c, R);
  if (!pts.length) return { error: 'Точка внутри окружности — касательных нет' };
  return pts.map((t) => ({ point: t, length: dist(P, t), angle: deg(angleOf(P, t)) }));
}

export { info as arcInfo, cross };
