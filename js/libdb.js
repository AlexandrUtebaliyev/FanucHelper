// IndexedDB: локальное хранение библиотеки программ (офлайн). Без внешних зависимостей.
const DB = 'fh-library';
const STORE = 'items';

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB недоступна')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const run = (mode, fn) => open().then((db) => new Promise((resolve, reject) => {
  const tx = db.transaction(STORE, mode);
  const r = fn(tx.objectStore(STORE));
  tx.oncomplete = () => resolve(r && r.result);
  tx.onerror = () => reject(tx.error);
}));

export const libAll = () => run('readonly', (s) => s.getAll());
export const libGet = (id) => run('readonly', (s) => s.get(id));
export const libPut = (item) => run('readwrite', (s) => s.put(item));
export const libDelete = (id) => run('readwrite', (s) => s.delete(id));
