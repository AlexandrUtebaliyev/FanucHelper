// Проверка траектории (раздел 10): рисует G-код, выданный генератором, покадрово.
import { topHtml, navHtml, ICONS, disclaimerHtml } from './kit.js';
import { highlightLine, esc } from './highlight.js';
import { analyze, worst } from '../gcode/check.js';
import { arcPoints, dist } from '../core/geometry.js';
import { compensateContour } from '../core/noseRadius.js';
import * as store from '../store.js';

const W = 350, H = 300;
const f3 = (n) => (Math.round(n * 1000) / 1000).toString();

// Точка перемещения в мировых координатах вида
function mk(profile, plane) {
  if (profile !== 'MF') return { pt: (p) => ({ x: p.z, y: p.x / 2 }), ok: () => true, label: ['Z', 'Ø'] };
  if (plane === 'xz') return { pt: (p) => ({ x: p.x, y: p.z }), ok: (m) => !m.plane || m.plane === 'G18', label: ['X', 'Z'] };
  return { pt: (p) => ({ x: p.x, y: p.y }), ok: (m) => !m.plane || m.plane === 'G17', label: ['X', 'Y'] };
}

function pathOf(m, view, profile) {
  const a = view.pt(m.from), b = view.pt(m.to);
  if ((m.type === 'G02' || m.type === 'G03') && m.center && view.ok(m)) {
    const c = view.pt(m.center);
    return arcPoints(a, b, c, m.ccw, 28);
  }
  void profile;
  return [a, b];
}

export function bpView(analysis, st) {
  const { parsed } = analysis;
  const view = mk(analysis.profile, st.plane);
  const paths = parsed.moves.map((m) => pathOf(m, view, analysis.profile));
  return { view, paths };
}

export function render(root, ctx) {
  const s = ctx.settings;
  const saved = store.load('bp', null);
  const profile = (saved && saved.profile) || s.profile;
  const st = { nums: true, g00: true, rough: false, nose: false, plane: 'xy', cur: 0, play: null, c: { x: 0, y: 0 }, sc: 1, r: 0.8 };
  root.innerHTML = `${topHtml('Проверка траектории', profile === 'MF' ? 'XY · 0i-MF' : 'ZX · 0i-TF', 'gray', saved && saved.from ? '#/' + saved.from : '#/')}<div class="page" id="pg"></div>${navHtml('#/')}`;
  const pg = root.querySelector('#pg');
  if (!saved || !saved.lines || !saved.lines.length) {
    pg.innerHTML = `<div class="note info">Нет программы для проверки. Вставьте текст G-кода или откройте этот экран кнопкой «Проверить на эскизе».</div>
      <textarea id="paste" class="inp" rows="8" placeholder="G00 X44. Z2.&#10;..."></textarea><div class="btns"><button class="btn pri" id="go" type="button">Показать</button></div>`;
    pg.querySelector('#go').onclick = () => { store.save('bp', { lines: pg.querySelector('#paste').value.split(/\r?\n/), profile }); ctx.rerender(); };
    return;
  }
  const text = saved.lines.join('\n');
  const stock = saved.stock || (profile === 'MF' ? null : null);
  const an = analyze(text, { profile, holder: s.holder, stock, chuckZ: s.chuckZ });
  const { parsed, checks } = an;
  const n = parsed.moves.length;
  let { view, paths } = bpView(an, st);

  const bbox = () => {
    const pts = paths.flat();
    if (stock && profile !== 'MF') { pts.push({ x: 0, y: stock.d / 2 }); }
    if (!pts.length) return { x0: -10, x1: 10, y0: -10, y1: 10 };
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys, profile === 'MF' ? Infinity : 0), y1: Math.max(...ys) };
  };
  const fit = () => {
    const b = bbox();
    const w = Math.max(b.x1 - b.x0, 1e-3), h = Math.max(b.y1 - b.y0, 1e-3);
    st.sc = Math.min((W - 50) / w, (H - 50) / h);
    st.c = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
  };
  fit();
  const X = (p) => (W / 2 + (p.x - st.c.x) * st.sc).toFixed(1);
  const Y = (p) => (H / 2 - (p.y - st.c.y) * st.sc).toFixed(1);
  const poly = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + X(p) + ' ' + Y(p)).join(' ');

  // контур чистового прохода (между кадрами P и Q первого G71/G72/G73)
  function contourMoves() {
    const c = parsed.cycles.find((k) => ['G71', 'G72', 'G73'].includes(k.code) && k.p !== undefined);
    if (!c) return null;
    const a = parsed.blocks.find((b) => b.line > c.line && b.n === c.p), z = parsed.blocks.find((b) => b.line > c.line && b.n === c.q);
    if (!a || !z) return null;
    return parsed.moves.filter((m) => m.line >= a.line && m.line <= z.line);
  }

  function svgHtml() {
    let g = '';
    if (profile !== 'MF') g += `<line x1="0" y1="${Y({ y: 0 })}" x2="${W}" y2="${Y({ y: 0 })}" stroke="#3A414B" stroke-dasharray="8 4 2 4"/>`;
    const cm = profile !== 'MF' ? contourMoves() : null;
    if (profile !== 'MF') {
      const sd = stock && stock.d;
      if (sd) {
        const minZ = Math.min(...parsed.moves.map((m) => Math.min(m.from.z, m.to.z)));
        g += `<rect x="${X({ x: minZ })}" y="${Y({ y: sd / 2 })}" width="${(0 - minZ) * st.sc}" height="${sd / 2 * st.sc}" fill="#1C2026" fill-opacity=".6" stroke="#3A414B" stroke-dasharray="3 3"/>`;
      }
      if (cm && cm.length) {
        const pts = cm.flatMap((m, i) => (paths[m.n].slice(i ? 1 : 0)));
        const poly2 = [{ x: pts[0].x, y: 0 }, ...pts, { x: pts[pts.length - 1].x, y: 0 }];
        g += `<path d="${poly(poly2)} Z" fill="#2C323A"/>`;
        if (st.rough) {
          const dd = (parsed.cycles.find((c) => c.code === 'G71' && c.p === undefined) || {}).u;
          const R0 = sd ? sd / 2 : null;
          if (dd > 0 && R0) {
            const prof = pts.slice().sort((a, b) => b.x - a.x);
            const minR = Math.min(...pts.map((p) => p.y));
            for (let rr = R0 - dd, k = 0; rr > minR && k < 80; rr -= dd, k++) {
              let zEnd = Math.min(...pts.map((p) => p.x));
              for (let i = 0; i + 1 < pts.length; i++) {
                const a = pts[i], b = pts[i + 1];
                if ((a.y - rr) * (b.y - rr) <= 0 && a.y !== b.y) { zEnd = a.x + ((rr - a.y) / (b.y - a.y)) * (b.x - a.x); break; }
              }
              void prof;
              g += `<line x1="${X({ x: pts[0].x + 2 })}" y1="${Y({ y: rr })}" x2="${X({ x: zEnd })}" y2="${Y({ y: rr })}" stroke="#5FD3D3" stroke-opacity=".5"/>`;
            }
          }
        }
        if (st.nose) {
          const segs = cm.filter((m) => m.type !== 'G00').map((m) => (m.type === 'G01' ? { type: 'line', p: view.pt(m.from), q: view.pt(m.to) } : { type: 'arc', p: view.pt(m.from), q: view.pt(m.to), c: view.pt(m.center), ccw: m.ccw }));
          const c = segs.length ? compensateContour(segs, { r: st.r, tip: 9, side: 'right' }) : null;
          if (c && !c.error) g += `<path d="${poly(c.points)}" fill="none" stroke="#5FD3D3" stroke-dasharray="4 3" stroke-width="1.5"/>`;
        }
      }
    }
    // перемещения
    parsed.moves.forEach((m, i) => {
      if (m.type === 'G00' && !st.g00) return;
      const past = i <= st.cur;
      const col = m.type === 'G00' ? '#7DB8FF' : m.type === 'G01' || m.type === 'CYCLE' ? '#F5A524' : '#FF7AB6';
      const wd = m.type === 'G02' || m.type === 'G03' ? 4 : m.type === 'G00' ? 2 : 2.5;
      if (m.type === 'CYCLE') return;
      g += `<path d="${poly(paths[i])}" fill="none" stroke="${col}" stroke-width="${wd}" stroke-linecap="round" stroke-linejoin="round" ${m.type === 'G00' ? 'stroke-dasharray="6 4"' : ''} opacity="${past ? 1 : 0.3}"/>`;
    });
    // точки
    parsed.moves.forEach((m, i) => {
      const p = view.pt(m.type === 'CYCLE' ? { ...m.to, z: m.rPlane ?? m.to.z } : m.to);
      const past = i <= st.cur;
      if (m.type === 'CYCLE') g += `<circle cx="${X(view.pt(m.hole ? { x: m.hole.x, y: m.hole.y, z: 0 } : m.to))}" cy="${Y(view.pt(m.hole ? { x: m.hole.x, y: m.hole.y, z: 0 } : m.to))}" r="5" fill="${past ? '#6FB3FF' : '#5A626D'}"/>`;
      else g += `<circle cx="${X(p)}" cy="${Y(p)}" r="${i === st.cur ? 4 : 3.5}" fill="${past ? '#ECEFF3' : '#5A626D'}"/>`;
      if (st.nums) g += `<text x="${+X(p) + 6}" y="${+Y(p) - 6}" fill="${i === st.cur ? '#FF7AB6' : past ? '#C7CED8' : '#8B95A3'}" font-size="11" font-weight="700" font-family="monospace">${i}</text>`;
    });
    const cm0 = parsed.moves[st.cur];
    if (cm0) {
      const p = view.pt(cm0.type === 'CYCLE' ? { ...cm0.to, z: cm0.rPlane ?? 0 } : cm0.to);
      g += `<circle cx="${X(p)}" cy="${Y(p)}" r="11" fill="none" stroke="#FF7AB6" stroke-width="2"/>`;
    }
    return `<svg id="bpsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Траектория, кадр ${st.cur} из ${n}" style="background:#0E1013">${g}</svg>`;
  }

  function cycleProfile() {
    const cyc = parsed.moves.filter((m) => m.type === 'CYCLE');
    if (!cyc.length) return '';
    const m = parsed.moves[st.cur] && parsed.moves[st.cur].type === 'CYCLE' ? parsed.moves[st.cur] : cyc[cyc.length - 1];
    const zs = [m.initZ, m.rPlane, 0, m.bottom].filter((z) => Number.isFinite(z));
    const top = Math.max(...zs), bot = Math.min(...zs), sc = 90 / Math.max(top - bot, 1e-3);
    const Yz = (z) => 15 + (top - z) * sc;
    const line = (z, col, lab) => (Number.isFinite(z) ? `<line x1="60" y1="${Yz(z)}" x2="330" y2="${Yz(z)}" stroke="${col}" ${lab === 'Z0 детали' ? 'stroke-width="2"' : 'stroke-dasharray="4 3"'}/><text x="6" y="${Yz(z) + 4}" fill="${col}" font-size="10" font-family="monospace">${lab}</text><text x="334" y="${Yz(z) + 4}" fill="${col}" font-size="10" font-family="monospace" text-anchor="end">${f3(z)}</text>` : '');
    const ret = m.retract === 'G98' ? m.initZ : m.rPlane;
    return `<section><h2 class="h2">Профиль по Z · ${m.code} · возврат ${m.retract}</h2><div class="card sketch"><svg viewBox="0 0 340 120">
      <rect x="60" y="${Yz(0)}" width="270" height="${Math.max(0, (0 - bot) * sc)}" fill="#2C323A"/>
      ${line(m.initZ, '#7DB8FF', 'исх. плоск.')}${line(m.rPlane, '#6FD08C', 'плоск. R')}${line(0, '#ECEFF3', 'Z0 детали')}${line(m.bottom, '#FF7AB6', 'дно')}
      <path d="M195 ${Yz(m.initZ ?? top)} L195 ${Yz(m.bottom)} L215 ${Yz(ret)}" fill="none" stroke="#F5A524" stroke-width="2.5"/></svg></div></section>`;
  }

  function movesCard() {
    const m = parsed.moves[st.cur];
    if (!m) return '<div class="note info">В программе нет перемещений.</div>';
    const raw = parsed.blocks[m.line - 1].raw.trim();
    const pos = profile === 'MF' ? `X${f3(m.to.x)} Y${f3(m.to.y)} Z${f3(m.to.z)}` : `Ø${f3(m.to.x)}  Z${f3(m.to.z)}`;
    const arc = m.center ? `<span>дуга ${f3(m.sweep)}° ${m.ccw ? 'против' : 'по'} час.</span><span>центр ${profile === 'MF' ? `X${f3(m.center.x)} Y${f3(m.center.y)}` : `Ø${f3(m.center.x)} Z${f3(m.center.z)}`}</span>` : '';
    return `<div class="card pad" style="border-color:${m.type === 'G02' || m.type === 'G03' ? '#FF7AB6' : '#2C323A'}"><div style="font:500 15px var(--mono);white-space:pre">${highlightLine(raw)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:6px;font:500 13px var(--mono);color:#9AA4B1"><span>${pos}</span>${arc}<span>кадр ${m.line}</span></div></div>`;
  }

  function checksHtml() {
    return checks.map((c) => `<div class="note ${c.level === 'bad' ? 'bad' : c.level === 'warn' ? 'warn' : 'ok'}"><div><b>${esc(c.title)}</b>${c.items.map((i) => `<div>${i.line ? `строка ${i.line}: ` : ''}${esc(i.text)}</div>`).join('') || ' — ок'}</div></div>`).join('');
  }

  function draw() {
    const status = worst(checks);
    pg.innerHTML = `<div class="card bp">${svgHtml()}<div class="zoom"><button class="ib" data-z="in" aria-label="Приблизить">+</button><button class="ib" data-z="out" aria-label="Отдалить">−</button><button class="ib" data-z="fit" aria-label="Вписать">${ICONS.chev.replace('d="M9 6l6 6-6 6"', 'd="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"')}</button></div></div>
    <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:#C7CED8"><span style="color:#7DB8FF">┄ G00</span><span style="color:#F5A524">━ G01</span><span style="color:#FF7AB6">━ G02/G03</span>${profile !== 'MF' ? '<span style="color:#9AA4B1">▮ деталь</span>' : ''}</div>
    <div style="display:flex;align-items:center;gap:8px"><button class="ib" data-n="first" aria-label="В начало">⏮</button><button class="ib" data-n="prev" aria-label="Назад">‹</button>
      <div style="flex:1;text-align:center"><div style="font:700 18px var(--mono)">${st.cur} / ${n}</div><div style="font-size:11px;color:#9AA4B1">кадр (точка)</div></div>
      <button class="ib pri" data-n="next" aria-label="Вперёд">›</button><button class="ib" data-n="play" aria-label="Проиграть">${st.play ? '⏸' : '▶'}</button></div>
    ${movesCard()}
    <div class="tabs">${profile === 'MF' ? `<button class="tg" data-plane="${st.plane === 'xy' ? 'xz' : 'xy'}">Вид: ${st.plane === 'xy' ? 'XY' : 'XZ'}</button>` : ''}
      <button class="tg ${st.nums ? 'on' : ''}" data-t="nums">Номера точек</button><button class="tg ${st.g00 ? 'on' : ''}" data-t="g00">G00</button>
      ${profile !== 'MF' ? `<button class="tg ${st.rough ? 'on' : ''}" data-t="rough">Черновые проходы</button><button class="tg ${st.nose ? 'on' : ''}" data-t="nose">Пластина r${st.r}</button>` : ''}</div>
    <div style="display:flex;flex-direction:column;gap:8px"><div class="note ${status === 'bad' ? 'bad' : status === 'warn' ? 'warn' : 'ok'}"><b>${status === 'bad' ? 'Есть ошибки — не запускайте' : status === 'warn' ? 'Есть замечания' : 'Автопроверки пройдены'}</b></div>${checksHtml()}</div>
    ${profile === 'MF' ? cycleProfile() : ''}
    <section class="card lst">${parsed.moves.map((m, i) => `<div data-j="${i}" class="${i === st.cur ? 'on' : ''}"><b style="${i === st.cur ? 'color:#FF7AB6' : ''}">${i}</b><span>${highlightLine(parsed.blocks[m.line - 1].raw.trim())}</span></div>`).join('')}</section>
    ${disclaimerHtml()}`;
    attachGestures();
  }

  function redrawSvg() { pg.querySelector('#bpsvg').outerHTML = svgHtml(); attachGestures(); }
  function attachGestures() {
    const svg = pg.querySelector('#bpsvg');
    if (!svg) return;
    const pts = new Map();
    let last = null;
    svg.onpointerdown = (e) => { svg.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); last = null; };
    svg.onpointermove = (e) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const k = W / svg.getBoundingClientRect().width;
      if (pts.size === 1) { st.c.x -= ((e.clientX - prev.x) * k) / st.sc; st.c.y += ((e.clientY - prev.y) * k) / st.sc; redrawSvg(); }
      else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (last) { st.sc *= d / last; redrawSvg(); }
        last = d;
      }
    };
    svg.onpointerup = svg.onpointercancel = (e) => { pts.delete(e.pointerId); last = null; };
    svg.onwheel = (e) => { e.preventDefault(); st.sc *= e.deltaY < 0 ? 1.15 : 1 / 1.15; redrawSvg(); };
  }

  const stop = () => { if (st.play) { clearInterval(st.play); st.play = null; } };
  const step = (d) => { st.cur = Math.max(0, Math.min(n - 1, st.cur + d)); draw(); };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-z],[data-n],[data-t],[data-j],[data-plane]');
    if (!b) return;
    if (b.dataset.z) { if (b.dataset.z === 'fit') fit(); else st.sc *= b.dataset.z === 'in' ? 1.3 : 1 / 1.3; redrawSvg(); }
    else if (b.dataset.n === 'first') { stop(); st.cur = 0; draw(); }
    else if (b.dataset.n === 'prev') { stop(); step(-1); }
    else if (b.dataset.n === 'next') { stop(); step(1); }
    else if (b.dataset.n === 'play') {
      if (st.play) { stop(); draw(); return; }
      if (st.cur >= n - 1) st.cur = 0;
      st.play = setInterval(() => { if (st.cur >= n - 1) { stop(); draw(); } else step(1); }, 700);
      draw();
    } else if (b.dataset.t) { st[b.dataset.t] = !st[b.dataset.t]; draw(); }
    else if (b.dataset.j !== undefined) { stop(); st.cur = +b.dataset.j; draw(); }
    else if (b.dataset.plane) { st.plane = b.dataset.plane; ({ view, paths } = bpView(an, st)); fit(); draw(); }
  });
  void dist;
  draw();
}
export default { id: 'backplot', render };
