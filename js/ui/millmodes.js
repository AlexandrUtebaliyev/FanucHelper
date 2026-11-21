import { vcToS, sToVc, feedPerMin, removalRate, tapFeed } from '../core/mill/millCutting.js';
import { fmt, int, join } from '../gcode/format.js';
import { nn } from './kit.js';

export function calc(p, s) {
  const res = [];
  let S = nn(p.rpm) ? p.rpm : NaN;
  const code = [];
  const warn = [];
  if (nn(p.vc) && nn(p.D) && p.D > 0) {
    S = Math.round(vcToS(p.vc, p.D));
    res.push(['S из Vc и Ø', int(S) + ' об/мин']);
    if (S > s.spindleMax) warn.push(`S ${int(S)} выше предела шпинделя ${int(s.spindleMax)}`);
  } else if (nn(p.rpm) && nn(p.D) && p.D > 0) res.push(['Vc из S и Ø', fmt(sToVc(p.rpm, p.D), 1) + ' м/мин']);
  let F = NaN;
  if (nn(p.fz) && nn(p.z) && nn(S)) {
    F = Math.round(feedPerMin(p.fz, p.z, S));
    res.push(['Подача F = fz·z·S', int(F) + ' мм/мин']);
  }
  if (nn(p.ae) && nn(p.ap) && nn(F)) res.push(['Съём', fmt(removalRate(p.ae, p.ap, F), 1) + ' см³/мин']);
  if (nn(p.pitch) && p.pitch > 0) {
    const ts = nn(p.tapS) ? p.tapS : S;
    if (p.tapMode === 'G95') res.push(['Метчик, G95: F = P', fmt(tapFeed(ts, p.pitch, 'G95'), 3) + ' мм/об']);
    else if (nn(ts)) res.push([`Метчик, G94: F = S × P (S${int(ts)})`, int(tapFeed(ts, p.pitch, 'G94')) + ' мм/мин']);
  }
  if (!res.length) return { err: 'Введите данные: Vc и Ø, fz и z, шаг метчика и т.д.' };
  if (nn(S) && S > 0) code.push(join('S' + int(S), 'M03'));
  if (nn(F)) code.push('F' + int(F));
  return { warn, results: res, code, tag: 'S', title: `Режимы Ø${fmt(p.D || 0, 1)} Vc${fmt(p.vc || 0, 0)}` };
}

export default {
  id: 'millmodes', title: 'Режимы фрезерования', cat: 'mode', tag: 'S',
  defaults: { D: '10', vc: '100', rpm: '', fz: '0.05', z: '4', ae: '5', ap: '10', pitch: '1.25', tapS: '500', tapMode: 'G94' },
  form: [
    { type: 'num', k: 'D', label: 'Ø фрезы', unit: 'мм' },
    { type: 'num', k: 'vc', label: 'Скорость Vc', unit: 'м/мин' },
    { type: 'num', k: 'rpm', label: 'Обороты S (если известны)', unit: 'об/мин' },
    { type: 'num', k: 'fz', label: 'Подача на зуб fz', unit: 'мм' },
    { type: 'num', k: 'z', label: 'Число зубьев z', unit: 'шт' },
    { type: 'num', k: 'ae', label: 'Ширина ae', unit: 'мм' },
    { type: 'num', k: 'ap', label: 'Глубина ap', unit: 'мм' },
    { type: 'num', k: 'pitch', label: 'Метчик: шаг P', unit: 'мм' },
    { type: 'num', k: 'tapS', label: 'Метчик: обороты S', unit: 'об/мин' },
    { type: 'seg', k: 'tapMode', options: [['G94', 'G94 мм/мин'], ['G95', 'G95 мм/об']] },
  ],
  calc,
};
