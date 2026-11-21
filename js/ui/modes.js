import { vcToS, sToVc, feedPerMin, passTime, g50Limit, raFromFeed, feedFromRa } from '../core/cutting.js';
import { fmt, int, join } from '../gcode/format.js';
import { nn } from './kit.js';

export function calc(p, s) {
  const res = [];
  const warn = [];
  const smax = nn(p.smax) && p.smax > 0 ? p.smax : s.spindleMax;
  let S = NaN;
  if (nn(p.vc) && nn(p.D) && p.D > 0) {
    S = vcToS(p.vc, p.D);
    res.push(['S из Vc и Ø', int(S) + ' об/мин']);
    if (S > smax) warn.push(`Расчётные обороты ${int(S)} выше предела ${int(smax)} — ограничьте G50`);
  }
  if (nn(p.rpm) && nn(p.D) && p.D > 0) res.push(['Vc из S и Ø', fmt(sToVc(p.rpm, p.D), 1) + ' м/мин']);
  const Sx = nn(p.rpm) ? p.rpm : S;
  if (nn(p.f) && nn(Sx)) {
    const F = feedPerMin(p.f, Sx);
    res.push(['Подача F', fmt(F, 1) + ' мм/мин']);
    if (nn(p.L) && p.L > 0) res.push(['Время прохода', fmt(passTime(p.L, F), 2) + ' мин']);
  }
  if (nn(p.vc) && nn(p.dmin) && p.dmin >= 0) {
    if (p.dmin === 0) warn.push('Отрезка до центра: при Ø→0 обороты растут бесконечно — задайте Ø, до которого держим Vc, и предел G50');
    else res.push(['G50 S (ограничение для G96)', int(g50Limit(p.vc, p.dmin, smax)) + ' об/мин']);
  }
  if (nn(p.f) && nn(p.r) && p.r > 0) res.push(['Шероховатость Ra ≈', fmt(raFromFeed(p.f, p.r), 2) + ' мкм']);
  if (nn(p.ra) && nn(p.r) && p.r > 0) res.push(['Подача из Ra', fmt(feedFromRa(p.ra, p.r), 3) + ' мм/об']);
  if (!res.length) return { err: 'Введите данные: Vc и Ø, либо S и Ø, подачу f и т.д.' };
  const code = [];
  if (nn(p.vc) && nn(p.dmin) && p.dmin > 0) { code.push(join('G50', 'S' + int(g50Limit(p.vc, p.dmin, smax)))); code.push(join('G96', 'S' + int(p.vc), 'M03')); }
  else if (nn(S)) code.push(join('G97', 'S' + int(S), 'M03'));
  return { warn, results: res, code, tag: 'S', title: `Режимы Vc${fmt(p.vc || 0, 1)} Ø${fmt(p.D || 0, 1)}` };
}

export default {
  id: 'modes', title: 'Режимы резания', cat: 'mode', tag: 'S',
  defaults: { D: '40', vc: '200', rpm: '', f: '0.2', L: '50', dmin: '10', smax: '', r: '0.8', ra: '1.6' },
  form: [
    { type: 'num', k: 'D', label: 'Ø обработки', unit: 'мм' },
    { type: 'num', k: 'vc', label: 'Скорость Vc', unit: 'м/мин' },
    { type: 'num', k: 'rpm', label: 'Обороты S (если нужно Vc)', unit: 'об/мин' },
    { type: 'num', k: 'f', label: 'Подача f', unit: 'мм/об' },
    { type: 'num', k: 'L', label: 'Длина прохода', unit: 'мм' },
    { type: 'num', k: 'dmin', label: 'Мин. Ø для G50 (отрезка)', unit: 'мм' },
    { type: 'num', k: 'smax', label: 'Предел S станка', unit: 'об/мин', hint: 'пусто — из настроек' },
    { type: 'num', k: 'r', label: 'Радиус пластины r', unit: 'мм' },
    { type: 'num', k: 'ra', label: 'Нужная Ra', unit: 'мкм' },
  ],
  calc,
};
