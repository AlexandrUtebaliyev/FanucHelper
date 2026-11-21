// Режимы резания (токарка).
export const vcToS = (vc, d) => (d > 0 ? (1000 * vc) / (Math.PI * d) : NaN);
export const sToVc = (s, d) => (Math.PI * d * s) / 1000;
export const feedPerMin = (f, s) => f * s; // мм/об × об/мин
export const feedPerRev = (F, s) => (s > 0 ? F / s : NaN);
export const passTime = (L, F) => (F > 0 ? L / F : NaN); // мин

// Ограничение G50 для G96: S на минимальном рабочем Ø, не выше предела станка
export function g50Limit(vc, dMin, sMachine) {
  const s = vcToS(vc, dMin);
  return Number.isFinite(sMachine) && sMachine > 0 ? Math.min(s, sMachine) : s;
}

// Ra ≈ f²/(32·r)·1000 мкм
export const raFromFeed = (f, r) => (r > 0 ? (f * f) / (32 * r) * 1000 : NaN);
export const feedFromRa = (ra, r) => Math.sqrt((ra * 32 * r) / 1000);
