// Форматирование чисел и слов G-кода. Чистые функции, без DOM.

export function roundTo(n, dec = 3) {
  const k = 10 ** dec;
  const r = Math.sign(n) * Math.round(Math.abs(n) * k + 1e-7) / k;
  return r === 0 ? 0 : r; // убирает -0
}

// 25 -> "25.", 25.1 -> "25.1", -0.0004 -> "0."; NaN/Infinity -> ошибка (молча не выводим)
export function fmt(n, dec = 3) {
  if (!Number.isFinite(n)) throw new Error('Некорректное число в G-коде');
  const r = roundTo(n, dec);
  let s = r.toFixed(dec);
  if (s.includes('.')) s = s.replace(/0+$/, '');
  else s += '.';
  if (s === '-0.') s = '0.';
  return s;
}

export const word = (letter, n, dec = 3) => letter + fmt(n, dec);
// радиус -> слово на диаметр
export const diaWord = (letter, radius, dec = 3) => letter + fmt(radius * 2, dec);
// целое без точки (микроны, номера)
export function int(n) {
  if (!Number.isFinite(n)) throw new Error('Некорректное число в G-коде');
  return String(Math.round(n + Math.sign(n) * 1e-7));
}
export const micro = (mm) => int(mm * 1000);
export const pad2 = (n) => String(Math.round(n)).padStart(2, '0');

// принимает точку и запятую
export function parseNum(s) {
  if (typeof s === 'number') return s;
  if (s == null) return NaN;
  const t = String(s).trim().replace(/\s+/g, '').replace(',', '.');
  if (t === '' || t === '-' || t === '.') return NaN;
  return Number(t);
}

const TR = {
  А: 'A', Б: 'B', В: 'V', Г: 'G', Д: 'D', Е: 'E', Ё: 'E', Ж: 'ZH', З: 'Z', И: 'I', Й: 'Y', К: 'K', Л: 'L', М: 'M',
  Н: 'N', О: 'O', П: 'P', Р: 'R', С: 'S', Т: 'T', У: 'U', Ф: 'F', Х: 'KH', Ц: 'TS', Ч: 'CH', Ш: 'SH', Щ: 'SCH',
  Ъ: '', Ы: 'Y', Ь: '', Э: 'E', Ю: 'YU', Я: 'YA',
};

// только латиница в верхнем регистре, цифры и пробелы
export function translit(text) {
  let out = '';
  for (const ch of String(text ?? '').toUpperCase()) out += TR[ch] !== undefined ? TR[ch] : ch;
  return out.replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function comment(text) {
  const t = translit(text);
  return t ? `(${t})` : '';
}

export const join = (...parts) => parts.filter((p) => p !== '' && p != null && p !== false).join(' ');

// Направление дуги: ccw — против часовой в плоскости (Z вправо, X вверх).
// Задний резцедержатель: против часовой = G03. Передний — зеркально.
export function arcCode(ccw, holder = 'rear') {
  return (holder === 'front' ? !ccw : ccw) ? 'G03' : 'G02';
}
