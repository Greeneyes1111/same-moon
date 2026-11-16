import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../services/studio/server.js';
import { loadStories, textHash } from '../shared/stories.js';
import { getStatus } from '../shared/status.js';
import { tempStore, listen } from './helpers.js';

async function setup() {
  const t = await tempStore();
  const calls = [];
  const srv = await listen(createServer({ store: t.store, stories: loadStories(), publish: async () => calls.push(1) }));
  return { ...t, ...srv, calls };
}

const form = (obj) => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'sec-fetch-site': 'same-origin' }, body: new URLSearchParams(obj), redirect: 'manual' });

test('the dashboard lists every story in every language', async () => {
  const s = await setup();
  try {
    const html = await (await fetch(`${s.base}/`)).text();
    assert.equal((html.match(/Waiting for review/g) || []).length, 30);
  } finally {
    await s.close();
    await s.cleanup();
  }
});

test('approving records the exact text version and starts publishing', async () => {
  const s = await setup();
  try {
    const res = await fetch(`${s.base}/story/nest-again/ar/approve`, form({}));
    assert.equal(res.status, 303);
    const st = await getStatus(s.store, 'nest-again', 'ar');
    assert.equal(st.state, 'approved');
    assert.equal(st.hash, textHash(loadStories().find((x) => x.id === 'nest-again'), 'ar'));
    assert.equal(s.calls.length, 1);
  } finally {
    await s.close();
    await s.cleanup();
  }
});

test('asking for changes keeps the note', async () => {
  const s = await setup();
  try {
    await fetch(`${s.base}/story/the-brave-box/en/changes`, form({ note: 'Make Wednesday gentler' }));
    const st = await getStatus(s.store, 'the-brave-box', 'en');
    assert.equal(st.state, 'changes');
    assert.equal(st.note, 'Make Wednesday gentler');
  } finally {
    await s.close();
    await s.cleanup();
  }
});

test('forms posted from another site are refused', async () => {
  const s = await setup();
  try {
    const res = await fetch(`${s.base}/story/nest-again/ar/approve`, { ...form({}), headers: { 'sec-fetch-site': 'cross-site' } });
    assert.equal(res.status, 403);
    assert.equal((await getStatus(s.store, 'nest-again', 'ar')).state, 'draft');
  } finally {
    await s.close();
    await s.cleanup();
  }
});

test('in the cloud, only listed reviewers get in', async () => {
  const s = await setup();
  const prev = { STORE: process.env.STORE, REVIEWERS: process.env.REVIEWERS };
  process.env.STORE = 'gcs';
  process.env.REVIEWERS = 'reviewer@example.com';
  try {
    assert.equal((await fetch(`${s.base}/`)).status, 403);
    assert.equal((await fetch(`${s.base}/`, { headers: { 'x-goog-authenticated-user-email': 'accounts.google.com:someone@example.com' } })).status, 403);
    assert.equal((await fetch(`${s.base}/`, { headers: { 'x-goog-authenticated-user-email': 'accounts.google.com:Reviewer@example.com' } })).status, 200);
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await s.close();
    await s.cleanup();
  }
});

test('password mode asks for a password and accepts only the right one', async () => {
  const s = await setup();
  const prev = { STORE: process.env.STORE, STUDIO_AUTH: process.env.STUDIO_AUTH, STUDIO_PASSWORD: process.env.STUDIO_PASSWORD };
  Object.assign(process.env, { STORE: 'gcs', STUDIO_AUTH: 'password', STUDIO_PASSWORD: 'moon light 42' });
  const basic = (u, p) => ({ authorization: `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}` });
  try {
    const none = await fetch(`${s.base}/`);
    assert.equal(none.status, 401);
    assert.match(none.headers.get('www-authenticate'), /Basic/);
    assert.equal((await fetch(`${s.base}/`, { headers: basic('Sherief', 'wrong') })).status, 401);
    const ok = await fetch(`${s.base}/`, { headers: basic('Sherief', 'moon light 42') });
    assert.equal(ok.status, 200);
    assert.match(await ok.text(), /Sherief/);
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await s.close();
    await s.cleanup();
  }
});

test('volunteer recordings are listed for review and can be rejected', async () => {
  const s = await setup();
  try {
    const id = '11111111-2222-3333-4444-555555555555';
    const base = `voices/review/nest-again/ar/${id}`;
    await s.store.put('state', `${base}.json`, Buffer.from(JSON.stringify({ id, storyId: 'nest-again', lang: 'ar', credit: 'Amal', duration: 90 })));
    await s.store.put('state', `${base}.webm`, Buffer.from('x'));
    await s.store.put('state', `${base}.m4a`, Buffer.from('x'));
    assert.match(await (await fetch(`${s.base}/voices`)).text(), /Amal/);
    await fetch(`${s.base}/voices/reject`, form({ key: `${base}.json` }));
    assert.deepEqual(await s.store.list('state', 'voices/'), []);
  } finally {
    await s.close();
    await s.cleanup();
  }
});
