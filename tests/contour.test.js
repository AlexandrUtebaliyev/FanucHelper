import test from 'node:test';
import assert from 'node:assert/strict';
import { compensateContour, compensateLine } from '../js/core/noseRadius.js';
import { buildContour, checkMonotonic, parseTag } from '../js/core/contour.js';
import { roughingLines } from '../js/gcode/cycles.js';
import { parseGcode } from '../js/gcode/parse.js';
import { runChecks, analyze } from '../js/gcode/check.js';

const close = (a, b, e = 1e-3) => assert.ok(Math.abs(a - b) <= e, `${a} !≈ ${b}`);

// Вал-12 из п. 3.6: Ø20 с фаской C1, уступ Ø30 с R0.5, заготовка Ø42
const VAL12 = [
  { d: 20, z: 0, tag: 'C1' }, { d: 20, z: -15, tag: '' }, { d: 30, z: -15, tag: 'R0.5' }, { d: 30, z: -40, tag: '' }, { d: 42, z: -40, tag: '' },
];
const base = { gsys: 'A', rows: VAL12, cycle: 'G71', dd: 1.5, e: 0.5, u: 0.4, w: 0.1, fRough: 0.25, fFinish: 0.1, blank: 42, ns: 10, nf: 60, zApproach: 2 };

test('компенсация: r=0.8, фаска 45° → ΔZ 0.469, ΔX 0.937 (на Ø)', () => {
  // торец Z0 → фаска 45° (c=2) → цилиндр R=10, от торца к патрону
  const c = 2, R = 10;
  const segs = [
    { type: 'line', p: { x: 0, y: 0 }, q: { x: 0, y: R - c } },
    { type: 'line', p: { x: 0, y: R - c }, q: { x: -c, y: R } },
    { type: 'line', p: { x: -c, y: R }, q: { x: -30, y: R } },
  ];
  const r = compensateContour(segs, { r: 0.8, tip: 3, side: 'right' });
  assert.ok(!r.error, r.error);
  close(Math.abs(r.deltas[1].dd), 0.937);
  close(Math.abs(r.deltas[2].dz), 0.469); // вершина «фаска–цилиндр»: по Z — 0.469, по Ø нет
  close(Math.abs(r.deltas[2].dd), 0, 1e-6);
  close(Math.abs(r.deltas[1].dz), 0, 1e-6);
});
test('компенсация: проверка частной формулой r(1 − tg 22.5°)', () => {
  close(0.8 * (1 - Math.tan(Math.PI / 8)), 0.4686, 1e-4);
});
test('компенсация: T5–T8 — нет данных, не выводит', () => {
  const r = compensateLine({ x: 0, y: 5 }, { x: -10, y: 5 }, { r: 0.4, tip: 6 });
  assert.match(r.error, /нет данных/);
});
test('компенсация: угол торец–цилиндр при T3 остаётся на месте (вершина лежит на контуре)', () => {
  const r = compensateContour([{ type: 'line', p: { x: 0, y: 0 }, q: { x: 0, y: 5 } }, { type: 'line', p: { x: 0, y: 5 }, q: { x: -10, y: 5 } }], { r: 0.8, tip: 3 });
  close(r.deltas[1].dd, 0, 1e-9);
  close(r.deltas[1].dz, 0, 1e-9);
});
test('контур Вал-12: 8 сегментов и дуга R0.5 G03', () => {
  const b = buildContour(VAL12, { holder: 'rear' });
  assert.deepEqual(b.errors, []);
  assert.equal(b.segs.length, 6);
  assert.equal(b.segs.filter((s) => s.type === 'arc').length, 1);
});
test('монотонность: вал монотонный; «карман» — предупреждение и G73', () => {
  const ok = checkMonotonic(buildContour(VAL12).segs);
  assert.equal(ok.ok, true);
  const pocket = buildContour([{ d: 30, z: 0 }, { d: 30, z: -10 }, { d: 20, z: -10 }, { d: 20, z: -20 }, { d: 30, z: -20 }, { d: 42, z: -30 }].map((r) => ({ ...r, tag: '' })));
  const m = checkMonotonic(pocket.segs);
  assert.equal(m.ok, false);
  assert.equal(m.suggest, 'G73');
});
test('G71: первый блок контура содержит только X (без Z)', () => {
  const { lines } = roughingLines(base);
  const first = lines.find((l) => l.startsWith('N10'));
  assert.match(first, /^N10 G00 X18\.$/);
  assert.ok(!/Z/.test(first), 'в первом блоке не должно быть Z');
});
test('G71: полный кусок программы как в макете', () => {
  const { lines } = roughingLines(base);
  assert.deepEqual(lines, [
    'G00 X44. Z2.', 'G71 U1.5 R0.5', 'G71 P10 Q60 U0.4 W0.1 F0.25',
    'N10 G00 X18.', 'G01 Z0. F0.1', 'X20. Z-1.', 'Z-15.', 'X29.', 'G03 X30. Z-15.5 R0.5', 'G01 Z-40.', 'N60 X42.', 'G70 P10 Q60 F0.1',
  ]);
});
test('G71 на «кармане» отказывается выводить код', () => {
  const rows = [{ d: 30, z: 0 }, { d: 30, z: -10 }, { d: 20, z: -10 }, { d: 20, z: -20 }, { d: 30, z: -20 }, { d: 42, z: -30 }].map((r) => ({ ...r, tag: '' }));
  assert.throws(() => roughingLines({ ...base, rows }), /G73/);
  const g73 = roughingLines({ ...base, rows, cycle: 'G73' });
  assert.ok(g73.lines.some((l) => l.startsWith('G73 U')));
});
test('G72: первый блок — только Z', () => {
  const { lines } = roughingLines({ ...base, cycle: 'G72', dd: 1 });
  const first = lines.find((l) => l.startsWith('N10'));
  assert.match(first, /^N10 G00 Z-40\.$/);
});
test('теги: C1, R0.5, G03 R5', () => {
  assert.deepEqual(parseTag('C1').corner, { kind: 'C', v: 1 });
  assert.deepEqual(parseTag('r0,5').corner, { kind: 'R', v: 0.5 });
  assert.deepEqual(parseTag('G03 R5').arc, { dir: 'G03', R: 5 });
  assert.equal(parseTag('abc').ok, false);
});

// ---- парсер и backplot ----
test('backplot «Вал-12»: 9 перемещений, 6-е — G03 с центром Ø29 / Z-15.5', () => {
  const { lines } = roughingLines(base);
  const p = parseGcode(lines.join('\n'), { profile: 'TF', holder: 'rear' });
  assert.equal(p.moves.length, 9);
  const m = p.moves[6]; // нумерация точек как в макете: 0 … 8
  assert.equal(m.n, 6);
  assert.equal(m.type, 'G03');
  close(m.center.x, 29);
  close(m.center.z, -15.5);
  assert.equal(m.mismatch, false);
});
test('парсер TF: U/W — приращения, X на диаметр', () => {
  const p = parseGcode('G00 X40. Z2.\nG01 U-10. W-5. F0.2', { profile: 'TF' });
  assert.deepEqual(p.moves[1].to, { x: 30, z: -3 });
});
test('парсер MF: G90/G91 переключают абсолют/приращения', () => {
  const p = parseGcode('G90 G00 X10. Y10. Z5.\nG91 G01 X5. Y-5.\nG90 X0. Y0.', { profile: 'MF' });
  assert.deepEqual([p.moves[1].to.x, p.moves[1].to.y], [15, 5]);
  assert.deepEqual([p.moves[2].to.x, p.moves[2].to.y], [0, 0]);
});
test('парсер: дуга через R и через I/J дают один центр', () => {
  const a = parseGcode('G90 G00 X45. Y0.\nG03 X50. Y5. R5.', { profile: 'MF' });
  assert.ok(a.errors.length === 0);
  close(a.moves[1].center.x, 45); close(a.moves[1].center.y, 5);
  const b = parseGcode('G90 G00 X45. Y0.\nG03 X50. Y5. I0. J5.', { profile: 'MF' });
  close(b.moves[1].center.x, 45); close(b.moves[1].center.y, 5);
});
test('проверка: G00 в точку внутри заготовки — красная плашка', () => {
  const p = parseGcode('G00 X44. Z2.\nG00 X24. Z-8.', { profile: 'TF' });
  const checks = runChecks(p, { stock: { d: 32, zFace: 0 } });
  const g00 = checks.find((c) => c.id === 'g00');
  assert.equal(g00.level, 'bad');
  assert.equal(g00.items[0].line, 2);
});
test('импорт: программа с G00 X24. Z-8. при заготовке Ø32 даёт ошибку на этой строке', () => {
  const text = '%\nO1000\nG21 G40 G99\nT0101\nG50 S2000\nG96 S200 M03\nG00 X34. Z2.\nG00 X24. Z-8.\nM30\n%';
  const r = analyze(text, { stock: { d: 32, zFace: 0 } });
  const bad = r.checks.find((c) => c.id === 'g00');
  assert.equal(bad.level, 'bad');
  assert.equal(bad.items[0].line, 8);
});
test('проверка: первый кадр G71 с Z — ошибка', () => {
  const text = 'G00 X44. Z2.\nG71 U1.5 R0.5\nG71 P10 Q20 U0.4 W0.1 F0.25\nN10 G00 X18. Z0.\nN20 G01 X30.\nG70 P10 Q20';
  const c = analyze(text, { profile: 'TF' }).checks.find((x) => x.id === 'g71first');
  assert.equal(c.level, 'bad');
});
test('проверка: G96 без G50 — ошибка; дуга не сходится — ошибка', () => {
  const c1 = analyze('G96 S200 M03\nG00 X50. Z2.', { profile: 'TF' }).checks.find((x) => x.id === 'g96');
  assert.equal(c1.level, 'bad');
  const c2 = analyze('G00 X20. Z0.\nG03 X30. Z-5. I-2. K-1.', { profile: 'TF' }).checks.find((x) => x.id === 'arc');
  assert.equal(c2.level, 'bad');
});

import taper from '../js/ui/taper.js';
import { calcContour } from '../js/ui/contour.js';
test('конус с компенсацией r: координаты смещаются, код выводится', () => {
  const S = { decimals: 3, gsys: 'A', holder: 'rear' };
  const plain = taper.calc({ mode: 'ddl', D: 40, d: 30, L: 50, z0: 0, f: 0.2, pos: 'chuck', comp: false }, S);
  const comp = taper.calc({ mode: 'ddl', D: 40, d: 30, L: 50, z0: 0, f: 0.2, pos: 'chuck', comp: true, r: 0.8, tip: '3' }, S);
  assert.ok(!comp.err, comp.err);
  assert.notEqual(plain.code[0], comp.code[0]);
});
test('экран «Контур»: таблица Вал-12 → код со строкой N60', () => {
  const v = { rows: [{ d: '20', z: '0', tag: 'C1' }, { d: '20', z: '-15', tag: '' }, { d: '30', z: '-15', tag: 'R0.5' }, { d: '30', z: '-40', tag: '' }, { d: '42', z: '-40', tag: '' }], cycle: 'G71', side: 'ext', dd: '1.5', e: '0.5', blank: '42', u: '0.4', w: '0.1', fr: '0.25', ff: '0.1', ns: '10', nf: '60', zApp: '2', comp: false };
  const r = calcContour(v, { decimals: 3, gsys: 'A', holder: 'rear' });
  assert.ok(!r.err, r.err);
  assert.ok(r.code.includes('N60 X42.'));
  assert.ok(r.ok.length === 1);
});
