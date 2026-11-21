// Генераторы G-кода фрезерной стойки 0i-MF. Никогда не выводят U/W; G90/G91 — абсолют/приращения.
// G98/G99 здесь — возврат в исходную плоскость / в плоскость R (не подача).
import { fmt, word, int, join } from './format.js';
import { arcSweepDeg } from './arcs.js';

const CYCLES = ['G81', 'G82', 'G83', 'G73', 'G84', 'G85', 'G86'];

export function drillBlock({ code, x, y, z, r, q, p, f }, dec = 3, withCode = true) {
  const parts = [];
  if (withCode) parts.push(code);
  parts.push(word('X', x, dec), word('Y', y, dec));
  if (withCode) {
    parts.push(word('Z', z, dec), word('R', r, dec));
    if (code === 'G83' || code === 'G73') parts.push(word('Q', q, dec));
    if (code === 'G82' && p > 0) parts.push('P' + int(p));
    if (f > 0) parts.push(word('F', f, dec));
  }
  return join(...parts);
}

// holes: [{x, y, angle?}]; format: 'xy' | 'polar' | 'macro'. Бросает Error — тогда код не выводится.
export function holeLines(o) {
  const dec = o.dec ?? 3;
  const { code = 'G81', holes, z, r, q, p, f, initZ = 50, format = 'xy', center = { x: 0, y: 0 }, R, s, pitch, feedMode = 'G94', midReturn = 'G99', lastReturn = 'G98' } = o;
  if (!CYCLES.includes(code)) throw new Error('Неизвестный цикл ' + code);
  if (!holes || !holes.length) throw new Error('Нет отверстий');
  if (!Number.isFinite(z) || !Number.isFinite(r)) throw new Error('Задайте глубину Z и плоскость R');
  if (r <= 0) throw new Error('Плоскость R должна быть выше Z0 детали (R > 0)');
  if (z >= r) throw new Error('Глубина Z должна быть ниже плоскости R');
  if (initZ < r) throw new Error('Исходная плоскость Z ниже плоскости R — цикл вернётся в плоскость R');
  if ((code === 'G83' || code === 'G73') && !(q > 0)) throw new Error(code + ': задайте шаг Q > 0');
  if (code !== 'G84' && !(f > 0)) throw new Error('Задайте подачу F');
  if (code === 'G84') {
    if (!(s > 0) || !(pitch > 0)) throw new Error('G84: задайте обороты S и шаг резьбы');
  }
  let F = f;
  const cyc = { code, z, r, q, p, get f() { return F; } };
  if (code === 'G84') F = feedMode === 'G95' ? pitch : s * pitch;
  const lines = [];
  const pre = () => {
    if (code === 'G84') {
      lines.push(join('M29', 'S' + int(s)));
      if (feedMode === 'G95') lines.push('G95'); else lines.push('G94');
    }
  };
  // первый кадр — с кодом цикла, последний — с G98, средние — только координаты (G99 модально)
  const emit = (h, i, xy) => {
    const first = i === 0, last = i === holes.length - 1;
    const blk = (withCode) => drillBlock({ ...cyc, x: xy.x, y: xy.y }, dec, withCode);
    if (first) lines.push(join(last ? lastReturn : midReturn, blk(true)));
    else if (last) lines.push(join(lastReturn, blk(false)));
    else lines.push(blk(false));
  };
  const post = () => { lines.push('G80'); if (code === 'G84' && feedMode === 'G95') lines.push('G94'); };
  if (format === 'macro') {
    if (code !== 'G81') throw new Error('Макрос O9010 сверлит только циклом G81 — выберите явные координаты или G81');
    if (holes.length < 1 || !(R > 0)) throw new Error('Для макроса нужны центр, радиус и количество');
    const a0 = holes[0].angle ?? 0;
    const st = holes.length > 1 ? (holes[1].angle - holes[0].angle) : 0;
    lines.push(join('G00', 'G90', word('Z', initZ, dec)));
    lines.push(join('G00', word('X', holes[0].x, dec), word('Y', holes[0].y, dec)));
    lines.push(join('G65', 'P9010', word('X', center.x, dec), word('Y', center.y, dec), word('R', R, dec), word('A', a0, dec), word('B', st, dec), 'Q' + holes.length, word('Z', z, dec), word('H', r, dec), word('F', F, dec)));
    return lines;
  }
  lines.push(join('G00', 'G90', word('Z', initZ, dec)));
  if (format === 'polar') {
    if (!(R > 0)) throw new Error('Для полярных координат нужен радиус');
    lines.push(join('G52', word('X', center.x, dec), word('Y', center.y, dec)));
    lines.push(join('G90', 'G16'));
    pre();
    holes.forEach((h, i) => emit(h, i, { x: R, y: h.angle ?? 0 }));
    post();
    lines.push('G15');
    lines.push(join('G52', 'X0.', 'Y0.'));
    return lines;
  }
  lines.push(join('G00', word('X', holes[0].x, dec), word('Y', holes[0].y, dec)));
  pre();
  holes.forEach((h, i) => emit(h, i, h));
  post();
  return lines;
}

// Дуга в плоскости G17: {from, to, center, ccw}. fmt: 'r' | 'ij'. Дуга > 180° и полный круг — всегда через I J.
export function arcLine({ from, to, center, ccw, fmt: format = 'r', dec = 3, plane = 'G17' }) {
  const sweep = arcSweepDeg(from, to, center, ccw);
  const R = Math.hypot(from.x - center.x, from.y - center.y);
  const code = ccw ? 'G03' : 'G02';
  const full = Math.hypot(from.x - to.x, from.y - to.y) < 1e-9;
  let useIJ = format === 'ij';
  let note = null;
  if (sweep > 180 + 1e-6 || full) {
    if (!useIJ) note = 'Дуга больше 180° — выведена через I J';
    useIJ = true;
  }
  if (plane !== 'G17') throw new Error('Дуги пока выводятся только в плоскости G17');
  const tail = useIJ ? join(word('I', center.x - from.x, dec), word('J', center.y - from.y, dec)) : word('R', R, dec);
  return { line: join(code, word('X', to.x, dec), word('Y', to.y, dec), tail), note, sweep };
}

// Торцовка: массив строк по результату core\mill\facing.js
export function facingLines(fc, { feed, dec = 3 }) {
  const lines = [];
  const rapidXY = (x, y) => lines.push(join('G00', word('X', x, dec), word('Y', y, dec)));
  lines.push(join('G00', 'G90', word('Z', fc.safeZ, dec)));
  rapidXY(fc.xs, fc.ys[0]);
  fc.zs.forEach((z, k) => {
    lines.push(join('G01', word('Z', z, dec), word('F', feed, dec)));
    fc.ys.forEach((y, i) => {
      const toEnd = fc.mode === 'zigzag' ? i % 2 === 0 : true;
      if (i > 0) {
        if (fc.mode === 'zigzag') lines.push(word('Y', y, dec));
        else { lines.push(join('G00', word('Z', fc.safeZ, dec))); rapidXY(fc.xs, y); lines.push(join('G01', word('Z', z, dec), word('F', feed, dec))); }
      }
      lines.push(word('X', toEnd ? fc.xe : fc.xs, dec));
    });
    if (k < fc.zs.length - 1) {
      lines.push(join('G00', word('Z', fc.safeZ, dec)));
      const startAtEnd = fc.mode === 'zigzag' && fc.ys.length % 2 === 0; // после чётного числа дорожек — в начале X
      void startAtEnd;
      rapidXY(fc.xs, fc.ys[0]);
    }
  });
  lines.push(join('G00', word('Z', fc.safeZ, dec)));
  return lines;
}

// Поворот: G68 X Y R … G69
export function rotateLines(body, { x, y, angle, dec = 3 }) {
  return [join('G68', word('X', x, dec), word('Y', y, dec), word('R', angle, dec)), ...body, 'G69'];
}

export { fmt };

// Резьбофрезерование по результату core\mill\threadMill.js. Вход в центр на дно (или на верх при спуске),
// полудуга с подъёмом P/2, полные витки с I J и подъёмом на P, полудуга отвода.
export function threadMillLines(tm, { P, depth, F, safeZ = 5, dec = 3, sub = false, subNo = 8001 }) {
  const { radius: r, fCenter, full, ccw, up, xc, yc } = tm;
  const g = ccw ? 'G03' : 'G02';
  const sgn = up ? 1 : -1;
  const zStart = up ? -depth : 0; // снизу вверх — со дна, сверху вниз — с верха
  const lines = [];
  const circ = (x, y, i, j, dz) => join(g, word('X', x, dec), word('Y', y, dec), word('I', i, dec), word('J', j, dec), word('Z', zNow + dz, dec), word('F', fCenter, dec));
  let zNow = zStart;
  lines.push(join('G00', 'G90', word('Z', safeZ, dec)));
  lines.push(join('G00', word('X', xc, dec), word('Y', yc, dec)));
  lines.push(join('G01', word('Z', zStart, dec), word('F', F, dec)));
  // вход: полудуга из центра на радиус r, подъём P/2
  lines.push(circ(xc, yc - r, 0, -r / 2, sgn * P / 2));
  zNow += sgn * P / 2;
  if (sub) {
    lines.push(join('M98', 'P' + subNo, 'L' + full));
    zNow += sgn * P * full;
  } else {
    for (let k = 0; k < full; k++) {
      lines.push(circ(xc, yc - r, 0, r, sgn * P));
      zNow += sgn * P;
    }
  }
  // отвод: полудуга на центр
  lines.push(circ(xc, yc, 0, r / 2, sgn * P / 2));
  zNow += sgn * P / 2;
  lines.push(join('G00', word('Z', safeZ, dec)));
  const subLines = sub ? [`O${subNo} (THREAD MILL TURN)`, join('G91', g, 'X0.', 'Y0.', word('I', 0, dec), word('J', r, dec), word('Z', sgn * P, dec), word('F', fCenter, dec)), 'G90', 'M99'] : null;
  return { lines, subLines, zEnd: zNow };
}

// ---------- карманы ----------
// Контур прямоугольника со скруглёнными углами, против часовой. Возвращает вершины: {t:'L'|'A', x, y, i?, j?}
function rectPath(xc, yc, ax, ay, rc, startMid) {
  const segs = [];
  const L = (x, y) => segs.push({ t: 'L', x, y });
  const A = (x, y, i, j) => segs.push({ t: 'A', x, y, i, j });
  const start = startMid ? { x: xc + ax, y: yc } : { x: xc + ax, y: yc - ay + rc };
  L(xc + ax, yc + ay - rc);
  if (rc > 1e-9) A(xc + ax - rc, yc + ay, -rc, 0);
  L(xc - ax + rc, yc + ay);
  if (rc > 1e-9) A(xc - ax, yc + ay - rc, 0, -rc);
  L(xc - ax, yc - ay + rc);
  if (rc > 1e-9) A(xc - ax + rc, yc - ay, rc, 0);
  L(xc + ax - rc, yc - ay);
  if (rc > 1e-9) A(xc + ax, yc - ay + rc, 0, rc);
  if (startMid) L(xc + ax, yc);
  return { start, segs };
}

export function pocketLines(plan, o) {
  const dec = o.dec ?? 3;
  const { safeZ = 5, fRough, fEntry = fRough / 2, fFinish = fRough, dNo = 1 } = o;
  if (!(fRough > 0) || !(fEntry > 0) || !(fFinish > 0)) throw new Error('Задайте подачи');
  if (!Number.isFinite(safeZ) || safeZ <= 0) throw new Error('Безопасный Z должен быть выше Z0 детали');
  if (!(dNo >= 1)) throw new Error('Номер коррекции D — от 1');
  const { xc, yc, shape } = plan;
  const lines = [];
  // cur — текущая точка; нулевые перемещения (вырожденные контуры) пропускаются
  const emit = (path, cur) => {
    let modal = null;
    let at = { ...cur };
    for (const s of path) {
      if (s.t === 'L') {
        if (Math.hypot(s.x - at.x, s.y - at.y) < 1e-9) continue;
        lines.push(join(modal === 'G01' ? '' : 'G01', word('X', s.x, dec), word('Y', s.y, dec)));
        modal = 'G01';
      } else { lines.push(join('G03', word('X', s.x, dec), word('Y', s.y, dec), word('I', s.i, dec), word('J', s.j, dec))); modal = 'G03'; }
      at = { x: s.x, y: s.y };
    }
  };
  const loopPath = (lp, startMid = false) => {
    if (shape === 'circle') {
      return { start: { x: xc + lp.r, y: yc }, segs: [{ t: 'A', x: xc + lp.r, y: yc, i: -lp.r, j: 0 }] };
    }
    return rectPath(xc, yc, lp.ax, lp.ay, lp.rc, startMid);
  };
  lines.push(join('G00', 'G90', word('Z', safeZ, dec)));
  lines.push(join('G00', word('X', xc, dec), word('Y', yc, dec)));
  let zPrev = 0;
  plan.levels.forEach((z, k) => {
    // --- врезание ---
    if (k === 0) lines.push(join('G00', word('Z', Math.min(safeZ, 1), 3)));
    if (plan.entry === 'helix') {
      const Rh = plan.helixR;
      lines.push(join('G01', word('X', xc + Rh, dec), word('Y', yc, dec), k === 0 ? join('Z' + fmt(zPrev, dec), word('F', fEntry, dec)) : ''));
      for (let t = 1; t <= plan.turns; t++) {
        lines.push(join('G03', word('X', xc + Rh, dec), word('Y', yc, dec), word('I', -Rh, dec), word('J', 0, dec), word('Z', zPrev + ((z - zPrev) * t) / plan.turns, dec), t === 1 ? word('F', fEntry, dec) : ''));
      }
      lines.push(join('G03', word('X', xc + Rh, dec), word('Y', yc, dec), word('I', -Rh, dec), word('J', 0, dec)));
    } else {
      const l = plan.ramp.leg;
      lines.push(join('G01', word('X', xc - l / 2, dec), word('Y', yc, dec), k === 0 ? join('Z' + fmt(zPrev, dec), word('F', fEntry, dec)) : ''));
      lines.push(join('G01', word('X', xc + l / 2, dec), word('Z', (zPrev + z) / 2, dec), word('F', fEntry, dec)));
      lines.push(join('G01', word('X', xc - l / 2, dec), word('Z', z, dec)));
    }
    // --- черновые контуры изнутри наружу ---
    plan.loops.forEach((lp, i) => {
      const p = loopPath(lp);
      lines.push(join('G01', word('X', p.start.x, dec), word('Y', p.start.y, dec), i === 0 ? word('F', fRough, dec) : ''));
      emit(p.segs, p.start);
    });
    // --- чистовая стенка с G41 ---
    {
      const ra = plan.ra;
      const f = plan.finish;
      const wallX = xc + (shape === 'circle' ? f.R : f.ax);
      const S = { x: wallX - ra, y: yc - ra };
      lines.push(join('G41', 'G01', word('X', S.x, dec), word('Y', S.y, dec), 'D' + int(dNo), word('F', fFinish, dec)));
      lines.push(join('G03', word('X', wallX, dec), word('Y', yc, dec), word('I', 0, dec), word('J', ra, dec)));
      let path;
      if (shape === 'circle') path = [{ t: 'A', x: wallX, y: yc, i: -f.R, j: 0 }];
      else path = rectPath(xc, yc, f.ax, f.ay, f.rc, true).segs;
      emit(path, { x: wallX, y: yc });
      lines.push(join('G03', word('X', wallX - ra, dec), word('Y', yc + ra, dec), word('I', -ra, dec), word('J', 0, dec)));
      lines.push(join('G40', 'G01', word('X', xc, dec), word('Y', yc, dec)));
    }
    zPrev = z;
  });
  lines.push(join('G00', word('Z', safeZ, dec)));
  return lines;
}
