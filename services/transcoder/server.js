// Private Cloud Run service, called by Eventarc when a volunteer recording
// lands in the uploads bucket. Cleans and compresses it, files it for human
// review, then deletes the raw upload. Nothing here is ever public.
import http from 'node:http';
import path from 'node:path';
import { makeStore } from '../../shared/store.js';
import { transcodeVoice } from '../../shared/audio.js';

const MAX_BYTES = 60 * 1024 * 1024;
const MIN_SECONDS = 15;
const log = (severity, message, extra = {}) => console.log(JSON.stringify({ severity, message, ...extra }));

export async function processUpload(store, objectName) {
  if (!objectName?.startsWith('incoming/')) return 'ignored';
  const id = objectName.slice('incoming/'.length);
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    await store.del('uploads', objectName);
    return 'bad-name';
  }
  const metaBuf = await store.get('state', `voices/meta/${id}.json`);
  const raw = await store.get('uploads', objectName);
  if (!metaBuf || !raw) {
    await store.del('uploads', objectName);
    return 'orphan';
  }
  const meta = JSON.parse(metaBuf.toString('utf8'));
  try {
    if (raw.length > MAX_BYTES) return await reject(store, objectName, meta, 'too-large');
    let out;
    try {
      out = await transcodeVoice(raw);
    } catch {
      return await reject(store, objectName, meta, 'not-audio');
    }
    if (out.duration < MIN_SECONDS) return await reject(store, objectName, meta, 'too-short');
    const base = `voices/review/${meta.storyId}/${meta.lang}/${id}`;
    await store.put('state', `${base}.webm`, out.webm, { contentType: 'audio/webm' });
    await store.put('state', `${base}.m4a`, out.m4a, { contentType: 'audio/mp4' });
    const record = { ...meta, duration: Math.round(out.duration), receivedAt: new Date().toISOString() };
    await store.put('state', `${base}.json`, Buffer.from(JSON.stringify(record, null, 2)), { contentType: 'application/json' });
    await store.del('state', `voices/meta/${id}.json`);
    log('INFO', 'recording ready for review', { id, story: meta.storyId, lang: meta.lang, seconds: record.duration });
    return 'ok';
  } finally {
    await store.del('uploads', objectName);
  }
}

async function reject(store, objectName, meta, reason) {
  await store.del('state', `voices/meta/${meta.id}.json`);
  log('WARNING', 'recording rejected', { id: meta.id, reason });
  return reason;
}

function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function createServer(store = makeStore()) {
  return http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/healthz') {
      res.writeHead(200).end('ok');
      return;
    }
    if (req.method !== 'POST') {
      res.writeHead(405).end();
      return;
    }
    try {
      // Eventarc delivers the Cloud Storage object as the JSON body.
      const event = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      const name = event.name || event.data?.name;
      const result = await processUpload(store, name);
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ result }));
    } catch (err) {
      log('ERROR', 'transcode failed', { error: err.message });
      res.writeHead(500).end();
    }
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const port = Number(process.env.PORT || 8082);
  createServer().listen(port, () => log('INFO', `transcoder listening on ${port}`));
}
