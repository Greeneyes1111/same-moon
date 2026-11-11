// Offline support. The app shell and catalogue are kept automatically.
// Story audio is kept only when the family taps "Save for offline", so we
// never fill a phone without asking.
const BUILD = '__BUILD__';
const SHELL = `shell-${BUILD}`;
const DATA = 'data-v1';
const AUDIO = 'audio-v1';
const SHELL_FILES = ['/', '/app.js', '/styles.css', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png'];

// The first visit happens before this worker is in charge, so on install we
// also keep the story list and the cover pictures (about 30 KB together).
// After one visit with signal, the library opens with none.
async function keepLibrary() {
  const data = await caches.open(DATA);
  const res = await fetch('/api/catalogue', { cache: 'no-cache' });
  if (!res.ok) return;
  await data.put('/api/catalogue', res.clone());
  const { stories = [] } = await res.json();
  await data.addAll([...new Set(stories.map((s) => s.cover))]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll(SHELL_FILES))
      .then(() => keepLibrary().catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw new Error('offline');
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

// Audio players ask for byte ranges. Serve them from the saved copy.
async function savedAudio(request) {
  const cache = await caches.open(AUDIO);
  const hit = await cache.match(request.url);
  if (!hit) return fetch(request);
  const range = request.headers.get('range');
  if (!range) return hit;
  const buf = await hit.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  const start = m && m[1] ? Number(m[1]) : 0;
  const end = m && m[2] ? Math.min(Number(m[2]), buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'content-type': hit.headers.get('content-type') || 'audio/webm',
      'content-range': `bytes ${start}-${end}/${buf.byteLength}`,
      'content-length': String(end - start + 1),
      'accept-ranges': 'bytes',
    },
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(new Request('/'), SHELL));
  } else if (url.pathname === '/api/catalogue') {
    event.respondWith(networkFirst(request, DATA));
  } else if (url.pathname.startsWith('/media/covers/')) {
    event.respondWith(cacheFirst(request, DATA));
  } else if (url.pathname.startsWith('/media/')) {
    event.respondWith(savedAudio(request));
  } else if (SHELL_FILES.includes(url.pathname) || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request, SHELL));
  }
});
