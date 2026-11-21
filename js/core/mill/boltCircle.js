// Отверстия по окружности и сетка. Точки {x, y, angle?}. Чистые функции.
import { rad } from '../geometry.js';

export function boltCircle({ xc = 0, yc = 0, R, D, n, a0 = 0, step }) {
  const r = R > 0 ? R : D / 2;
  if (!(r > 0)) return { error: 'Задайте радиус или диаметр окружности' };
  if (!(n >= 1) || !Number.isInteger(n)) return { error: 'Количество отверстий — целое, не меньше 1' };
  const st = Number.isFinite(step) && step !== 0 ? step : 360 / n;
  const holes = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + i * st;
    holes.push({ x: xc + r * Math.cos(rad(a)), y: yc + r * Math.sin(rad(a)), angle: a });
  }
  return { holes, R: r, step: st };
}

// Сетка nx × ny от точки (x0, y0), ряды вдоль X повёрнуты на angle°. snake — обход змейкой.
export function grid({ x0 = 0, y0 = 0, dx, dy, nx, ny, angle = 0, snake = false }) {
  if (!(nx >= 1) || !(ny >= 1)) return { error: 'Количество по X и Y — не меньше 1' };
  const c = Math.cos(rad(angle)), s = Math.sin(rad(angle));
  const pts = [];
  for (let j = 0; j < ny; j++) {
    for (let k = 0; k < nx; k++) {
      const i = snake && j % 2 === 1 ? nx - 1 - k : k;
      const u = i * dx, v = j * dy;
      pts.push({ x: x0 + u * c - v * s, y: y0 + u * s + v * c });
    }
  }
  return { holes: pts };
}
