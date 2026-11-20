// Anonymous daily totals. Same Moon counts things that happen, never who does
// them: no addresses, cookies or device IDs are stored or logged, and nothing
// is counted while a phone is offline.
//
//   open      the app was opened with signal (it asked for the story list)
//   newPhone  the app was set up on a phone for the first time
//   play      a story started playing (per story and language)
//   save      one story was saved for offline (per story and language)
//   saveAll   "Save all stories for offline" finished
//
// Each web instance keeps its counts in memory and, every few minutes, writes
// what it counted since last time as a new small file in the private bucket:
// stats/<UTC day>/<instance>-<n>.json. The web service can only create files
// there (it cannot read or change them). The studio adds them up and, for days
// that are over, folds each day's files into one (stats/<day>/day.json).

import crypto from 'node:crypto';

export const COUNTED = ['open', 'newPhone', 'play', 'save', 'saveAll'];
const PER_STORY = ['play', 'save'];

const log = (severity, message, extra = {}) => console.log(JSON.stringify({ severity, message, ...extra }));
export const utcDay = (d) => d.toISOString().slice(0, 10);

export function emptyTotals() {
  return { open: 0, newPhone: 0, saveAll: 0, play: {}, save: {} };
}

// Adds b into a. Unknown fields are ignored; numbers only.
export function addTotals(a, b) {
  for (const k of ['open', 'newPhone', 'saveAll']) a[k] += Number(b?.[k]) || 0;
  for (const k of PER_STORY) {
    for (const [key, n] of Object.entries(b?.[k] || {})) a[k][key] = (a[k][key] || 0) + (Number(n) || 0);
  }
  return a;
}

export class Counter {
  constructor(store, { flushMs = 5 * 60 * 1000, now = () => new Date() } = {}) {
    this.store = store;
    this.flushMs = flushMs;
    this.now = now;
    this.id = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    this.seq = 0;
    this.pending = {};
    this.lastFlush = Date.now();
    this.flushing = null;
    this.timer = setInterval(() => this.maybeFlush(), Math.min(flushMs, 60_000));
    this.timer.unref?.();
  }

  add(event, story, lang) {
    if (!COUNTED.includes(event)) return;
    const day = utcDay(this.now());
    const t = (this.pending[day] ||= emptyTotals());
    if (PER_STORY.includes(event)) {
      const key = `${story}|${lang}`;
      t[event][key] = (t[event][key] || 0) + 1;
    } else {
      t[event] += 1;
    }
    this.maybeFlush();
  }

  get dirty() {
    return Object.keys(this.pending).length > 0;
  }

  maybeFlush() {
    if (this.dirty && !this.flushing && Date.now() - this.lastFlush >= this.flushMs) {
      this.flush().catch(() => {});
    }
  }

  // Writes everything counted so far. If a write fails, those counts are kept
  // and tried again next time, so nothing is lost or counted twice.
  async flush() {
    if (this.flushing) await this.flushing;
    if (!this.dirty) return;
    const batch = this.pending;
    this.pending = {};
    this.lastFlush = Date.now();
    this.flushing = (async () => {
      for (const [day, totals] of Object.entries(batch)) {
        this.seq += 1;
        const key = `stats/${day}/${this.id}-${String(this.seq).padStart(5, '0')}.json`;
        try {
          await this.store.put('state', key, Buffer.from(JSON.stringify(totals)), { contentType: 'application/json' });
        } catch (err) {
          addTotals((this.pending[day] ||= emptyTotals()), totals);
          log('WARNING', 'could not save counts, will retry', { error: err.message });
        }
      }
    })();
    try {
      await this.flushing;
    } finally {
      this.flushing = null;
    }
  }

  async close() {
    clearInterval(this.timer);
    await this.flush();
  }
}

// For the studio: totals per day for the last `days` days, newest first.
// Days that are over (two or more days ago) are folded into one file.
export async function readTotals(store, { days = 14, now = new Date(), compact = true } = {}) {
  const keys = (await store.list('state', 'stats/')).filter((k) => /^stats\/\d{4}-\d{2}-\d{2}\/[\w.-]+\.json$/.test(k));
  const byDay = new Map();
  for (const k of keys) {
    const day = k.split('/')[1];
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(k);
  }
  const wanted = [];
  for (let i = 0; i < days; i++) wanted.push(utcDay(new Date(now.getTime() - i * 86_400_000)));
  const settled = utcDay(new Date(now.getTime() - 2 * 86_400_000));

  const out = [];
  for (const day of wanted) {
    const files = byDay.get(day) || [];
    const totals = emptyTotals();
    const extra = {};
    const parts = [];
    for (let i = 0; i < files.length; i += 20) {
      const bufs = await Promise.all(files.slice(i, i + 20).map((k) => store.get('state', k)));
      bufs.forEach((buf, j) => {
        if (!buf) return;
        let data;
        try { data = JSON.parse(buf.toString('utf8')); } catch { return; }
        addTotals(totals, data);
        // Counts taken from Google's request log before the counter went live.
        if (data.source === 'google-request-log') {
          extra.fromLog = true;
          extra.audioDownloads = (extra.audioDownloads || 0) + (Number(data.audioDownloads) || 0);
        }
        if (!files[i + j].endsWith('/day.json') && data.source !== 'google-request-log') parts.push(files[i + j]);
      });
    }
    if (compact && day <= settled && parts.length > 1) {
      const sum = emptyTotals();
      const dayFile = `stats/${day}/day.json`;
      const prev = await store.get('state', dayFile);
      if (prev) addTotals(sum, JSON.parse(prev.toString('utf8')));
      for (const k of parts) addTotals(sum, JSON.parse((await store.get('state', k)).toString('utf8')));
      await store.put('state', dayFile, Buffer.from(JSON.stringify(sum)), { contentType: 'application/json' });
      for (const k of parts) await store.del('state', k);
    }
    out.push({ day, ...totals, ...extra });
  }
  return out;
}
