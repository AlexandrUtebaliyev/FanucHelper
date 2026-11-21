// Service Worker: кэш всех файлов приложения, работа офлайн. Список ASSETS обновляется скриптом tools\\sw-list.js
const CACHE = 'fh-vmwpy01wm';
const ASSETS = [
  './',
  './css/app.css',
  './icon.svg',
  './index.html',
  './js/app.js',
  './js/core/chamfer.js',
  './js/core/contour.js',
  './js/core/cutting.js',
  './js/core/geometry.js',
  './js/core/library.js',
  './js/core/mill/boltCircle.js',
  './js/core/mill/facing.js',
  './js/core/mill/millCutting.js',
  './js/core/mill/probing.js',
  './js/core/mill/tangent.js',
  './js/core/mill/threadMill.js',
  './js/core/mill/transform.js',
  './js/core/noseRadius.js',
  './js/core/taper.js',
  './js/core/thread.js',
  './js/core/tolerance.js',
  './js/data/iso286.js',
  './js/data/macros.js',
  './js/data/threads.js',
  './js/gcode/arcs.js',
  './js/gcode/check.js',
  './js/gcode/cycles.js',
  './js/gcode/format.js',
  './js/gcode/millCycles.js',
  './js/gcode/parse.js',
  './js/gcode/program.js',
  './js/libdb.js',
  './js/profiles/index.js',
  './js/profiles/mf.js',
  './js/profiles/tf.js',
  './js/store.js',
  './js/ui/backplot.js',
  './js/ui/bolt.js',
  './js/ui/chamfer.js',
  './js/ui/contour.js',
  './js/ui/drill.js',
  './js/ui/facing.js',
  './js/ui/groove.js',
  './js/ui/highlight.js',
  './js/ui/importcheck.js',
  './js/ui/kit.js',
  './js/ui/library.js',
  './js/ui/macros.js',
  './js/ui/main.js',
  './js/ui/millmodes.js',
  './js/ui/modes.js',
  './js/ui/nose.js',
  './js/ui/probing.js',
  './js/ui/program.js',
  './js/ui/settings.js',
  './js/ui/sketch.js',
  './js/ui/tangent.js',
  './js/ui/taper.js',
  './js/ui/thread.js',
  './js/ui/threadmill.js',
  './js/ui/tolerance.js',
  './js/ui/transform.js',
  './manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      if (res.ok && new URL(e.request.url).origin === location.origin) caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match('./index.html'))),
  );
});
