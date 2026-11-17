# Product Hunt launch: Same Moon

Launch day: Friday 20 November 2026 (goes live 00:01 Pacific = 12:01 Dubai).
Contest: Google Cloud Run Hackathon, "Build for Good". Scheduled and opted in on 16 November. Spanish added 17 November.

## Name
Same Moon

## Tagline (60 characters max)
Free bedtime stories for children who had to leave home

## Description (256 of 260 characters)
Gentle bedtime stories in English, Arabic and Spanish for refugee and displaced children, read aloud and built for cheap phones: tiny first load, works offline, no sign-up, no tracking. A person approves every story and every voice before a child hears it.

## Topics
Kids, Education, Charity & Giving

## Links
- App: https://web-qdzmk3s3cq-ew.a.run.app
- Source and architecture: https://github.com/Greeneyes1111/same-moon

## Gallery (1270 x 760)
1. The library in English
2. A story playing, with the page being read highlighted
3. Three languages: Arabic (right to left) and Spanish side by side
4. The Calm breathing exercise
5. The review studio: nothing goes live until a person approves it
6. Architecture on Cloud Run

## Maker's first comment

Hi Product Hunt. I'm Sherief, a spine surgeon in Dubai. I've been on surgical missions in Lesbos, the Bekaa Valley and Cox's Bazar.

For a child who has had to leave home, bedtime can be the hardest part of the day: a new room, strange sounds, people they miss. Same Moon is a small, free library of bedtime stories for those children. Ten short stories in English, Arabic and Spanish about the things they carry: missing a grandparent, a new language, a new room, a new street. Each one ends calmly, with a question for the grown-up to ask. There's a breathing exercise for hard nights.

It's built for the phones refugee families actually have:
- The first visit is about 50 KB. After one visit with signal, it opens with none.
- Tap "Save for offline" and a story plays with no data.
- No accounts, no adverts, no tracking.

And nothing reaches a child unless a person has checked it. Every story and every voice recording is approved in a private review studio. Change one word and the story comes down until it's approved again. A word guard rejects any story that mentions war, soldiers or borders.

On Cloud Run:
- **web**: a public service that scales to zero, serving the app, the stories and the audio.
- **publish**: a Cloud Run job that narrates every draft privately with Cloud Text-to-Speech, joins the pages, evens out the loudness and squeezes each story to about 250 KB, then publishes only what a person approved.
- **studio**: the password-protected review studio.
- **transcoder**: triggered by Eventarc when a volunteer uploads a recording; it cleans the audio up and files it for review, then deletes the original.

Each service runs as its own service account with only the access it needs. The public service can't even read the private bucket.

Two asks:
1. If you speak another language or accent, there's a "Record a story" page. Adults only, and every recording is reviewed before anyone hears it.
2. If you work with refugee children, tell me what would make this useful in your sessions.

Thank you for reading.
