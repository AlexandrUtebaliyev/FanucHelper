// localStorage с try/catch. В node (тесты) localStorage нет — возвращаются значения по умолчанию.
const PFX = 'fh.';
export function load(key, def) {
  try {
    const s = localStorage.getItem(PFX + key);
    return s == null ? def : JSON.parse(s);
  } catch { return def; }
}
export function save(key, val) {
  try { localStorage.setItem(PFX + key, JSON.stringify(val)); return true; } catch { return false; }
}

export const DEFAULT_SETTINGS = {
  profile: 'TF',        // TF | MF
  gsys: 'A',            // A | B | C
  holder: 'rear',       // rear | front
  decimals: 3,
  feedMode: 'G99',      // TF: G99 | G98
  progNo: 1001,
  chuckZ: null,         // граница патрона по Z (отрицательное число), null = не задана
  spindleMax: 3000,     // предел оборотов, об/мин
  refTrim: false,       // G28 U0 W0 / G28 X0 Y0 в шапке и концовке (опционально)
  numbering: false, numStep: 10,
  homeXY: false,        // MF: G28 X0 Y0 в концовке
  anchor: 'left',       // G75: точка привязки пластины left | right
  tools: [],            // {t, name, r, tip, type}
};
export const getSettings = () => ({ ...DEFAULT_SETTINGS, ...load('settings', {}) });
export const setSettings = (patch) => save('settings', { ...getSettings(), ...patch });

// История и избранное
export const getRecent = () => load('recent', []);
export function pushRecent(item) {
  const list = getRecent().filter((r) => !(r.screen === item.screen && r.title === item.title));
  list.unshift({ ...item, ts: Date.now() });
  save('recent', list.slice(0, 20));
}
export const getFavs = () => load('favs', []);
export function toggleFav(item) {
  const list = getFavs();
  const i = list.findIndex((r) => r.screen === item.screen && r.title === item.title);
  if (i >= 0) list.splice(i, 1); else list.unshift(item);
  save('favs', list);
  return i < 0;
}

// Блоки программы (сборщик)
export const getBlocks = () => load('blocks', []);
export const setBlocks = (b) => save('blocks', b);
export function addBlock(block) {
  const b = getBlocks();
  b.push({ id: Date.now() + '' + Math.floor(Math.random() * 1000), ...block });
  setBlocks(b);
}

// Значения полей экрана
export const getScreenValues = (id) => load('scr.' + id, null);
export const setScreenValues = (id, v) => save('scr.' + id, v);
