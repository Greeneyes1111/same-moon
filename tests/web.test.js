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

test('a story idea goes to the private bucket only, and spam is quietly dropped', async () => {
  const s = await setup();
  try {
    const post = (body) => fetch(`${s.base}/api/ideas`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const good = { idea: 'A story about the first\r\nday at a <b>new</b> school.', langs: ['ar', 'xx'], otherLang: 'Tigrinya', place: 'Cairo',
      role: 'teacher', name: 'Amal', email: 'amal@example.org', adult: true, consent: true, pageLang: 'ar' };
    assert.equal((await post({ ...good, consent: false })).status, 400);
    assert.equal((await post({ ...good, idea: 'short' })).status, 400);
    assert.equal((await post({ ...good, email: 'not an email' })).status, 400);
    assert.equal((await post({ ...good, website: 'http://spam.example' })).status, 200);
    assert.deepEqual(await s.store.list('state', 'ideas/'), []);
    assert.equal((await post(good)).status, 200);
    const keys = await s.store.list('state', 'ideas/new/');
    assert.equal(keys.length, 1);
    const rec = JSON.parse((await s.store.get('state', keys[0])).toString());
    assert.equal(rec.idea, 'A story about the first\nday at a bnew/b school.');
    assert.deepEqual(rec.langs, ['ar']);
    assert.equal(rec.email, 'amal@example.org');
    assert.equal(rec.role, 'teacher');
    assert.deepEqual(await s.store.list('public', 'ideas/'), []);
  } finally {
    await s.close();
    await s.cleanup();
  }
});

test('story ideas are limited to a few an hour from one address', async () => {
  const s = await setup();
  try {
    const post = () => fetch(`${s.base}/api/ideas`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idea: 'A gentle story about a new street.', adult: true, consent: true }) });
    for (let i = 0; i < 5; i++) assert.equal((await post()).status, 200);
    assert.equal((await post()).status, 429);
  } finally {
    await s.close();
    await s.cleanup();
  }
});
