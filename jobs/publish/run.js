// Cloud Run job: narrate and publish.
//
// 1. Render: every story in every language gets narrated into PRIVATE storage,
//    so a reviewer can listen before approving (once per version of the text).
// 2. Publish: only stories a person approved, for this exact text, are copied
//    to the PUBLIC bucket, along with approved volunteer recordings.
// 3. Catalogue: writes the catalogue the app reads.
//
// Flags: --tts=google|fake|none   --approve-all (local development only)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { LANGS, isCloud } from '../../shared/config.js';
import { makeStore } from '../../shared/store.js';
import { loadStories, storyLangs, textHash, minutesFor, validateStory, COVERS_DIR } from '../../shared/stories.js';
import { getStatus, setStatus, isApproved } from '../../shared/status.js';
import { makeTts, chosenVoice } from '../../shared/tts.js';
import { renderStory } from '../../shared/audio.js';

const IMMUTABLE = 'public, max-age=31536000, immutable';
const log = (msg, extra = {}) => console.log(JSON.stringify({ severity: 'INFO', message: msg, ...extra }));

function parseArgs(argv) {
  const args = { tts: process.env.TTS || 'none', approveAll: false };
  for (const a of argv) {
    if (a.startsWith('--tts=')) args.tts = a.slice(6);
    if (a === '--approve-all') args.approveAll = true;
  }
  return args;
}

// Narration for this text. It is redone when the words change (new hash) or
// when a different voice has been chosen for the language.
async function ensureNarration(store, tts, story, lang, hash) {
  const base = `audio/${story.id}/${lang}-${hash}`;
  const existing = await store.get('state', `${base}.json`);
  const manifest0 = existing ? JSON.parse(existing.toString('utf8')) : null;
  const wanted = chosenVoice(lang);
  if (manifest0 && (!wanted || manifest0.voice === wanted)) return manifest0;
  if (!tts) return manifest0;
  const t = story[lang];
  const segments = [];
  let voice = null;
  for (const text of [t.title, ...t.pages]) {
    const r = await tts.synth(text, lang);
    segments.push(r.wav);
    voice = r.voice;
  }
  const out = await renderStory(segments);
  await store.put('state', `${base}.webm`, out.webm, { contentType: 'audio/webm' });
  await store.put('state', `${base}.m4a`, out.m4a, { contentType: 'audio/mp4' });
  const manifest = {
    hash,
    voice,
    // Names the public copy, so a re-narration never reuses a cached file name.
    audioId: crypto.createHash('sha256').update(String(voice)).update(out.webm).update(out.m4a).digest('hex').slice(0, 8),
    duration: Math.round(out.duration * 10) / 10,
    pageStarts: out.pageStarts,
    bytes: { webm: out.webm.length, m4a: out.m4a.length },
    createdAt: new Date().toISOString(),
  };
  await store.put('state', `${base}.json`, Buffer.from(JSON.stringify(manifest, null, 2)), { contentType: 'application/json' });
  log('narrated', { story: story.id, lang, voice, seconds: manifest.duration, kb: Math.round(out.webm.length / 1024) });
  return manifest;
}

async function publishFile(store, fromKey, toKey, contentType) {
  if (!(await store.exists('public', toKey))) {
    await store.copy('state', fromKey, 'public', toKey, { contentType, cacheControl: IMMUTABLE });
  }
  return `/media/${toKey}`;
}

async function approvedVoices(store, story, lang) {
  const prefix = `voices/approved/${story.id}/${lang}/`;
  const keys = (await store.list('state', prefix)).filter((k) => k.endsWith('.json'));
  const out = [];
  for (const k of keys) {
    const rec = JSON.parse((await store.get('state', k)).toString('utf8'));
    const src = k.slice(0, -'.json'.length);
    out.push({
      id: rec.id,
      credit: rec.credit || null,
      dialect: rec.dialect || null,
      duration: rec.duration,
      webm: await publishFile(store, `${src}.webm`, `voices/${rec.id}.webm`, 'audio/webm'),
      m4a: await publishFile(store, `${src}.m4a`, `voices/${rec.id}.m4a`, 'audio/mp4'),
    });
  }
  return out;
}

export async function publish({ tts: ttsKind = 'none', approveAll = false, store = makeStore(), stories = loadStories() } = {}) {
  if (approveAll && isCloud()) throw new Error('--approve-all is for local development only');
  const errors = stories.flatMap(validateStory);
  if (errors.length) throw new Error(`Story checks failed:\n${errors.join('\n')}`);

  const tts = makeTts(ttsKind);
  const catalogue = { generatedAt: new Date().toISOString(), languages: [], stories: [] };
  const usedLangs = new Set();
  const summary = { narrated: 0, published: 0, waiting: 0 };

  for (const story of stories) {
    const entry = { id: story.id, order: story.order, cover: `/media/covers/${story.cover}.svg`, langs: {} };
    for (const lang of storyLangs(story)) {
      const hash = textHash(story, lang);
      if (approveAll) await setStatus(store, story.id, lang, { state: 'approved', hash, by: 'local-dev' });

      const narration = await ensureNarration(store, tts, story, lang, hash);
      if (narration) summary.narrated++;

      if (!isApproved(await getStatus(store, story.id, lang), hash)) {
        summary.waiting++;
        continue;
      }
      const t = story[lang];
      let audio = null;
      if (narration) {
        const base = `audio/${story.id}/${lang}-${hash}`;
        // Audio narrated before audioId existed keeps its old public name.
        const pub = narration.audioId ? `${base}-${narration.audioId}` : base;
        audio = {
          kind: 'computer',
          webm: await publishFile(store, `${base}.webm`, `${pub}.webm`, 'audio/webm'),
          m4a: await publishFile(store, `${base}.m4a`, `${pub}.m4a`, 'audio/mp4'),
          duration: narration.duration,
          pageStarts: narration.pageStarts,
        };
      }
      entry.langs[lang] = {
        title: t.title,
        theme: story.theme[lang],
        pages: t.pages,
        grownUp: t.grownUp,
        minutes: minutesFor(story, lang),
        audio,
        voices: await approvedVoices(store, story, lang),
      };
      usedLangs.add(lang);
      summary.published++;
    }
    if (Object.keys(entry.langs).length) catalogue.stories.push(entry);
  }

  for (const file of fs.readdirSync(COVERS_DIR).filter((f) => f.endsWith('.svg'))) {
    await store.put('public', `covers/${file}`, fs.readFileSync(path.join(COVERS_DIR, file)), {
      contentType: 'image/svg+xml',
      cacheControl: 'public, max-age=86400',
    });
  }

  catalogue.languages = Object.keys(LANGS)
    .filter((l) => usedLangs.has(l))
    .map((code) => ({ code, name: LANGS[code].name, dir: LANGS[code].dir }));
  await store.put('public', 'catalogue.json', Buffer.from(JSON.stringify(catalogue)), {
    contentType: 'application/json',
    cacheControl: 'no-cache',
  });
  log('published', summary);
  return { catalogue, summary };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  publish(parseArgs(process.argv.slice(2))).catch((err) => {
    console.error(JSON.stringify({ severity: 'ERROR', message: err.message }));
    process.exit(1);
  });
}
