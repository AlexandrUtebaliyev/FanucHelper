import { facing } from '../core/mill/facing.js';
import { facingLines } from '../gcode/millCycles.js';
import { fmt } from '../gcode/format.js';
import { wrap } from './sketch.js';
import { nn } from './kit.js';

function sketch(p, fc) {
  if (!fc || fc.error) return wrap(340, 160, '');
  const sc = Math.min(260 / (fc.xe - fc.xs), 110 / (p.B + p.D));
  const X = (x) => 40 + (x - fc.xs) * sc, Y = (y) => 140 - (y + p.D / 2) * sc;
  let path = '';
  fc.ys.forEach((y, i) => {
    const a = fc.mode === 'zigzag' && i % 2 === 1 ? fc.xe : fc.xs, b = fc.mode === 'zigzag' && i % 2 === 1 ? fc.xs : fc.xe;
    path += `M${X(a)} ${Y(y)} L${X(b)} ${Y(y)}`;
    if (i < fc.ys.length - 1 && fc.mode === 'zigzag') path += ` L${X(b)} ${Y(fc.ys[i + 1])}`;
  });
  return wrap(340, 160, `<rect x="${X(0)}" y="${Y(p.B)}" width="${p.L * sc}" height="${p.B * sc}" fill="#232830" stroke="#ECEFF3"/><path d="${path}" fill="none" stroke="#F5A524" stroke-width="1.5"/>`, 'Эскиз торцовки');
}

export function calc(p, s) {
  const dec = s.decimals;
  const fc = facing({ L: p.L, B: p.B, D: p.D, overlap: p.overlap, ap: p.ap, total: p.total, mode: p.mode, overhang: nn(p.ov) ? p.ov : 1, safeZ: nn(p.safe) ? p.safe : 5, feed: p.f });
  if (fc.error) return { err: fc.error };
  if (!(p.f > 0)) return { err: 'Задайте подачу F' };
  const res = [
    ['Дорожек по Y', String(fc.rows)], ['Шаг по Y (факт.)', fmt(fc.stepAct, dec)], ['Проходов по Z', String(fc.nz)], ['ap (факт.)', fmt(fc.apAct, dec)],
    ['Путь резания', fmt(fc.pathLen, 1) + ' мм'], ['Время', fmt(fc.minutes, 2) + ' мин'],
  ];
  let code = [], err = null;
  try { code = facingLines(fc, { feed: p.f, dec }); } catch (e) { err = e.message; }
  const warn = [...fc.warn, 'Начало: фреза слева-снизу от заготовки, X0 Y0 — угол детали, Z0 — верхняя поверхность. Подход по Z выполняется вне материала.'];
  return { err, warn, results: res, code, tag: 'G01', title: `Торцовка ${fmt(p.L, 1)}×${fmt(p.B, 1)}, Ø${fmt(p.D, 1)}`, sketch: sketch(p, fc), stock: { x: [0, p.L], y: [0, p.B] } };
}

export default {
  id: 'facing', title: 'Торцовка', cat: 'cyc', tag: 'G01',
  defaults: { L: '100', B: '60', D: '50', overlap: '30', ap: '1', total: '2', ov: '1', safe: '5', f: '800', mode: 'zigzag' },
  form: [
    { type: 'num', k: 'L', label: 'Длина по X', unit: 'мм' },
    { type: 'num', k: 'B', label: 'Ширина по Y', unit: 'мм' },
    { type: 'num', k: 'D', label: 'Ø фрезы', unit: 'мм' },
    { type: 'num', k: 'overlap', label: 'Перекрытие', unit: '% от Ø' },
    { type: 'num', k: 'ap', label: 'Глубина за проход ap', unit: 'мм' },
    { type: 'num', k: 'total', label: 'Общий съём', unit: 'мм' },
    { type: 'num', k: 'ov', label: 'Вылет за край', unit: 'мм' },
    { type: 'num', k: 'safe', label: 'Безопасный Z', unit: 'мм' },
    { type: 'num', k: 'f', label: 'Подача F', unit: 'мм/мин' },
    { type: 'seg', k: 'mode', options: [['zigzag', 'Зигзаг'], ['oneway', 'В одну сторону']] },
  ],
  calc,
};
