// Профиль токарной стойки 0i-TF: набор модулей. Правила шапки/концовки — в gcode\program.js.
const I = {
  taper: '<path d="M3 7h5l13 3.5v3L8 17H3z"/>',
  chamfer: '<path d="M4 21V9l5-5h11"/>',
  nose: '<path d="M4 21v-8a9 9 0 0 1 9-9h8"/><circle cx="13" cy="13" r="2.5"/>',
  thread: '<path d="M2 8l3 8 3-8 3 8 3-8 3 8 3-8 3 8"/>',
  contour: '<path d="M3 19h5v-5h5V9h8"/>',
  groove: '<path d="M2 8h8v9h4V8h8"/>',
  drill: '<path d="M2 9h12l4 3-4 3H2z"/><path d="M18 12h4"/>',
  modes: '<circle cx="12" cy="13" r="8"/><path d="M12 13l4-4M12 3v2"/>',
  tol: '<path d="M3 12h18"/><path d="M7 8v8M17 8v8"/><path d="M10 6h4M10 18h4"/>',
  check: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 15l3 3 5-6"/>',
};
export const ICON = I;

export const TF = {
  id: 'TF',
  name: '0i-TF',
  modules: [
    { id: 'taper', title: 'Конус', sub: 'D · d · L · α/2', cat: 'geo', icon: I.taper },
    { id: 'chamfer', title: 'Фаска / радиус', sub: 'C · R · точки', cat: 'geo', icon: I.chamfer },
    { id: 'thread', title: 'Резьба', sub: 'G76 · G92', cat: 'cyc', icon: I.thread },
    { id: 'modes', title: 'Режимы', sub: 'Vc · S · f · Ra', cat: 'mode', icon: I.modes },
  ],
};
