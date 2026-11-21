// Резьбофрезерование: путь центра фрезы по винтовой линии.
// Радиус пути: внутренняя (D − d)/2, наружная (D + d)/2. Подача центра: внутр. F·(D−d)/D, нар. F·(D+d)/D.
import { threadDepth } from '../thread.js';

export function threadMill({ D, P, external = false, cutter, depth, F, hand = 'right', climb = true, xc = 0, yc = 0 }) {
  if (!(D > 0) || !(P > 0)) return { error: 'Задайте диаметр и шаг резьбы' };
  if (!(cutter > 0)) return { error: 'Задайте Ø фрезы' };
  if (!(depth > 0)) return { error: 'Глубина — положительное число, мм (от Z0 вниз)' };
  if (!(F > 0)) return { error: 'Задайте подачу F на кромке' };
  const warn = [];
  if (!external) {
    if (cutter >= D) return { error: 'Фреза больше диаметра резьбы' };
    const minor = D - 2 * threadDepth(P, false); // отверстие под резьбу
    if (cutter >= minor) return { error: `Фреза Ø${cutter} не проходит в отверстие под резьбу Ø${Math.round(minor * 1000) / 1000}` };
  }
  const radius = external ? (D + cutter) / 2 : (D - cutter) / 2;
  const fCenter = external ? (F * (D + cutter)) / D : (F * (D - cutter)) / D;
  if (depth < P) return { error: 'Глубина меньше шага — витков нет' };
  const full = Math.floor(depth / P + 1e-9) - 1; // полные витки между двумя полудугами
  const lifted = (full + 1) * P; // суммарный подъём: полудуга + полные витки + полудуга
  if (Math.abs(lifted - depth) > 1e-6) warn.push(`Глубина ${depth} не кратна шагу ${P}: резьба нарезается на ${Math.round(lifted * 1000) / 1000} мм`);
  // направление: попутное внутри — против часовой (G03), снаружи — по часовой; встречное — наоборот
  const ccw = external ? !climb : climb;
  // правая резьба: против часовой — вверх; левая — вниз
  const up = (ccw && hand === 'right') || (!ccw && hand === 'left');
  return { radius, fCenter, full, half: 2, lifted, ccw, up, turns: full + 1, warn, xc, yc };
}
