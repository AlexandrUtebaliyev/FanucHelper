// Карманы MF: прямоугольный и круглый. Расчёт плана обработки (без G-кода).
// Черновая: контуры эквидистантно, от центра к стенкам (изнутри наружу), на каждом уровне Z.
// Чистовая: стенка с G41 (попутное, против часовой), подвод и отвод дугой радиусом не меньше радиуса фрезы.
export function planPocket(o) {
  const { shape = 'rect', xc = 0, yc = 0, L, B, Rc = 0, Dp, D, depth, ap, stepPct = 40, fin = 0.2, entry = 'helix', rampAngle = 3, helixPitch = 1 } = o;
  const warn = [];
  const err = (e) => ({ error: e });
  if (!(D > 0)) return err('Задайте Ø фрезы');
  if (!(depth > 0) || !(ap > 0)) return err('Задайте глубину и ap');
  if (!(stepPct > 0 && stepPct <= 50)) return err('Шаг в сторону — от 1 до 50 % Ø: при большем в центре останется остров');
  if (!(fin >= 0)) return err('Припуск не может быть отрицательным');
  const r = D / 2;
  const step = (D * stepPct) / 100;
  const nz = Math.ceil(depth / ap - 1e-9);
  const apAct = depth / nz;
  const levels = Array.from({ length: nz }, (_, k) => -(k + 1) * apAct);
  const plan = { shape, xc, yc, D, step, levels, apAct, depth, fin, entry, warn };
  // зона подвода дугой: не меньше радиуса фрезы
  plan.ra = r + Math.max(r * 0.5, 1); // радиус дуги подвода строго больше радиуса фрезы
  if (shape === 'circle') {
    if (!(Dp > D + 2 * fin)) return err('Ø кармана должен быть больше Ø фрезы плюс припуск');
    const R0 = Dp / 2 - r - fin;
    const loops = [];
    for (let d = 0; d <= R0 + 1e-9; d += step) loops.push({ r: R0 - d });
    const last = loops[loops.length - 1].r;
    if (last > 1e-6 && last > r * 0.1) { /* внутренний контур оставляет центр: закрывается входом */ }
    plan.loops = loops.filter((l) => l.r > 1e-6).reverse();
    plan.finish = { R: Dp / 2 };
    plan.minHalf = R0;
    plan.helixR = Math.min(0.4 * D, R0);
    if (plan.ra > Dp / 2 - 0.1) return err('Карман слишком мал для дуги подвода');
  } else {
    if (!(L > 0) || !(B > 0)) return err('Задайте длину и ширину кармана');
    if (Rc < r - 1e-9) return err('Радиус угла кармана меньше радиуса фрезы: фрезой такой угол не получить');
    const ax0 = L / 2 - r - fin, ay0 = B / 2 - r - fin, rc0 = Rc - r - fin;
    if (ax0 < 0 || ay0 < 0) return err('Карман уже фрезы с припуском');
    if (rc0 < 0) return err('Радиус угла меньше радиуса фрезы плюс припуск — уменьшите припуск');
    const m = Math.min(ax0, ay0);
    const ds = [];
    for (let d = 0; d <= m + 1e-9; d += step) ds.push(d);
    if (m - ds[ds.length - 1] > 1e-6) ds.push(m);
    plan.loops = ds.map((d) => ({ ax: ax0 - d, ay: ay0 - d, rc: Math.max(rc0 - d, 0) })).reverse();
    plan.finish = { ax: L / 2, ay: B / 2, rc: Rc };
    plan.minHalf = ay0;
    plan.helixR = Math.min(0.4 * D, ay0);
    if (plan.ra > Math.min(L, B) / 2 - 0.1 || plan.ra > L / 2 - Rc) return err('Карман слишком мал для дуги подвода');
  }
  if (entry === 'helix') {
    if (plan.minHalf < 0.4 * D) return err('Карман слишком узкий для спирали — выберите наклонное врезание');
    plan.turns = Math.max(1, Math.ceil(apAct / helixPitch - 1e-9));
    warn.push('Спиральное врезание: фреза должна быть режущей по центру (или карман предварительно засверлен).');
  } else {
    const a = (rampAngle * Math.PI) / 180;
    if (!(rampAngle > 0 && rampAngle <= 10)) return err('Угол наклонного врезания — от 0 до 10°');
    const leg = apAct / 2 / Math.tan(a);
    const half = shape === 'circle' ? plan.minHalf : Math.min(plan.loops[plan.loops.length - 1].ax ?? 0, 1e9) + 0;
    const room = shape === 'circle' ? plan.minHalf : (plan.loops[plan.loops.length - 1].ax);
    plan.ramp = { leg };
    void half;
    if (leg > 2 * room) return err(`Наклонный вход длиннее кармана (${leg.toFixed(1)} мм): уменьшите ap или увеличьте угол`);
    warn.push('Наклонное врезание: от конца наклона к первому контуру фреза идёт на полной глубине с большим захватом — снизьте подачу.');
  }
  if (fin > 0) warn.push('Чистовой проход по стенке с G41 на каждом уровне. Радиус инструмента в таблице коррекций (D) должен совпадать с Ø фрезы.');
  return plan;
}
