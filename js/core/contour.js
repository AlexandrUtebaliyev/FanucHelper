// Контур детали для G71/G70/G72: сегменты, валидация (монотонность), блоки контура.
import { sub, unit, dist, arcCenterFromR, arcPoints, EPS } from './geometry.js';
import { chamferCorner, filletCorner } from './chamfer.js';
import { fmt, word, join, arcCode } from '../gcode/format.js';

// Строка таблицы: { d: Ø, z: Z, tag: 'C1' | 'R0.5' | 'G02 R5' | 'G03 R5' | '' }
// C — фаска (катет, равные катеты), R — скругление угла в этой точке,
// «G03 R5» — дуга радиуса 5 от этой точки к следующей.
export function parseTag(text) {
  const t = String(text ?? '').trim().toUpperCase().replace(',', '.');
  if (!t || t === '—' || t === '-') return { ok: true };
  let m = t.match(/^C(\d*\.?\d+)$/);
  if (m) return { ok: true, corner: { kind: 'C', v: parseFloat(m[1]) } };
  m = t.match(/^R(\d*\.?\d+)$/);
  if (m) return { ok: true, corner: { kind: 'R', v: parseFloat(m[1]) } };
  m = t.match(/^(G0[23])\s*R?(\d*\.?\d+)$/);
  if (m) return { ok: true, arc: { dir: m[1], R: parseFloat(m[2]) } };
  return { ok: false, error: `Не понял «${text}». Примеры: C1, R0.5, G03 R5` };
}

export const ccwOf = (dir, holder = 'rear') => (holder === 'front' ? dir === 'G02' : dir === 'G03');

const P = (row) => ({ x: row.z, y: row.d / 2 }); // x = Z, y = радиус

// rows -> { segs, errors }. side: 'ext' | 'int'
export function buildContour(rows, { holder = 'rear', side = 'ext' } = {}) {
  const errors = [];
  if (!rows || rows.length < 2) return { segs: [], errors: ['Нужно минимум две точки'] };
  for (let i = 0; i < rows.length; i++) {
    if (!Number.isFinite(rows[i].d) || !Number.isFinite(rows[i].z)) return { segs: [], errors: [`Точка ${i + 1}: заполните Ø и Z`] };
    if (rows[i].d < 0) return { segs: [], errors: [`Точка ${i + 1}: отрицательный Ø`] };
  }
  const V = rows.map(P);
  const n = rows.length;
  const tags = rows.map((r) => parseTag(r.tag));
  tags.forEach((t, i) => { if (!t.ok) errors.push(`Точка ${i + 1}: ${t.error}`); });
  if (errors.length) return { segs: [], errors };
  const inPt = V.map((p) => p); // вход в угол
  const outPt = V.map((p) => p); // выход из угла
  const cornerSeg = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const c = tags[i].corner;
    if (!c) continue;
    if (i === n - 1) { errors.push(`Точка ${i + 1}: фаска/радиус на последней точке не поддерживается`); continue; }
    if ((i > 0 && tags[i - 1].arc) || tags[i].arc) { errors.push(`Точка ${i + 1}: фаска/радиус рядом с дугой не поддерживается — добавьте точки вручную`); continue; }
    const uIn = i === 0 ? { x: 0, y: side === 'int' ? -1 : 1 } : unit(sub(V[i], V[i - 1]));
    const uOut = unit(sub(V[i + 1], V[i]));
    const res = c.kind === 'C' ? chamferCorner(V[i], uIn, uOut, c.v, c.v) : filletCorner(V[i], uIn, uOut, c.v);
    if (res.error) { errors.push(`Точка ${i + 1}: ${res.error}`); continue; }
    // катет не длиннее соседних отрезков
    const t = c.kind === 'C' ? c.v : res.t;
    if (i > 0 && t > dist(V[i], V[i - 1]) + 1e-9) errors.push(`Точка ${i + 1}: угол не помещается на предыдущем отрезке`);
    if (t > dist(V[i], V[i + 1]) + 1e-9) errors.push(`Точка ${i + 1}: угол не помещается на следующем отрезке`);
    inPt[i] = res.p1; outPt[i] = res.p2;
    cornerSeg[i] = c.kind === 'C' ? { type: 'line', p: res.p1, q: res.p2 } : { type: 'arc', p: res.p1, q: res.p2, c: res.center, ccw: res.ccw };
  }
  if (errors.length) return { segs: [], errors };
  const segs = [];
  for (let i = 0; i < n; i++) {
    if (cornerSeg[i]) segs.push(cornerSeg[i]);
    if (i === n - 1) break;
    const p = outPt[i], q = inPt[i + 1];
    if (dist(p, q) < EPS) continue;
    if (tags[i].arc) {
      const ccw = ccwOf(tags[i].arc.dir, holder);
      const c = arcCenterFromR(p, q, tags[i].arc.R, ccw);
      if (!c) { errors.push(`Точки ${i + 1}–${i + 2}: радиус дуги меньше половины хорды`); continue; }
      segs.push({ type: 'arc', p, q, c, ccw });
    } else segs.push({ type: 'line', p, q });
  }
  return { segs, errors };
}

// Развернуть контур (для G72: идём от патрона к центру)
export function reverseSegs(segs) {
  return segs.slice().reverse().map((s) => (s.type === 'arc' ? { ...s, p: s.q, q: s.p, ccw: !s.ccw } : { ...s, p: s.q, q: s.p }));
}

export function samplePoints(segs, n = 32) {
  const pts = [];
  for (const s of segs) {
    if (s.type === 'arc') pts.push(...arcPoints(s.p, s.q, s.c, s.ccw, n));
    else pts.push(s.p, s.q);
  }
  return pts;
}

// Монотонность профиля для G71/G72 тип I.
// G71 наружный: Z не растёт, радиус не убывает. Внутренний: Z не растёт, радиус не растёт.
// G72 (контур развёрнут от патрона): Z не убывает, радиус не растёт (наружный).
export function checkMonotonic(segs, { mode = 'G71', side = 'ext' } = {}) {
  const issues = [];
  const tol = 1e-7;
  segs.forEach((s, i) => {
    const pts = s.type === 'arc' ? arcPoints(s.p, s.q, s.c, s.ccw, 32) : [s.p, s.q];
    for (let k = 1; k < pts.length; k++) {
      const dz = pts[k].x - pts[k - 1].x, dr = pts[k].y - pts[k - 1].y;
      let bad = false;
      if (mode === 'G72') bad = dz < -tol || (side === 'int' ? dr < -tol : dr > tol);
      else bad = dz > tol || (side === 'int' ? dr > tol : dr < -tol);
      if (bad) { issues.push({ index: i, text: `Участок ${i + 1}: профиль возвращается (карман или подрез)` }); break; }
    }
  });
  return { ok: issues.length === 0, issues, suggest: issues.length ? 'G73' : null };
}

// Блоки контура. Первый блок G71 — только X, G72 — только Z. N только на первом и последнем блоке.
export function contourBlocks(segs, { dec = 3, holder = 'rear', mode = 'G71', ns = 10, nf = 60, fFinish, startX, startZ }) {
  const seq = mode === 'G72' ? reverseSegs(segs) : segs;
  const p0 = seq[0].p;
  const lines = [];
  let cur;
  if (mode === 'G72') {
    lines.push(join('N' + ns, 'G00', word('Z', p0.x, dec)));
    cur = { x: p0.x, y: startX / 2 };
  } else {
    lines.push(join('N' + ns, 'G00', word('X', p0.y * 2, dec)));
    cur = { x: startZ, y: p0.y };
  }
  let modal = 'G00';
  let fDone = false;
  const emitLine = (to) => {
    const parts = [];
    if (modal !== 'G01') { parts.push('G01'); modal = 'G01'; }
    const dz = Math.abs(to.x - cur.x) > 5e-4, dx = Math.abs(to.y - cur.y) > 5e-4;
    if (dx) parts.push(word('X', to.y * 2, dec));
    if (dz) parts.push(word('Z', to.x, dec));
    if (!dx && !dz) return;
    if (!fDone && Number.isFinite(fFinish)) { parts.push(word('F', fFinish, dec)); fDone = true; }
    lines.push(join(...parts));
    cur = to;
  };
  for (const s of seq) {
    if (dist(cur, s.p) > 5e-4) emitLine(s.p);
    if (s.type === 'line') emitLine(s.q);
    else {
      const R = dist(s.c, s.p);
      lines.push(join(arcCode(s.ccw, holder), word('X', s.q.y * 2, dec), word('Z', s.q.x, dec), word('R', R, dec)));
      modal = arcCode(s.ccw, holder);
      cur = s.q;
    }
  }
  const last = lines.length - 1;
  if (last === 0) throw new Error('Контур состоит из одного блока');
  lines[last] = `N${nf} ` + lines[last];
  return lines;
}

export { fmt };
