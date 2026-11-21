import { planPocket } from '../core/mill/pocket.js';
import { pocketLines } from '../gcode/millCycles.js';
import { fmt } from '../gcode/format.js';
import { wrap } from './sketch.js';
import { nn } from './kit.js';

function sketch(p, plan) {
  if (!plan || plan.error) return wrap(340, 160, '');
  const W = plan.shape === 'circle' ? p.Dp : p.L, H = plan.shape === 'circle' ? p.Dp : p.B;
  const sc = Math.min(280 / W, 130 / H);
  const cx = 170, cy = 80;
  const loops = plan.loops.map((l) => (plan.shape === 'circle'
    ? `<circle cx="${cx}" cy="${cy}" r="${l.r * sc}" fill="none" stroke="#F5A524" stroke-opacity=".45"/>`
    : `<rect x="${cx - l.ax * sc}" y="${cy - l.ay * sc}" width="${2 * l.ax * sc}" height="${2 * l.ay * sc}" rx="${l.rc * sc}" fill="none" stroke="#F5A524" stroke-opacity=".45"/>`)).join('');
  const wall = plan.shape === 'circle'
    ? `<circle cx="${cx}" cy="${cy}" r="${(p.Dp / 2) * sc}" fill="#232830" stroke="#ECEFF3" stroke-width="2"/>`
    : `<rect x="${cx - (p.L / 2) * sc}" y="${cy - (p.B / 2) * sc}" width="${p.L * sc}" height="${p.B * sc}" rx="${p.Rc * sc}" fill="#232830" stroke="#ECEFF3" stroke-width="2"/>`;
  return wrap(340, 160, wall + loops + `<circle cx="${cx}" cy="${cy}" r="3" fill="#6FB3FF"/>`, 'Эскиз кармана');
}

export function calc(p, s) {
  const dec = s.decimals;
  const plan = planPocket({ shape: p.shape, xc: nn(p.xc) ? p.xc : 0, yc: nn(p.yc) ? p.yc : 0, L: p.L, B: p.B, Rc: nn(p.Rc) ? p.Rc : 0, Dp: p.Dp, D: p.D, depth: p.depth, ap: p.ap, stepPct: p.step, fin: nn(p.fin) ? p.fin : 0, entry: p.entry, rampAngle: nn(p.ang) ? p.ang : 3, helixPitch: nn(p.hp) ? p.hp : 1 });
  if (plan.error) return { err: plan.error };
  let code = [], err = null;
  try {
    code = pocketLines(plan, { dec, safeZ: nn(p.safe) ? p.safe : 5, fRough: p.f, fEntry: nn(p.fe) ? p.fe : p.f / 2, fFinish: nn(p.ff) ? p.ff : p.f, dNo: nn(p.dno) ? p.dno : 1 });
  } catch (e) { err = e.message; }
  const res = [['Проходов по Z', String(plan.levels.length)], ['ap (факт.)', fmt(plan.apAct, dec)], ['Контуров на уровень', String(plan.loops.length)], ['Шаг в сторону', fmt(plan.step, dec)], ['Радиус дуги подвода', fmt(plan.ra, dec)]];
  if (plan.entry === 'helix') res.push(['Спираль: радиус пути / витков', `${fmt(plan.helixR, dec)} / ${plan.turns}`]);
  else res.push(['Наклон: длина плеча', fmt(plan.ramp.leg, dec)]);
  return { err, warn: plan.warn, results: res, code, tag: 'G41', title: plan.shape === 'circle' ? `Карман Ø${fmt(p.Dp, 3)}, глубина ${fmt(p.depth, 3)}` : `Карман ${fmt(p.L, 3)}×${fmt(p.B, 3)}, глубина ${fmt(p.depth, 3)}`, sketch: sketch(p, plan) };
}

export default {
  id: 'pocket', title: 'Карманы', cat: 'cyc', tag: 'G41',
  defaults: { shape: 'rect', xc: '0', yc: '0', L: '60', B: '40', Rc: '6', Dp: '40', D: '10', depth: '10', ap: '3', step: '40', fin: '0.2', entry: 'helix', ang: '3', hp: '1', f: '600', fe: '300', ff: '400', safe: '5', dno: '1' },
  form: [
    { type: 'seg', k: 'shape', options: [['rect', 'Прямоугольный'], ['circle', 'Круглый']] },
    { type: 'num', k: 'xc', label: 'Центр X', unit: 'мм' },
    { type: 'num', k: 'yc', label: 'Центр Y', unit: 'мм' },
    { type: 'num', k: 'L', label: 'Длина по X', unit: 'мм', show: (v) => v.shape === 'rect' },
    { type: 'num', k: 'B', label: 'Ширина по Y', unit: 'мм', show: (v) => v.shape === 'rect' },
    { type: 'num', k: 'Rc', label: 'Радиус углов', unit: 'мм', show: (v) => v.shape === 'rect' },
    { type: 'num', k: 'Dp', label: 'Ø кармана', unit: 'мм', show: (v) => v.shape === 'circle' },
    { type: 'num', k: 'D', label: 'Ø фрезы', unit: 'мм' },
    { type: 'num', k: 'depth', label: 'Глубина (вниз от Z0)', unit: 'мм' },
    { type: 'num', k: 'ap', label: 'Глубина за проход ap', unit: 'мм' },
    { type: 'num', k: 'step', label: 'Шаг в сторону', unit: '% Ø' },
    { type: 'num', k: 'fin', label: 'Припуск на стенку', unit: 'мм' },
    { type: 'seg', k: 'entry', options: [['helix', 'Спираль'], ['ramp', 'Наклонно']] },
    { type: 'num', k: 'hp', label: 'Шаг спирали на виток', unit: 'мм', show: (v) => v.entry === 'helix' },
    { type: 'num', k: 'ang', label: 'Угол наклона', unit: '°', show: (v) => v.entry === 'ramp' },
    { type: 'num', k: 'f', label: 'F черновая', unit: 'мм/мин' },
    { type: 'num', k: 'fe', label: 'F врезания', unit: 'мм/мин' },
    { type: 'num', k: 'ff', label: 'F чистовая', unit: 'мм/мин' },
    { type: 'num', k: 'safe', label: 'Безопасный Z', unit: 'мм' },
    { type: 'num', k: 'dno', label: 'Коррекция D', unit: '№' },
  ],
  calc,
};
