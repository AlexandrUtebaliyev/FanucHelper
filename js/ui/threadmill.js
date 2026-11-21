import { threadMill } from '../core/mill/threadMill.js';
import { threadMillLines } from '../gcode/millCycles.js';
import { THREADS, threadData } from '../data/threads.js';
import { fmt } from '../gcode/format.js';
import { highlight } from './highlight.js';
import { threadSketch } from './sketch.js';
import { nn } from './kit.js';

export function calc(p, s) {
  const dec = s.decimals;
  const external = p.side === 'ext';
  let D, P;
  if (p.kind === 'table') {
    const t = threadData(p.size);
    if (!t) return { err: 'Нет данных для этого размера. Выберите «Свой шаг» и введите Ø и шаг вручную.' };
    D = t.d; P = t.coarse;
  } else { D = p.D; P = p.P; }
  const tm = threadMill({ D, P, external, cutter: p.cutter, depth: nn(p.depth) ? Math.abs(p.depth) : NaN, F: p.f, hand: p.hand, climb: p.mode !== 'conv', xc: nn(p.xc) ? p.xc : 0, yc: nn(p.yc) ? p.yc : 0 });
  if (tm.error) return { err: tm.error, sketch: threadSketch({ external }) };
  const out = threadMillLines(tm, { P, depth: Math.abs(p.depth), F: p.f, safeZ: nn(p.safe) ? p.safe : 5, dec, sub: !!p.sub, subNo: nn(p.subNo) ? Math.round(p.subNo) : 8001 });
  const res = [
    ['Радиус пути центра', fmt(tm.radius, 3)], ['Подача центра', fmt(tm.fCenter, 1)], ['Полных витков', String(tm.full)], ['Полудуг', '2 (вход и выход)'],
    ['Направление', `${tm.ccw ? 'G03' : 'G02'}, ${tm.up ? 'снизу вверх' : 'сверху вниз'}`], ['Последний Z', fmt(out.zEnd, 3)],
  ];
  const warn = [...tm.warn, 'Подача F — на кромке фрезы; на дугах программируется подача центра (пересчитана). Проверьте в графике и на воздухе, выдержите коррекцию на износ.'];
  if (p.sub) warn.push(`Подпрограмма O${p.subNo} загружается отдельной программой (текст ниже). Не вставляйте её в тело основной.`);
  return {
    warn, results: res, code: out.lines, tag: 'G03', title: `Резьбофреза M${fmt(D, 3).replace(/\.$/, '')}×${fmt(P, 3).replace(/\.$/, '')}`, sketch: threadSketch({ external, P, h: 0 }),
    extra: out.subLines ? `<section><h2 class="h2">Подпрограмма</h2><div class="code">${highlight(out.subLines)}</div></section>` : '',
  };
}

export default {
  id: 'threadmill', title: 'Резьбофрезерование', cat: 'cyc', tag: 'G03',
  defaults: { side: 'int', kind: 'table', size: Object.keys(THREADS)[0], D: '20', P: '2.5', cutter: '14', depth: '20', xc: '0', yc: '0', f: '250', safe: '5', hand: 'right', mode: 'climb', sub: false, subNo: '8001' },
  form: [
    { type: 'seg', k: 'side', options: [['int', 'Внутренняя'], ['ext', 'Наружная']] },
    { type: 'seg', k: 'kind', options: [['table', 'Из таблицы'], ['custom', 'Свой шаг']] },
    { type: 'select', k: 'size', label: 'Размер', options: Object.keys(THREADS).map((k) => [k, k]), show: (v) => v.kind === 'table' },
    { type: 'num', k: 'D', label: 'Номинальный Ø', unit: 'мм', show: (v) => v.kind === 'custom' },
    { type: 'num', k: 'P', label: 'Шаг', unit: 'мм', show: (v) => v.kind === 'custom' },
    { type: 'num', k: 'cutter', label: 'Ø фрезы', unit: 'мм' },
    { type: 'num', k: 'depth', label: 'Глубина резьбы (вниз от Z0)', unit: 'мм' },
    { type: 'num', k: 'xc', label: 'Центр X', unit: 'мм' },
    { type: 'num', k: 'yc', label: 'Центр Y', unit: 'мм' },
    { type: 'num', k: 'f', label: 'F на кромке', unit: 'мм/мин' },
    { type: 'num', k: 'safe', label: 'Безопасный Z', unit: 'мм' },
    { type: 'seg', k: 'hand', options: [['right', 'Правая'], ['left', 'Левая']] },
    { type: 'seg', k: 'mode', options: [['climb', 'Попутное'], ['conv', 'Встречное']] },
    { type: 'check', k: 'sub', label: 'Через подпрограмму G91' },
    { type: 'num', k: 'subNo', label: 'Номер подпрограммы O', unit: '', show: (v) => v.sub },
  ],
  calc,
};
