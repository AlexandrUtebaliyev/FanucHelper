// Привязка щупом: вводятся машинные координаты (POS → MACHINE).

// Кромка: X = Xкас ± D/2. side: 'minus' — щуп касается кромки со стороны −X (кромка = касание + D/2), 'plus' — со стороны +X.
export function edge(touch, probeD, side) {
  const r = probeD / 2;
  return side === 'plus' ? touch - r : touch + r;
}

// Центр отверстия: четыре касания. Ø = (X2 − X1) + Dщупа, отдельно по X и по Y.
export function holeCenter({ x1, x2, y1, y2, probeD }) {
  const dx = x2 - x1 + probeD, dy = y2 - y1 + probeD;
  return { cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, dx, dy, ovality: Math.abs(dx - dy) };
}

// Центр бобышки: Ø = (X2 − X1) − Dщупа
export function bossCenter({ x1, x2, y1, y2, probeD }) {
  const dx = x2 - x1 - probeD, dy = y2 - y1 - probeD;
  return { cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, dx, dy, ovality: Math.abs(dx - dy) };
}

// Угол заготовки: две кромки (X и Y), каждая со своей стороны касания
export function corner({ xTouch, yTouch, probeD, xSide, ySide }) {
  return { x: edge(xTouch, probeD, xSide), y: edge(yTouch, probeD, ySide) };
}

// G10 для рабочих систем: G54–G59 → P1–P6 (L2); G54.1 P1–P48 → L20
export function g10Lines({ wcs, p54 = 1, x, y, z }, fmtFn) {
  const w = (l, v) => (Number.isFinite(v) ? ' ' + l + fmtFn(v) : '');
  if (wcs === 'G54.1') {
    if (!(p54 >= 1 && p54 <= 48)) throw new Error('G54.1: P от 1 до 48');
    return [`G90 G10 L20 P${Math.round(p54)}${w('X', x)}${w('Y', y)}${w('Z', z)}`];
  }
  const n = ['G54', 'G55', 'G56', 'G57', 'G58', 'G59'].indexOf(wcs);
  if (n < 0) throw new Error('Неизвестная система координат ' + wcs);
  return [`G90 G10 L2 P${n + 1}${w('X', x)}${w('Y', y)}${w('Z', z)}`];
}
