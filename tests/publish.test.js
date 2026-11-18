import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publish } from '../jobs/publish/run.js';
import { loadStories, textHash } from '../shared/stories.js';
import { setStatus, getStatus } from '../shared/status.js';
import { tempStore } from './helpers.js';

const two = loadStories().slice(0, 2);

test('nothing is public until a person approves it, but every draft is narrated privately', async () => {
  const { store, cleanup } = await tempStore();
  try {
    const { catalogue, summary } = await publish({ store, tts: 'fake', stories: two });
    assert.equal(catalogue.stories.length, 0);
    assert.equal(summary.narrated, 6);
    const drafts = await store.list('state', 'audio/');
    assert.equal(drafts.filter((k) => k.endsWith('.webm')).length, 6);
    assert.deepEqual(await store.list('public', 'audio/'), []);
  } finally {
    await cleanup();
  }
});

test('approving one language publishes exactly that, with page timings', async () => {
  const { store, cleanup } = await tempStore();
  try {
    const s = two[0];
    await setStatus(store, s.id, 'ar', { state: 'approved', hash: textHash(s, 'ar'), by: 'test' });
    const { catalogue } = await publish({ store, tts: 'fake', stories: two });
    assert.equal(catalogue.stories.length, 1);
    const entry = catalogue.stories[0];
    assert.deepEqual(Object.keys(entry.langs), ['ar']);
    assert.deepEqual(catalogue.languages, [{ code: 'ar', name: 'العربية', dir: 'rtl' }]);
    const a = entry.langs.ar.audio;
    assert.equal(a.kind, 'computer');
    assert.equal(a.pageStarts.length, s.ar.pages.length);
    for (let i = 1; i < a.pageStarts.length; i++) assert.ok(a.pageStarts[i] > a.pageStarts[i - 1]);
    assert.ok(a.duration > a.pageStarts.at(-1));
    const webm = await store.get('public', a.webm.replace('/media/', ''));
    assert.ok(webm && webm.length > 1000);
    assert.ok(await store.get('public', 'covers/moon.svg'));
  } finally {
    await cleanup();
  }
});

test('editing an approved story takes it out of the app until it is approved again', async () => {
  const { store, cleanup } = await tempStore();
  try {
    const s = structuredClone(two[0]);
    await setStatus(store, s.id, 'en', { state: 'approved', hash: textHash(s, 'en'), by: 'test' });
    let { catalogue } = await publish({ store, tts: 'none', stories: [s] });
    assert.equal(catalogue.stories.length, 1);
    s.en.pages[0] = s.en.pages[0].replace('lemon tree', 'orange tree');
    ({ catalogue } = await publish({ store, tts: 'none', stories: [s] }));
    assert.equal(catalogue.stories.length, 0);
    assert.equal((await getStatus(store, s.id, 'en')).state, 'approved');
  } finally {
    await cleanup();
  }
});

test('a story with a frightening word stops the whole publish', async () => {
  const { store, cleanup } = await tempStore();
  try {
    const s = structuredClone(two[0]);
    s.en.pages[1] += ' Then the bombs fell.';
    await assert.rejects(publish({ store, tts: 'none', stories: [s] }), /bombs/);
  } finally {
    await cleanup();
  }
});

test('choosing a new voice narrates that language again under new file names, and it stays approved', async () => {
  const { store, cleanup } = await tempStore();
  const s = two[0];
  try {
    for (const lang of ['en', 'ar']) await setStatus(store, s.id, lang, { state: 'approved', hash: textHash(s, lang), by: 'test' });
    const before = (await publish({ store, tts: 'fake', stories: [s] })).catalogue.stories[0].langs;

    process.env.TTS_VOICE_EN = 'en-GB-Test-Warm';
    const after = (await publish({ store, tts: 'fake', stories: [s] })).catalogue.stories[0].langs;
    assert.notEqual(after.en.audio.webm, before.en.audio.webm, 'English gets new file names');
    assert.ok(await store.get('public', after.en.audio.webm.replace('/media/', '')), 'new English audio is public');
    assert.equal(after.ar.audio.webm, before.ar.audio.webm, 'Arabic is untouched');
    const manifest = JSON.parse((await store.get('state', `audio/${s.id}/en-${textHash(s, 'en')}.json`)).toString('utf8'));
    assert.equal(manifest.voice, 'en-GB-Test-Warm');

    const again = (await publish({ store, tts: 'fake', stories: [s] })).catalogue.stories[0].langs;
    assert.equal(again.en.audio.webm, after.en.audio.webm, 'not narrated a third time');
  } finally {
    delete process.env.TTS_VOICE_EN;
    await cleanup();
  }
});

test('voice samples can be made without a Google account', async () => {
  const { makeSamples } = await import('../tools/voice-samples.js');
  const fsP = await import('node:fs/promises');
  const os = await import('node:os');
  const dir = await fsP.mkdtemp(`${os.tmpdir()}/samples-`);
  try {
    const out = await makeSamples({ tts: 'fake', names: ['en-GB-A', 'en-GB-B'], outDir: dir });
    assert.deepEqual(out.map((o) => o.voice), ['en-GB-A', 'en-GB-B']);
    for (const o of out) assert.ok((await fsP.stat(o.file)).size > 1000);
  } finally {
    await fsP.rm(dir, { recursive: true, force: true });
  }
});
