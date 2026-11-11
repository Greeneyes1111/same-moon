import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../services/web/server.js';
import { loadStories } from '../shared/stories.js';
import { tempStore, listen, toneWav } from './helpers.js';

async function setup() {
  const t = await tempStore();
  await t.store.put('public', 'catalogue.json', Buffer.from(JSON.stringify({ languages: [], stories: [] })));
  await t.store.put('public', 'audio/x/en-abc.webm', Buffer.from('0123456789'));
  const srv = await listen(createServer({ store: t.store, stories: loadStories() }));
  return { ...t, ...srv };
}

test('serves the app with a strict content security policy and no cookies', async () => {
  const s = await setup();
  try {
    const res = await fetch(`${s.base}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
    assert.equal(res.headers.get('set-cookie'), null);
    assert.match(await res.text(), /Same Moon/);
    const sw = await (await fetch(`${s.base}/sw.js`)).text();
    assert.ok(!sw.includes('__BUILD__'));
  } finally {
    await s.close();
    await s.cleanup();
  }
});

test('serves the catalogue and audio, with byte ranges for phones', async () => {
  const s = await setup();
  try {
    assert.equal((await fetch(`${s.base}/api/catalogue`)).status, 200);
    const full = await fetch(`${s.base}/media/audio/x/en-abc.webm`);
    assert.equal(full.status, 200);
    assert.match(full.headers.get('cache-control'), /immutable/);
    const part = await fetch(`${s.base}/media/audio/x/en-abc.webm`, { headers: { range: 'bytes=2-5' } });
    assert.equal(part.status, 206);
    assert.equal(await part.text(), '2345');
    assert.equal(part.headers.get('content-range'), 'bytes 2-5/10');
  } finally {
    await s.close();
    await s.cleanup();
  }
});

test('refuses paths outside the published media', async () => {
  const s = await setup();
  try {
    for (const p of ['/media/../state/status/x.json', '/media/%2e%2e/catalogue.json', '/media/status/x.json', '/media/catalogue.json']) {
      assert.equal((await fetch(`${s.base}${p}`)).status, 404, p);
    }
  } finally {
    await s.close();
    await s.cleanup();
  }
});

test('a volunteer recording needs both boxes ticked and a real story', async () => {
  const s = await setup();
  try {
    const post = (body) => fetch(`${s.base}/api/voices`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await post({ storyId: 'nest-again', lang: 'ar', adult: true, consent: false, mime: 'audio/webm' })).status, 400);
    assert.equal((await post({ storyId: 'no-such-story', lang: 'ar', adult: true, consent: true, mime: 'audio/webm' })).status, 400);
    assert.equal((await post({ storyId: 'nest-again', lang: 'ar', adult: true, consent: true, mime: 'text/html' })).status, 400);
  } finally {
    await s.close();
    await s.cleanup();
  }
});

test('a volunteer recording goes to private review, never to the public library', async () => {
  const s = await setup();
  try {
    const res = await fetch(`${s.base}/api/voices`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ storyId: 'nest-again', lang: 'ar', dialect: 'Sudanese <b>Arabic</b>', credit: 'Amal', adult: true, consent: true, mime: 'audio/wav' }),
    });
    assert.equal(res.status, 200);
    const { upload } = await res.json();
    const put = await fetch(`${s.base}${upload.url}`, { method: 'PUT', headers: upload.headers, body: await toneWav(20) });
    assert.equal((await put.json()).result, 'ok');
    const review = await s.store.list('state', 'voices/review/nest-again/ar/');
    assert.equal(review.length, 3);
    const meta = JSON.parse((await s.store.get('state', review.find((k) => k.endsWith('.json')))).toString());
    assert.equal(meta.credit, 'Amal');
    assert.equal(meta.dialect, 'Sudanese bArabic/b');
    assert.deepEqual(await s.store.list('uploads'), []);
    assert.deepEqual(await s.store.list('public', 'voices/'), []);
  } finally {
    await s.close();
    await s.cleanup();
  }
});

test('a recording that is too short is rejected and deleted', async () => {
  const s = await setup();
  try {
    const { upload } = await (await fetch(`${s.base}/api/voices`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ storyId: 'nest-again', lang: 'en', adult: true, consent: true, mime: 'audio/wav' }),
    })).json();
    const put = await fetch(`${s.base}${upload.url}`, { method: 'PUT', headers: upload.headers, body: await toneWav(4) });
    assert.equal((await put.json()).result, 'too-short');
    assert.deepEqual(await s.store.list('state', 'voices/'), []);
    assert.deepEqual(await s.store.list('uploads'), []);
  } finally {
    await s.close();
    await s.cleanup();
  }
});
