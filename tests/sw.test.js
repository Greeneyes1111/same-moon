// The offline worker, run in Node with a pretend phone: an in-memory cache
// store and a pretend network that sends a story file in small pieces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const ORIGIN = 'https://samemoon.test';
const SW = readFileSync(new URL('../services/web/public/sw.js', import.meta.url), 'utf8').replaceAll('__BUILD__', 'test');
const AUDIO = 'audio-v1';
const URL_A = '/media/audio/nest-again/en-abc.webm';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fakeCaches() {
  const stores = new Map();
  const key = (r) => (typeof r === 'string' ? new URL(r, ORIGIN).href : r.url);
  async function open(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    return {
      async match(r) {
        const e = m.get(key(r));
        return e ? new Response(e.body.slice(), { headers: e.headers }) : undefined;
      },
      async put(r, res) {
        m.set(key(r), { body: new Uint8Array(await res.arrayBuffer()), headers: Object.fromEntries(res.headers) });
      },
      async delete(r) { return m.delete(key(r)); },
      async addAll() {},
    };
  }
  return { open, stores, kept: (url) => stores.get(AUDIO)?.get(new URL(url, ORIGIN).href)?.body };
}

// A network that sends `file` in pieces. `breakAfter` cuts the download off.
function fakeNetwork(file, { piece = 700, delayMs = 1, breakAfter = Infinity } = {}) {
  const calls = [];
  const net = { offline: false, calls };
  net.fetch = async (input, init) => {
    const req = input instanceof Request ? input : new Request(new URL(String(input), ORIGIN), init);
    calls.push({ url: req.url, range: req.headers.get('range') });
    if (net.offline) throw new TypeError('Failed to fetch');
    const range = req.headers.get('range');
    if (range) {
      const [, a, b] = /bytes=(\d*)-(\d*)/.exec(range);
      const start = Number(a || 0);
      const end = b === '' ? file.length - 1 : Number(b);
      return new Response(file.slice(start, end + 1), {
        status: 206,
        headers: { 'content-type': 'audio/webm', 'content-range': `bytes ${start}-${end}/${file.length}` },
      });
    }
    let sent = 0;
    const body = new ReadableStream({
      async pull(c) {
        await sleep(delayMs);
        if (sent >= breakAfter) return c.error(new TypeError('network lost'));
        if (sent >= file.length) return c.close();
        c.enqueue(file.slice(sent, sent + piece));
        sent += piece;
      },
    });
    return new Response(body, {
      status: 200,
      headers: { 'content-type': 'audio/webm', 'content-length': String(file.length) },
    });
  };
  return net;
}

function loadWorker(caches, net) {
  const listeners = {};
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting() {},
    clients: { claim() {}, matchAll: async () => [{ postMessage: (m) => messages.push(m) }] },
  };
  const messages = [];
  new Function('self', 'caches', 'fetch', SW)(self, caches, (...a) => net.fetch(...a));
  // What a phone's audio player does: ask the worker for a byte range.
  function ask(url, range) {
    const request = new Request(ORIGIN + url, { headers: range ? { range } : {} });
    let reply = null;
    const waits = [];
    listeners.fetch({ request, respondWith: (p) => { reply = p; }, waitUntil: (p) => waits.push(p) });
    return { reply, settled: () => Promise.all(waits) };
  }
  ask.messages = messages;
  ask.listeners = listeners;
  return ask;
}

const bytes = async (res) => new Uint8Array(await res.arrayBuffer());
const audioCalls = (net) => net.calls.filter((c) => c.url.endsWith(URL_A));

test('a story that plays once with signal is kept, and every byte is downloaded only once', async () => {
  const file = new Uint8Array(randomBytes(5000));
  const caches = fakeCaches();
  const net = fakeNetwork(file);
  const ask = loadWorker(caches, net);

  // How iPhones and Android phones ask: a 2-byte probe, then the rest, while seeking ahead.
  const probe = ask(URL_A, 'bytes=0-1');
  const all = ask(URL_A, 'bytes=0-');
  const tail = ask(URL_A, 'bytes=4000-4999');
  const [r1, r2, r3] = await Promise.all([probe.reply, all.reply, tail.reply]);

  assert.equal(r1.status, 206);
  assert.equal(r1.headers.get('content-range'), 'bytes 0-1/5000');
  assert.deepEqual(await bytes(r1), file.slice(0, 2));
  assert.equal(r2.status, 206);
  assert.equal(r2.headers.get('content-range'), 'bytes 0-4999/5000');
  assert.deepEqual(await bytes(r2), file);
  assert.equal(r3.headers.get('content-length'), '1000');
  assert.deepEqual(await bytes(r3), file.slice(4000, 5000));
  await Promise.all([probe.settled(), all.settled(), tail.settled()]);

  assert.equal(audioCalls(net).length, 1, 'one download for all three requests');
  assert.equal(audioCalls(net)[0].range, null, 'the whole file, once');
  assert.deepEqual(caches.kept(URL_A), file, 'kept on the phone');
  assert.deepEqual(ask.messages, [{ kept: ORIGIN + URL_A }], 'the page is told, once');

  // Now with no signal: it still plays, from the kept copy.
  net.offline = true;
  const later = ask(URL_A, 'bytes=100-199');
  const r4 = await later.reply;
  assert.equal(r4.status, 206);
  assert.equal(r4.headers.get('content-range'), 'bytes 100-199/5000');
  assert.deepEqual(await bytes(r4), file.slice(100, 200));
  assert.equal(audioCalls(net).length, 1, 'no network needed');
});

test('playback starts before the download finishes', async () => {
  const file = new Uint8Array(randomBytes(20000));
  const caches = fakeCaches();
  const net = fakeNetwork(file, { piece: 500, delayMs: 5 });
  const ask = loadWorker(caches, net);
  const t0 = Date.now();
  const first = ask(URL_A, 'bytes=0-1');
  const r = await first.reply;
  assert.deepEqual(await bytes(r), file.slice(0, 2));
  assert.ok(Date.now() - t0 < 100, 'the first bytes arrive straight away');
  assert.equal(caches.kept(URL_A), undefined, 'not kept until the whole file is in');
  await first.settled();
  assert.deepEqual(caches.kept(URL_A), file);
});

test('"Save for offline" (no range) gets the whole file and keeps it', async () => {
  const file = new Uint8Array(randomBytes(3000));
  const caches = fakeCaches();
  const net = fakeNetwork(file);
  const ask = loadWorker(caches, net);
  const save = ask(URL_A, null);
  const r = await save.reply;
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-length'), '3000');
  assert.deepEqual(await bytes(r), file);
  await save.settled();
  assert.deepEqual(caches.kept(URL_A), file);
});

test('with no signal and nothing kept, it fails just as it did before', async () => {
  const caches = fakeCaches();
  const net = fakeNetwork(new Uint8Array(100));
  net.offline = true;
  const ask = loadWorker(caches, net);
  const req = ask(URL_A, 'bytes=0-1');
  await assert.rejects(req.reply);
  await req.settled();
  assert.equal(caches.kept(URL_A), undefined);
});

test('a download that breaks off is not kept, and the next play tries again', async () => {
  const file = new Uint8Array(randomBytes(4000));
  const caches = fakeCaches();
  const net = fakeNetwork(file, { breakAfter: 1400 });
  const ask = loadWorker(caches, net);
  const broken = ask(URL_A, 'bytes=0-');
  const r = await broken.reply;
  await assert.rejects(bytes(r));
  await broken.settled();
  assert.equal(caches.kept(URL_A), undefined, 'half a story is never kept');

  const good = fakeNetwork(file);
  net.fetch = good.fetch;
  const again = ask(URL_A, 'bytes=0-');
  assert.deepEqual(await bytes(await again.reply), file);
  await again.settled();
  assert.deepEqual(caches.kept(URL_A), file);
});

test('a range past the end of a kept story gets 416', async () => {
  const file = new Uint8Array(randomBytes(1000));
  const caches = fakeCaches();
  const net = fakeNetwork(file);
  const ask = loadWorker(caches, net);
  const first = ask(URL_A, null);
  await bytes(await first.reply);
  await first.settled();
  const r = await ask(URL_A, 'bytes=5000-').reply;
  assert.equal(r.status, 416);
  assert.equal(r.headers.get('content-range'), 'bytes */1000');
});

test('setting up on a phone tells the server only whether it is the first time', async () => {
  for (const [hadShell, want] of [[false, '/api/catalogue?first=1'], [true, '/api/catalogue?sw=1']]) {
    const caches = fakeCaches();
    caches.keys = async () => [...caches.stores.keys()];
    if (hadShell) await caches.open('shell-older');
    const net = fakeNetwork(new Uint8Array(10));
    const ask = loadWorker(caches, net);
    const waits = [];
    ask.listeners.install({ waitUntil: (p) => waits.push(p) });
    await Promise.all(waits);
    const asked = net.calls.map((c) => c.url).filter((u) => u.includes('/api/catalogue'));
    assert.deepEqual(asked, [ORIGIN + want]);
  }
});
