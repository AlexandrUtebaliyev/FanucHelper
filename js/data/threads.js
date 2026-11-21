// Таблица метрических резьб. Заполнять только из стандарта (ISO 261/262), не по памяти.
// Проверено тестами ТЗ: M20×2.5. Остальное — TODO (см. TODO_DATA.md).
export const THREADS = {
  M20: { d: 20, coarse: 2.5, fine: [] },
  // TODO: M3…M64 — крупные и мелкие шаги из стандарта
};

export const threadSizes = () => Object.keys(THREADS);
export function threadData(name) {
  return THREADS[name] || null;
}
