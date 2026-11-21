import { calcThread } from '../core/thread.js';
import { THREADS, threadData } from '../data/threads.js';
import { g76Lines, g92Lines } from '../gcode/cycles.js';
import { fmt } from '../gcode/format.js';
import { threadSketch } from './sketch.js';
import { nn } from './kit.js';

function pitchOptions(size) {
  const t = threadData(size);
  if (!t) return [];
  return [[String(t.coarse), `${t.coarse} (крупный)`], ...t.fine.map((f) => [String(f), `${f} (мелкий)`])];
}

export function calc(p, s) {
  const dec = s.decimals;
  const ext = p.side !== 'int';
  let D, P, warn = [];
  if (p.kind === 'table') {
    const t = threadData(p.size);
    if (!t) return { err: 'Нет данных для этого размера. Выберите «Своя» и введите диаметр и шаг вручную.', sketch: threadSketch({ external: ext }) };
    D = t.d;
    P = parseFloat(p.pitch);
    if (!nn(P) || !pitchOptions(p.size).some(([v]) => parseFloat(v) === P)) P = t.coarse;
  } else { D = p.D; P = p.P; }
  if (!nn(D) || !nn(P) || D <= 0 || P <= 0) return { err: 'Укажите диаметр и шаг', sketch: threadSketch({ external: ext }) };
  if (!nn(p.length) || p.length <= 0) return { err: 'Укажите длину резьбы', sketch: threadSketch({ external: ext, P }) };
  const starts = nn(p.starts) && p.starts >= 1 ? Math.round(p.starts) : 1;
  const z0 = nn(p.z0) ? p.z0 : 0;
  const th = calcThread({ D, P, external: ext, length: p.length, firstCut: p.firstCut, minCut: nn(p.minCut) ? p.minCut : 0.1, starts, z0 });
  if (th.error) return { err: th.error };
  const res = [
    ['Глубина профиля h (на радиус)', fmt(th.h, 4)], ['k для G76 (мкм)', String(th.kMicro)],
    [ext ? 'Диаметр под резьбу (рекомендация D − 0.1·P)' : 'Диаметр отверстия под резьбу', fmt(ext ? th.turnD : th.holeD, dec)],
    [ext ? 'Внутренний Ø резьбы (X конечный)' : 'Конечный Ø (X)', fmt(th.finalX, dec)], ['Число проходов', String(th.passes.length)],
    ['Конечная точка Z', fmt(th.zEnd, dec)],
  ];
  if (starts > 1) warn.push(`Многозаходная резьба (${starts} захода): ход F = ${fmt(P * starts, dec)}, старт каждого захода сдвинут по Z на шаг. Проверьте в графике и на воздухе.`);
  if (p.angle && !['60', '55', '30', '29', '80', '0'].includes(String(p.angle))) warn.push('Нестандартный угол профиля для G76');
  let code = [], err = null;
  try {
    if (p.out === 'g92') code = g92Lines({ gsys: s.gsys, dec, P, D, external: ext, zStart: z0, zEnd: th.zEnd, xs: th.passes.map((x) => x.x), starts, finishPasses: nn(p.finish) ? p.finish : 1 });
    else code = g76Lines({ gsys: s.gsys, dec, P, D, external: ext, zStart: z0, zEnd: th.zEnd, finishPasses: nn(p.finish) ? p.finish : 2, runout: nn(p.runout) ? p.runout : P, angle: nn(p.angle) ? p.angle : 60, firstCut: p.firstCut, minCut: nn(p.minCut) ? p.minCut : 0.1, starts });
  } catch (e) { err = e.message; }
  const rows = th.passes.map((x) => `<div class="row"><span>Проход ${x.n}</span><b>h ${fmt(x.depth, 3)} · X${fmt(x.x, dec)}</b></div>`).join('');
  return {
    err, warn, results: res, code, tag: p.out === 'g92' ? 'G92' : 'G76', title: `M${fmt(D, 3).replace(/\.$/, '')}×${fmt(P, 3).replace(/\.$/, '')} ${ext ? 'наружная' : 'внутренняя'}, L${fmt(p.length, 3).replace(/\.$/, '')}`,
    sketch: threadSketch({ external: ext, P, h: th.h }), extra: `<section><h2 class="h2">Таблица проходов</h2><div class="card pad">${rows}</div></section>`,
  };
}

export default {
  id: 'thread', title: 'Резьба', cat: 'cyc', tag: 'G76',
  defaults: { side: 'ext', kind: 'table', size: Object.keys(THREADS)[0], pitch: '2.5', D: '20', P: '2.5', length: '30', z0: '0', runout: '2.5', starts: '1', firstCut: '0.4', minCut: '0.1', finish: '2', angle: '60', out: 'g76' },
  form: [
    { type: 'seg', k: 'side', options: [['ext', 'Наружная'], ['int', 'Внутренняя']] },
    { type: 'seg', k: 'kind', options: [['table', 'Метрическая'], ['custom', 'Своя']] },
    { type: 'select', k: 'size', label: 'Размер', options: Object.keys(THREADS).map((k) => [k, k]), show: (v) => v.kind === 'table' },
    { type: 'select', k: 'pitch', label: 'Шаг P, мм', options: (v) => pitchOptions(v.size), show: (v) => v.kind === 'table' },
    { type: 'note', text: 'В таблице только проверенные размеры (M20). Для остальных выберите «Своя» и введите Ø и шаг — полная таблица M3–M64 будет добавлена из стандарта (TODO_DATA.md).', show: (v) => v.kind === 'table' },
    { type: 'num', k: 'D', label: 'Номинальный Ø, D', unit: 'мм', show: (v) => v.kind === 'custom' },
    { type: 'num', k: 'P', label: 'Шаг, P', unit: 'мм', show: (v) => v.kind === 'custom' },
    { type: 'num', k: 'length', label: 'Длина резьбы', unit: 'мм' },
    { type: 'num', k: 'z0', label: 'Z начала', unit: 'мм' },
    { type: 'num', k: 'runout', label: 'Сбег (фаска выхода)', unit: 'мм' },
    { type: 'num', k: 'starts', label: 'Заходов', unit: '' },
    { type: 'num', k: 'firstCut', label: 'Первый проход Δd', unit: 'мм' },
    { type: 'num', k: 'minCut', label: 'Мин. проход Δdmin', unit: 'мм' },
    { type: 'num', k: 'finish', label: 'Чистовых проходов', unit: '' },
    { type: 'seg', k: 'out', options: [['g76', 'G76'], ['g92', 'G92']] },
  ],
  calc,
};
