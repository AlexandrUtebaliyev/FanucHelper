// Эскизы SVG. Все функции чистые: возвращают строку SVG.
const FONT = "font-family=\"JetBrains Mono, monospace\"";
const t = (x, y, s, fill = '#C7CED8', size = 12, anchor = 'start') => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="${fill}" font-size="${size}" text-anchor="${anchor}" ${FONT}>${s}</text>`;
const f1 = (n) => (Math.round(n * 1000) / 1000).toString();
export const wrap = (w, h, inner, label = 'Эскиз') => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">${inner}</svg>`;
const axis = (y, w = 340) => `<line x1="6" y1="${y}" x2="${w - 6}" y2="${y}" stroke="#3A414B" stroke-dasharray="8 4 2 4"/>`;

// Конус: большой Ø у патрона (слева) или у торца
export function taperSketch({ D, d, L, bigAtChuck = true }) {
  if (!(D > d) || !(L > 0)) return wrap(340, 160, axis(132) + t(170, 80, 'введите размеры', '#9AA4B1', 13, 'middle'));
  const sc = Math.min(250 / L, 90 / D);
  const x0 = 30, x1 = x0 + 260, base = 132;
  const hb = (D / 2) * sc, hs = (d / 2) * sc;
  const left = bigAtChuck ? hb : hs, right = bigAtChuck ? hs : hb;
  const xe = x0 + L * sc;
  const pts = `M${x0} ${base - left} L${xe} ${base - right} L${xe} ${base} L${x0} ${base} Z`;
  return wrap(340, 160, axis(base) + `<path d="${pts}" fill="#232830"/><path d="M${x0} ${base - left} L${xe} ${base - right}" stroke="#F5A524" stroke-width="3" fill="none"/>`
    + `<line x1="${x0}" y1="146" x2="${xe}" y2="146" stroke="#9AA4B1"/>` + t((x0 + xe) / 2, 158, 'L ' + f1(L), '#C7CED8', 12, 'middle')
    + t(x0 + 4, base - left - 6, 'Ø' + f1(bigAtChuck ? D : d)) + t(xe - 4, base - right - 6, 'Ø' + f1(bigAtChuck ? d : D), '#C7CED8', 12, 'end')
    + `<circle cx="${xe}" cy="${base}" r="4" fill="#F5A524"/>` + t(xe - 6, base - 8, 'Z0', '#9AA4B1', 11, 'end'), 'Эскиз конуса');
}

// Угол: две линии и скругление/фаска. pts в мм (x=Z, y=радиус)
export function cornerSketch({ V, p1, p2, center, R, kind, ccw }) {
  if (!V || !p1 || !p2) return wrap(340, 160, t(170, 80, 'введите размеры', '#9AA4B1', 13, 'middle'));
  const xs = [V.x, p1.x, p2.x], ys = [V.y, p1.y, p2.y];
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const span = Math.max(maxx - minx, maxy - miny, 1e-6);
  const sc = 70 / span;
  const cx = 170 - ((minx + maxx) / 2) * sc, cy = 80 + ((miny + maxy) / 2) * sc;
  const X = (p) => cx + p.x * sc, Y = (p) => cy - p.y * sc;
  const ext = 55;
  const dIn = { x: p1.x - V.x, y: p1.y - V.y }, dOut = { x: p2.x - V.x, y: p2.y - V.y };
  const nl = (d) => Math.hypot(d.x, d.y) || 1;
  const a = { x: V.x + (dIn.x / nl(dIn)) * ext / sc, y: V.y + (dIn.y / nl(dIn)) * ext / sc };
  const b = { x: V.x + (dOut.x / nl(dOut)) * ext / sc, y: V.y + (dOut.y / nl(dOut)) * ext / sc };
  let mid = `<path d="M${X(p1)} ${Y(p1)} L${X(p2)} ${Y(p2)}" stroke="#F5A524" stroke-width="3" fill="none"/>`;
  if (kind === 'fillet' && center) {
    const r = R * sc;
    const sweep = ccw ? 0 : 1;
    mid = `<path d="M${X(p1)} ${Y(p1)} A ${r} ${r} 0 0 ${sweep} ${X(p2)} ${Y(p2)}" stroke="#F5A524" stroke-width="3" fill="none"/><circle cx="${X(center)}" cy="${Y(center)}" r="2.5" fill="#9AA4B1"/>`;
  }
  return wrap(340, 160, `<path d="M${X(a)} ${Y(a)} L${X(p1)} ${Y(p1)}" stroke="#ECEFF3" stroke-width="2" fill="none"/><path d="M${X(p2)} ${Y(p2)} L${X(b)} ${Y(b)}" stroke="#ECEFF3" stroke-width="2" fill="none"/>${mid}`
    + `<circle cx="${X(p1)}" cy="${Y(p1)}" r="4" fill="#F5A524"/><circle cx="${X(p2)}" cy="${Y(p2)}" r="4" fill="#F5A524"/>` + t(X(p1) + 6, Y(p1) - 6, '1', '#F5A524') + t(X(p2) + 6, Y(p2) - 6, '2', '#F5A524'), 'Эскиз угла');
}

// Профиль резьбы (пила)
export function threadSketch({ external = true, P = 0, h = 0 }) {
  const n = 6, w = 40, top = external ? 40 : 100, bot = external ? 100 : 40;
  let d = `M20 ${top}`;
  for (let i = 0; i < n; i++) d += ` L${20 + i * w + w / 2} ${bot} L${20 + (i + 1) * w} ${top}`;
  return wrap(340, 160, `<path d="${d}" fill="none" stroke="#F5A524" stroke-width="2.5"/><line x1="10" y1="${top}" x2="330" y2="${top}" stroke="#3A414B" stroke-dasharray="4 3"/><line x1="10" y1="${bot}" x2="330" y2="${bot}" stroke="#3A414B" stroke-dasharray="4 3"/>`
    + (P ? t(20 + w, 135, 'P ' + f1(P), '#C7CED8', 12) : '') + (h ? t(270, 75, 'h ' + f1(h), '#F5A524', 12) : '') + t(20, 20, external ? 'наружная резьба' : 'внутренняя резьба', '#9AA4B1', 11), 'Профиль резьбы');
}

// Профиль детали по сегментам (токарка): segs [{type,p,q,c,ccw}] в мм (x=Z, y=радиус)
export function profileSketch(segs, { stockR = null, w = 340, h = 110, pts = null } = {}) {
  if (!segs || !segs.length) return wrap(w, h, t(w / 2, h / 2, 'нет контура', '#9AA4B1', 13, 'middle'));
  const all = [];
  for (const s of segs) { all.push(s.p, s.q); }
  const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
  if (stockR) ys.push(stockR);
  const minx = Math.min(...xs), maxx = Math.max(...xs), maxy = Math.max(...ys);
  const sc = Math.min((w - 40) / Math.max(maxx - minx, 1e-6), (h - 30) / Math.max(maxy, 1e-6));
  const X = (p) => 20 + (p.x - minx) * sc, Y = (p) => h - 12 - p.y * sc;
  let d = `M${X(segs[0].p)} ${Y(segs[0].p)}`;
  for (const s of segs) {
    if (s.type === 'arc') {
      const R = Math.hypot(s.p.x - s.c.x, s.p.y - s.c.y) * sc;
      d += ` A ${R} ${R} 0 0 ${s.ccw ? 0 : 1} ${X(s.q)} ${Y(s.q)}`;
    } else d += ` L${X(s.q)} ${Y(s.q)}`;
  }
  const stock = stockR ? `<rect x="${X({ x: minx })}" y="${Y({ y: stockR })}" width="${(maxx - minx) * sc}" height="${stockR * sc}" fill="none" stroke="#3A414B" stroke-dasharray="3 3"/>` : '';
  return wrap(w, h, axis(h - 12, w) + stock + `<path d="${d}" fill="none" stroke="#F5A524" stroke-width="2.5" stroke-linejoin="round"/>`
    + (pts || []).map((p, i) => `<circle cx="${X(p)}" cy="${Y(p)}" r="3" fill="#ECEFF3"/>`).join(''), 'Профиль');
}

// Окружность с отверстиями (фреза)
export function holesSketch(pts, { R = 0, center = { x: 0, y: 0 } } = {}) {
  if (!pts || !pts.length) return wrap(340, 200, t(170, 100, 'введите размеры', '#9AA4B1', 13, 'middle'));
  const xs = pts.map((p) => p.x).concat([center.x]), ys = pts.map((p) => p.y).concat([center.y]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const span = Math.max(maxx - minx, maxy - miny, 1e-6);
  const sc = 150 / span, cx = 170 - ((minx + maxx) / 2) * sc, cy = 100 + ((miny + maxy) / 2) * sc;
  const X = (p) => cx + p.x * sc, Y = (p) => cy - p.y * sc;
  return wrap(340, 200, (R > 0 ? `<circle cx="${X(center)}" cy="${Y(center)}" r="${R * sc}" fill="none" stroke="#3A414B" stroke-dasharray="4 3"/>` : '')
    + `<path d="M${X(center) - 6} ${Y(center)}h12M${X(center)} ${Y(center) - 6}v12" stroke="#9AA4B1"/>`
    + pts.map((p, i) => `<circle cx="${X(p)}" cy="${Y(p)}" r="5" fill="#6FB3FF"/>` + t(X(p) + 7, Y(p) - 7, String(i + 1), '#ECEFF3', 11)).join(''), 'Эскиз отверстий');
}
