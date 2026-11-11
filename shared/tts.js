// Narration. In production: Google Cloud Text-to-Speech, called from the
// publish job's own service account (no keys anywhere).
import { LANGS, env } from './config.js';
import { fakeSpeech } from './audio.js';

const TTS = 'https://texttospeech.googleapis.com/v1';
const TIERS = ['Chirp3-HD', 'Chirp-HD', 'Neural2', 'Studio', 'Wavenet', 'Standard'];

class GoogleTts {
  constructor() {
    this.voices = {};
    this.authPromise = import('google-auth-library').then(
      ({ GoogleAuth }) => new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }),
    );
  }

  async headers() {
    const client = await (await this.authPromise).getClient();
    const { token } = await client.getAccessToken();
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
    const pinned = env(`TTS_VOICE_${lang.toUpperCase()}`);
    if (pinned) return (this.voices[lang] = { languageCode, name: pinned });
    const res = await fetch(`${TTS}/voices?languageCode=${languageCode}`, { headers: await this.headers() });
    if (!res.ok) throw new Error(`TTS voices ${res.status}: ${await res.text()}`);
    const { voices = [] } = await res.json();
    const rank = (v) => {
      const tier = TIERS.findIndex((t) => v.name.includes(t));
      return (tier === -1 ? 99 : tier) * 2 + (v.ssmlGender === 'FEMALE' ? 0 : 1);
    };
    const best = voices.filter((v) => v.languageCodes.includes(languageCode)).sort((a, b) => rank(a) - rank(b))[0];
    if (!best) throw new Error(`No TTS voice for ${languageCode}`);
    return (this.voices[lang] = { languageCode, name: best.name });
  }

  async synth(text, lang) {
    const voice = await this.voiceFor(lang);
    const body = (withRate) => JSON.stringify({
      input: { text },
      voice,
      audioConfig: {
        audioEncoding: 'LINEAR16',
        sampleRateHertz: 24000,
        ...(withRate ? { speakingRate: LANGS[lang].tts.speakingRate } : {}),
      },
    });
    let res = await fetch(`${TTS}/text:synthesize`, { method: 'POST', headers: await this.headers(), body: body(true) });
    if (res.status === 400) {
      // Some voices do not accept a speaking rate; fall back to their natural pace.
      res = await fetch(`${TTS}/text:synthesize`, { method: 'POST', headers: await this.headers(), body: body(false) });
    }
    if (!res.ok) throw new Error(`TTS ${res.status}: ${await res.text()}`);
    const { audioContent } = await res.json();
    return { wav: Buffer.from(audioContent, 'base64'), voice: voice.name };
  }
}

class FakeTts {
  async synth(text) {
    return { wav: await fakeSpeech(text), voice: 'test-tone' };
  }
}

export function makeTts(kind) {
  if (kind === 'google') return new GoogleTts();
  if (kind === 'fake') return new FakeTts();
  return null;
}
