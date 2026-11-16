// Languages the library can publish in. Adding a language = adding it here
// plus its text in each story file, then a native speaker approves it in the studio.
export const LANGS = {
  en: { name: 'English', dir: 'ltr', tts: { languageCode: 'en-GB', speakingRate: 0.9 } },
  ar: { name: 'العربية', dir: 'rtl', tts: { languageCode: 'ar-XA', speakingRate: 0.85 } },
  es: { name: 'Español', dir: 'ltr', tts: { languageCode: 'es-US', speakingRate: 0.9 } },
};

export const env = (key, fallback) => process.env[key] ?? fallback;

export const isCloud = () => env('STORE', 'local') === 'gcs';
