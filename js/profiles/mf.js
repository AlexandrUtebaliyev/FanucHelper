// Профиль фрезерной стойки 0i-MF: набор модулей. Правила шапки/концовки — в gcode\program.js.
const I = {
  bolt: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="4" r="1.5"/><circle cx="19" cy="16" r="1.5"/><circle cx="5" cy="16" r="1.5"/>',
  tangent: '<path d="M3 20h8a9 9 0 0 0 9-9V4"/>',
  facing: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M6 9h12M6 12h12M6 15h12"/>',
  modes: '<circle cx="12" cy="13" r="8"/><path d="M12 13l4-4M12 3v2"/>',
  macro: '<path d="M8 4c-2 0-3 1-3 3v3c0 1-1 2-2 2 1 0 2 1 2 2v3c0 2 1 3 3 3M16 4c2 0 3 1 3 3v3c0 1 1 2 2 2-1 0-2 1-2 2v3c0 2-1 3-3 3"/>',
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
    { id: 'millmodes', title: 'Режимы', sub: 'Vc · S · fz · метчик', cat: 'mode', icon: I.modes },
    { id: 'macros', title: 'Макросы G65', sub: 'O9010 – O9012', cat: 'mac', icon: I.macro },
  ],
};
