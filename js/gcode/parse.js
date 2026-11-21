// Парсер G-кода в список перемещений по правилам профиля (TF / MF). Чистые функции, без DOM.
// Перемещение: { n, type: 'G00'|'G01'|'G02'|'G03'|'CYCLE', from, to, center?, line, ... }
// TF: точки {x: Ø, z}; MF: точки {x, y, z}.
import { arcCenterFromR, dist, arcSweep, deg } from '../core/geometry.js';

const WORD_RE = /([A-Z])\s*([+-]?(?:\d+\.?\d*|\.\d+))/g;
const MACRO_RE = /[#[\]]|\b(WHILE|DO\d|END\d|IF|GOTO)\b/;

export function tokenize(line) {
  let s = String(line).toUpperCase();
  const comments = [];
  s = s.replace(/\(([^)]*)\)/g, (m, c) => { comments.push(c); return ' '; });
  const macro = MACRO_RE.test(s);
  const words = [];
  if (!macro) {
    WORD_RE.lastIndex = 0;
    let m;
    while ((m = WORD_RE.exec(s))) words.push({ l: m[1], v: parseFloat(m[2]) });
  }
  return { words, comments, macro, text: s.trim() };
}

const clone = (p) => (p ? { ...p } : p);
const has = (ws, l) => ws.some((w) => w.l === l);
const get = (ws, l) => { const w = ws.find((x) => x.l === l); return w ? w.v : undefined; };

export function parseGcode(text, { profile = 'TF', holder = 'rear' } = {}) {
  const TF = profile !== 'MF';
  const lines = String(text).split(/\r?\n/);
  const out = { moves: [], blocks: [], cycles: [], tools: [], errors: [], profile };
  const st = {
    pos: null, motion: 'G00', abs: true, plane: 'G17', cycle: null, ret: 'G98', rPlane: null, initZ: null,
    tool: null, f: null, feedMode: TF ? 'G99' : 'G94', s: null, spindle: 'G97', g50: null, comp: 'G40', hcomp: false,
  };
  lines.forEach((raw, idx) => {
    const lineNo = idx + 1;
    const tk = tokenize(raw);
    const blk = { line: lineNo, raw, n: undefined, words: tk.words, macro: tk.macro, comments: tk.comments, gs: [], ms: [], moveIdx: [], flags: [] };
    out.blocks.push(blk);
    if (tk.text === '%' || /^O\d+/.test(tk.text) || !tk.text) return;
    if (tk.macro) { blk.flags.push('macro'); return; }
    const ws = tk.words;
    const nw = ws.find((w) => w.l === 'N');
    if (nw) blk.n = nw.v;
    const gs = ws.filter((w) => w.l === 'G').map((w) => Math.round(w.v * 10) / 10);
    const ms = ws.filter((w) => w.l === 'M').map((w) => w.v);
    blk.gs = gs; blk.ms = ms;
    // --- модальные коды ---
    let special = null; // цикл токарки / G28 и т.п.
    for (const g of gs) {
      if (g === 0 || g === 1 || g === 2 || g === 3) st.motion = 'G0' + g;
      else if (!TF && (g === 17 || g === 18 || g === 19)) st.plane = 'G' + g;
      else if (!TF && g === 90) st.abs = true;
      else if (!TF && g === 91) st.abs = false;
      else if (g === 40 || g === 41 || g === 42) st.comp = 'G' + g;
      else if (g === 43) st.hcomp = true;
      else if (g === 49) st.hcomp = false;
      else if (g === 96 || g === 97) st.spindle = 'G' + g;
      else if (g === 50 && TF) st.g50 = get(ws, 'S') ?? st.g50;
      else if (g === 98 || g === 99) { if (TF) st.feedMode = 'G' + g; else st.ret = 'G' + g; }
      else if (!TF && (g === 94 || g === 95)) st.feedMode = 'G' + g;
      else if (!TF && g === 80) st.cycle = null;
      else if (!TF && [73, 74, 76, 81, 82, 83, 84, 85, 86, 87, 88, 89].includes(g) && g !== 74) st.cycle = 'G' + g;
      else if (g === 28 || g === 30) special = 'G28';
      else if (TF && [70, 71, 72, 73, 74, 75, 76, 90, 92, 94].includes(g)) special = 'G' + g;
    }
    if (has(ws, 'F')) st.f = get(ws, 'F');
    if (has(ws, 'S') && !gs.includes(50)) st.s = get(ws, 'S');
    if (has(ws, 'T')) { st.tool = get(ws, 'T'); if (!out.tools.includes(st.tool)) out.tools.push(st.tool); }
    const meta = { feedMode: st.feedMode, f: st.f, s: st.s, spindle: st.spindle, g50: st.g50, tool: st.tool, comp: st.comp };

    if (special === 'G28') { st.pos = null; blk.flags.push('ref'); return; }

    if (TF) {
      const target = tfTarget(ws, st.pos);
      if (special && ['G70', 'G71', 'G72', 'G73', 'G74', 'G75'].includes(special)) {
        out.cycles.push({ code: special, line: lineNo, p: get(ws, 'P'), q: get(ws, 'Q'), u: get(ws, 'U'), w: get(ws, 'W'), r: get(ws, 'R'), f: get(ws, 'F'), x: get(ws, 'X'), z: get(ws, 'Z') });
        blk.flags.push('cycle');
        // циклы черновой/чистовой обработки возвращают инструмент в точку старта цикла
        if (['G71', 'G72', 'G73'].includes(special) && has(ws, 'P') && st.pos) st.cycStart = clone(st.pos);
        if (special === 'G70' && st.cycStart) st.pos = clone(st.cycStart);
        return;
      }
      if (special === 'G76') {
        out.cycles.push({ code: 'G76', line: lineNo, p: get(ws, 'P'), q: get(ws, 'Q'), r: get(ws, 'R'), x: get(ws, 'X'), z: get(ws, 'Z'), f: get(ws, 'F') });
        blk.flags.push('cycle');
        if (has(ws, 'X') && has(ws, 'Z') && st.pos) pushMove(out, blk, { type: 'G01', from: clone(st.pos), to: { x: st.pos.x, z: get(ws, 'Z') }, cycle: 'G76', approx: true, ...meta });
        return;
      }
      if (special === 'G90' || special === 'G92' || special === 'G94') {
        blk.flags.push('cycle');
        out.cycles.push({ code: special, line: lineNo, x: get(ws, 'X'), z: get(ws, 'Z'), f: get(ws, 'F') });
        if (st.pos && target) {
          const X = has(ws, 'X') || has(ws, 'U') ? target.x : st.pos.x, Z = has(ws, 'Z') || has(ws, 'W') ? target.z : st.pos.z;
          const from = special === 'G94' ? { x: st.pos.x, z: Z } : { x: X, z: st.pos.z };
          const to = special === 'G94' ? { x: X, z: Z } : { x: X, z: Z };
          pushMove(out, blk, { type: 'G01', from, to, cycle: special, approx: true, ...meta });
        }
        return;
      }
      if (!target) return; // нет осей
      const from = st.pos ? clone(st.pos) : clone(target);
      const to = target;
      const mv = { type: st.motion, from, to, ...meta };
      if (st.motion === 'G02' || st.motion === 'G03') {
        const arc = tfArc(ws, from, to, st.motion, holder);
        if (arc.error) { out.errors.push({ line: lineNo, text: arc.error }); blk.flags.push('arcerr'); } else Object.assign(mv, arc);
      }
      pushMove(out, blk, mv);
      st.pos = to;
      return;
    }

    // ---- MF ----
    const axes = ['X', 'Y', 'Z'];
    const anyAxis = axes.some((a) => has(ws, a));
    if (st.cycle && (anyAxis || has(ws, 'R'))) {
      if (has(ws, 'R')) st.rPlane = st.abs ? get(ws, 'R') : (st.pos ? st.pos.z : 0) + get(ws, 'R');
      if (has(ws, 'Z')) st.cz = get(ws, 'Z');
      if (st.initZ === null || !out.moves.length || out.moves[out.moves.length - 1].type !== 'CYCLE') st.initZ = st.pos ? st.pos.z : 0;
      const cur = st.pos ? clone(st.pos) : { x: 0, y: 0, z: 0 };
      const to = { x: has(ws, 'X') ? (st.abs ? get(ws, 'X') : cur.x + get(ws, 'X')) : cur.x, y: has(ws, 'Y') ? (st.abs ? get(ws, 'Y') : cur.y + get(ws, 'Y')) : cur.y, z: cur.z };
      const retr = gs.includes(98) ? 'G98' : gs.includes(99) ? 'G99' : st.ret;
      const bottom = st.abs ? st.cz : (st.rPlane ?? 0) + (st.cz ?? 0);
      const k = get(ws, 'K');
      if (k === 0) { blk.flags.push('cycle-store'); return; }
      pushMove(out, blk, { type: 'CYCLE', code: st.cycle, from: cur, to: { x: to.x, y: to.y, z: bottom }, hole: { x: to.x, y: to.y }, rPlane: st.rPlane, bottom, initZ: st.initZ, retract: retr, q: get(ws, 'Q'), p: get(ws, 'P'), ...meta });
      st.pos = { x: to.x, y: to.y, z: retr === 'G98' ? st.initZ : st.rPlane };
      st.ret = retr;
      return;
    }
    if (!anyAxis) return;
    const to = clone(st.pos) || {};
    const from0 = st.pos ? clone(st.pos) : null;
    for (const a of axes) {
      const k = a.toLowerCase();
      if (has(ws, a)) to[k] = st.abs ? get(ws, a) : (from0 && from0[k] !== undefined ? from0[k] : 0) + get(ws, a);
    }
    for (const k of ['x', 'y', 'z']) if (to[k] === undefined) to[k] = 0;
    const from = from0 || clone(to);
    const mv = { type: st.motion, from, to, ...meta, plane: st.plane };
    if (st.motion === 'G02' || st.motion === 'G03') {
      const arc = mfArc(ws, from, to, st.motion, st.plane);
      if (arc.error) { out.errors.push({ line: lineNo, text: arc.error }); blk.flags.push('arcerr'); } else Object.assign(mv, arc);
    }
    pushMove(out, blk, mv);
    st.pos = to;
  });
  return out;
}

function pushMove(out, blk, mv) {
  mv.n = out.moves.length;
  mv.line = blk.line;
  blk.moveIdx.push(mv.n);
  out.moves.push(mv);
}

function tfTarget(ws, pos) {
  const X = get(ws, 'X'), Z = get(ws, 'Z'), U = get(ws, 'U'), W = get(ws, 'W');
  if (X === undefined && Z === undefined && U === undefined && W === undefined) return null;
  const base = pos || { x: 0, z: 0 };
  return {
    x: X !== undefined ? X : U !== undefined ? base.x + U : base.x,
    z: Z !== undefined ? Z : W !== undefined ? base.z + W : base.z,
  };
}

// TF: плоскость (Z вправо, радиус вверх). Против часовой в этой плоскости = G03 для заднего держателя.
function tfArc(ws, from, to, code, holder) {
  const ccw = holder === 'front' ? code === 'G02' : code === 'G03';
  const p1 = { x: from.z, y: from.x / 2 }, p2 = { x: to.z, y: to.x / 2 };
  const R = get(ws, 'R');
  let c = null;
  if (has(ws, 'I') || has(ws, 'K')) c = { x: p1.x + (get(ws, 'K') || 0), y: p1.y + (get(ws, 'I') || 0) };
  else if (R !== undefined) {
    c = arcCenterFromR(p1, p2, R, ccw);
    if (!c) return { error: `Дуга: |R|=${Math.abs(R)} меньше половины хорды (${(dist(p1, p2) / 2).toFixed(3)})` };
  } else return { error: 'Дуга без R и без I/K' };
  const r1 = dist(c, p1), r2 = dist(c, p2);
  return { center: { x: c.y * 2, z: c.x }, radius: r1, endError: Math.abs(r1 - r2), ccw, sweep: deg(arcSweep(p1, p2, c, ccw)), mismatch: Math.abs(r1 - r2) > 1e-3 };
}

function mfArc(ws, from, to, code, plane) {
  const ccw = code === 'G03';
  const ax = plane === 'G17' ? ['x', 'y', 'I', 'J'] : plane === 'G18' ? ['z', 'x', 'K', 'I'] : ['y', 'z', 'J', 'K'];
  const [a1, a2, o1, o2] = ax;
  const p1 = { x: from[a1], y: from[a2] }, p2 = { x: to[a1], y: to[a2] };
  const R = get(ws, 'R');
  let c = null;
  const viaR = !(has(ws, o1) || has(ws, o2));
  if (!viaR) c = { x: p1.x + (get(ws, o1) || 0), y: p1.y + (get(ws, o2) || 0) };
  else if (R !== undefined) {
    c = arcCenterFromR(p1, p2, R, ccw);
    if (!c) return { error: `Дуга: |R|=${Math.abs(R)} меньше половины хорды` };
  } else return { error: 'Дуга без R и без I/J/K' };
  const r1 = dist(c, p1), r2 = dist(c, p2);
  const center = { ...from };
  center[a1] = c.x; center[a2] = c.y;
  const sweep = deg(arcSweep(p1, p2, c, ccw));
  return { center, radius: r1, ccw, sweep, viaR, R, mismatch: Math.abs(r1 - r2) > 1e-3 };
}
