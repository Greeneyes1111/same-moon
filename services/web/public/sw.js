// Offline support. The app shell and catalogue are kept automatically.
// A story's audio is kept once it has played with signal, so it plays again
// with no signal. "Save for offline" keeps a story without playing it first.
// Only stories the family chose to play or save are ever kept.
const BUILD = '__BUILD__';
const SHELL = `shell-${BUILD}`;
const DATA = 'data-v1';
const AUDIO = 'audio-v1';
const SHELL_FILES = ['/', '/app.js', '/styles.css', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png'];

// The first visit happens before this worker is in charge, so on install we
// also keep the story list and the cover pictures (about 30 KB together).
// After one visit with signal, the library opens with none.
// It also tells the server whether this is a phone setting Same Moon up for
// the first time, so the anonymous totals can count new phones. Nothing about
// the phone is sent.
async function keepLibrary(firstTime) {
  const data = await caches.open(DATA);
  const res = await fetch(firstTime ? '/api/catalogue?first=1' : '/api/catalogue?sw=1', { cache: 'no-cache' });
  if (!res.ok) return;
  await data.put('/api/catalogue', res.clone());
  const { stories = [] } = await res.json();
  await data.addAll([...new Set(stories.map((s) => s.cover))]);
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    // A phone that has never had Same Moon has no app shell kept yet.
    const firstTime = !(await caches.keys()).some((k) => k.startsWith('shell-'));
    const shell = await caches.open(SHELL);
    await shell.addAll(SHELL_FILES);
    await keepLibrary(firstTime).catch(() => {});
    await self.skipWaiting();
  })());
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

// Audio players ask for byte ranges, a piece at a time. Once a story is kept,
// every piece comes from the kept copy.
//
// The first time a story plays with signal, the worker downloads the whole
// file once (what the player would download anyway, 0.2 to 0.7 MB) and hands
// the player each piece as soon as its bytes arrive, so playback starts just as
// fast. When the download finishes, the file is kept. No byte is downloaded
// twice, which matters on a prepaid data bundle.

// [start, end] for a Range header, or null to send the whole file.
function parseRange(header, total) {
  const m = header && /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  if (m[1] === '') return [Math.max(0, total - Number(m[2])), total - 1];
  return [Number(m[1]), m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1)];
}

function audioResponse(body, type, total, range) {
  const headers = { 'content-type': type, 'accept-ranges': 'bytes' };
  if (!range) return new Response(body, { status: 200, headers: { ...headers, 'content-length': String(total) } });
  const [start, end] = range;
  return new Response(body, {
    status: 206,
    headers: { ...headers, 'content-range': `bytes ${start}-${end}/${total}`, 'content-length': String(end - start + 1) },
  });
}

function outOfRange(total) {
  return new Response(null, { status: 416, headers: { 'content-range': `bytes */${total}` } });
}

// One download per story file, shared by every request for it.
const downloads = new Map();

function download(url) {
  const d = { buf: null, type: 'audio/webm', total: 0, received: 0, error: null, listeners: new Set() };
  const notify = () => { for (const fn of [...d.listeners]) fn(); };
  let gotHead;
  d.head = new Promise((resolve, reject) => { gotHead = { resolve, reject }; });
  d.head.catch(() => {});
  d.done = (async () => {
    const res = await fetch(url);
    const total = Number(res.headers.get('content-length'));
    // Anything unusual (an error, no length, a compressed body): don't keep it.
    if (!res.ok || res.status !== 200 || !res.body || !(total > 0) || res.headers.get('content-encoding')) {
      res.body?.cancel().catch(() => {});
      throw new Error('cannot keep this file');
    }
    d.total = total;
    d.type = res.headers.get('content-type') || 'audio/webm';
    d.buf = new Uint8Array(total);
    gotHead.resolve();
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (d.received + value.byteLength > total) throw new Error('longer than expected');
      d.buf.set(value, d.received);
      d.received += value.byteLength;
      notify();
    }
    if (d.received !== total) throw new Error('download cut short');
    const cache = await caches.open(AUDIO);
    await cache.put(url, audioResponse(d.buf, d.type, total, null));
    // Let open pages show "Saved on this phone".
    try {
      for (const client of await self.clients.matchAll()) client.postMessage({ kept: url });
    } catch { /* nothing to tell */ }
  })();
  d.done
    .catch((err) => {
      d.error = err;
      gotHead.reject(err);
      notify();
    })
    .finally(() => downloads.delete(url));
  downloads.set(url, d);
  return d;
}

// The bytes start..end of a download, handed over as they arrive.
function streamFrom(d, start, end) {
  let pos = start;
  let waiting = null;
  return new ReadableStream({
    pull(controller) {
      return new Promise((resolve) => {
        const step = () => {
          const last = Math.min(d.received - 1, end);
          if (last >= pos) {
            d.listeners.delete(step);
            waiting = null;
            controller.enqueue(d.buf.slice(pos, last + 1));
            pos = last + 1;
            if (pos > end) controller.close();
            resolve();
          } else if (d.error) {
            d.listeners.delete(step);
            waiting = null;
            controller.error(d.error);
            resolve();
          } else {
            waiting = step;
            d.listeners.add(step);
          }
        };
        step();
      });
    },
    cancel() {
      if (waiting) d.listeners.delete(waiting);
    },
  });
}

async function storyAudio(event) {
  const { request } = event;
  const url = request.url;
  const header = request.headers.get('range');

  const cache = await caches.open(AUDIO);
  const hit = await cache.match(url);
  if (hit) {
    const buf = await hit.arrayBuffer();
    const total = buf.byteLength;
    const range = parseRange(header, total);
    if (range && range[0] > range[1]) return outOfRange(total);
    const type = hit.headers.get('content-type') || 'audio/webm';
    return audioResponse(range ? buf.slice(range[0], range[1] + 1) : buf, type, total, range);
  }

  const d = downloads.get(url) || download(url);
  // Keep the worker awake until the whole file is downloaded and kept.
  event.waitUntil(d.done.catch(() => {}));
  try {
    await d.head;
  } catch {
    // No signal, or a file we can't keep: behave exactly as before.
    return fetch(request);
  }
  const range = parseRange(header, d.total);
  if (range && range[0] > range[1]) return outOfRange(d.total);
  const [start, end] = range || [0, d.total - 1];
  return audioResponse(streamFrom(d, start, end), d.type, d.total, range);
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
    event.respondWith(storyAudio(event));
  } else if (SHELL_FILES.includes(url.pathname) || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request, SHELL));
  }
});
