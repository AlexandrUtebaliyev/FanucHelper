import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTol, tolerance, intervalOf, programSize, fitWithBase } from '../js/core/tolerance.js';
import { edge, holeCenter, bossCenter, g10Lines } from '../js/core/mill/probing.js';
import { threadMill } from '../js/core/mill/threadMill.js';
import { threadMillLines } from '../js/gcode/millCycles.js';
import { newItem, saveVersion, setStatus, filterItems, diffLines, mergeConflict, STATUSES } from '../js/core/library.js';
import { analyze, detectProfile } from '../js/gcode/check.js';
import { parseGcode } from '../js/gcode/parse.js';
import tol from '../js/ui/tolerance.js';
import probing from '../js/ui/probing.js';
import tm from '../js/ui/threadmill.js';
import { fmt, word } from '../js/gcode/format.js';

const close = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) <= e, `${a} !≈ ${b}`);
const S = { decimals: 3, gsys: 'A', holder: 'rear', profile: 'MF' };
const T = (s) => tolerance(parseTol(s));

test('ISO: 20h7 → 0 / −0.021', () => { const t = T('20 h7'); close(t.es, 0); close(t.ei, -0.021); });
test('ISO: 20H7 → +0.021 / 0', () => { const t = T('20H7'); close(t.es, 0.021); close(t.ei, 0); });
test('ISO: 50g6 → −0.009 / −0.025', () => { const t = T('50g6'); close(t.es, -0.009); close(t.ei, -0.025); });
test('ISO: 10js7 → ±0.0075', () => { const t = T('10js7'); close(t.es, 0.0075); close(t.ei, -0.0075); });
test('ISO: граница 18 относится к интервалу 10–18', () => {
  assert.equal(intervalOf(18), '10-18');
  assert.equal(intervalOf(18.01), '18-30');
  assert.equal(intervalOf(10), '6-10');
  assert.equal(intervalOf(500), '400-500');
  assert.equal(intervalOf(501), null);
});
test('ISO: регистр буквы — вал или отверстие, Ø в строке и без пробела', () => {
  assert.equal(parseTol('Ø50 H7').kind, 'hole');
  assert.equal(parseTol('20g6').kind, 'shaft');
  assert.equal(parseTol('10JS7').kind, 'hole');
  assert.ok(parseTol('hello').error);
});
test('ISO: 20 h7 — середина 19.9895, в программу X19.99', () => {
  const t = T('20 h7');
  close(t.mid, 19.9895, 1e-9);
  assert.equal(word('X', programSize(t, 'mid'), 3), 'X19.99');
  assert.equal(word('X', programSize(t, 'max'), 3), 'X20.');
  assert.equal(word('X', programSize(t, 'min'), 3), 'X19.979');
});
test('ISO: посадка h7/H7 — зазор 0 … 0.042', () => {
  const f = fitWithBase(20, T('20 h7'), 7);
  close(f.min, 0); close(f.max, 0.042);
  assert.equal(f.type, 'с зазором');
});
test('ISO: нет данных — понятная ошибка, а не выдуманное значение', () => {
  assert.match(T('20 g6').error, /нет данных/);
  assert.match(T('77 h8').error, /нет данных/);
  assert.match(T('20 k7').error, /нет данных/);
});
test('экран «Допуски»: код X19.99', () => {
  const r = tol.calc({ text: '20 h7', pick: 'mid' }, { decimals: 3 });
  assert.deepEqual(r.code, ['X19.99']);
});
test('привязка: тест из ТЗ — центр −220.3 / −135.08, Ø 60.04 / 60.06, овальность 0.02', () => {
  const r = holeCenter({ x1: -245.32, x2: -195.28, y1: -160.11, y2: -110.05, probeD: 10 });
  close(r.cx, -220.3, 1e-9); close(r.cy, -135.08, 1e-9); close(r.dx, 60.04, 1e-9); close(r.dy, 60.06, 1e-9); close(r.ovality, 0.02, 1e-9);
});
test('привязка: бобышка — Ø = (X2−X1) − Dщупа; кромка ± D/2', () => {
  close(bossCenter({ x1: 0, x2: 30, y1: 0, y2: 30, probeD: 4 }).dx, 26);
  close(edge(-100, 10, 'minus'), -95);
  close(edge(-100, 10, 'plus'), -105);
});
test('G10: G54–G59 → L2 P1–P6; G54.1 → L20', () => {
  const f = (n) => fmt(n, 3);
  assert.deepEqual(g10Lines({ wcs: 'G54', x: -220.3, y: -135.08 }, f), ['G90 G10 L2 P1 X-220.3 Y-135.08']);
  assert.deepEqual(g10Lines({ wcs: 'G59', x: 1, y: 2 }, f), ['G90 G10 L2 P6 X1. Y2.']);
  assert.deepEqual(g10Lines({ wcs: 'G54.1', p54: 3, x: 1 }, f), ['G90 G10 L20 P3 X1.']);
  assert.throws(() => g10Lines({ wcs: 'G54.1', p54: 49, x: 1 }, f));
});
test('экран «Привязка»: тест ТЗ даёт G10 L2 P1', () => {
  const r = probing.calc({ mode: 'hole', probeD: 10, wcs: 'G54', p54: 1, x1: -245.32, x2: -195.28, y1: -160.11, y2: -110.05 }, S);
  assert.deepEqual(r.code, ['G90 G10 L2 P1 X-220.3 Y-135.08']);
});
test('G10 коррекции инструмента: без кода L не выводится (бета)', () => {
  const r = probing.calc({ mode: 'tool', lcode: '', tools: '1 10.5' }, S);
  assert.ok(r.err && !r.code);
  const r2 = probing.calc({ mode: 'tool', lcode: '10', tools: '1 10.5\n2 -3' }, S);
  assert.deepEqual(r2.code, ['G10 L10 P1 R10.5', 'G10 L10 P2 R-3.']);
  assert.match(r2.warn[0], /БЕТА/);
});
test('резьбофреза M20×2.5 внутренняя, фреза Ø14, Z−20: R пути 3.000, F центра 75, 7 витков + 2 полудуги, последний Z0', () => {
  const t = threadMill({ D: 20, P: 2.5, external: false, cutter: 14, depth: 20, F: 250 });
  close(t.radius, 3); close(t.fCenter, 75); assert.equal(t.full, 7); assert.equal(t.half, 2);
  const o = threadMillLines(t, { P: 2.5, depth: 20, F: 250 });
  assert.equal(o.zEnd, 0);
  assert.equal(o.lines.filter((l) => /^G03 X0\. Y-3\. I0\. J3\./.test(l)).length, 7);
  assert.equal(o.lines.filter((l) => /J-1\.5|J1\.5/.test(l)).length, 2);
  assert.ok(o.lines.find((l) => /^G03/.test(l)).includes('Z-18.75'));
  assert.ok(o.lines[o.lines.length - 2].includes('Z0.'));
});
test('резьбофреза: направление и подача для наружной, левой, встречного', () => {
  const ext = threadMill({ D: 20, P: 2.5, external: true, cutter: 10, depth: 10, F: 200 });
  close(ext.radius, 15); close(ext.fCenter, 300);
  assert.equal(ext.ccw, false); // наружная попутная — по часовой
  const left = threadMill({ D: 20, P: 2.5, external: false, cutter: 14, depth: 20, F: 250, hand: 'left' });
  assert.equal(left.up, false); // левая при G03 — сверху вниз
  const conv = threadMill({ D: 20, P: 2.5, external: false, cutter: 14, depth: 20, F: 250, climb: false });
  assert.equal(conv.ccw, false);
});
test('резьбофреза: фреза не проходит в отверстие — ошибка; подпрограмма G91', () => {
  assert.match(threadMill({ D: 20, P: 2.5, external: false, cutter: 18, depth: 20, F: 250 }).error, /не проходит/);
  const t = threadMill({ D: 20, P: 2.5, cutter: 14, depth: 20, F: 250 });
  const o = threadMillLines(t, { P: 2.5, depth: 20, F: 250, sub: true, subNo: 8001 });
  assert.ok(o.lines.includes('M98 P8001 L7'));
  assert.match(o.subLines[1], /^G91 G03 X0\. Y0\. I0\. J3\. Z2\.5 F75\.$/);
  assert.equal(o.zEnd, 0);
});
test('экран «Резьбофреза»: нет данных для размера', () => {
  const r = tm.calc({ side: 'int', kind: 'table', size: 'M99', cutter: 14, depth: 20, f: 250 }, S);
  assert.match(r.err, /Нет данных/);
  const ok = tm.calc({ side: 'int', kind: 'table', size: 'M20', cutter: 14, depth: 20, f: 250, hand: 'right', mode: 'climb', xc: 0, yc: 0, safe: 5 }, S);
  assert.ok(ok.code.length > 8);
});
test('библиотека: версии, статус «Проверено на станке» только вручную, поиск, diff', () => {
  let it = newItem({ title: 'Вал 12', o: 'O1234', text: 'G00 X1.\nM30', machine: 'TF' });
  it.order = 'ЗАК-77';
  it = saveVersion(it, 'G00 X2.\nM30');
  assert.equal(it.version, 2);
  assert.equal(it.versions.length, 1);
  assert.equal(saveVersion(it, it.text), it);
  assert.equal(setStatus(it, 'Проверено на станке', false).status, STATUSES[0]);
  const m = setStatus(it, 'Проверено на станке', true);
  assert.equal(m.status, 'Проверено на станке');
  assert.equal(saveVersion(m, 'G00 X3.\nM30').status, STATUSES[0]); // правка сбрасывает статус
  const items = [it, newItem({ title: 'Фланец', o: 'O9', machine: 'MF' })];
  assert.equal(filterItems(items, { q: 'o1234' }).length, 1);
  assert.equal(filterItems(items, { q: 'зак-77' }).length, 1);
  assert.equal(filterItems(items, { machine: 'MF' }).length, 1);
  const d = diffLines('a\nb\nc', 'a\nx\nc');
  assert.deepEqual(d.map((x) => x.t), ['=', '-', '+', '=']);
  assert.equal(mergeConflict({ ...it, version: 2 }, { ...it, version: 3, text: 'other' }).items.length, 2);
});
test('импорт: автоопределение профиля', () => {
  assert.equal(detectProfile('T0101\nG71 U1.5 R0.5\nG00 X10. W-2.'), 'TF');
  assert.equal(detectProfile('G90 G54\nT1 M06\nG43 Z50. H1\nG81 X0. Y0. Z-5. R2.'), 'MF');
});
test('импорт: сводка — кадры, инструменты, время', () => {
  const r = analyze('T0101\nG97 S1000 M03\nG99\nG00 X50. Z2.\nG01 Z-20. F0.2\nG01 X60.', { profile: 'TF', stock: { d: 50 } });
  assert.equal(r.summary.moves, 3);
  assert.deepEqual(r.summary.tools, [101]);
  assert.ok(r.summary.minutes > 0);
});
test('импорт: TF — G00 внутрь заготовки по Ø32 на строке 3', () => {
  const r = analyze('G00 X34. Z2.\nG00 X24. Z2.\nG00 X24. Z-8.', { profile: 'TF', stock: { d: 32, zFace: 0 } });
  const g = r.checks.find((c) => c.id === 'g00');
  assert.deepEqual(g.items.map((i) => i.line), [3]);
});
test('парсер: комментарии и макро-строки не ломают разбор', () => {
  const p = parseGcode('(VAL 1)\n#1=5\nG00 X10. Z2. (PODVOD)\nWHILE [#1 GT 0] DO1\nG01 Z-1. F0.1\nEND1', { profile: 'TF' });
  assert.equal(p.moves.length, 2);
  assert.ok(p.blocks[1].flags.includes('macro'));
});
