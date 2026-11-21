import { edge, holeCenter, bossCenter, corner, g10Lines } from '../core/mill/probing.js';
import { fmt, join } from '../gcode/format.js';
import { nn, toast } from './kit.js';
import * as store from '../store.js';

const WCS = ['G54', 'G55', 'G56', 'G57', 'G58', 'G59', 'G54.1'];

export function calc(p, s) {
  const dec = s.decimals;
  const f = (n) => fmt(n, dec);
  const res = [];
  const warn = [];
  let X, Y;
  if (p.mode === 'tool') {
    const L = String(p.lcode || '').trim();
    const rows = String(p.tools || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!L) return { err: 'Укажите код L из руководства на 0i-F (формат G10 для коррекций не подтверждён). Без него код не выводится.', beta: true };
    const lines = [];
    for (const row of rows) {
      const [n, ...vals] = row.split(/[\s;]+/);
      if (!/^\d+$/.test(n) || !vals.length || vals.some((v) => !Number.isFinite(parseFloat(v.replace(',', '.'))))) return { err: `Строка «${row}»: ожидается «номер значение» (для токарки — «номер X Z»)`, beta: true };
      const nums = vals.map((v) => fmt(parseFloat(v.replace(',', '.')), dec));
      lines.push(s.profile === 'MF' ? `G10 L${L} P${n} R${nums[0]}` : `G10 L${L} P${n} X${nums[0]}${nums[1] !== undefined ? ' Z' + nums[1] : ''}`);
    }
    if (!lines.length) return { err: 'Введите строки: номер коррекции и значение', beta: true };
    return { warn: ['БЕТА: формат G10 для коррекций инструмента не проверен на станке. Сверьте код L и слова с руководством 0i-F, сначала выполните в MDI для одной коррекции.'], results: [['Строк', String(lines.length)]], code: lines, tag: 'G10', title: 'G10 коррекции (бета)' };
  }
  const D = p.probeD;
  if (!nn(D) || D <= 0) return { err: 'Укажите Ø щупа' };
  if (p.mode === 'edge') {
    if (!nn(p.xt)) return { err: 'Введите машинную координату касания' };
    const e = edge(p.xt, D, p.side);
    const part = nn(p.partCoord) ? p.partCoord : 0;
    X = e - part;
    res.push(['Кромка (машинная)', f(e)], ['Смещение для детали', f(X)]);
    if (p.axis === 'Y') { Y = X; X = undefined; }
  } else if (p.mode === 'hole' || p.mode === 'boss') {
    if (![p.x1, p.x2, p.y1, p.y2].every(nn)) return { err: 'Введите четыре касания: X1, X2, Y1, Y2' };
    const r = (p.mode === 'hole' ? holeCenter : bossCenter)({ x1: p.x1, x2: p.x2, y1: p.y1, y2: p.y2, probeD: D });
    X = r.cx; Y = r.cy;
    res.push(['Центр X / Y', `${f(r.cx)} / ${f(r.cy)}`], ['Ø по X', f(r.dx)], ['Ø по Y', f(r.dy)], ['Овальность', f(r.ovality)]);
  } else {
    if (!nn(p.xt) || !nn(p.yt)) return { err: 'Введите касания по X и по Y' };
    const c = corner({ xTouch: p.xt, yTouch: p.yt, probeD: D, xSide: p.side, ySide: p.side2 });
    X = c.x; Y = c.y;
    res.push(['Угол X / Y (машинные)', `${f(c.x)} / ${f(c.y)}`]);
  }
  let code = [];
  let err = null;
  if (s.profile !== 'MF') warn.push('G10 L2 — для фрезерной стойки. Переключите профиль на 0i-MF.');
  try {
    code = g10Lines({ wcs: p.wcs, p54: nn(p.p54) ? p.p54 : 1, x: X, y: Y, z: nn(p.zv) ? p.zv : undefined }, f);
  } catch (e) { err = e.message; }
  if (p.mode === 'hole' || p.mode === 'boss') {
    const d = (p.mode === 'hole' ? 1 : -1);
    void d;
  }
  return {
    err, warn, results: res, code, tag: 'G10', title: `Привязка ${p.wcs}`, journal: { wcs: p.wcs, values: res.map(([a, b]) => `${a}: ${b}`).join('; '), code: code.join(' ') },
    extra: `<div class="btns"><button class="btn" type="button" data-act="x:journal">В журнал наладки</button></div>`,
  };
}

export default {
  id: 'probing', title: 'Привязка и G10', cat: 'set', tag: 'G10',
  defaults: { mode: 'hole', probeD: '10', wcs: 'G54', p54: '1', side: 'minus', side2: 'minus', axis: 'X', xt: '', yt: '', partCoord: '0', x1: '-245.32', x2: '-195.28', y1: '-160.11', y2: '-110.05', zv: '', part: '', lcode: '', tools: '' },
  form: [
    { type: 'seg', k: 'mode', options: [['edge', 'Кромка'], ['hole', 'Отверстие'], ['boss', 'Бобышка'], ['corner', 'Угол'], ['tool', 'Коррекции']] },
    { type: 'note', text: 'Вводите МАШИННЫЕ координаты (POS → MACHINE). Режим «Коррекции» — бета: формат G10 не проверен на станке.', },
    { type: 'num', k: 'probeD', label: 'Ø щупа', unit: 'мм', show: (v) => v.mode !== 'tool' },
    { type: 'num', k: 'xt', label: 'Касание X (машинная)', unit: 'мм', show: (v) => v.mode === 'edge' || v.mode === 'corner' },
    { type: 'num', k: 'yt', label: 'Касание Y (машинная)', unit: 'мм', show: (v) => v.mode === 'corner' },
    { type: 'seg', k: 'axis', options: [['X', 'Кромка по X'], ['Y', 'Кромка по Y']], show: (v) => v.mode === 'edge' },
    { type: 'seg', k: 'side', options: [['minus', 'Касание со стороны −'], ['plus', 'Касание со стороны +']], show: (v) => v.mode === 'edge' || v.mode === 'corner' },
    { type: 'seg', k: 'side2', options: [['minus', 'Y: со стороны −'], ['plus', 'Y: со стороны +']], show: (v) => v.mode === 'corner' },
    { type: 'num', k: 'partCoord', label: 'Координата кромки в детали', unit: 'мм', show: (v) => v.mode === 'edge' },
    { type: 'num', k: 'x1', label: 'X1', unit: 'мм', show: (v) => v.mode === 'hole' || v.mode === 'boss' },
    { type: 'num', k: 'x2', label: 'X2', unit: 'мм', show: (v) => v.mode === 'hole' || v.mode === 'boss' },
    { type: 'num', k: 'y1', label: 'Y1', unit: 'мм', show: (v) => v.mode === 'hole' || v.mode === 'boss' },
    { type: 'num', k: 'y2', label: 'Y2', unit: 'мм', show: (v) => v.mode === 'hole' || v.mode === 'boss' },
    { type: 'select', k: 'wcs', label: 'Система координат', options: WCS.map((w) => [w, w]), show: (v) => v.mode !== 'tool' },
    { type: 'num', k: 'p54', label: 'G54.1: номер P (1–48)', unit: '', show: (v) => v.mode !== 'tool' && v.wcs === 'G54.1' },
    { type: 'num', k: 'zv', label: 'Z (если нужно)', unit: 'мм', show: (v) => v.mode !== 'tool' },
    { type: 'text', k: 'part', label: 'Деталь (для журнала)', full: true, show: (v) => v.mode !== 'tool' },
    { type: 'text', k: 'lcode', label: 'Код L из руководства 0i-F', show: (v) => v.mode === 'tool' },
    { type: 'text', k: 'tools', label: 'Коррекции: «номер значение» по строке', full: true, show: (v) => v.mode === 'tool' },
  ],
  calc,
  beta: false,
  onAct(act, { r, v }) {
    if (act !== 'journal' || !r || !r.journal) return;
    const list = store.load('journal', []);
    list.unshift({ date: new Date().toISOString(), part: v.part || '', ...r.journal });
    store.save('journal', list.slice(0, 200));
    toast('Записано в журнал наладки');
  },
};
