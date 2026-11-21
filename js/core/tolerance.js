// Допуски ISO 286: разбор строки вида «20 h7», «Ø50 H7», «20g6»; регистр буквы задаёт тип (строчная — вал, заглавная — отверстие).
import { INTERVALS, IT, FUND } from '../data/iso286.js';

export function parseTol(text) {
  const m = String(text ?? '').trim().replace(',', '.').match(/^[ØøDd⌀]?\s*(\d+(?:\.\d+)?)\s*([A-Za-z]{1,2})\s*(\d{1,2})$/);
  if (!m) return { error: 'Не понял «' + text + '». Пример: 20 h7, Ø50 H7, 20g6' };
  const letter = m[2];
  const lower = letter.toLowerCase();
  if (lower.length === 2 && lower !== 'js') return { error: 'Неизвестное отклонение «' + letter + '»' };
  const kind = letter === letter.toLowerCase() ? 'shaft' : 'hole';
  return { size: parseFloat(m[1]), letter: lower, kind, grade: parseInt(m[3], 10) };
}

// Интервал «свыше a до b»: граница относится к нижнему интервалу (18 → 10–18)
export function intervalOf(size) {
  if (!(size > 0) || size > 500) return null;
  const iv = INTERVALS.find(([a, b]) => size > a && size <= b);
  return iv ? iv.join('-') : null;
}

const NO_DATA = 'нет данных для этого размера';

// Возвращает отклонения в мм: {es, ei, it, max, min, mid, kind, interval}
export function tolerance({ size, letter, kind, grade }) {
  const key = intervalOf(size);
  if (!key) return { error: 'Размер вне диапазона 1–500 мм' };
  const itUm = IT[key] && IT[key][grade];
  if (itUm === undefined) return { error: `IT${grade} для интервала ${key} мм: ${NO_DATA}`, noData: true };
  let es, ei;
  if (letter === 'h' && kind === 'shaft') { es = 0; ei = -itUm; }
  else if (letter === 'h' && kind === 'hole') { ei = 0; es = itUm; } // H
  else if (letter === 'js') { es = itUm / 2; ei = -itUm / 2; }
  else {
    const f = (FUND[kind] && FUND[kind][letter] && FUND[kind][letter][key]);
    if (!f) return { error: `Отклонение ${kind === 'shaft' ? letter : letter.toUpperCase()} для интервала ${key} мм: ${NO_DATA}`, noData: true };
    if (kind === 'shaft') { if (f.es !== undefined) { es = f.es; ei = es - itUm; } else { ei = f.ei; es = ei + itUm; } }
    else if (f.EI !== undefined) { ei = f.EI; es = ei + itUm; } else { es = f.ES; ei = es - itUm; }
  }
  const mm = (u) => Math.round(u * 10) / 10000; // мкм → мм, шаг 0.1 мкм
  const out = { kind, interval: key, it: itUm / 1000, es: mm(es), ei: mm(ei) };
  out.max = size + out.es; out.min = size + out.ei; out.mid = (out.max + out.min) / 2;
  return out;
}

export const programSize = (t, pick) => (pick === 'max' ? t.max : pick === 'min' ? t.min : t.mid);

// Посадка с основной парой: вал + отверстие H того же квалитета; отверстие + вал h
export function fitWithBase(size, tol, grade) {
  const base = tolerance({ size, letter: 'h', kind: tol.kind === 'shaft' ? 'hole' : 'shaft', grade });
  if (base.error) return null;
  const hole = tol.kind === 'shaft' ? base : tol, shaft = tol.kind === 'shaft' ? tol : base;
  const maxClear = hole.es - shaft.ei, minClear = hole.ei - shaft.es;
  const r = (n) => Math.round(n * 1e6) / 1e6;
  const type = minClear >= 0 ? 'с зазором' : maxClear <= 0 ? 'с натягом' : 'переходная';
  return { max: r(maxClear), min: r(minClear), type };
}
