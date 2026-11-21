// Циклы токарной стойки 0i-TF (система G-кодов A). Возвращают массив строк без номеров N.
import { fmt, word, diaWord, micro, int, pad2, join } from './format.js';
import { threadHeightMicrons, threadDepth } from '../core/thread.js';

// В системах B/C коды циклов другие. Данных для их безопасной генерации нет — не выводим ничего.
export function assertSystemA(gsys) {
  if (gsys && gsys !== 'A') {
    throw new Error('Выбрана система G-кодов ' + gsys + ': генерация циклов пока поддержана только для системы A (см. TODO_DATA.md). Переключите систему в настройках.');
  }
}

const ANGLES = [0, 29, 30, 55, 60, 80];

// G76 — многопроходная нарезка резьбы (два блока). Q и P в микронах, без точки.
export function g76Lines(o) {
  assertSystemA(o.gsys);
  const dec = o.dec ?? 3;
  const { P, D, external = true, zStart = 0, zEnd, finishPasses = 2, runout = P, angle = 60, firstCut, minCut = 0.1, finishAllow = 0.05, starts = 1 } = o;
  if (!(P > 0) || !(D > 0)) throw new Error('Не заданы диаметр и шаг резьбы');
  if (!Number.isFinite(zEnd)) throw new Error('Не задана конечная точка резьбы по Z');
  if (!ANGLES.includes(angle)) throw new Error('Угол профиля G76: допустимы ' + ANGLES.join(', '));
  if (!(finishPasses >= 1 && finishPasses <= 99)) throw new Error('Чистовых проходов 1…99');
  const rr = Math.max(0, Math.min(99, Math.round(runout / (0.1 * P))));
  const h = threadDepth(P, external);
  const xFinal = external ? D - 2 * h : D;
  const xStart = external ? D + 2 : D - 2 * h - 2;
  const lead = P * starts;
  const zApproach = zStart + Math.max(3 * lead, 3);
  const kMicro = threadHeightMicrons(P, external);
  const fc = firstCut > 0 ? firstCut : Math.max(0.1, h / 4);
  const lines = [];
  for (let s = 0; s < starts; s++) {
    if (starts > 1) lines.push(`(ZAHOD ${s + 1})`);
    lines.push(join('G00', word('X', xStart, dec), word('Z', zApproach + s * P, dec)));
    lines.push(join('G76', 'P' + pad2(finishPasses) + pad2(rr) + pad2(angle), 'Q' + micro(minCut), word('R', finishAllow, dec)));
    lines.push(join('G76', word('X', xFinal, dec), word('Z', zEnd, dec), 'R0.', 'P' + kMicro, 'Q' + micro(fc), word('F', lead, dec)));
  }
  return lines;
}

// G92 — резьбовой цикл, строка на каждый проход. xs — диаметры проходов.
export function g92Lines(o) {
  assertSystemA(o.gsys);
  const dec = o.dec ?? 3;
  const { P, D, external = true, zStart = 0, zEnd, xs, finishPasses = 1, starts = 1 } = o;
  if (!xs || !xs.length) throw new Error('Нет проходов резьбы');
  const h = threadDepth(P, external);
  const xStart = external ? D + 2 : D - 2 * h - 2;
  const lead = P * starts;
  const zApproach = zStart + Math.max(3 * lead, 3);
  const lines = [];
  for (let s = 0; s < starts; s++) {
    if (starts > 1) lines.push(`(ZAHOD ${s + 1})`);
    lines.push(join('G00', word('X', xStart, dec), word('Z', zApproach + s * P, dec)));
    xs.forEach((x, i) => lines.push(i === 0 ? join('G92', word('X', x, dec), word('Z', zEnd, dec), word('F', lead, dec)) : word('X', x, dec)));
    for (let i = 0; i < finishPasses; i++) lines.push(word('X', xs[xs.length - 1], dec));
    lines.push(join('G00', word('X', xStart, dec)));
  }
  return lines;
}

// ---------- G71 / G72 / G73 + G70 ----------
import { buildContour, contourBlocks, checkMonotonic, reverseSegs } from '../core/contour.js';
import { word as _w } from './format.js';

// rows — таблица контура; возвращает { lines, warn, segs } или бросает Error (код не выводится)
export function roughingLines(o) {
  assertSystemA(o.gsys);
  const dec = o.dec ?? 3;
  const { rows, cycle = 'G71', side = 'ext', holder = 'rear', dd, e, u, w, fRough, fFinish, blank, ns = 10, nf = 60, zApproach = 2 } = o;
  if (!(nf > ns)) throw new Error('Номер N конца контура должен быть больше номера начала');
  if (!(dd > 0) || !(e >= 0)) throw new Error('Задайте глубину прохода Δd > 0 и отвод e ≥ 0');
  if (!(fRough > 0) || !(fFinish > 0)) throw new Error('Задайте подачи: черновую и чистовую');
  if (!(blank > 0)) throw new Error(side === 'int' ? 'Задайте Ø предварительного отверстия' : 'Задайте Ø заготовки');
  const built = buildContour(rows, { holder, side });
  if (built.errors.length) throw new Error(built.errors[0]);
  let segs = built.segs;
  const warn = [];
  const maxD = Math.max(...rows.map((r) => r.d));
  const minD = Math.min(...rows.map((r) => r.d));
  if (side === 'ext' && maxD > blank + 1e-9) warn.push(`Ø контура ${fmt(maxD, 3)} больше заготовки ${fmt(blank, 3)}`);
  if (side === 'int' && minD < blank - 1e-9) warn.push(`Ø контура ${fmt(minD, 3)} меньше отверстия ${fmt(blank, 3)}`);
  if (cycle !== 'G73') {
    const mono = checkMonotonic(cycle === 'G72' ? reverseSegs(segs) : segs, { mode: cycle, side: side === 'int' ? 'int' : 'ext' });
    if (!mono.ok) throw new Error(`${mono.issues[0].text}. Для такого профиля G71/G72 не подходят — выберите G73`);
  }
  const finishSegs = typeof o.transform === 'function' ? o.transform(segs) : segs; // ручная компенсация r
  const clear = Math.max(e, 1);
  const startX = side === 'int' ? blank - 2 * clear : blank + 2 * clear;
  const uVal = side === 'int' ? -Math.abs(u ?? 0) : Math.abs(u ?? 0);
  const body = contourBlocks(finishSegs, { dec, holder, mode: cycle === 'G72' ? 'G72' : 'G71', ns, nf, fFinish, startX, startZ: zApproach });
  const lines = [join('G00', _w('X', startX, dec), _w('Z', zApproach, dec))];
  if (cycle === 'G71') {
    lines.push(join('G71', _w('U', dd, dec), _w('R', e, dec)));
    lines.push(join('G71', 'P' + ns, 'Q' + nf, _w('U', uVal, dec), _w('W', w ?? 0, dec), _w('F', fRough, dec)));
  } else if (cycle === 'G72') {
    lines.push(join('G72', _w('W', dd, dec), _w('R', e, dec)));
    lines.push(join('G72', 'P' + ns, 'Q' + nf, _w('U', uVal, dec), _w('W', w ?? 0, dec), _w('F', fRough, dec)));
  } else {
    const radial = Math.abs(blank - (side === 'int' ? maxD : minD)) / 2 + Math.abs(u ?? 0) / 2;
    const passes = Math.max(1, Math.ceil(radial / dd));
    warn.push('G73: припуск и число проходов рассчитаны ориентировочно (Δi = перепад Ø/2 + припуск, R = Δi/Δd). Проверьте в графике: цикл идёт по эквидистантам контура.');
    lines.push(join('G73', _w('U', side === 'int' ? -radial : radial, dec), _w('W', 0, dec), 'R' + passes));
    lines.push(join('G73', 'P' + ns, 'Q' + nf, _w('U', uVal, dec), _w('W', w ?? 0, dec), _w('F', fRough, dec)));
  }
  lines.push(...body);
  lines.push(join('G70', 'P' + ns, 'Q' + nf, _w('F', fFinish, dec)));
  return { lines, warn, segs, startX };
}
