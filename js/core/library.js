// Библиотека программ: чистая логика (без IndexedDB и DOM).
export const STATUSES = ['Черновик', 'Ошибки в проверке', 'Проверено на станке'];

export function newItem(p = {}) {
  const now = new Date().toISOString();
  return {
    id: p.id || 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    title: p.title || 'Без названия', o: p.o || '', machine: p.machine === 'MF' ? 'MF' : 'TF', version: 1, date: now, status: STATUSES[0],
    fav: false, text: p.text || '', notes: p.notes || '', order: p.order || '', versions: [], journal: [],
  };
}

// Сохранение новой версии: прежний текст уходит в историю, только если он изменился
export function saveVersion(item, text, note = '') {
  if (text === item.text) return item;
  const versions = [...item.versions, { v: item.version, date: item.date, text: item.text, note }];
  return { ...item, text, version: item.version + 1, date: new Date().toISOString(), versions, status: item.status === 'Проверено на станке' ? STATUSES[0] : item.status };
}

// «Проверено на станке» ставится только вручную. Автоматически допустимо лишь снижение до «Ошибки в проверке».
export function setStatus(item, status, manual) {
  if (!STATUSES.includes(status)) return item;
  if (status === 'Проверено на станке' && !manual) return item;
  return { ...item, status };
}

export function filterItems(items, { q = '', machine = '', fav = false, draft = false } = {}) {
  const s = q.trim().toLowerCase();
  return items.filter((it) => {
    if (machine && it.machine !== machine) return false;
    if (fav && !it.fav) return false;
    if (draft && it.status !== STATUSES[0]) return false;
    if (!s) return true;
    return [it.title, it.o, it.order].some((f) => String(f || '').toLowerCase().includes(s));
  }).sort((a, b) => (a.date < b.date ? 1 : -1));
}

// Построчные отличия двух текстов (LCS): [{t:'=', s}, {t:'+', s}, {t:'-', s}]
export function diffLines(a, b) {
  const x = String(a).split('\n'), y = String(b).split('\n');
  const n = x.length, m = y.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) { out.push({ t: '=', s: x[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ t: '-', s: x[i++] });
    else out.push({ t: '+', s: y[j++] });
  }
  while (i < n) out.push({ t: '-', s: x[i++] });
  while (j < m) out.push({ t: '+', s: y[j++] });
  return out;
}

// Конфликт версий при синхронизации: обе сохраняются, пользователь выбирает
export function mergeConflict(local, remote) {
  if (local.version === remote.version && local.text === remote.text) return { conflict: false, items: [local] };
  return { conflict: true, items: [local, { ...remote, id: remote.id + '-remote', title: remote.title + ' (копия)' }] };
}

export function addJournal(item, entry) {
  return { ...item, journal: [...item.journal, { date: new Date().toISOString(), ...entry }] };
}
