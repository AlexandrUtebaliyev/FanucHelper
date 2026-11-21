// Торцовка прямоугольника: дорожки вдоль X, шаг по Y. Заготовка X ∈ [0, L], Y ∈ [0, B], верх Z = zTop.
export function facing({ L, B, D, overlap = 30, ap, total, mode = 'zigzag', overhang = 1, safeZ = 5, zTop = 0, feed }) {
  if (!(L > 0) || !(B > 0) || !(D > 0)) return { error: 'Задайте размеры заготовки и Ø фрезы' };
  if (!(ap > 0) || !(total > 0)) return { error: 'Задайте ap и общий съём' };
  if (!(overlap >= 0 && overlap < 100)) return { error: 'Перекрытие 0…99 %' };
  const ov = Math.max(0, overhang);
  const warn = [];
  const step = D * (1 - overlap / 100);
  const yFirst = D / 2 - ov, yLast = B - D / 2 + ov;
  let rows, stepAct, ys;
  if (yLast <= yFirst + 1e-9) {
    rows = 1; stepAct = 0; ys = [B / 2];
    warn.push('Фреза шире заготовки по Y — одна дорожка по центру');
  } else {
    rows = Math.ceil((yLast - yFirst) / step - 1e-9) + 1;
    stepAct = (yLast - yFirst) / (rows - 1);
    ys = Array.from({ length: rows }, (_, i) => yFirst + i * stepAct);
  }
  const nz = Math.ceil(total / ap - 1e-9);
  const apAct = total / nz;
  const zs = Array.from({ length: nz }, (_, k) => zTop - (k + 1) * apAct);
  const xs = -D / 2 - ov, xe = L + D / 2 + ov;
  const rowLen = xe - xs;
  const perLevel = rows * rowLen + (rows - 1) * stepAct;
  const pathLen = perLevel * nz;
  const minutes = feed > 0 ? pathLen / feed : NaN;
  const lines = [];
  return { step, rows, stepAct, ys, nz, apAct, zs, xs, xe, rowLen, pathLen, minutes, mode, safeZ, lines, warn };
}
