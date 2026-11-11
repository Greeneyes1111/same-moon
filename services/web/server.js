// Public Cloud Run service: serves the app, the catalogue and the published
// audio. Scales to zero. No cookies, no accounts, no tracking.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { makeStore, contentTypeFor } from '../../shared/store.js';
import { isCloud } from '../../shared/config.js';
import { loadStories, storyLangs } from '../../shared/stories.js';
import { processUpload } from '../transcoder/server.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(here, 'public');
const BUILD = (process.env.K_REVISION || 'dev').replace(/[^\w.-]/g, '');
const log = (severity, message, extra = {}) => console.log(JSON.stringify({ severity, message, ...extra }));

const SECURITY_HEADERS = {
  'content-security-policy': [
    "default-src 'self'",
    "img-src 'self' data:",
    "media-src 'self' blob:",
    "connect-src 'self' https://storage.googleapis.com",
    "style-src 'self'",
    "script-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; '),
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'permissions-policy': 'camera=(), geolocation=(), microphone=(self)',
  'cross-origin-opener-policy': 'same-origin',
};

// The app shell is tiny, so it lives in memory.
function loadStatic() {
  const files = new Map();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else {
        const urlPath = '/' + path.relative(PUBLIC_DIR, full).split(path.sep).join('/');
        let body = fs.readFileSync(full);
        if (urlPath === '/sw.js' || urlPath === '/index.html') body = Buffer.from(body.toString('utf8').replaceAll('__BUILD__', BUILD));
        files.set(urlPath, { body, type: contentTypeFor(full), etag: `"${crypto.createHash('sha1').update(body).digest('hex').slice(0, 16)}"` });
      }
    }
  };
  walk(PUBLIC_DIR);
  files.set('/', files.get('/index.html'));
  return files;
}

// Small cache in front of Cloud Storage. Audio file names contain a content
// hash, so a cached copy can never go stale.
class MediaCache {
  constructor(maxBytes = 64 * 1024 * 1024) {
    this.max = maxBytes;
    this.size = 0;
    this.map = new Map();
  }
  get(key) {
    const v = this.map.get(key);
    if (!v) return null;
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }
  set(key, buf) {
    if (buf.length > this.max / 4) return;
    this.map.set(key, buf);
    this.size += buf.length;
    for (const [k, v] of this.map) {
      if (this.size <= this.max) break;
      this.map.delete(k);
      this.size -= v.length;
    }
  }
}

// Gentle limit on recording uploads. The address is hashed with a salt that
// changes every restart, kept in memory only and never logged.
class RateLimit {
  constructor(limit = 8, windowMs = 60 * 60 * 1000) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.salt = crypto.randomBytes(16);
    this.hits = new Map();
  }
  allow(ip) {
    const key = crypto.createHmac('sha256', this.salt).update(ip || '').digest('base64url');
    const now = Date.now();
    const recent = (this.hits.get(key) || []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) return false;
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}

const json = (res, status, obj, headers = {}) =>
  send(res, status, JSON.stringify(obj), { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers });

// Text compresses to about a third; worth it on prepaid mobile data.
const gzipCache = new WeakMap();
const COMPRESSIBLE = /^(text\/|application\/(json|javascript|manifest\+json)|image\/svg\+xml)/;

function sendBuffer(req, res, buf, { type, cacheControl, etag }) {
  const base = { 'content-type': type, 'cache-control': cacheControl, 'accept-ranges': 'bytes' };
  if (etag) base.etag = etag;
  if (etag && req.headers['if-none-match'] === etag) return send(res, 304, null, base);
  if (COMPRESSIBLE.test(type) && buf.length > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    let gz = gzipCache.get(buf);
    if (!gz) {
      gz = zlib.gzipSync(buf, { level: 9 });
      gzipCache.set(buf, gz);
    }
    return send(res, 200, req.method === 'HEAD' ? null : gz, {
      ...base, 'content-encoding': 'gzip', vary: 'accept-encoding', 'content-length': gz.length,
    });
  }
  const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  if (range) {
    let start = range[1] === '' ? buf.length - Number(range[2]) : Number(range[1]);
    let end = range[1] === '' || range[2] === '' ? buf.length - 1 : Number(range[2]);
    start = Math.max(0, start);
    end = Math.min(end, buf.length - 1);
    if (start > end) return send(res, 416, null, { ...base, 'content-range': `bytes */${buf.length}` });
    return send(res, 206, req.method === 'HEAD' ? null : buf.subarray(start, end + 1), {
      ...base,
      'content-range': `bytes ${start}-${end}/${buf.length}`,
      'content-length': end - start + 1,
    });
  }
  return send(res, 200, req.method === 'HEAD' ? null : buf, { ...base, 'content-length': buf.length });
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/x-m4a', 'audio/aac'];
const clean = (s, max) => String(s || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, max);

export function createServer({ store = makeStore(), stories = loadStories() } = {}) {
  const statics = loadStatic();
  const media = new MediaCache();
  const limiter = new RateLimit();
  let catalogueCache = { at: 0, body: null };

  async function catalogue() {
    if (catalogueCache.body && Date.now() - catalogueCache.at < 30_000) return catalogueCache.body;
    const buf = await store.get('public', 'catalogue.json');
    catalogueCache = { at: Date.now(), body: buf };
    return buf;
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;

    if (p === '/healthz') return send(res, 200, 'ok', { 'content-type': 'text/plain' });

    if ((req.method === 'GET' || req.method === 'HEAD') && statics.has(p)) {
      const f = statics.get(p);
      const cc = p === '/sw.js' || p === '/' || p === '/index.html' ? 'no-cache' : 'public, max-age=3600';
      return sendBuffer(req, res, f.body, { type: f.type, cacheControl: cc, etag: f.etag });
    }

    if (req.method === 'GET' && p === '/api/catalogue') {
      const buf = await catalogue();
      if (!buf) return json(res, 503, { error: 'The library is being prepared. Try again in a minute.' });
      return sendBuffer(req, res, buf, { type: 'application/json', cacheControl: 'no-cache' });
    }

    if ((req.method === 'GET' || req.method === 'HEAD') && p.startsWith('/media/')) {
      const key = decodeURIComponent(p.slice('/media/'.length));
      if (!/^(covers|audio|voices)\/[\w./-]+$/.test(key) || key.includes('..')) return send(res, 404, 'Not found');
      let buf = media.get(key);
      if (!buf) {
        buf = await store.get('public', key);
        if (!buf) return send(res, 404, 'Not found');
        media.set(key, buf);
      }
      const cacheControl = key.startsWith('covers/') ? 'public, max-age=86400' : 'public, max-age=31536000, immutable';
      return sendBuffer(req, res, buf, { type: contentTypeFor(key), cacheControl });
    }

    // A volunteer asks where to send a recording. Only the reviewers ever hear it.
    if (req.method === 'POST' && p === '/api/voices') {
      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      if (!limiter.allow(ip)) return json(res, 429, { error: 'Too many recordings from here today. Thank you, and please try again later.' });
      let body;
      try {
        body = JSON.parse((await readBody(req, 8 * 1024)).toString('utf8'));
      } catch {
        return json(res, 400, { error: 'Bad request' });
      }
      const story = stories.find((s) => s.id === body.storyId);
      if (!story || !storyLangs(story).includes(body.lang)) return json(res, 400, { error: 'Unknown story or language' });
      if (body.adult !== true || body.consent !== true) return json(res, 400, { error: 'Please confirm both boxes' });
      const mime = String(body.mime || '').split(';')[0].trim().toLowerCase();
      if (!AUDIO_TYPES.includes(mime)) return json(res, 400, { error: 'Unsupported audio type' });
      const id = crypto.randomUUID();
      const meta = {
        id,
        storyId: story.id,
        lang: body.lang,
        dialect: clean(body.dialect, 40),
        credit: clean(body.credit, 40),
        mime,
        createdAt: new Date().toISOString(),
      };
      await store.put('state', `voices/meta/${id}.json`, Buffer.from(JSON.stringify(meta)), { contentType: 'application/json' });
      const target = await store.uploadTarget(`incoming/${id}`, mime);
      log('INFO', 'recording slot issued', { story: story.id, lang: body.lang });
      return json(res, 200, { id, upload: target });
    }

    // Local development only: stands in for the signed Cloud Storage URL and
    // the Eventarc trigger.
    if (!isCloud() && req.method === 'PUT' && p.startsWith('/api/voices/local-upload/')) {
      const key = decodeURIComponent(p.slice('/api/voices/local-upload/'.length));
      if (!/^incoming\/[0-9a-f-]{36}$/.test(key)) return send(res, 400, 'Bad key');
      const buf = await readBody(req, 60 * 1024 * 1024);
      await store.put('uploads', key, buf);
      const result = await processUpload(store, key);
      return json(res, 200, { result });
    }

    return send(res, 404, 'Not found', { 'content-type': 'text/plain' });
  }

  return http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      log('ERROR', 'request failed', { path: req.url.split('?')[0], error: err.message });
      if (!res.headersSent) json(res, err.status || 500, { error: 'Something went wrong' });
    });
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const port = Number(process.env.PORT || 8080);
  createServer().listen(port, () => log('INFO', `web listening on ${port}`));
}
