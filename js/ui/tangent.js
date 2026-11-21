import { filletLineLine, filletLineCircle, filletCircleCircle, tangentFromPoint } from '../core/mill/tangent.js';
import { arcLine } from '../gcode/millCycles.js';
import { fmt, word, join } from '../gcode/format.js';
import { wrap } from './sketch.js';
import { nn } from './kit.js';
import { rad } from '../core/geometry.js';

const pt = (x, y) => ({ x, y });
const P2 = (q) => `X${q.x} Y${q.y}`;

function sketchPts(list, c) {
  const xs = list.map((p) => p.x), ys = list.map((p) => p.y);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const sc = 130 / Math.max(maxx - minx, maxy - miny, 1e-6);
  const X = (p) => 170 + (p.x - (minx + maxx) / 2) * sc, Y = (p) => 90 - (p.y - (miny + maxy) / 2) * sc;
  return wrap(340, 180, list.map((p, i) => `<circle cx="${X(p)}" cy="${Y(p)}" r="4" fill="${i < 2 ? '#F5A524' : '#6FB3FF'}"/>`).join('') + (c ? `<circle cx="${X(c)}" cy="${Y(c)}" r="3" fill="#9AA4B1"/>` : ''), 'Точки');
}

export function calc(p, s) {
  const dec = s.decimals;
  const f = (n) => fmt(n, dec);
  const res = [];
  let code = [];
  const warn = [];
  let sketch = '';
  const need = (...ks) => ks.every((k) => nn(p[k]));
  if (p.type === 'tp') {
    if (!need('px', 'py', 'cx', 'cy', 'R')) return { err: 'Заполните точку, центр и радиус' };
    const t = tangentFromPoint(pt(p.px, p.py), pt(p.cx, p.cy), p.R);
    if (t.error) return { err: t.error };
    t.forEach((x, i) => res.push([`Касание ${i + 1}`, `X${f(x.point.x)} Y${f(x.point.y)} · длина ${f(x.length)}`]));
    code = t.map((x) => join('G01', word('X', x.point.x, dec), word('Y', x.point.y, dec)));
    sketch = sketchPts([pt(p.px, p.py), pt(p.cx, p.cy), ...t.map((x) => x.point)], pt(p.cx, p.cy));
    return { results: res, code: [`(TOCHKA KASANIYA 1)`, code[0], `(TOCHKA KASANIYA 2: ZAMENIT)`], warn, sketch, tag: 'G01', title: 'Касательная из точки' };
  }
  if (p.type === 'll') {
    if (!need('ax', 'ay', 'cx', 'cy', 'bx', 'by', 'R')) return { err: 'Заполните три точки и радиус' };
    const r = filletLineLine(pt(p.ax, p.ay), pt(p.cx, p.cy), pt(p.bx, p.by), p.R);
    if (r.error) return { err: r.error };
    res.push(['Точка касания 1', `X${f(r.p1.x)} Y${f(r.p1.y)}`], ['Точка касания 2', `X${f(r.p2.x)} Y${f(r.p2.y)}`], ['Центр', `X${f(r.center.x)} Y${f(r.center.y)}`], ['Направление', r.ccw ? 'G03 (против часовой)' : 'G02 (по часовой)'], ['Угол дуги', f(r.sweep) + '°']);
    const a1 = arcLine({ from: r.p1, to: r.p2, center: r.center, ccw: r.ccw, fmt: 'r', dec });
    const a2 = arcLine({ from: r.p1, to: r.p2, center: r.center, ccw: r.ccw, fmt: 'ij', dec });
    code = [join('G01', word('X', r.p1.x, dec), word('Y', r.p1.y, dec)), a1.line, `(ILI CHEREZ I J)`, a2.line];
    sketch = sketchPts([r.p1, r.p2, pt(p.ax, p.ay), pt(p.cx, p.cy), pt(p.bx, p.by)], r.center);
    return { results: res, code, warn, sketch, tag: r.ccw ? 'G03' : 'G02', title: `Сопряжение R${f(p.R)} в углу X${f(p.cx)} Y${f(p.cy)}` };
  }
  const dirCode = p.dir === 'G02' ? 'G02' : 'G03';
  let cands = [];
  if (p.type === 'lc') {
    if (!need('lx', 'ly', 'la', 'cx', 'cy', 'r0', 'R')) return { err: 'Заполните прямую, окружность и радиус' };
    const d = pt(Math.cos(rad(p.la)), Math.sin(rad(p.la)));
    cands = filletLineCircle(pt(p.lx, p.ly), d, pt(p.cx, p.cy), p.r0, p.R, p.side, p.kind).map((c) => ({ center: c.center, a: c.tLine, b: c.tCircle }));
  } else {
    if (!need('cx', 'cy', 'r0', 'c2x', 'c2y', 'r2', 'R')) return { err: 'Заполните две окружности и радиус' };
    cands = filletCircleCircle(pt(p.cx, p.cy), p.r0, pt(p.c2x, p.c2y), p.r2, p.R, p.kind, p.kind2).map((c) => ({ center: c.center, a: c.t1, b: c.t2 }));
  }
  if (!cands.length) return { err: 'Решений нет: сопрягающая дуга не помещается. Измените R или тип касания' };
  cands.forEach((c, i) => res.push([`Вариант ${i + 1}`, `центр X${f(c.center.x)} Y${f(c.center.y)}`], [`  касание A / B`, `X${f(c.a.x)} Y${f(c.a.y)} / X${f(c.b.x)} Y${f(c.b.y)}`]));
  const c = cands[Math.min(Math.max(Math.round(p.variant || 1), 1), cands.length) - 1];
  const ccw = dirCode === 'G03';
  const a1 = arcLine({ from: c.a, to: c.b, center: c.center, ccw, fmt: 'r', dec });
  const a2 = arcLine({ from: c.a, to: c.b, center: c.center, ccw, fmt: 'ij', dec });
  code = [join('G01', word('X', c.a.x, dec), word('Y', c.a.y, dec)), a1.line, '(ILI CHEREZ I J)', a2.line];
  warn.push('Дуга идёт от точки A к точке B; проверьте направление G02/G03 по эскизу и в графике. Номер варианта и направление выбираются вручную.');
  if (a1.note) warn.push(a1.note);
  sketch = sketchPts([c.a, c.b, pt(p.cx, p.cy)], c.center);
  return { results: res, code, warn, sketch, tag: dirCode, title: 'Сопряжение ' + (p.type === 'lc' ? 'прямая–дуга' : 'дуга–дуга') };
}

export default {
  id: 'tangent', title: 'Сопряжения', cat: 'geo', tag: 'G03',
  defaults: { type: 'll', ax: '0', ay: '0', cx: '50', cy: '0', bx: '50', by: '30', R: '5', px: '0', py: '0', lx: '0', ly: '0', la: '0', r0: '10', side: 'left', kind: 'ext', kind2: 'ext', c2x: '40', c2y: '0', r2: '10', dir: 'G03', variant: '1' },
  form: [
    { type: 'seg', k: 'type', options: [['ll', 'Прямая–прямая'], ['tp', 'Из точки'], ['lc', 'Прямая–дуга'], ['cc', 'Дуга–дуга']] },
    { type: 'num', k: 'ax', label: 'A: X (подход)', unit: 'мм', show: (v) => v.type === 'll' },
    { type: 'num', k: 'ay', label: 'A: Y', unit: 'мм', show: (v) => v.type === 'll' },
    { type: 'num', k: 'cx', label: (v) => ({ ll: 'C: X (угол)', tp: 'Центр: X', lc: 'Окружность: центр X', cc: 'Окружность 1: X' })[v.type], unit: 'мм' },
    { type: 'num', k: 'cy', label: (v) => ({ ll: 'C: Y (угол)', tp: 'Центр: Y', lc: 'Окружность: центр Y', cc: 'Окружность 1: Y' })[v.type], unit: 'мм' },
    { type: 'num', k: 'bx', label: 'B: X (отход)', unit: 'мм', show: (v) => v.type === 'll' },
    { type: 'num', k: 'by', label: 'B: Y', unit: 'мм', show: (v) => v.type === 'll' },
    { type: 'num', k: 'px', label: 'Точка P: X', unit: 'мм', show: (v) => v.type === 'tp' },
    { type: 'num', k: 'py', label: 'Точка P: Y', unit: 'мм', show: (v) => v.type === 'tp' },
    { type: 'num', k: 'lx', label: 'Прямая: точка X', unit: 'мм', show: (v) => v.type === 'lc' },
    { type: 'num', k: 'ly', label: 'Прямая: точка Y', unit: 'мм', show: (v) => v.type === 'lc' },
    { type: 'num', k: 'la', label: 'Прямая: угол', unit: '°', show: (v) => v.type === 'lc' },
    { type: 'num', k: 'r0', label: 'Радиус окружности / дуги 1', unit: 'мм', show: (v) => v.type === 'lc' || v.type === 'cc' },
    { type: 'num', k: 'c2x', label: 'Окружность 2: X', unit: 'мм', show: (v) => v.type === 'cc' },
    { type: 'num', k: 'c2y', label: 'Окружность 2: Y', unit: 'мм', show: (v) => v.type === 'cc' },
    { type: 'num', k: 'r2', label: 'Окружность 2: радиус', unit: 'мм', show: (v) => v.type === 'cc' },
    { type: 'num', k: 'R', label: 'Радиус сопряжения / окружности', unit: 'мм' },
    { type: 'seg', k: 'side', options: [['left', 'Слева от прямой'], ['right', 'Справа']], show: (v) => v.type === 'lc' },
    { type: 'seg', k: 'kind', options: [['ext', 'Снаружи'], ['int', 'Внутри']], show: (v) => v.type === 'lc' || v.type === 'cc' },
    { type: 'seg', k: 'kind2', options: [['ext', 'Окр.2 снаружи'], ['int', 'Окр.2 внутри']], show: (v) => v.type === 'cc' },
    { type: 'seg', k: 'dir', options: [['G03', 'G03'], ['G02', 'G02']], show: (v) => v.type === 'lc' || v.type === 'cc' },
    { type: 'num', k: 'variant', label: 'Номер варианта', unit: '', show: (v) => v.type === 'lc' || v.type === 'cc' },
  ],
  calc,
};
