// Режимы фрезерования.
export const vcToS = (vc, D) => (D > 0 ? (1000 * vc) / (Math.PI * D) : NaN);
export const sToVc = (s, D) => (Math.PI * D * s) / 1000;
export const feedPerMin = (fz, z, S) => fz * z * S;
export const fzFromFeed = (F, z, S) => (z > 0 && S > 0 ? F / (z * S) : NaN);
// ae, ap, мм; F, мм/мин → см³/мин
export const removalRate = (ae, ap, F) => (ae * ap * F) / 1000;
// Метчик: G94 F = S × P, G95 F = P
export const tapFeed = (S, P, mode = 'G94') => (mode === 'G95' ? P : S * P);
