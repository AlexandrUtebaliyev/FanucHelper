import test from 'node:test';
import assert from 'node:assert/strict';
import { solveTaper } from '../js/core/taper.js';
import { calcThread, threadHeightMicrons, threadPasses } from '../js/core/thread.js';
import { chamferCorner, filletCorner, directions } from '../js/core/chamfer.js';
import { vcToS, raFromFeed, feedFromRa, g50Limit } from '../js/core/cutting.js';
import { g76Lines, g92Lines } from '../js/gcode/cycles.js';
import { highlightLine } from '../js/ui/highlight.js';
import taper from '../js/ui/taper.js';
import chamfer from '../js/ui/chamfer.js';
import thread from '../js/ui/thread.js';
import modes from '../js/ui/modes.js';

const S = { decimals: 3, gsys: 'A', holder: 'rear', spindleMax: 3000 };
const close = (a, b, e = 1e-3) => assert.ok(Math.abs(a - b) <= e, `${a} !≈ ${b}`);

test('конус: D40 d30 L50 -> α/2 = 5.711°, 1:5', () => {
  const r = solveTaper({ D: 40, d: 30, L: 50 });
  close(r.half, 5.711);
  close(r.k, 5);
});
test('конус: решение из D, L, угла и из D, d, 1:k', () => {
  const r = solveTaper({ D: 40, L: 50, half: 5.7106 });
  close(r.d, 30, 0.01);
  const r2 = solveTaper({ D: 40, d: 30, k: 5 });
  close(r2.L, 50);
});
test('конус: противоречие и нехватка данных — ошибка', () => {
  assert.ok(solveTaper({ D: 40, d: 30 }).error);
  assert.ok(solveTaper({ D: 40, d: 30, L: 50, k: 4 }).error);
});
test('резьба M20×2.5 наружная: k = 1.534 -> P1534', () => {
  assert.equal(threadHeightMicrons(2.5, true), 1534);
  const lines = g76Lines({ gsys: 'A', P: 2.5, D: 20, external: true, zStart: 0, zEnd: -30, firstCut: 0.4 });
  assert.ok(lines.some((l) => /^G76 X.* P1534 /.test(l)), lines.join('\n'));
});
test('G76: первый блок P mm rr aa, Q в микронах без точки', () => {
  const lines = g76Lines({ gsys: 'A', P: 2.5, D: 20, zEnd: -30, firstCut: 0.4, finishPasses: 2, runout: 2.5, angle: 60, minCut: 0.1 });
  const first = lines.find((l) => l.startsWith('G76 P'));
  assert.match(first, /^G76 P021060 Q100 R/);
  const second = lines.find((l) => l.startsWith('G76 X'));
  assert.match(second, /Q400 F2\.5$/);
});
test('проходы с постоянным сечением: глубина Δd·√n, последний — до полной', () => {
  const p = threadPasses(1.5335, 0.4, 0.05);
  close(p[0].depth, 0.4);
  close(p[3].depth, 0.8);
  close(p[p.length - 1].depth, 1.5335);
});
test('G92: по строке на проход', () => {
  const th = calcThread({ D: 20, P: 2.5, external: true, length: 30, firstCut: 0.4 });
  const l = g92Lines({ gsys: 'A', P: 2.5, D: 20, zEnd: -30, xs: th.passes.map((x) => x.x) });
  assert.equal(l.filter((x) => x.startsWith('G92')).length, 1);
  assert.ok(l.length > th.passes.length);
});
test('системы B/C: циклы не выводятся', () => {
  assert.throws(() => g76Lines({ gsys: 'B', P: 2.5, D: 20, zEnd: -30, firstCut: 0.4 }), /систем/i);
});
test('фаска 2×45° на торце: точки на диаметре', () => {
  const d = directions('face-dia');
  const c = chamferCorner({ x: 0, y: 15 }, d.uIn, d.uOut, 2, 2);
  close(c.p1.y * 2, 26);
  close(c.p2.x, -2);
});
test('радиус R2 в углу торец→Ø: точки касания и направление', () => {
  const d = directions('face-dia');
  const f = filletCorner({ x: 0, y: 15 }, d.uIn, d.uOut, 2);
  close(f.p1.y, 13); close(f.p1.x, 0); close(f.p2.x, -2); close(f.p2.y, 15);
  assert.equal(f.ccw, true); // вверх по торцу, затем влево к патрону: поворот налево = против часовой
});
test('режимы: Vc → S, Ra', () => {
  close(vcToS(100, 10), 3183.1, 0.1);
  close(raFromFeed(0.2, 0.8), 1.5625, 1e-4);
  close(feedFromRa(1.5625, 0.8), 0.2, 1e-4);
  assert.equal(g50Limit(200, 5, 3000), 3000);
});
test('экран «Конус»: код с G01 X Z F', () => {
  const r = taper.calc({ mode: 'ddl', D: 40, d: 30, L: 50, z0: 0, f: 0.2, pos: 'chuck' }, S);
  assert.deepEqual(r.code, ['G01 X30. Z0. F0.2', 'G01 X40. Z-50.']);
});
test('экран «Фаска/радиус»: G03/G02 по держателю', () => {
  const p = { type: 'fillet', place: 'face-dia', size: 'cc', D: 30, z: 0, R: 2, f: 0.1 };
  const rear = chamfer.calc(p, S);
  assert.match(rear.code[1], /^G03 X30\. Z-2\. R2\.$/);
  const front = chamfer.calc(p, { ...S, holder: 'front' });
  assert.match(front.code[1], /^G02 /);
});
test('экран «Резьба»: M20×2.5 и «нет данных» для остальных', () => {
  const ok = thread.calc({ side: 'ext', kind: 'table', size: 'M20', pitch: '2.5', length: 30, z0: 0, runout: 2.5, starts: 1, firstCut: 0.4, minCut: 0.1, finish: 2, angle: 60, out: 'g76' }, S);
  assert.ok(ok.code.some((l) => l.includes('P1534')));
  const none = thread.calc({ side: 'ext', kind: 'table', size: 'M99', length: 30 }, S);
  assert.match(none.err, /Нет данных/);
});
test('экран «Режимы»: S3183 для Ø10, Vc100', () => {
  const r = modes.calc({ D: 10, vc: 100, f: 0.1, dmin: NaN }, S);
  assert.ok(r.results.some(([, v]) => v.startsWith('3183')));
});
test('подсветка: G оранжевый, X/Z синие, F зелёный, комментарий курсивом', () => {
  const h = highlightLine('G01 X20. Z-1. F0.2 (VAL)');
  assert.match(h, /<span class="g">G01<\/span>/);
  assert.match(h, /<span class="a">X20\.<\/span>/);
  assert.match(h, /<span class="f">F0\.2<\/span>/);
  assert.match(h, /<span class="c">\(VAL\)<\/span>/);
  assert.match(highlightLine('N10 M03 P5 #12'), /class="n">N10.*class="m">M03.*class="p">P5.*class="v">#12/);
});
