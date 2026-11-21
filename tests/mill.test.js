import test from 'node:test';
import assert from 'node:assert/strict';
import { boltCircle, grid } from '../js/core/mill/boltCircle.js';
import { filletLineLine, filletLineCircle, tangentFromPoint } from '../js/core/mill/tangent.js';
import { vcToS, feedPerMin, tapFeed } from '../js/core/mill/millCutting.js';
import { facing } from '../js/core/mill/facing.js';
import { solveTriangle, polarToCart } from '../js/core/mill/transform.js';
import { holeLines, arcLine, facingLines } from '../js/gcode/millCycles.js';
import { fmt, word } from '../js/gcode/format.js';
import { parseGcode } from '../js/gcode/parse.js';
import { analyze } from '../js/gcode/check.js';
import { MACROS } from '../js/data/macros.js';
import bolt from '../js/ui/bolt.js';
import tangent from '../js/ui/tangent.js';
import millmodes from '../js/ui/millmodes.js';
import facingScreen from '../js/ui/facing.js';
import transform from '../js/ui/transform.js';
import taper from '../js/ui/taper.js';
import chamfer from '../js/ui/chamfer.js';
import thread from '../js/ui/thread.js';
import contour from '../js/ui/contour.js';
import { roughingLines } from '../js/gcode/cycles.js';

const close = (a, b, e = 1e-3) => assert.ok(Math.abs(a - b) <= e, `${a} !≈ ${b}`);
const S = { decimals: 3, gsys: 'A', holder: 'rear', spindleMax: 8000 };

test('окружность: центр 0,0, R50, 6 отверстий, A0 — 2-е X25. Y43.301, 4-е X-50. Y0.', () => {
  const { holes } = boltCircle({ xc: 0, yc: 0, R: 50, n: 6, a0: 0 });
  assert.equal(holes.length, 6);
  assert.equal(word('X', holes[1].x) + ' ' + word('Y', holes[1].y), 'X25. Y43.301');
  assert.equal(word('X', holes[3].x) + ' ' + word('Y', holes[3].y), 'X-50. Y0.');
});
test('окружность: неполная и со своим шагом', () => {
  const { holes } = boltCircle({ R: 10, n: 3, a0: 90, step: 45 });
  close(holes[0].x, 0, 1e-9);
  close(holes[2].x, -10, 1e-9);
  close(holes[1].angle, 135);
});
test('сетка: змейка меняет направление рядов, поворот ряда', () => {
  const g = grid({ dx: 10, dy: 10, nx: 3, ny: 2, snake: true }).holes;
  assert.deepEqual(g.map((p) => p.x), [0, 10, 20, 20, 10, 0]);
  const r = grid({ dx: 10, dy: 10, nx: 2, ny: 1, angle: 90 }).holes;
  close(r[1].y, 10); close(r[1].x, 0, 1e-9);
});
test('сопряжение прямая–прямая: угол (50,0), подход по +X, R5 → X45. Y0. и X50. Y5.', () => {
  const r = filletLineLine({ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 30 }, 5);
  close(r.p1.x, 45); close(r.p1.y, 0); close(r.p2.x, 50); close(r.p2.y, 5);
  assert.equal(r.ccw, true);
  assert.equal(arcLine({ from: r.p1, to: r.p2, center: r.center, ccw: r.ccw, fmt: 'r' }).line, 'G03 X50. Y5. R5.');
  assert.equal(arcLine({ from: r.p1, to: r.p2, center: r.center, ccw: r.ccw, fmt: 'ij' }).line, 'G03 X50. Y5. I0. J5.');
});
test('экран «Сопряжения»: код содержит оба формата', () => {
  const r = tangent.calc({ type: 'll', ax: 0, ay: 0, cx: 50, cy: 0, bx: 50, by: 30, R: 5 }, S);
  assert.ok(r.code.includes('G03 X50. Y5. R5.'));
  assert.ok(r.code.includes('G03 X50. Y5. I0. J5.'));
});
test('касательная из точки и сопряжение прямая–окружность', () => {
  const t = tangentFromPoint({ x: 10, y: 0 }, { x: 0, y: 0 }, 5);
  close(Math.hypot(t[0].point.x, t[0].point.y), 5);
  close(t[0].length, Math.sqrt(75));
  const c = filletLineCircle({ x: -20, y: 10 }, { x: 1, y: 0 }, { x: 0, y: 0 }, 5, 3, 'right', 'ext');
  assert.ok(c.length >= 1);
  close(Math.hypot(c[0].center.x, c[0].center.y), 8);
});
test('дуга больше 180° и полный круг выводятся только через I J', () => {
  const a = arcLine({ from: { x: 10, y: 0 }, to: { x: -10, y: 0.0001 }, center: { x: 0, y: 0 }, ccw: false, fmt: 'r' });
  assert.match(a.line, /I-10\. J0\.$/);
  assert.ok(a.sweep > 180 && a.note);
  const full = arcLine({ from: { x: 5, y: 0 }, to: { x: 5, y: 0 }, center: { x: 0, y: 0 }, ccw: true, fmt: 'r' });
  assert.match(full.line, /I-5\. J0\.$/);
});
test('режимы MF: D10, Vc100 → S3183; fz0.05, z4 → F637', () => {
  const S1 = Math.round(vcToS(100, 10));
  assert.equal(S1, 3183);
  assert.equal(Math.round(feedPerMin(0.05, 4, S1)), 637);
  const r = millmodes.calc({ D: 10, vc: 100, fz: 0.05, z: 4, ae: 5, ap: 10, pitch: NaN, tapS: NaN, tapMode: 'G94' }, S);
  assert.ok(r.results.some(([, v]) => v.startsWith('3183')));
  assert.ok(r.results.some(([, v]) => v.startsWith('637')));
});
test('метчик M8×1.25 при S500 (G94) → F625; G95 → F = P', () => {
  assert.equal(tapFeed(500, 1.25, 'G94'), 625);
  assert.equal(tapFeed(500, 1.25, 'G95'), 1.25);
});
test('G84: M29 S перед циклом, F = S × P', () => {
  const holes = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
  const l = holeLines({ code: 'G84', holes, z: -10, r: 2, s: 500, pitch: 1.25, initZ: 50 });
  const i29 = l.indexOf('M29 S500'), icyc = l.findIndex((x) => x.includes('G84'));
  assert.ok(i29 >= 0 && i29 < icyc);
  assert.match(l[icyc], /F625\.$/);
});
test('циклы: G99 между отверстиями, G98 на последнем, G80 в конце', () => {
  const { holes } = boltCircle({ R: 50, n: 6 });
  const l = holeLines({ code: 'G81', holes, z: -10, r: 2, f: 100, initZ: 50 });
  assert.match(l.find((x) => x.includes('G81')), /^G99 G81 /);
  assert.match(l[l.length - 2], /^G98 X/);
  assert.equal(l[l.length - 1], 'G80');
});
test('циклы: опасные параметры не выводятся', () => {
  const h = [{ x: 0, y: 0 }];
  assert.throws(() => holeLines({ code: 'G81', holes: h, z: -10, r: -1, f: 100, initZ: 50 }), /выше Z0/);
  assert.throws(() => holeLines({ code: 'G83', holes: h, z: -10, r: 2, f: 100, initZ: 50 }), /Q/);
  assert.throws(() => holeLines({ code: 'G81', holes: h, z: 5, r: 2, f: 100, initZ: 50 }), /ниже плоскости R/);
});
test('backplot MF: окружность даёт 6 отверстий, все на R50 ± 0.001', () => {
  const { holes } = boltCircle({ R: 50, n: 6 });
  const code = holeLines({ code: 'G81', holes, z: -10, r: 2, f: 100, initZ: 50 }).join('\n');
  const p = parseGcode(code, { profile: 'MF' });
  const cyc = p.moves.filter((m) => m.type === 'CYCLE');
  assert.equal(cyc.length, 6);
  for (const m of cyc) close(Math.hypot(m.hole.x, m.hole.y), 50, 0.001);
  assert.equal(cyc[5].retract, 'G98');
  assert.equal(cyc[0].retract, 'G99');
});
test('проверки MF: цикл без G80, G99 на последнем, R ниже Z0', () => {
  const t = 'G90 G00 Z50.\nG00 X0. Y0.\nG99 G81 X0. Y0. Z-10. R-2. F100.\nX10. Y0.\nM30';
  const c = analyze(t, { profile: 'MF' }).checks;
  assert.equal(c.find((x) => x.id === 'g80').level, 'bad');
  assert.equal(c.find((x) => x.id === 'g98').level, 'warn');
  assert.equal(c.find((x) => x.id === 'rplane').level, 'bad');
});
test('проверки MF: M06 без G43, G41 без G40, дуга >180° через R', () => {
  const c = analyze('T1 M06\nG00 X0. Y0.\nG41 D1 G01 X10. Y0. F100.\nM30', { profile: 'MF' }).checks;
  assert.equal(c.find((x) => x.id === 'g43').level, 'bad');
  assert.equal(c.find((x) => x.id === 'g40').level, 'bad');
  const c2 = analyze('G90 G00 X10. Y0.\nG02 X0. Y10. R-10.', { profile: 'MF' }).checks;
  assert.equal(c2.find((x) => x.id === 'arc180').level, 'bad');
});
test('торцовка: проходы, дорожки и код', () => {
  const fc = facing({ L: 100, B: 60, D: 50, overlap: 30, ap: 1, total: 2, mode: 'zigzag', overhang: 1, safeZ: 5, feed: 800 });
  assert.equal(fc.nz, 2);
  assert.ok(fc.rows >= 2);
  close(fc.stepAct * (fc.rows - 1), 60 - 50 + 2); // от D/2−ov до B−D/2+ov
  assert.ok(fc.stepAct <= 35 + 1e-9);
  const code = facingLines(fc, { feed: 800 });
  assert.ok(code.some((l) => l.startsWith('G01 Z-1.')));
  assert.ok(code.some((l) => l.startsWith('G01 Z-2.')));
  const r = facingScreen.calc({ L: 100, B: 60, D: 50, overlap: 30, ap: 1, total: 2, ov: 1, safe: 5, f: 800, mode: 'oneway' }, S);
  assert.ok(!r.err, r.err);
});
test('торцовка: подвод по Z только вне материала (первый X вне заготовки)', () => {
  const fc = facing({ L: 100, B: 60, D: 50, overlap: 30, ap: 1, total: 1, feed: 800 });
  assert.ok(fc.xs + 25 < 0, 'правая кромка фрезы слева от заготовки');
  const p = parseGcode(facingLines(fc, { feed: 800 }).join('\n'), { profile: 'MF' });
  assert.ok(p.moves.length > 3);
});
test('треугольник: 3-4-5 и по двум углам', () => {
  const t = solveTriangle({ a: 3, b: 4, c: 5 });
  close(t.C, 90);
  const t2 = solveTriangle({ a: 10, A: 30, B: 60 });
  close(t2.c, 20, 1e-6);
  assert.ok(solveTriangle({ a: 1, b: 1, c: 5 }).error);
  const p = polarToCart(10, 10, 90, 5);
  close(p.x, 10); close(p.y, 15);
});
test('экран «Поворот»: G68 … G69', () => {
  const r = transform.calc({ mode: 'rot', x0: 0, y0: 0, angle: 30, pts: '10 0\n20 0' }, S);
  assert.match(r.code[0], /^G68 X0\. Y0\. R30\.$/);
  assert.equal(r.code[r.code.length - 1], 'G69');
});
test('макросы: тексты O9010–O9012 непустые, заканчиваются M99, скобки баланс', () => {
  assert.deepEqual(MACROS.map((m) => m.id), ['O9010', 'O9011', 'O9012']);
  for (const m of MACROS) {
    assert.match(m.lines[0], new RegExp('^' + m.id + ' '));
    assert.ok(m.lines.some((l) => /M99$/.test(l)));
    assert.ok(m.example.startsWith('G65 P' + m.id.slice(1)));
    const text = m.lines.join('\n');
    assert.equal((text.match(/\[/g) || []).length, (text.match(/\]/g) || []).length, m.id);
    const whiles = (text.match(/WHILE/g) || []).length, ends = (text.match(/END\d/g) || []).length;
    assert.equal(whiles, ends, m.id);
  }
});
test('генератор MF никогда не выводит U/W; TF — G90 как «абсолютные координаты»', () => {
  const mfOut = [];
  mfOut.push(...bolt.calc({ type: 'circle', xc: 0, yc: 0, rd: 'R', R: 50, n: 6, a0: 0, code: 'G81', z: -10, r: 2, initZ: 50, f: 100, format: 'xy' }, S).code);
  mfOut.push(...bolt.calc({ type: 'circle', xc: 0, yc: 0, rd: 'R', R: 50, n: 6, a0: 0, code: 'G81', z: -10, r: 2, initZ: 50, f: 100, format: 'polar' }, S).code);
  mfOut.push(...bolt.calc({ type: 'circle', xc: 0, yc: 0, rd: 'R', R: 50, n: 6, a0: 0, code: 'G81', z: -10, r: 2, initZ: 50, f: 100, format: 'macro' }, S).code);
  mfOut.push(...bolt.calc({ type: 'grid', x0: 0, y0: 0, dx: 10, dy: 10, nx: 3, ny: 2, ang: 0, snake: true, code: 'G83', z: -10, r: 2, q: 3, initZ: 50, f: 100 }, S).code);
  mfOut.push(...facingScreen.calc({ L: 100, B: 60, D: 50, overlap: 30, ap: 1, total: 2, ov: 1, safe: 5, f: 800, mode: 'zigzag' }, S).code);
  mfOut.push(...transform.calc({ mode: 'rot', x0: 0, y0: 0, angle: 30, pts: '10 0' }, S).code);
  for (const l of mfOut) assert.ok(!/(^|\s)[UW]-?[\d.]/.test(l), 'U/W на MF: ' + l);
  const tfOut = [];
  tfOut.push(...taper.calc({ mode: 'ddl', D: 40, d: 30, L: 50, z0: 0, f: 0.2, pos: 'chuck' }, S).code);
  tfOut.push(...chamfer.calc({ type: 'chamfer', place: 'face-dia', size: 'cc', D: 30, z: 0, c1: 1, c2: 1, f: 0.1 }, S).code);
  tfOut.push(...thread.calc({ side: 'ext', kind: 'table', size: 'M20', pitch: '2.5', length: 30, z0: 0, runout: 2.5, starts: 1, firstCut: 0.4, minCut: 0.1, finish: 2, angle: 60, out: 'g92' }, S).code);
  tfOut.push(...roughingLines({ gsys: 'A', rows: [{ d: 20, z: 0, tag: 'C1' }, { d: 20, z: -15, tag: '' }, { d: 42, z: -15, tag: '' }], cycle: 'G71', dd: 1.5, e: 0.5, u: 0.4, w: 0.1, fRough: 0.25, fFinish: 0.1, blank: 42 }).lines);
  for (const l of tfOut) assert.ok(!/\bG90\b(?!\s*X)/.test(l) || /^G90 X/.test(l) === false, 'G90 на TF вне цикла: ' + l);
  for (const l of tfOut) assert.ok(!/\bG9[01]\b/.test(l), 'G90/G91 как режим координат на TF: ' + l);
});
test('экран «Отверстия»: ошибки не пропускают код', () => {
  const r = bolt.calc({ type: 'circle', xc: 0, yc: 0, rd: 'R', R: 50, n: 6, a0: 0, code: 'G81', z: -10, r: -3, initZ: 50, f: 100, format: 'xy' }, S);
  assert.ok(r.err && (!r.code || r.code.length === 0));
});
test('smoke: fmt', () => assert.equal(fmt(43.30127), '43.301'));
void contour;
