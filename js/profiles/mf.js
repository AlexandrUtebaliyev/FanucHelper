// Профиль фрезерной стойки 0i-MF: набор модулей. Правила шапки/концовки — в gcode\program.js.
const I = {
  bolt: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="4" r="1.5"/><circle cx="19" cy="16" r="1.5"/><circle cx="5" cy="16" r="1.5"/>',
  tangent: '<path d="M3 20h8a9 9 0 0 0 9-9V4"/>',
  facing: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M6 9h12M6 12h12M6 15h12"/>',
  modes: '<circle cx="12" cy="13" r="8"/><path d="M12 13l4-4M12 3v2"/>',
  macro: '<path d="M8 4c-2 0-3 1-3 3v3c0 1-1 2-2 2 1 0 2 1 2 2v3c0 2 1 3 3 3M16 4c2 0 3 1 3 3v3c0 1 1 2 2 2-1 0-2 1-2 2v3c0 2-1 3-3 3"/>',
  tol: '<path d="M3 12h18"/><path d="M7 8v8M17 8v8"/><path d="M10 6h4M10 18h4"/>',
  check: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 15l3 3 5-6"/>',
  probe: '<path d="M12 3v10"/><circle cx="12" cy="17" r="3"/><path d="M3 21h18"/>',
  tmill: '<path d="M4 8c3-3 5 3 8 0s5 3 8 0M4 14c3-3 5 3 8 0s5 3 8 0"/>',
  pocket: '<rect x="3" y="5" width="18" height="14" rx="4"/><rect x="8" y="9" width="8" height="6" rx="2"/>',
  rot: '<path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5"/>',
};

export const MF = {
  id: 'MF',
  name: '0i-MF',
  modules: [
    { id: 'bolt', title: 'Отверстия', sub: 'окружность · сетка', cat: 'geo', icon: I.bolt },
    { id: 'tangent', title: 'Сопряжения', sub: 'R · точки касания', cat: 'geo', icon: I.tangent },
    { id: 'transform', title: 'Полярные · поворот', sub: 'G16 · G68 · треугольник', cat: 'geo', icon: I.rot },
    { id: 'facing', title: 'Торцовка', sub: 'зигзаг · время', cat: 'cyc', icon: I.facing },
    { id: 'pocket', title: 'Карманы', sub: 'спираль · G41', cat: 'cyc', icon: I.pocket },
    { id: 'millmodes', title: 'Режимы', sub: 'Vc · S · fz · метчик', cat: 'mode', icon: I.modes },
    { id: 'threadmill', title: 'Резьбофреза', sub: 'G03 · винтовая', cat: 'cyc', icon: I.tmill },
    { id: 'tolerance', title: 'Допуски ISO', sub: 'h7 → X19.99', cat: 'geo', icon: I.tol },
    { id: 'probing', title: 'Привязка и G10', sub: 'G54 · щуп', cat: 'set', icon: I.probe },
    { id: 'importcheck', title: 'Импорт и проверка', sub: 'чужая программа', cat: 'set', icon: I.check },
    { id: 'macros', title: 'Макросы G65', sub: 'O9010 – O9012', cat: 'mac', icon: I.macro },
  ],
};
