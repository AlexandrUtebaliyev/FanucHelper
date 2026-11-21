import { compensateContour } from '../core/noseRadius.js';
import { chamferCorner, filletCorner, directions } from '../core/chamfer.js';
import { fmt, word, join, arcCode } from '../gcode/format.js';
import { assertSystemA } from '../gcode/cycles.js';
import { wrap } from './sketch.js';
import { nn } from './kit.js';

const TIPS = [['1', 'T1'], ['2', 'T2'], ['3', 'T3'], ['4', 'T4'], ['9', 'T9']];

// Исходный контур от торца к патрону: торец → угол (фаска / радиус / конус) → цилиндр
function buildSegs(p) {
  const R = p.D / 2, face = { x: 0, y: 0 };
  if (p.shape === 'taper') {
    if (!(p.d >= 0) || !(p.L > 0) || !(p.D > p.d)) return { error: 'Для конуса нужны d < D и L > 0' };
    const r0 = p.d / 2;
    return { segs: [
      { type: 'line', p: face, q: { x: 0, y: r0 } },
      { type: 'line', p: { x: 0, y: r0 }, q: { x: -p.L, y: R } },
      { type: 'line', p: { x: -p.L, y: R }, q: { x: -p.L - 10, y: R } },
    ], names: ['торец/конус', 'конус/цилиндр'] };
  }
  const dir = directions('face-dia');
  const V = { x: 0, y: R };
  const c = p.shape === 'arc' ? filletCorner(V, dir.uIn, dir.uOut, p.size) : chamferCorner(V, dir.uIn, dir.uOut, p.size, p.size * Math.tan(((nn(p.ang) ? p.ang : 45) * Math.PI) / 180));
  if (c.error) return { error: c.error };
  const mid = c.kind === 'fillet' ? { type: 'arc', p: c.p1, q: c.p2, c: c.center, ccw: c.ccw } : { type: 'line', p: c.p1, q: c.p2 };
  return { segs: [
    { type: 'line', p: face, q: c.p1 }, mid, { type: 'line', p: c.p2, q: { x: c.p2.x - 10, y: R } },
  ], names: ['торец/' + (c.kind === 'fillet' ? 'дуга' : 'фаска'), (c.kind === 'fillet' ? 'дуга' : 'фаска') + '/цилиндр'] };
}

export function calc(p0, s) {
  const dec = s.decimals;
  const p = { ...p0, r: p0.rp && p0.rp !== 'man' ? parseFloat(p0.rp) : p0.r };
  if (!nn(p.r) || p.r <= 0) return { err: 'Укажите радиус пластины' };
  if (!nn(p.D) || p.D <= 0) return { err: 'Укажите Ø' };
  const b = buildSegs(p);
  if (b.error) return { err: b.error };
  const res = compensateContour(b.segs, { r: p.r, tip: parseInt(p.tip, 10), side: p.side === 'int' ? 'left' : 'right' });
  if (res.error) return { err: res.error };
  const rows = [];
  const cmp = [];
  [1, 2].forEach((i, k) => {
    const o = i === 1 ? b.segs[0].q : b.segs[1].q;
    const c = res.points[i];
    const dz = res.deltas[i].dz, dd = res.deltas[i].dd;
    cmp.push(`<div class="cmp"><span>${b.names[k]}</span><div>Ø${fmt(o.y * 2, dec)} Z${fmt(o.x, dec)}</div><div style="color:#F5A524">Ø${fmt(c.y * 2, dec)} Z${fmt(c.x, dec)}</div></div>`);
    rows.push([`Δ ${b.names[k]}`, `ΔZ ${fmt(dz, dec)} · ΔØ ${fmt(dd, dec)}`]);
  });
  const code = [];
  let err = null;
  try {
    assertSystemA(s.gsys);
    const f = nn(p.f) && p.f > 0 ? word('F', p.f, dec) : '';
    const pts = res.points;
    code.push(join('G01', word('X', pts[1].y * 2, dec), word('Z', pts[1].x, dec), f));
    res.segs.slice(1).forEach((sg, i) => {
      if (sg.type === 'arc') code.push(join(arcCode(sg.ccw, s.holder), word('X', sg.q.y * 2, dec), word('Z', sg.q.x, dec), word('R', Math.hypot(sg.q.x - sg.c.x, sg.q.y - sg.c.y), dec)));
      else code.push(join('G01', word('X', sg.q.y * 2, dec), word('Z', sg.q.x, dec)));
      void i;
    });
  } catch (e) { err = e.message; }
  const sketch = wrap(340, 110, `<text x="14" y="20" fill="#9AA4B1" font-size="11" font-family="monospace">контур (белый) и траектория вершины (оранжевый)</text>` + pathSvg(b.segs, '#ECEFF3', 110) + pathSvg(res.segs, '#F5A524', 110, true), 'Эскиз компенсации');
  return {
    err, results: rows, code, tag: 'r' + fmt(p.r, 2), title: `Компенсация r${fmt(p.r, 2)} T${p.tip}`, sketch,
    extra: `<section><h2 class="h2">Исходные и скорректированные точки</h2><div class="card pad"><div class="cmp" style="border-bottom:1px solid #2C323A"><span></span><span>исходные</span><span>с компенсацией</span></div>${cmp.join('')}</div></section>`,
    warn: ['Компенсация посчитана вручную — не включайте G41/G42 для этих блоков. Проверьте в графике.'],
  };
}

function pathSvg(segs, color, h, dashed) {
  const xs = segs.flatMap((s) => [s.p.x, s.q.x]), ys = segs.flatMap((s) => [s.p.y, s.q.y]);
  const minx = -Math.max(...xs.map(Math.abs)) - 1, maxx = 1, maxy = Math.max(...ys) + 1;
  const sc = Math.min(300 / (maxx - minx), (h - 30) / maxy);
  const X = (p) => 320 - (maxx - p.x) * sc, Y = (p) => h - 8 - p.y * sc;
  let d = `M${X(segs[0].p)} ${Y(segs[0].p)}`;
  for (const s of segs) {
    if (s.type === 'arc') { const R = Math.hypot(s.p.x - s.c.x, s.p.y - s.c.y) * sc; d += ` A ${R} ${R} 0 0 ${s.ccw ? 0 : 1} ${X(s.q)} ${Y(s.q)}`; } else d += ` L${X(s.q)} ${Y(s.q)}`;
  }
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" ${dashed ? 'stroke-dasharray="5 3"' : ''}/>`;
}

export default {
  id: 'nose', title: 'Радиус пластины', cat: 'geo', tag: 'r',
  defaults: { rp: '0.8', r: '0.8', tip: '3', side: 'ext', shape: 'chamfer', D: '30', size: '2', ang: '45', d: '20', L: '20', f: '0.1' },
  form: [
    { type: 'seg', k: 'rp', options: [['0.2', '0.2'], ['0.4', '0.4'], ['0.8', '0.8'], ['1.2', '1.2'], ['1.6', '1.6'], ['man', 'свой']] },
    { type: 'num', k: 'r', label: 'Радиус пластины r', unit: 'мм', show: (v) => v.rp === 'man' },
    { type: 'seg', k: 'tip', options: TIPS },
    { type: 'note', text: 'Направления вершины T5–T8 пока без данных (TODO_DATA.md). T3 — наружный проходной к патрону, T2 — расточной.' },
    { type: 'seg', k: 'side', options: [['ext', 'Наружная'], ['int', 'Внутренняя']] },
    { type: 'seg', k: 'shape', options: [['chamfer', 'Фаска'], ['taper', 'Конус'], ['arc', 'Дуга R']] },
    { type: 'num', k: 'D', label: 'Ø цилиндра', unit: 'мм' },
    { type: 'num', k: 'size', label: 'Фаска: катет по Z / радиус R', unit: 'мм', show: (v) => v.shape !== 'taper' },
    { type: 'num', k: 'ang', label: 'Угол фаски к оси', unit: '°', show: (v) => v.shape === 'chamfer' },
    { type: 'num', k: 'd', label: 'Меньший Ø конуса d', unit: 'мм', show: (v) => v.shape === 'taper' },
    { type: 'num', k: 'L', label: 'Длина конуса', unit: 'мм', show: (v) => v.shape === 'taper' },
    { type: 'num', k: 'f', label: 'Подача F', unit: 'мм/об' },
  ],
  calc,
};
