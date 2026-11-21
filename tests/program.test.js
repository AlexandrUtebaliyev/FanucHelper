import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProgram, headerTF, headerMF, footerTF, footerMF, numberLines, duplicateN, toFileText, fileName } from '../js/gcode/program.js';
import { g75Lines, g74Lines, roughingLines } from '../js/gcode/cycles.js';
import { analyze } from '../js/gcode/check.js';
import { calcContour } from '../js/ui/contour.js';
import groove from '../js/ui/groove.js';
import drill from '../js/ui/drill.js';
import { assemble } from '../js/ui/program.js';

const S = { decimals: 3, gsys: 'A', holder: 'rear', feedMode: 'G99', profile: 'TF', numbering: false, numStep: 10 };
const VAL = { rows: [{ d: '20', z: '0', tag: 'C1' }, { d: '20', z: '-15', tag: '' }, { d: '30', z: '-15', tag: 'R0.5' }, { d: '30', z: '-40', tag: '' }, { d: '42', z: '-40', tag: '' }], cycle: 'G71', side: 'ext', dd: '1.5', e: '0.5', blank: '42', u: '0.4', w: '0.1', fr: '0.25', ff: '0.1', ns: '10', nf: '60', zApp: '2', comp: false };

test('шапка TF: %, O#### с комментарием, G21 G40 G99, T, G50 перед G96', () => {
  const h = headerTF({ title: 'Вал 1', o: 1001, tool: '0101', mode: 'g96', vc: 200, g50: 3000, ref: true }, { feedMode: 'G99' });
  assert.deepEqual(h, ['%', 'O1001 (VAL 1)', 'G21 G40 G99', 'G28 U0. W0.', 'T0101', 'G50 S3000', 'G96 S200 M03']);
});
test('шапка TF: G98 из настроек, G97 без G50', () => {
  const h = headerTF({ title: 'A', o: 5, tool: '0202', mode: 'g97', rpm: 800 }, { feedMode: 'G98' });
  assert.deepEqual(h, ['%', 'O0005 (A)', 'G21 G40 G98', 'T0202', 'G97 S800 M03']);
});
test('шапка TF: G96 без G50 не собирается', () => {
  assert.throws(() => headerTF({ title: 'A', o: 5, tool: '0101', mode: 'g96', vc: 200, g50: 0 }), /G50/);
});
test('концовка TF и MF', () => {
  assert.deepEqual(footerTF(), ['G28 U0. W0.', 'M05', 'M30', '%']);
  assert.deepEqual(footerMF({ homeXY: false }), ['G91 G28 Z0.', 'M05', 'M30', '%']);
  assert.deepEqual(footerMF({ homeXY: true }), ['G91 G28 Z0.', 'G28 X0. Y0.', 'M05', 'M30', '%']);
});
test('шапка MF по ТЗ', () => {
  const h = headerMF({ title: 'Фланец', o: 2002, wcs: 'G54', tool: 1, rpm: 3000, h: 1, safeZ: 100 });
  assert.deepEqual(h, ['%', 'O2002 (FLANETS)', 'G17 G21 G40 G49 G80 G90 G94', 'G54', 'T01 M06', 'S3000 M03', 'G00 G43 Z100. H01']);
});
test('шапка и концовка MF не содержат U/W, TF — G90/G91', () => {
  const mf = [...headerMF({ title: 'A', o: 1, wcs: 'G54', tool: 1, rpm: 1000, h: 1, safeZ: 50 }), ...footerMF({ homeXY: true })];
  for (const l of mf) assert.ok(!/(^|\s)[UW]-?[\d.]/.test(l), l);
  const tf = [...headerTF({ title: 'A', o: 1, tool: '0101', mode: 'g97', rpm: 800, ref: true }, {}), ...footerTF()];
  for (const l of tf) assert.ok(!/\bG9[01]\b/.test(l), l);
});
test('нумерация N не дублирует номера контура G71', () => {
  const lines = ['%', 'O1 (A)', 'G21', 'G71 P10 Q60 U0.4 W0.1 F0.25', 'N10 G00 X18.', 'G01 Z0.', 'N60 X42.', 'G70 P10 Q60', 'M30', '%'];
  const n = numberLines(lines, 10);
  assert.deepEqual(duplicateN(n), []);
  assert.equal(n[0], '%');
  assert.match(n[2], /^N20 G21$/); // N10 занят контуром
  assert.equal(n[4], 'N10 G00 X18.');
});
test('повторяющиеся номера контуров ловятся', () => {
  const d = duplicateN(['N10 G00 X10.', 'G01 Z1.', 'N10 G00 X20.']);
  assert.equal(d.length, 1);
  assert.equal(d[0].n, 10);
});
test('экспорт: CRLF, имя файла O1001.nc', () => {
  assert.equal(toFileText(['%', 'M30']), '%\r\nM30\r\n');
  assert.equal(fileName(1001, 'nc'), 'O1001.nc');
  assert.equal(fileName(7, 'txt'), 'O0007.txt');
});
test('программа целиком: шапка + контур Вал-12 + концовка проходит автопроверки', () => {
  const c = calcContour(VAL, S);
  const blocks = [{ title: 'Контур', lines: c.code, profile: 'TF' }];
  const { lines, dup } = assemble(blocks, { title: 'Вал 12', o: 1001, tool: '0101', mode: 'g96', vc: 200, g50: 3000 }, S);
  assert.deepEqual(dup, []);
  assert.equal(lines[0], '%');
  assert.equal(lines[lines.length - 1], '%');
  assert.ok(lines.includes('M30'));
  const a = analyze(lines.join('\n'), { profile: 'TF', stock: { d: 42, zFace: 0 } });
  for (const ch of a.checks) assert.notEqual(ch.level, 'bad', ch.title + ': ' + JSON.stringify(ch.items));
  assert.equal(a.parsed.moves.length, 9);
});
test('два контура с одинаковыми N — дубли обнаружены', () => {
  const c = calcContour(VAL, S);
  const { dup } = assemble([{ title: 'А', lines: c.code, profile: 'TF' }, { title: 'Б', lines: c.code, profile: 'TF' }], { title: 'A', o: 1, tool: '0101', mode: 'g97', rpm: 500 }, S);
  assert.ok(dup.length >= 2);
});
test('блок из другого профиля не собирается', () => {
  assert.throws(() => buildProgram([{ title: 'Сверло', lines: ['G81 X0. Y0.'], profile: 'MF' }], { title: 'A', o: 1, tool: '0101', mode: 'g97', rpm: 500 }, S), /другого профиля/);
});
test('G75: ширина пластины 3, канавка 8, привязка слева/справа; Δi и Δk в микронах', () => {
  const o = { gsys: 'A', width: 3, d0: 40, dBottom: 34, z: -20, grooveW: 8, dI: 1.5, dK: 2.5, e: 0.5, f: 0.08 };
  const l = g75Lines({ ...o, anchor: 'left' });
  assert.deepEqual(l, ['G00 X42. Z-23.', 'G75 R0.5', 'G75 X34. Z-28. P1500 Q2500 F0.08', 'G00 X42.']);
  const r = g75Lines({ ...o, anchor: 'right' });
  assert.equal(r[0], 'G00 X42. Z-20.');
  assert.match(r[2], /^G75 X34\. Z-25\. P1500 Q2500/);
});
test('G75: опасные параметры не выводятся', () => {
  const o = { gsys: 'A', width: 3, d0: 40, dBottom: 34, z: -20, grooveW: 8, dI: 1.5, dK: 2.5, f: 0.08 };
  assert.throws(() => g75Lines({ ...o, grooveW: 2 }), /меньше ширины пластины/);
  assert.throws(() => g75Lines({ ...o, dK: 3 }), /меньше ширины/);
  assert.throws(() => g75Lines({ ...o, dBottom: 41 }), /Ø/);
  assert.throws(() => g75Lines({ ...o, relief: 0.2 }), /сверить/);
  assert.throws(() => g75Lines({ ...o, gsys: 'B' }), /систем/i);
});
test('G74: заборный конус 0.3·D, Q в микронах, обороты из Vc', () => {
  const l = g74Lines({ gsys: 'A', D: 10, depth: 30, peck: 5, e: 1, f: 0.1, vc: 40 });
  assert.equal(l[0], 'G97 S1273 M03');
  assert.ok(l.includes('G74 R1.'));
  assert.ok(l.includes('G74 Z-33. Q5000 F0.1'));
  assert.ok(!l.some((x) => /\bP\d/.test(x)), 'при сверлении по оси P не нужен');
});
test('экраны «Канавка» и «Сверление» отдают код', () => {
  const g = groove.calc({ width: 3, d0: 40, dBottom: 34, z: -20, grooveW: 8, dI: 1.5, dK: 2.5, e: 0.5, f: 0.08, anchor: 'left', relief: 0 }, S);
  assert.ok(!g.err, g.err);
  const d = drill.calc({ D: 10, depth: 30, peck: 5, e: 1, f: 0.1, vc: 40 }, S);
  assert.ok(!d.err, d.err);
});
test('G71 контур через roughingLines используется в программе без изменений', () => {
  const r = roughingLines({ gsys: 'A', rows: [{ d: 20, z: 0, tag: '' }, { d: 30, z: -10, tag: '' }], cycle: 'G71', dd: 1, e: 0.5, u: 0.2, w: 0.1, fRough: 0.2, fFinish: 0.1, blank: 32 });
  assert.ok(r.lines[0].startsWith('G00 X34.'));
});

test('после G70 инструмент в точке старта цикла: следующий G00 не «проходит сквозь деталь»', () => {
  const c = calcContour(VAL, S);
  const text = [...c.code, 'G00 X22. Z7.5', 'M30'].join('\n');
  const a = analyze(text, { profile: 'TF', stock: { d: 42, zFace: 0 } });
  assert.equal(a.checks.find((x) => x.id === 'g00').level, 'ok');
});
