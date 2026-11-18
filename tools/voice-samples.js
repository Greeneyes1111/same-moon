// Short samples of narration voices, so a person can choose one by ear.
//
//   node tools/voice-samples.js                     # English: current voice + warm British candidates
//   node tools/voice-samples.js en-GB-Chirp3-HD-Sulafat en-GB-Chirp3-HD-Aoede
//   node tools/voice-samples.js --lang=ar --story=nest-again
//   node tools/voice-samples.js --tts=fake          # no Google account needed (test tone)
//
// Reads the title and first page of one story in each voice and writes
// voice-samples/<voice>.m4a (plays on any phone). Nothing is published.
// To switch to a voice, set it as `voice` for the language in shared/config.js,
// deploy, and run the publish job: that language is narrated again.
import fs from 'node:fs';
import path from 'node:path';
import { LANGS } from '../shared/config.js';
import { loadStories } from '../shared/stories.js';
import { makeTts } from '../shared/tts.js';
import { renderStory } from '../shared/audio.js';

// Warm, friendly-sounding Chirp 3 HD voices (all British English).
const CANDIDATES = {
  en: ['Sulafat', 'Laomedeia', 'Aoede', 'Vindemiatrix', 'Callirrhoe', 'Achird'].map((n) => `en-GB-Chirp3-HD-${n}`),
};

export async function makeSamples({ tts: kind = 'google', lang = 'en', storyId, names = [], outDir = 'voice-samples' } = {}) {
  const tts = makeTts(kind);
  if (!tts) throw new Error('Use --tts=google or --tts=fake');
  const story = storyId ? loadStories().find((s) => s.id === storyId) : loadStories()[0];
  if (!story?.[lang]) throw new Error(`No ${lang} text for ${storyId || 'the first story'}`);
  const texts = [story[lang].title, story[lang].pages[0]];

  let voices = names.length ? names : CANDIDATES[lang] || [];
  const out = [];
  if (kind === 'google') {
    const available = new Set((await tts.listVoices(LANGS[lang].tts.languageCode)).map((v) => v.name));
    const missing = voices.filter((v) => !available.has(v));
    if (missing.length) console.log(`Not available, skipped: ${missing.join(', ')}`);
    voices = voices.filter((v) => available.has(v));
    if (!names.length) {
      const current = (await tts.voiceFor(lang)).name;
      voices = [current, ...voices.filter((v) => v !== current)];
      console.log(`Current voice: ${current}`);
    }
  }
  fs.mkdirSync(outDir, { recursive: true });
  for (const voiceName of voices) {
    const segments = [];
    for (const text of texts) segments.push((await tts.synth(text, lang, { voiceName })).wav);
    const { m4a, duration } = await renderStory(segments);
    const file = path.join(outDir, `${voiceName}.m4a`);
    fs.writeFileSync(file, m4a);
    out.push({ voice: voiceName, file, seconds: Math.round(duration) });
    console.log(`${voiceName}: ${file} (${Math.round(duration)} s)`);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const opts = { names: [] };
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--tts=')) opts.tts = a.slice(6);
    else if (a.startsWith('--lang=')) opts.lang = a.slice(7);
    else if (a.startsWith('--story=')) opts.storyId = a.slice(8);
    else if (a.startsWith('--out=')) opts.outDir = a.slice(6);
    else opts.names.push(a);
  }
  makeSamples(opts).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
