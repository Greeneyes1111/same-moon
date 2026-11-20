// The anonymous counter: what is counted, that nothing about a person is kept,
// and that counts are never lost or counted twice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Counter, readTotals } from '../shared/counter.js';
import { createServer as createWeb } from '../services/web/server.js';
import { createServer as createStudio } from '../services/studio/server.js';
import { loadStories } from '../shared/stories.js';
import { tempStore, listen } from './helpers.js';

const STORY = loadStories()[0].id;
const day = (d) => d.toISOString().slice(0, 10);

test('counts are written as small files of totals, and a failed write is retried, not lost', async () => {
  const t = await tempStore();
  try {
    let failNext = true;
    const flaky = {
      put: async (...a) => {
        if (failNext) { failNext = false; throw new Error('storage down'); }
        return t.store.put(...a);
      },
    };
    const c = new Counter(flaky, { flushMs: 1e9 });
    c.add('open');
    c.add('open');
    c.add('play', STORY, 'en');
    c.add('not-an-event');
    await c.flush();
    assert.deepEqual(await t.store.list('state', 'stats/'), [], 'first write failed');
    c.add('newPhone');
    await c.close();
    const keys = await t.store.list('state', 'stats/');
    assert.equal(keys.length, 1);
    const saved = JSON.parse((await t.store.get('state', keys[0])).toString());
    assert.deepEqual(saved, { open: 2, newPhone: 1, saveAll: 0, play: { [`${STORY}|en`]: 1 }, save: {} });
    assert.ok(!/ip|address|agent|cookie/i.test(JSON.stringify(saved)));
  } finally {
    await t.cleanup();
  }
});

test('the studio adds up every file, and folds finished days into one', async () => {
  const t = await tempStore();
  try {
    const now = new Date('2026-11-25T10:00:00Z');
    const put = (d, name, obj) => t.store.put('state', `stats/${d}/${name}.json`, Buffer.from(JSON.stringify(obj)));
    await put('2026-11-20', 'a-00001', { open: 3, newPhone: 2, saveAll: 0, play: { [`${STORY}|en`]: 2 }, save: {} });
    await put('2026-11-20', 'b-00001', { open: 1, newPhone: 0, saveAll: 1, play: { [`${STORY}|en`]: 1, [`${STORY}|ar`]: 4 }, save: {} });
    await put('2026-11-20', 'logs-backfill', { source: 'google-request-log', open: 10, audioDownloads: 7 });
    await put('2026-11-25', 'c-00001', { open: 5, newPhone: 1, saveAll: 0, play: {}, save: {} });
    await put('2026-11-25', 'c-00002', { open: 1, newPhone: 0, saveAll: 0, play: {}, save: { [`${STORY}|es`]: 1 } });

    const first = await readTotals(t.store, { days: 14, now });
    const d20 = first.find((d) => d.day === '2026-11-20');
    assert.equal(d20.open, 14);
    assert.equal(d20.newPhone, 2);
    assert.equal(d20.saveAll, 1);
    assert.deepEqual(d20.play, { [`${STORY}|en`]: 3, [`${STORY}|ar`]: 4 });
    assert.equal(d20.audioDownloads, 7);
    assert.equal(first.find((d) => d.day === '2026-11-25').open, 6);

    // 20 Nov is over: its two files became one; the log figures stay separate.
    assert.deepEqual(await t.store.list('state', 'stats/2026-11-20/'),
      ['stats/2026-11-20/day.json', 'stats/2026-11-20/logs-backfill.json']);
    // Today is still being counted, so it is left alone.
    assert.equal((await t.store.list('state', 'stats/2026-11-25/')).length, 2);
    // Folding changes nothing in the totals.
    assert.deepEqual(await readTotals(t.store, { days: 14, now }), first);
  } finally {
    await t.cleanup();
  }
});

test('the web app counts opens, new phones, plays and saves, and nothing else', async () => {
  const t = await tempStore();
  await t.store.put('public', 'catalogue.json', Buffer.from(JSON.stringify({ languages: [], stories: [] })));
  const counter = new Counter(t.store, { flushMs: 1e9 });
  const s = await listen(createWeb({ store: t.store, stories: loadStories(), counter }));
  try {
    await fetch(`${s.base}/api/catalogue`);
    await fetch(`${s.base}/api/catalogue?first=1`);
    await fetch(`${s.base}/api/catalogue?sw=1`);
    await fetch(`${s.base}/`);
    const post = (body) => fetch(`${s.base}/api/count`, { method: 'POST', body: JSON.stringify(body) });
    const ok = await post({ e: 'play', story: STORY, lang: 'en' });
    assert.equal(ok.status, 204);
    assert.equal(ok.headers.get('set-cookie'), null);
    assert.equal((await post({ e: 'save', story: STORY, lang: 'ar' })).status, 204);
    assert.equal((await post({ e: 'saveAll' })).status, 204);
    assert.equal((await post({ e: 'play', story: 'no-such-story', lang: 'en' })).status, 400);
    assert.equal((await post({ e: 'play', story: STORY, lang: 'xx' })).status, 400);
    assert.equal((await post({ e: 'whoami', id: 'abc' })).status, 400);
    assert.equal((await fetch(`${s.base}/api/count`, { method: 'POST', body: 'not json' })).status, 400);
    await counter.flush();
    const [key] = await t.store.list('state', 'stats/');
    assert.match(key, new RegExp(`^stats/${day(new Date())}/`));
    assert.deepEqual(JSON.parse((await t.store.get('state', key)).toString()), {
      open: 1, newPhone: 1, saveAll: 1, play: { [`${STORY}|en`]: 1 }, save: { [`${STORY}|ar`]: 1 },
    });
  } finally {
    await s.close();
    await t.cleanup();
  }
});

test('one connection cannot run up the totals', async () => {
  const t = await tempStore();
  const counter = new Counter(t.store, { flushMs: 1e9 });
  const s = await listen(createWeb({ store: t.store, stories: loadStories(), counter }));
  try {
    for (let i = 0; i < 320; i++) {
      await fetch(`${s.base}/api/count`, { method: 'POST', body: JSON.stringify({ e: 'saveAll' }) });
    }
    assert.equal(counter.pending[day(new Date())].saveAll, 300);
  } finally {
    await s.close();
    await t.cleanup();
  }
});

test('the studio shows the numbers', async () => {
  const t = await tempStore();
  const s = await listen(createStudio({ store: t.store, stories: loadStories(), publish: async () => {} }));
  try {
    const today = day(new Date());
    await t.store.put('state', `stats/${today}/x-00001.json`,
      Buffer.from(JSON.stringify({ open: 42, newPhone: 17, saveAll: 3, play: { [`${STORY}|ar`]: 9 }, save: {} })));
    const html = await (await fetch(`${s.base}/stats`)).text();
    assert.match(html, /42 app opens · 17 new phones · 9 story plays · 3 saves for offline/);
    assert.match(html, /9 plays/);
  } finally {
    await s.close();
    await t.cleanup();
  }
});
