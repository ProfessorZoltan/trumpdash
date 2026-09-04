// Trump Dash service worker: network first, cache as the fallback.
// Online players always get the latest deploy, exactly as before (the versioned loader in index.html
// keeps doing its job); the cached copy is only used when the network fails, which is what lets the
// installed app (Add to Home Screen / the Play Store shell) start without a connection.
// Bump CACHE when PRECACHE changes so stale entries are dropped on activate.
const CACHE = 'trumpdash-v1';
const PRECACHE = [
  './', 'index.html', 'style.css', 'manifest.json', 'privacy.html',
  'src/constants.js', 'src/sprites.js', 'src/level.js',
  'src/levels/greenland.js', 'src/levels/venezuela.js', 'src/levels/hormuz.js', 'src/levels/canada.js', 'src/levels/panama.js', 'src/levels/moon.js',
  'src/physics.js', 'src/audio.js', 'src/render.js', 'src/game.js',
  'resources/sprite_sheet.png', 'resources/greenland_map.png', 'resources/florida_map.png',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-512-maskable.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache entries are keyed without the ?v= query string, so any version of a file satisfies an
// offline request for it (ignoreSearch on match).
function keyFor(req) { const u = new URL(req.url); u.search = ''; return u.toString(); }

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return; // analytics etc. go straight out
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(keyFor(req), copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./') : undefined)))
  );
});
