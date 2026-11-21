// Сборка программы: шапка, концовка, нумерация N, проверка номеров, экспорт. Чистые функции.
import { comment, int, join, word, translit, pad2 } from './format.js';

export const DEFAULT_OPTS = {
  TF: { title: 'DETAL', o: 1001, tool: '0101', mode: 'g96', vc: 200, rpm: 1000, g50: 3000, ref: false },
  MF: { title: 'DETAL', o: 1001, wcs: 'G54', tool: 1, rpm: 3000, h: 1, safeZ: 100, homeXY: false },
};

const must = (cond, msg) => { if (!cond) throw new Error(msg); };

// Шапка TF: %, O####, комментарий, G21 G40 G99, G28 (опц.), T, G50 S, G96 S M03
export function headerTF(o, { feedMode = 'G99', dec = 3 } = {}) {
  must(Number.isFinite(o.o) && o.o > 0 && o.o < 10000, 'Номер программы O — от 1 до 9999');
  must(/^\d{3,4}$/.test(String(o.tool)), 'Инструмент T — четыре цифры, например 0101');
  const lines = ['%', join('O' + String(Math.round(o.o)).padStart(4, '0'), comment(o.title)), join('G21', 'G40', feedMode)];
  if (o.ref) lines.push('G28 U0. W0.');
  lines.push('T' + String(o.tool).padStart(4, '0'));
  if (o.mode === 'g96') {
    must(o.vc > 0 && o.g50 > 0, 'Для G96 нужны Vc и ограничение G50 S (G50 всегда перед G96)');
    lines.push('G50 S' + int(o.g50));
    lines.push(join('G96', 'S' + int(o.vc), 'M03'));
  } else {
    must(o.rpm > 0, 'Задайте обороты S');
    lines.push(join('G97', 'S' + int(o.rpm), 'M03'));
  }
  void dec;
  return lines;
}
export function footerTF() { return ['G28 U0. W0.', 'M05', 'M30', '%']; }

export function headerMF(o, { dec = 3 } = {}) {
  must(Number.isFinite(o.o) && o.o > 0 && o.o < 10000, 'Номер программы O — от 1 до 9999');
  must(['G54', 'G55', 'G56', 'G57', 'G58', 'G59'].includes(o.wcs) || /^G54\.1 P\d+$/.test(o.wcs), 'Система координат G54–G59 или «G54.1 P…»');
  must(o.rpm > 0, 'Задайте обороты S');
  must(Number.isFinite(o.safeZ), 'Задайте безопасный Z');
  return [
    '%', join('O' + String(Math.round(o.o)).padStart(4, '0'), comment(o.title)),
    'G17 G21 G40 G49 G80 G90 G94', o.wcs, join('T' + pad2(o.tool), 'M06'), join('S' + int(o.rpm), 'M03'),
    join('G00', 'G43', word('Z', o.safeZ, dec), 'H' + pad2(o.h)),
  ];
}
export function footerMF(o) {
  return ['G91 G28 Z0.', ...(o.homeXY ? ['G28 X0. Y0.'] : []), 'M05', 'M30', '%'];
}

// Нумерация N: пропускает %, O-строку и строки с уже существующим N; занятые номера (например, контуры G71) не повторяются
export function numberLines(lines, step = 10) {
  const used = new Set();
  for (const l of lines) { const m = l.match(/^N(\d+)\b/); if (m) used.add(+m[1]); }
  let n = step;
  return lines.map((l) => {
    if (l === '%' || /^O\d+/.test(l) || /^N\d+/.test(l) || !l.trim()) return l;
    while (used.has(n)) n += step;
    used.add(n);
    const out = `N${n} ${l}`;
    n += step;
    return out;
  });
}

// Повторяющиеся номера N (G70 P.. найдёт первый)
export function duplicateN(lines) {
  const seen = new Map();
  const dup = [];
  lines.forEach((l, i) => { const m = l.match(/^N(\d+)\b/); if (m) { if (seen.has(m[1])) dup.push({ n: +m[1], line: i + 1, first: seen.get(m[1]) }); else seen.set(m[1], i + 1); } });
  return dup;
}

// Полная программа. blocks: [{title, lines, profile}], opts — шапка, s — настройки
export function buildProgram(blocks, opts, s) {
  const prof = s.profile === 'MF' ? 'MF' : 'TF';
  const foreign = blocks.filter((b) => b.profile && b.profile !== prof);
  must(!foreign.length, `Блок «${foreign[0] && foreign[0].title}» из другого профиля (${foreign[0] && foreign[0].profile}) — удалите его или переключите профиль`);
  const o = { ...DEFAULT_OPTS[prof], ...opts };
  const head = prof === 'MF' ? headerMF(o, { dec: s.decimals }) : headerTF(o, { feedMode: s.feedMode, dec: s.decimals });
  const foot = prof === 'MF' ? footerMF(o) : footerTF(o);
  const body = [];
  for (const b of blocks) { body.push(...b.lines); }
  let lines = [...head, ...body, ...foot];
  if (s.numbering) lines = numberLines(lines, s.numStep || 10);
  return lines;
}

export const toFileText = (lines) => lines.join('\r\n') + '\r\n';
export const fileName = (o, ext = 'nc') => `O${String(Math.round(o)).padStart(4, '0')}.${ext}`;
export const safeTitle = (t) => translit(t) || 'DETAL';
