// Languages the library can publish in. Adding a language = adding it here
// plus its text in each story file, then a native speaker approves it in the studio.
export const LANGS = {
  // voice: a Google Text-to-Speech voice name to use instead of the automatic
  // pick. Changing it re-narrates that language (and gives the audio new file
  // names, so phones never play an old copy). The words stay approved.
  en: { name: 'English', dir: 'ltr', tts: { languageCode: 'en-GB', speakingRate: 0.9, voice: 'en-GB-Chirp3-HD-Callirrhoe' } },
  ar: { name: 'العربية', dir: 'rtl', tts: { languageCode: 'ar-XA', speakingRate: 0.85 } },
  es: { name: 'Español', dir: 'ltr', tts: { languageCode: 'es-US', speakingRate: 0.9 } },
};

export const env = (key, fallback) => process.env[key] ?? fallback;

export const isCloud = () => env('STORE', 'local') === 'gcs';
