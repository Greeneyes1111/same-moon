# Changing a narration voice

The computer voice for each language is picked automatically (the newest Google
voice tier, female) unless `voice` is set for that language in `shared/config.js`.

## 1. Make samples to choose by ear

From a computer signed in to Google Cloud (`gcloud auth login`):

```bash
git pull
npm ci
TTS_ACCESS_TOKEN=$(gcloud auth print-access-token) GOOGLE_CLOUD_PROJECT=same-moon-stories \
  node tools/voice-samples.js
```

This reads the title and first page of "The Moon Came Too" in the current English
voice and six warm British candidates (Chirp 3 HD: Sulafat, Laomedeia, Aoede,
Vindemiatrix, Callirrhoe, Achird) and writes `voice-samples/<voice>.m4a`.
Name other voices on the command line to try them instead. Nothing is published.

## 2. Switch

1. Set the chosen name as `voice` for the language in `shared/config.js`, run
   `npm test`, commit and push.
2. Deploy: `PROJECT=same-moon-stories REVIEWERS=elsayedspine@gmail.com infra/deploy.sh`.
   This rebuilds the images; its last step runs the publish job, which narrates
   that language again in the new voice.
3. Check the catalogue: every story in that language has new audio file names
   (`…-<hash>-<audioId>.webm`), and the other languages are unchanged.

The words stay approved, so the new narration goes live as soon as the job
finishes: listen to a story or two in the review studio straight after (it shows
the voice name under each player). New file names mean phones never play an old
cached copy; stories a family saved before the change keep the old voice until
they save again.

## Gemini voices (English since 20 Nov 2026)

A voice written `model:Name` in `shared/config.js` (for example
`gemini-2.5-pro-tts:Callirrhoe`) is one of Google's Gemini voices. It reads in the
style given by `prompt` (English: a soft, warm British bedtime voice) and ignores
`speakingRate`. Because the accent comes from the prompt, `check` makes the
publish job send every narrated page to Gemini (`LISTEN_MODEL`, default
`gemini-3.5-flash`) to confirm the accent and that the words are exactly the
approved text; a page that fails is re-recorded, up to 4 tries, and the best take
is kept with a `narration-check-failed` log line. Each story's manifest records
how many pages passed and how many retakes were needed.
