// Полярные ↔ декартовы, треугольник, поворот точек.
import { rad, deg } from '../geometry.js';

export const polarToCart = (x0, y0, angle, len) => ({ x: x0 + len * Math.cos(rad(angle)), y: y0 + len * Math.sin(rad(angle)) });
export function cartToPolar(a, b) {
  return { angle: deg(Math.atan2(b.y - a.y, b.x - a.x)), length: Math.hypot(b.x - a.x, b.y - a.y) };
}

// Треугольник: стороны a, b, c; углы A (напротив a), B, C — в градусах. Нужны три величины, среди них хотя бы одна сторона.
export function solveTriangle({ a, b, c, A, B, C }) {
  const h = (v) => Number.isFinite(v);
  const sides = [a, b, c].filter(h).length;
  const angles = [A, B, C].filter(h).length;
  if (sides + angles < 3 || sides < 1) return { error: 'Нужны три величины, среди них хотя бы одна сторона' };
  if (sides === 3) {
    if (a + b <= c || a + c <= b || b + c <= a) return { error: 'Такого треугольника нет' };
    const AA = deg(Math.acos((b * b + c * c - a * a) / (2 * b * c)));
    const BB = deg(Math.acos((a * a + c * c - b * b) / (2 * a * c)));
    return { a, b, c, A: AA, B: BB, C: 180 - AA - BB };
  }
  if (sides === 2 && angles === 1) {
    // угол между известными сторонами (SAS); угол напротив стороны (SSA) неоднозначен
    if (h(C) && h(a) && h(b)) return solveTriangle({ a, b, c: Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(rad(C))) });
    if (h(B) && h(a) && h(c)) return solveTriangle({ a, b: Math.sqrt(a * a + c * c - 2 * a * c * Math.cos(rad(B))), c });
    if (h(A) && h(b) && h(c)) return solveTriangle({ a: Math.sqrt(b * b + c * c - 2 * b * c * Math.cos(rad(A))), b, c });
    return { error: 'Угол напротив известной стороны (SSA) неоднозначен — задайте угол между сторонами' };
  }
  if (sides === 1 && angles === 2) {
    const AA = h(A) ? A : 180 - B - C, BB = h(B) ? B : 180 - A - C, CC = h(C) ? C : 180 - A - B;
    if (AA <= 0 || BB <= 0 || CC <= 0) return { error: 'Сумма углов должна быть 180°' };
    const k = h(a) ? a / Math.sin(rad(AA)) : h(b) ? b / Math.sin(rad(BB)) : c / Math.sin(rad(CC));
    return { a: k * Math.sin(rad(AA)), b: k * Math.sin(rad(BB)), c: k * Math.sin(rad(CC)), A: AA, B: BB, C: CC };
  }
  return { error: 'Недостаточно данных' };
}

export function rotatePoints(pts, cx, cy, angle) {
  const c = Math.cos(rad(angle)), s = Math.sin(rad(angle));
  return pts.map((p) => ({ x: cx + (p.x - cx) * c - (p.y - cy) * s, y: cy + (p.x - cx) * s + (p.y - cy) * c }));
}
