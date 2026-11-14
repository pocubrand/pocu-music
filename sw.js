/* Pocu Music — Service Worker */
const VERSION = 'v86';
const SHELL_CACHE = `pocu-shell-${VERSION}`;
const MEDIA_CACHE = `pocu-media-${VERSION}`;

const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './css/theme.css',
  './js/store.js',
  './js/library.js',
  './js/artists.js',
  './js/player.js',
  './js/track-card.js',
  './js/ui-player.js',
  './js/search.js',
  './js/favorites-ui.js',
  './js/playlists-ui.js',
  './js/artist-ui.js',
  './js/track-ui.js',
  './js/album-ui.js',
  './js/genre-ui.js',
  './js/context-menu.js',
  './js/pulse.js',
  './js/home-ui.js',
  './js/charts-ui.js',
  './js/profile-ui.js',
  './js/settings-ui.js',
  './js/eq-ui.js',
  './js/preferences-ui.js',
  './js/supabase.js',
  './js/auth-ui.js',
  './js/app.js',
  './icons/icon.svg',
  './audio/artists.json',
  './audio/library.json'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.allSettled(
      SHELL.map(url => cache.add(url).catch(err => console.warn('[sw] precache skip:', url, err.message)))
    );
  })());
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k !== SHELL_CACHE && k !== MEDIA_CACHE).map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/\.(m4a|mp3|aac|wav|ogg|mp4|jpg|jpeg|png|webp)$/i.test(url.pathname)) return;
  if (url.origin === self.location.origin) {
    e.respondWith(networkFirst(req, SHELL_CACHE));
  }
});

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    return new Response('Offline', { status: 503 });
  }
}