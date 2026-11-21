// Плоская геометрия. Точки {x, y}. Для токарки: x = Z (горизонталь), y = радиус X/2 (вверх).
export const EPS = 1e-9;
export const rad = (d) => (d * Math.PI) / 180;
export const deg = (r) => (r * 180) / Math.PI;
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const cross = (a, b) => a.x * b.y - a.y * b.x;
export const len = (a) => Math.hypot(a.x, a.y);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function unit(a) {
  const l = len(a);
  if (l < EPS) throw new Error('Нулевой вектор');
  return { x: a.x / l, y: a.y / l };
}
export const leftNormal = (d) => ({ x: -d.y, y: d.x });
export const rightNormal = (d) => ({ x: d.y, y: -d.x });
export const normal = (d, side) => (side === 'left' ? leftNormal(d) : rightNormal(d));

// прямые p + t*d
export function lineLine(p1, d1, p2, d2) {
  const den = cross(d1, d2);
  if (Math.abs(den) < 1e-12) return null;
  const t = cross(sub(p2, p1), d2) / den;
  return add(p1, mul(d1, t));
}

export function circleLine(c, R, p, d) {
  const u = unit(d);
  const f = sub(p, c);
  const b = dot(f, u);
  const disc = b * b - (dot(f, f) - R * R);
  if (disc < -1e-9) return [];
  const s = Math.sqrt(Math.max(disc, 0));
  return disc < 1e-12 ? [add(p, mul(u, -b))] : [add(p, mul(u, -b - s)), add(p, mul(u, -b + s))];
}

export function circleCircle(c1, r1, c2, r2) {
  const d = dist(c1, c2);
  if (d < EPS || d > r1 + r2 + 1e-9 || d < Math.abs(r1 - r2) - 1e-9) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(r1 * r1 - a * a, 0));
  const u = unit(sub(c2, c1));
  const m = add(c1, mul(u, a));
  const n = leftNormal(u);
  return h < 1e-9 ? [m] : [add(m, mul(n, h)), add(m, mul(n, -h))];
}

// центр дуги по R. ccw — против часовой в плоскости (x вправо, y вверх).
// R>0: дуга <= 180°, R<0: дуга > 180°.
export function arcCenterFromR(p1, p2, R, ccw) {
  const chord = sub(p2, p1);
  const c = len(chord);
  const ar = Math.abs(R);
  if (c < EPS) return null;
  if (ar < c / 2 - 1e-6) return null; // |R| меньше половины хорды
  const h = Math.sqrt(Math.max(ar * ar - (c / 2) ** 2, 0));
  const m = add(p1, mul(chord, 0.5));
  const n = leftNormal(unit(chord));
  const minorLeft = ccw; // центр малой дуги ccw лежит слева от хорды
  const sign = (minorLeft ? 1 : -1) * (R > 0 ? 1 : -1);
  return add(m, mul(n, h * sign));
}

const TAU = 2 * Math.PI;
export const angleOf = (c, p) => Math.atan2(p.y - c.y, p.x - c.x);
// угол дуги (рад), (0, 2π]
export function arcSweep(p1, p2, c, ccw) {
  const a1 = angleOf(c, p1);
  const a2 = angleOf(c, p2);
  let s = ccw ? a2 - a1 : a1 - a2;
  s = ((s % TAU) + TAU) % TAU;
  return s < 1e-12 ? TAU : s;
}

export function arcPoints(p1, p2, c, ccw, n = 24) {
  const R = dist(c, p1);
  const sw = arcSweep(p1, p2, c, ccw);
  const a1 = angleOf(c, p1);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a1 + (ccw ? 1 : -1) * (sw * i) / n;
    pts.push({ x: c.x + R * Math.cos(a), y: c.y + R * Math.sin(a) });
  }
  return pts;
}

// касательные из внешней точки P к окружности (c, R): две точки
export function tangentPoints(P, c, R) {
  const d = dist(P, c);
  if (d < R - 1e-9) return [];
  const a = Math.acos(Math.min(1, R / d));
  const base = angleOf(c, P);
  return [a, -a].map((da) => ({ x: c.x + R * Math.cos(base + da), y: c.y + R * Math.sin(base + da) }));
}
