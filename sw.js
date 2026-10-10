/* BottleSense service worker: offline shell + safe caching. API calls are never cached. */
const VERSION = 'bs-v13';
const SHELL = `${VERSION}-shell`;
const IMG = `${VERSION}-img`;
const FONT = `${VERSION}-font`;
const PRECACHE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(PRECACHE)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function networkFirst(req, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs))
    ]);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (hit) return hit;
    if (req.mode === 'navigate') { const idx = await cache.match('index.html') || await cache.match('./'); if (idx) return idx; }
    throw e;
  }
}
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
  return res;
}
async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || Response.error();
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(staleWhileRevalidate(req, FONT)); return;
  }
  // 相片 (不可變網址)
  if (url.pathname.startsWith('/api/photo/')) { e.respondWith(cacheFirst(req, IMG)); return; }
  // 其他 API：一律走網絡，不快取
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') { e.respondWith(networkFirst(req, SHELL, 4000)); return; }
  if (/\.(webp|png|jpg|jpeg|svg|ico)$/i.test(url.pathname)) { e.respondWith(cacheFirst(req, IMG)); return; }
  if (/\.(js|css|webmanifest|html)$/i.test(url.pathname)) { e.respondWith(networkFirst(req, SHELL, 4000)); return; }
});
