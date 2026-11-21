// Конус: tg(α/2) = (D − d) / (2L), k = L / (D − d).
import { rad, deg } from './geometry.js';

const has = (v) => typeof v === 'number' && Number.isFinite(v);

// Вход: любые величины из D, d, L, half (α/2 в градусах), k (конусность 1:k).
// Нужны три независимые величины: хотя бы одна из D,d,L + связь (half или k) считается одной величиной.
export function solveTaper({ D, d, L, half, k } = {}) {
  const errors = [];
  let ratio = null; // (D − d) / L
  if (has(half)) {
    if (half <= 0 || half >= 90) return { error: 'Угол α/2 должен быть в пределах 0…90°' };
    ratio = 2 * Math.tan(rad(half));
  }
  if (has(k)) {
    if (k <= 0) return { error: 'Конусность 1:k — k должно быть больше 0' };
    const r2 = 1 / k;
    if (ratio !== null && Math.abs(ratio - r2) > 1e-6) return { error: 'Угол и конусность противоречат друг другу — задайте что-то одно' };
    ratio = r2;
  }
  let Dv = D, dv = d, Lv = L;
  const known = [has(Dv), has(dv), has(Lv)].filter(Boolean).length;
  if (ratio === null) {
    if (known < 3) return { error: 'Нужны три величины: D, d, L или две из них и угол / конусность' };
    if (Lv <= 0) return { error: 'Длина L должна быть больше 0' };
    ratio = (Dv - dv) / Lv;
  } else {
    if (known < 2) return { error: 'Нужны три величины: угол / конусность и две из D, d, L' };
    if (known === 3) {
      if (Math.abs((Dv - dv) - ratio * Lv) > 1e-6) return { error: 'Величины противоречат друг другу (переопределено)' };
    } else if (!has(Dv)) Dv = dv + ratio * Lv;
    else if (!has(dv)) dv = Dv - ratio * Lv;
    else Lv = ratio === 0 ? NaN : (Dv - dv) / ratio;
  }
  if (!has(Dv) || !has(dv) || !has(Lv)) return { error: 'Не удалось вычислить размеры' };
  if (Lv <= 0) return { error: 'Длина получилась не больше 0 — проверьте D и d' };
  if (Dv <= dv) return { error: 'D должен быть больше d' };
  if (dv < 0) return { error: 'Меньший Ø получился отрицательным' };
  const halfAngle = deg(Math.atan((Dv - dv) / (2 * Lv)));
  return { D: Dv, d: dv, L: Lv, half: halfAngle, full: halfAngle * 2, k: Lv / (Dv - dv), errors };
}
