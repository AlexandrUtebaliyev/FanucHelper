// Резьба: глубина профиля на радиус, проходы с постоянным сечением.
export const DEPTH_EXT = 0.6134;
export const DEPTH_INT = 0.5413;

export function threadDepth(P, external = true) {
  return (external ? DEPTH_EXT : DEPTH_INT) * P;
}

// k в микронах, целое (M20×2.5 -> 1534)
export function threadHeightMicrons(P, external = true) {
  return Math.round(threadDepth(P, external) * 1000 + 1e-7);
}

// Проходы: накопленная глубина Δd·√n, приращение не меньше Δdmin, последний проход — до полной глубины.
export function threadPasses(k, firstCut, minCut = 0) {
  if (!(k > 0) || !(firstCut > 0)) return [];
  const out = [];
  let cum = 0;
  for (let n = 1; n < 500; n++) {
    let target = firstCut * Math.sqrt(n);
    let inc = target - cum;
    if (inc < minCut) inc = minCut;
    cum = Math.min(cum + inc, k);
    out.push({ n, depth: cum });
    if (cum >= k - 1e-9) break;
  }
  return out;
}

// Полный расчёт метрической резьбы
export function calcThread({ D, P, external = true, length, firstCut, minCut = 0.1, starts = 1, z0 = 0 }) {
  if (!(D > 0) || !(P > 0)) return { error: 'Укажите диаметр и шаг' };
  const h = threadDepth(P, external);
  const k = threadHeightMicrons(P, external) / 1000;
  const fc = firstCut > 0 ? firstCut : Math.max(0.1, h / 4);
  const holeD = D - 2 * h; // внутренняя: Ø отверстия под резьбу
  const passes = threadPasses(h, fc, minCut).map((p) => ({
    ...p,
    x: external ? D - 2 * p.depth : holeD + 2 * p.depth,
  }));
  const turnD = external ? D - 0.1 * P : holeD; // рекомендация: наружная — D − 0.1·P; внутренняя — Ø отверстия
  return {
    h, k, kMicro: threadHeightMicrons(P, external), minorD: external ? D - 2 * h : D,
    holeD, turnD, passes, finalX: external ? D - 2 * h : D, zEnd: z0 - length, lead: P * starts,
  };
}
