// Автопроверки траектории и программы (раздел 10 и 11.3 ТЗ). Чистые функции.
import { parseGcode } from './parse.js';
import { dist } from '../core/geometry.js';

const R = (id, title, level, items = []) => ({ id, title, level, items });
const fmt3 = (n) => (Math.round(n * 1000) / 1000).toString();

function sample(a, b, n = 60) {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push({ x: a.x + ((b.x - a.x) * i) / n, y: (a.y ?? 0) + (((b.y ?? 0) - (a.y ?? 0)) * i) / n, z: a.z + ((b.z - a.z) * i) / n });
  return pts;
}

// Ø заготовки: из настроек/ввода, иначе — по X перед первым G71/G72 (грубая оценка сверху)
export function guessStock(parsed) {
  const c = parsed.cycles.find((k) => k.code === 'G71' || k.code === 'G72');
  if (!c) return null;
  for (let i = parsed.moves.length - 1; i >= 0; i--) {
    const m = parsed.moves[i];
    if (m.line < c.line && m.type === 'G00') return { d: m.to.x, zFace: 0, guessed: true };
  }
  return null;
}

export function runChecks(parsed, { stock = null, chuckZ = null, profile = parsed.profile } = {}) {
  const TF = profile !== 'MF';
  const res = [];
  const moves = parsed.moves;
  if (parsed.errors.length) res.push(R('parse', 'Разбор кадров', 'bad', parsed.errors.map((e) => ({ line: e.line, text: e.text }))));

  // дуги: сходимость
  const arcBad = [];
  for (const m of moves) {
    if (m.type !== 'G02' && m.type !== 'G03') continue;
    if (m.mismatch) arcBad.push({ line: m.line, text: `Дуга не сходится: конец лежит не на окружности (R≈${fmt3(m.radius)})` });
  }
  res.push(R('arc', 'Дуги сходятся', arcBad.length ? 'bad' : 'ok', arcBad));

  if (TF) {
    const st = stock || guessStock(parsed);
    // G00 не заходит в материал
    if (st && st.d > 0) {
      const bad = [];
      for (const m of moves) {
        if (m.type !== 'G00') continue;
        const len = st.length > 0 ? st.length : Infinity;
        for (const p of sample({ x: m.from.x, y: 0, z: m.from.z }, { x: m.to.x, y: 0, z: m.to.z })) {
          if (p.x < st.d - 1e-6 && p.z < (st.zFace ?? 0) - 1e-6 && p.z > (st.zFace ?? 0) - len) {
            bad.push({ line: m.line, text: `G00 заходит в материал (Ø${fmt3(p.x)} при Z${fmt3(p.z)}, заготовка Ø${fmt3(st.d)})` });
            break;
          }
        }
      }
      res.push(R('g00', 'Подвод G00 вне заготовки', bad.length ? 'bad' : 'ok', bad));
    } else res.push(R('g00', 'Подвод G00 вне заготовки', 'warn', [{ text: 'Ø заготовки не задан — проверка пропущена' }]));
    // граница патрона
    if (Number.isFinite(chuckZ)) {
      const bad = moves.filter((m) => m.to.z < chuckZ - 1e-6 || (m.type !== 'G00' && m.from.z < chuckZ - 1e-6)).map((m) => ({ line: m.line, text: `Z${fmt3(m.to.z)} заходит за границу патрона Z${fmt3(chuckZ)}` }));
      res.push(R('chuck', 'Z не заходит в патрон', bad.length ? 'bad' : 'ok', bad));
    } else res.push(R('chuck', 'Z не заходит в патрон', 'warn', [{ text: 'Граница патрона не задана в настройках' }]));
    // первый кадр G71/G72
    const first = [];
    for (const c of parsed.cycles) {
      if ((c.code !== 'G71' && c.code !== 'G72') || c.p === undefined || c.x !== undefined || c.z !== undefined) continue;
      const blk = parsed.blocks.find((b) => b.line > c.line && b.n === c.p);
      if (!blk) { first.push({ line: c.line, text: `Не найден кадр N${c.p} начала контура` }); continue; }
      const hasX = blk.words.some((w) => w.l === 'X' || w.l === 'U'), hasZ = blk.words.some((w) => w.l === 'Z' || w.l === 'W');
      if (c.code === 'G71' && (!hasX || hasZ)) first.push({ line: blk.line, text: 'Первый кадр контура G71 должен содержать только X (без Z)' });
      if (c.code === 'G72' && (!hasZ || hasX)) first.push({ line: blk.line, text: 'Первый кадр контура G72 должен содержать только Z (без X)' });
    }
    if (parsed.cycles.some((c) => c.code === 'G71' || c.code === 'G72')) res.push(R('g71first', 'Первый кадр контура G71/G72', first.length ? 'bad' : 'ok', first));
    // G96 без G50
    let g50 = false; const g96 = [];
    for (const b of parsed.blocks) {
      if (b.gs.includes(50) && b.words.some((w) => w.l === 'S')) g50 = true;
      if (b.gs.includes(96) && !g50) g96.push({ line: b.line, text: 'G96 без предварительного G50 S — обороты не ограничены' });
    }
    if (parsed.blocks.some((b) => b.gs.includes(96))) res.push(R('g96', 'G96 с ограничением G50', g96.length ? 'bad' : 'ok', g96));
    // смена инструмента без отвода
    const tc = []; let lastTool = null; let cut = false; let retracted = true;
    for (const b of parsed.blocks) {
      if (b.flags.includes('ref')) retracted = true;
      const t = b.words.find((w) => w.l === 'T');
      if (t && t.v !== lastTool) {
        if (lastTool !== null && cut && !retracted) tc.push({ line: b.line, text: `Смена T${t.v} без отвода (нет G28 перед сменой)` });
        lastTool = t.v; cut = false;
      }
      if (b.moveIdx.some((i) => moves[i].type !== 'G00')) { cut = true; retracted = false; }
    }
    if (parsed.tools.length > 1) res.push(R('toolchg', 'Смена инструмента с отводом', tc.length ? 'warn' : 'ok', tc));
  } else {
    // MF
    const cyc = moves.filter((m) => m.type === 'CYCLE');
    const rb = cyc.filter((m) => m.rPlane !== undefined && m.rPlane !== null && m.rPlane < 0).map((m) => ({ line: m.line, text: `Плоскость R${fmt3(m.rPlane)} ниже Z0 детали` }));
    if (cyc.length) res.push(R('rplane', 'R выше Z0 детали', rb.length ? 'bad' : 'ok', rb));
    // последний кадр цикла с G98
    const lastBad = [];
    cyc.forEach((m, i) => {
      const next = cyc[i + 1];
      const lastOfSeq = !next || next.code !== m.code || parsed.blocks.slice(m.line, next.line - 1).some((b) => b.gs.includes(80));
      if (lastOfSeq && m.retract !== 'G98') lastBad.push({ line: m.line, text: 'Последний кадр цикла идёт с G99 — возврат в плоскость R, а не в исходную' });
    });
    if (cyc.length) res.push(R('g98', 'Последний кадр цикла с G98', lastBad.length ? 'warn' : 'ok', lastBad));
    // G80
    if (cyc.length) {
      const lastCycLine = cyc[cyc.length - 1].line;
      const g80 = parsed.blocks.some((b) => b.line >= lastCycLine && b.gs.includes(80));
      res.push(R('g80', 'Цикл отменён G80', g80 ? 'ok' : 'bad', g80 ? [] : [{ line: lastCycLine, text: 'Цикл не отменён G80' }]));
    }
    // дуга > 180° через R
    const big = moves.filter((m) => (m.type === 'G02' || m.type === 'G03') && m.viaR && m.sweep > 180 + 1e-6).map((m) => ({ line: m.line, text: `Дуга ${fmt3(m.sweep)}° выведена через R — используйте I J` }));
    res.push(R('arc180', 'Дуга больше 180° через I J', big.length ? 'bad' : 'ok', big));
    // G43 после M06
    const noH = [];
    parsed.blocks.forEach((b, i) => {
      if (!b.ms.includes(6)) return;
      let ok = b.gs.includes(43);
      for (let j = i + 1; j < parsed.blocks.length && !ok; j++) {
        if (parsed.blocks[j].gs.includes(43)) ok = true;
        if (parsed.blocks[j].moveIdx.some((k) => moves[k].type !== 'G00') || parsed.blocks[j].ms.includes(6)) break;
      }
      if (!ok) noH.push({ line: b.line, text: 'После M06 нет G43 (коррекция длины)' });
    });
    if (parsed.blocks.some((b) => b.ms.includes(6))) res.push(R('g43', 'G43 после M06', noH.length ? 'bad' : 'ok', noH));
    // G41/G42 без G40
    let comp = 'G40', compLine = 0;
    for (const b of parsed.blocks) { if (b.gs.includes(40)) comp = 'G40'; if (b.gs.includes(41)) { comp = 'G41'; compLine = b.line; } if (b.gs.includes(42)) { comp = 'G42'; compLine = b.line; } }
    if (parsed.blocks.some((b) => b.gs.includes(41) || b.gs.includes(42))) res.push(R('g40', 'G41/G42 отменены G40', comp === 'G40' ? 'ok' : 'bad', comp === 'G40' ? [] : [{ line: compLine, text: `${comp} не отменён G40 до конца программы` }]));
    // G00 ниже Z0 внутри заготовки
    if (stock && stock.x && stock.y) {
      const bad = [];
      for (const m of moves) {
        if (m.type !== 'G00') continue;
        for (const p of sample(m.from, m.to)) {
          if (p.z < -1e-6 && p.x > stock.x[0] && p.x < stock.x[1] && p.y > stock.y[0] && p.y < stock.y[1]) { bad.push({ line: m.line, text: `G00 ниже Z0 внутри заготовки (Z${fmt3(p.z)})` }); break; }
        }
      }
      res.push(R('g00', 'G00 не заходит в заготовку', bad.length ? 'bad' : 'ok', bad));
    }
  }
  return res;
}

export const worst = (checks) => (checks.some((c) => c.level === 'bad') ? 'bad' : checks.some((c) => c.level === 'warn') ? 'warn' : 'ok');

// Профиль по тексту: U/W, G71, T0101 — TF; G43 H, G54, M06, G81 — MF
export function detectProfile(text) {
  const t = String(text).toUpperCase();
  let tf = 0, mf = 0;
  if (/\b[UW]-?\d/.test(t)) tf++;
  if (/\bG7[0-6]\b/.test(t) && /\bG7[12]\b/.test(t)) tf += 2;
  if (/\bT\d{4}\b/.test(t)) tf++;
  if (/\bG43\b.*\bH\d/.test(t)) mf++;
  if (/\bG5[4-9]\b/.test(t)) mf++;
  if (/\bM0?6\b/.test(t)) mf++;
  if (/\bG8[1-9]\b/.test(t)) mf++;
  return mf > tf ? 'MF' : 'TF';
}

// Оценка времени, мин. rapid — быстрый ход, мм/мин. maxRpm — если G96 без G50.
export function summarize(parsed, { rapid = 10000, maxRpm = 3000 } = {}) {
  let min = 0, unknown = 0;
  const TF = parsed.profile !== 'MF';
  for (const m of parsed.moves) {
    const a = m.from, b = m.to;
    const len = TF
      ? (m.type === 'G02' || m.type === 'G03') && m.radius ? m.radius * (m.sweep * Math.PI) / 180 : Math.hypot(b.z - a.z, (b.x - a.x) / 2)
      : (m.type === 'G02' || m.type === 'G03') && m.radius ? m.radius * (m.sweep * Math.PI) / 180 : m.type === 'CYCLE' ? Math.abs((m.rPlane ?? 0) - m.bottom) : dist({ x: a.x, y: a.y }, { x: b.x, y: b.y }) + Math.abs(b.z - a.z);
    if (m.type === 'G00') { min += len / rapid; continue; }
    let F = null;
    if (TF) {
      if (m.feedMode === 'G98') F = m.f;
      else if (m.f > 0) {
        let rpm = m.s;
        if (m.spindle === 'G96' && m.s > 0) rpm = Math.min(m.g50 || maxRpm, (1000 * m.s) / (Math.PI * Math.max(b.x, 1)));
        if (rpm > 0) F = m.f * rpm;
      }
    } else F = m.feedMode === 'G95' ? (m.f > 0 && m.s > 0 ? m.f * m.s : null) : m.f;
    if (F > 0) min += len / F; else unknown++;
  }
  return { moves: parsed.moves.length, tools: parsed.tools, minutes: min, unknown };
}

export const analyze = (text, opts = {}) => {
  const profile = opts.profile || detectProfile(text);
  const parsed = parseGcode(text, { profile, holder: opts.holder || 'rear' });
  const checks = runChecks(parsed, { stock: opts.stock || null, chuckZ: opts.chuckZ ?? null, profile });
  return { profile, parsed, checks, summary: summarize(parsed) };
};
