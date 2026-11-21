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
