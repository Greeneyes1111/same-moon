// Languages the library can publish in. Adding a language = adding it here
// plus its text in each story file, then a native speaker approves it in the studio.
export const LANGS = {
  // voice: a Google Text-to-Speech voice name to use instead of the automatic
  // pick. Changing it re-narrates that language (and gives the audio new file
  // names, so phones never play an old copy). The words stay approved.
  //
  // A voice written "model:Name" (e.g. gemini-2.5-pro-tts:Callirrhoe) is one of
  // Google's Gemini voices: it reads with the style in prompt, ignores
  // speakingRate, and with check set every page is listened to by Gemini before
  // use (right accent, exactly the approved words) and re-recorded if it fails.
  en: {
    name: 'English', dir: 'ltr',
    tts: {
      languageCode: 'en-GB', speakingRate: 0.9,
      voice: 'gemini-2.5-pro-tts:Callirrhoe',
      prompt: 'Read this aloud in a soft, warm British English accent, the accent of a gentle mother from the south of England reading a bedtime story to a young child. Not American. Speak softly and unhurriedly, with natural pauses.',
      check: { accent: 'British' },
    },
  },
  ar: { name: 'العربية', dir: 'rtl', tts: { languageCode: 'ar-XA', speakingRate: 0.85 } },
  es: { name: 'Español', dir: 'ltr', tts: { languageCode: 'es-US', speakingRate: 0.9 } },
};

export const env = (key, fallback) => process.env[key] ?? fallback;

export const isCloud = () => env('STORE', 'local') === 'gcs';
