// Narration. In production: Google Cloud Text-to-Speech, called from the
// publish job's own service account (no keys anywhere).
import { LANGS, env } from './config.js';
import { fakeSpeech } from './audio.js';

const TTS = 'https://texttospeech.googleapis.com/v1';

// The voice chosen for a language, if any: TTS_VOICE_EN etc., else config.js.
export function chosenVoice(lang) {
  return env(`TTS_VOICE_${lang.toUpperCase()}`) || LANGS[lang]?.tts?.voice || null;
}
const TIERS = ['Chirp3-HD', 'Chirp-HD', 'Neural2', 'Studio', 'Wavenet', 'Standard'];

class GoogleTts {
  constructor() {
    this.voices = {};
    this.authPromise = import('google-auth-library').then(
      ({ GoogleAuth }) => new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }),
    );
  }

  async headers() {
    // TTS_ACCESS_TOKEN lets a person run tools from their own computer:
    //   TTS_ACCESS_TOKEN=$(gcloud auth print-access-token) GOOGLE_CLOUD_PROJECT=... node tools/voice-samples.js
    let token = env('TTS_ACCESS_TOKEN');
    if (!token) ({ token } = await (await (await this.authPromise).getClient()).getAccessToken());
    const h = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const project = env('GOOGLE_CLOUD_PROJECT');
    if (project) h['x-goog-user-project'] = project;
    return h;
  }

  // Pick the best available voice for a language unless one is set in
  // TTS_VOICE_EN / TTS_VOICE_AR. Prefers the newest tier and a female voice.
  async voiceFor(lang) {
    if (this.voices[lang]) return this.voices[lang];
    const { languageCode } = LANGS[lang].tts;
    const pinned = chosenVoice(lang);
    if (pinned) return (this.voices[lang] = parseVoice(pinned, languageCode));
    const res = await fetch(`${TTS}/voices?languageCode=${languageCode}`, { headers: await this.headers() });
    if (!res.ok) throw new Error(`TTS voices ${res.status}: ${await res.text()}`);
    const { voices = [] } = await res.json();
    const rank = (v) => {
      const tier = TIERS.findIndex((t) => v.name.includes(t));
      return (tier === -1 ? 99 : tier) * 2 + (v.ssmlGender === 'FEMALE' ? 0 : 1);
    };
    const best = voices.filter((v) => v.languageCodes.includes(languageCode)).sort((a, b) => rank(a) - rank(b))[0];
    if (!best) throw new Error(`No TTS voice for ${languageCode}`);
    return (this.voices[lang] = { id: best.name, languageCode, name: best.name });
  }

  async listVoices(languageCode) {
    const res = await fetch(`${TTS}/voices?languageCode=${languageCode}`, { headers: await this.headers() });
    if (!res.ok) throw new Error(`TTS voices ${res.status}: ${await res.text()}`);
    const { voices = [] } = await res.json();
    return voices.filter((v) => v.languageCodes.includes(languageCode));
  }

  async synth(text, lang, { voiceName } = {}) {
    const voice = voiceName ? parseVoice(voiceName, LANGS[lang].tts.languageCode) : await this.voiceFor(lang);
    const check = LANGS[lang].tts.check;
    if (!check || !voice.modelName) return this.synthOnce(text, lang, voice);
    // Gemini voices can drift (accent, or a changed word): listen before use.
    let best = null;
    for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
      const r = await this.synthOnce(text, lang, voice);
      const verdict = await this.listen(r.wav, text, check).catch((e) => ({ ok: false, note: `check failed: ${e.message}` }));
      if (verdict.ok) return { ...r, check: { ...verdict, attempt } };
      console.log(JSON.stringify({ msg: 'narration-retry', lang, attempt, text: text.slice(0, 40), ...verdict }));
      if (!best || (verdict.score ?? 0) > (best.check.score ?? 0)) best = { ...r, check: { ...verdict, attempt } };
    }
    console.log(JSON.stringify({ msg: 'narration-check-failed', lang, text: text.slice(0, 60), ...best.check }));
    return best;
  }

  async synthOnce(text, lang, voice) {
    let res;
    for (let attempt = 0; attempt < 5; attempt++) {
      res = await fetch(`${TTS}/text:synthesize`, { method: 'POST', headers: await this.headers(), body: JSON.stringify(requestBody(text, lang, voice, true)) });
      if (res.status === 400 && !voice.modelName) {
        // Some voices do not accept a speaking rate; fall back to their natural pace.
        res = await fetch(`${TTS}/text:synthesize`, { method: 'POST', headers: await this.headers(), body: JSON.stringify(requestBody(text, lang, voice, false)) });
      }
      if (res.status !== 429 && res.status < 500) break;
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
    }
    if (!res.ok) throw new Error(`TTS ${res.status}: ${await res.text()}`);
    const { audioContent } = await res.json();
    return { wav: Buffer.from(audioContent, 'base64'), voice: voice.id };
  }

  // Gemini listens to the narration: is the accent right, and are the words
  // exactly the approved text?
  async listen(wav, text, check) {
    const project = env('GOOGLE_CLOUD_PROJECT') || (await (await this.authPromise).getProjectId());
    const model = env('LISTEN_MODEL', 'gemini-3.5-flash');
    const url = `https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${model}:generateContent`;
    const body = {
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'audio/wav', data: wav.toString('base64') } }, { text: listenPrompt(text, check) }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    };
    let res;
    for (let attempt = 0; attempt < 4; attempt++) {
      res = await fetch(url, { method: 'POST', headers: await this.headers(), body: JSON.stringify(body) });
      if (res.status !== 429 && res.status < 500) break;
      await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
    }
    if (!res.ok) throw new Error(`listen ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    return judgeVerdict(j.candidates?.[0]?.content?.parts?.[0]?.text, check);
  }
}

const MAX_TRIES = 4;

// "gemini-2.5-pro-tts:Callirrhoe" -> a Gemini voice; anything else is a plain voice name.
export function parseVoice(id, languageCode) {
  const i = id.indexOf(':');
  if (i === -1) return { id, languageCode, name: id };
  return { id, languageCode, name: id.slice(i + 1), modelName: id.slice(0, i) };
}

export function requestBody(text, lang, voice, withRate) {
  const { prompt, speakingRate } = LANGS[lang].tts;
  const v = { languageCode: voice.languageCode, name: voice.name, ...(voice.modelName ? { modelName: voice.modelName } : {}) };
  return {
    input: voice.modelName && prompt ? { text, prompt } : { text },
    voice: v,
    audioConfig: {
      audioEncoding: 'LINEAR16',
      sampleRateHertz: 24000,
      ...(withRate && !voice.modelName ? { speakingRate } : {}),
    },
  };
}

export function listenPrompt(text, check) {
  return [
    'You are checking a narration for a children\'s bedtime story app before it is published.',
    `1. Accent: would a ${check.accent} listener hear a ${check.accent} accent? Judge strictly.`,
    '2. Words: does the audio say exactly this text, with no word added, missing or changed? Ignore punctuation and pauses.',
    `TEXT: """${text}"""`,
    'Reply with JSON only: {"accent": "<accent heard>", "accent_confidence": 0-100, "words_match": true|false, "differences": "<empty if none>"}',
  ].join('\n');
}

// Turns Gemini's reply into ok / not ok, with a score to keep the best take.
export function judgeVerdict(raw, check) {
  let j;
  try { j = JSON.parse(String(raw).replace(/^```(json)?|```$/g, '').trim()); } catch { return { ok: false, score: 0, note: 'unreadable verdict' }; }
  const accentOk = String(j.accent || '').toLowerCase().includes(check.accent.toLowerCase()) && Number(j.accent_confidence) >= 70;
  const wordsOk = j.words_match === true;
  return {
    ok: accentOk && wordsOk,
    score: (accentOk ? 2 : 0) + (wordsOk ? 1 : 0) + Number(j.accent_confidence || 0) / 1000,
    accent: j.accent, confidence: j.accent_confidence, wordsMatch: wordsOk, differences: j.differences || '',
  };
}

class FakeTts {
  async synth(text, lang, { voiceName } = {}) {
    return { wav: await fakeSpeech(text), voice: voiceName || chosenVoice(lang) || 'test-tone' };
  }
}

export function makeTts(kind) {
  if (kind === 'google') return new GoogleTts();
  if (kind === 'fake') return new FakeTts();
  return null;
}
