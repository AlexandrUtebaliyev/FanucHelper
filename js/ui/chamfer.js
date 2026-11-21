import { chamferCorner, filletCorner, legsFromLenAngle, directions } from '../core/chamfer.js';
import { fmt, word, join, arcCode } from '../gcode/format.js';
import { assertSystemA } from '../gcode/cycles.js';
import { cornerSketch } from './sketch.js';
import { nn } from './kit.js';

export function calc(p, s) {
  const dec = s.decimals;
  if (!nn(p.D) || p.D <= 0) return { err: 'Укажите Ø на углу' };
  const z = nn(p.z) ? p.z : 0;
  const dir = directions(p.place, nn(p.cone) ? p.cone : 0);
  if (!dir) return { err: 'Неизвестное размещение' };
  const V = { x: z, y: p.D / 2 };
  let c;
  if (p.type === 'fillet') c = filletCorner(V, dir.uIn, dir.uOut, p.R);
  else {
    let l1 = p.c1, l2 = p.c2;
    if (p.size === 'la') {
      const lg = legsFromLenAngle(p.len, p.ang);
      if (lg.error) return { err: lg.error };
      // катет по оси Z — на цилиндре, радиальный — на торце
      const zOnIn = Math.abs(dir.uIn.x) > 0.5;
      l1 = zOnIn ? lg.z : lg.r; l2 = zOnIn ? lg.r : lg.z;
      if (p.place === 'dia-cone') return { err: 'Для перехода «диаметр → конус» используйте катет × катет' };
    }
    c = chamferCorner(V, dir.uIn, dir.uOut, l1, l2);
  }
  if (c.error) return { err: c.error };
  const P1 = { x: c.p1.y * 2, z: c.p1.x }, P2 = { x: c.p2.y * 2, z: c.p2.x };
  const res = [['Начало (Ø / Z)', `Ø${fmt(P1.x, dec)} / Z${fmt(P1.z, dec)}`], ['Конец (Ø / Z)', `Ø${fmt(P2.x, dec)} / Z${fmt(P2.z, dec)}`]];
  let code = [], err = null;
  const sketch = cornerSketch({ V, p1: c.p1, p2: c.p2, center: c.center, R: c.R, kind: c.kind, ccw: c.ccw });
  try {
    assertSystemA(s.gsys);
    const f = nn(p.f) && p.f > 0 ? word('F', p.f, dec) : '';
    code.push(join('G01', word('X', P1.x, dec), word('Z', P1.z, dec), f));
    if (c.kind === 'fillet') {
      res.push(['Центр дуги (Ø / Z)', `Ø${fmt(c.center.y * 2, dec)} / Z${fmt(c.center.x, dec)}`]);
      const g = arcCode(c.ccw, s.holder);
      res.push(['Дуга', `${g} ${c.ccw ? 'против' : 'по'} часовой (${s.holder === 'front' ? 'передний' : 'задний'} держатель)`]);
      code.push(join(g, word('X', P2.x, dec), word('Z', P2.z, dec), word('R', c.R, dec)));
    } else {
      res.push(['Длина фаски', fmt(c.length, dec)]);
      code.push(join('G01', word('X', P2.x, dec), word('Z', P2.z, dec)));
    }
  } catch (e) { err = e.message; }
  return { err, results: res, code, sketch, tag: c.kind === 'fillet' ? 'G03' : 'G01', title: c.kind === 'fillet' ? `Радиус R${fmt(p.R, 3)} на Ø${fmt(p.D, 3)}` : `Фаска на Ø${fmt(p.D, 3)}` };
}

export default {
  id: 'chamfer', title: 'Фаска / радиус', cat: 'geo', tag: 'G01',
  defaults: { type: 'chamfer', place: 'face-dia', size: 'cc', D: '30', z: '0', c1: '1', c2: '1', len: '2', ang: '45', R: '2', cone: '10', f: '0.1' },
  form: [
    { type: 'seg', k: 'type', options: [['chamfer', 'Фаска'], ['fillet', 'Радиус']] },
    { type: 'seg', k: 'place', options: [['face-dia', 'Торец → Ø'], ['dia-face', 'Ø → торец'], ['dia-cone', 'Ø → конус']] },
    { type: 'num', k: 'D', label: 'Ø на углу', unit: 'мм' },
    { type: 'num', k: 'z', label: 'Z угла', unit: 'мм' },
    { type: 'num', k: 'cone', label: 'Угол конуса α/2', unit: '°', show: (v) => v.place === 'dia-cone' },
    { type: 'seg', k: 'size', options: [['cc', 'катет × катет'], ['la', 'длина × угол']], show: (v) => v.type === 'chamfer' },
    { type: 'num', k: 'c1', label: 'Катет 1 (по входу)', unit: 'мм', show: (v) => v.type === 'chamfer' && v.size === 'cc' },
    { type: 'num', k: 'c2', label: 'Катет 2 (по выходу)', unit: 'мм', show: (v) => v.type === 'chamfer' && v.size === 'cc' },
    { type: 'num', k: 'len', label: 'Длина по оси Z', unit: 'мм', show: (v) => v.type === 'chamfer' && v.size === 'la' },
    { type: 'num', k: 'ang', label: 'Угол к оси', unit: '°', show: (v) => v.type === 'chamfer' && v.size === 'la' },
    { type: 'num', k: 'R', label: 'Радиус R', unit: 'мм', show: (v) => v.type === 'fillet' },
    { type: 'num', k: 'f', label: 'Подача F', unit: 'мм/об' },
  ],
  calc,
};
