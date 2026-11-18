# Same Moon

Free bedtime stories, read aloud, for children who have had to leave home.

Try it: https://samemoon.world

Ten short, gentle stories in English, Arabic and Spanish about the things children far from home carry with them: missing people, a new language, a new room, new streets. Each one ends calmly, with a question for the grown-up to ask. There is a breathing exercise for hard nights, and any story that has played once with signal plays again with no internet and no data (families can also save a story without playing it).

No accounts, no adverts, no tracking. Every story and every voice recording is approved by a person before a child can hear it.

Built on Google Cloud Run for the Cloud Run Hackathon, "Build for Good", 20 November 2026.

## What is in this repository

| Folder | What it is |
| --- | --- |
| `stories/` | The stories, one file each, every language side by side |
| `covers/` | Story pictures, drawn in code (2 to 3 KB each) by `tools/make_covers.py` |
| `services/web/` | The public app and its server |
| `services/studio/` | The private review studio |
| `services/transcoder/` | Cleans up volunteer recordings |
| `jobs/publish/` | Narrates drafts privately and publishes what was approved |
| `shared/` | Code the services share: storage, stories, review status, audio, narration |
| `infra/` | Container images and the one-step deploy script |
| `tests/` | 38 tests |

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the pieces fit together.

## Run it on your computer

Needs Node 22 and ffmpeg.

```bash
npm install
npm test
npm run publish:local   # narrates with a test tone and approves everything, locally only
npm run web             # http://localhost:8080
npm run studio          # http://localhost:8081
```

## Deploy

```bash
PROJECT=your-project REVIEWERS=you@example.com infra/deploy.sh
```

## Adding a story or a language

1. Add or edit a file in `stories/`. Every language needs the same number of pages.
2. `npm test` checks the structure and refuses any story that contains words like war, soldier or bomb.
3. Deploy. The publish job narrates the new text privately.
4. A reviewer listens in the studio and approves it. Only then does it appear in the app.

Changing a single word of an approved story takes it out of the app until it is approved again.
