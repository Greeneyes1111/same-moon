// Loading, checking and hashing the story files in /stories.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { LANGS } from './config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const STORIES_DIR = path.join(here, '..', 'stories');
export const COVERS_DIR = path.join(here, '..', 'covers');

export function loadStories(dir = STORIES_DIR) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    .sort((a, b) => a.order - b.order);
}

export const storyLangs = (story) => Object.keys(LANGS).filter((l) => story[l]);

// Approval is tied to the exact words. Change one word and the hash changes,
// so the story drops out of the public library until a person approves it again.
export function textHash(story, lang) {
  const t = story[lang];
  return crypto
    .createHash('sha256')
    .update(JSON.stringify([t.title, t.pages, t.grownUp]))
    .digest('hex')
    .slice(0, 12);
}

export const wordCount = (t) => [t.title, ...t.pages].join(' ').split(/\s+/).filter(Boolean).length;

// Read-aloud at a slow bedtime pace, about 105 words a minute.
export const minutesFor = (story, lang) => Math.max(1, Math.round(wordCount(story[lang]) / 105));

// Words that should never appear in a bedtime story for children who may have
// lived through violence. A hit fails the build; a person must rewrite the line.
export const GUARD_WORDS = {
  en: ['war', 'wars', 'soldier', 'soldiers', 'gun', 'guns', 'bomb', 'bombs', 'bombing', 'shoot', 'shooting', 'shot',
    'kill', 'killed', 'dead', 'die', 'died', 'dying', 'blood', 'drown', 'drowned', 'explosion', 'tank', 'tanks', 'army',
    'missile', 'rocket', 'prison', 'police', 'checkpoint', 'border'],
  ar: ['حرب', 'الحرب', 'جندي', 'جنود', 'بندقية', 'قنبلة', 'قنابل', 'قصف', 'قتل', 'مقتل', 'ميت', 'مات', 'ماتت', 'موت', 'دم',
    'دماء', 'غرق', 'انفجار', 'دبابة', 'جيش', 'صاروخ', 'سجن', 'شرطة', 'حاجز', 'حدود'],
};

function arabicVariants(token) {
  const out = new Set([token]);
  let t = token;
  if (/^[وف]/.test(t) && t.length > 3) { t = t.slice(1); out.add(t); }
  if (/^[بلك]/.test(t) && t.length > 3) { t = t.slice(1); out.add(t); }
  if (t.startsWith('ال') && t.length > 3) { out.add(t.slice(2)); }
  return [...out];
}

export function guardHits(story, lang) {
  const t = story[lang];
  if (!t) return [];
  const text = [t.title, ...t.pages, t.grownUp].join(' ');
  const words = new Set(GUARD_WORDS[lang] || []);
  const hits = new Set();
  const tokens = text
    .replace(/[ً-ْـ]/g, '') // strip Arabic diacritics and tatweel
    .toLowerCase()
    .split(/[^\p{L}']+/u)
    .filter(Boolean);
  for (const tok of tokens) {
    const variants = lang === 'ar' ? arabicVariants(tok) : [tok.replace(/'s$/, '')];
    for (const v of variants) if (words.has(v)) hits.add(v);
  }
  return [...hits];
}

export function validateStory(story) {
  const errors = [];
  const where = `story ${story.id || '(no id)'}`;
  if (!/^[a-z0-9-]+$/.test(story.id || '')) errors.push(`${where}: id must be lowercase words joined by dashes`);
  if (!Number.isInteger(story.order)) errors.push(`${where}: order must be a whole number`);
  if (!story.cover || !fs.existsSync(path.join(COVERS_DIR, `${story.cover}.svg`))) {
    errors.push(`${where}: cover "${story.cover}" not found in /covers`);
  }
  const langs = storyLangs(story);
  if (!langs.length) errors.push(`${where}: no languages`);
  let pageCount = null;
  for (const lang of langs) {
    const t = story[lang];
    if (!t.title) errors.push(`${where} [${lang}]: missing title`);
    if (!Array.isArray(t.pages) || t.pages.length < 3 || t.pages.length > 12) {
      errors.push(`${where} [${lang}]: needs 3 to 12 pages`);
    } else if (t.pages.some((p) => typeof p !== 'string' || p.trim().length < 20)) {
      errors.push(`${where} [${lang}]: every page needs real text`);
    }
    if (!t.grownUp) errors.push(`${where} [${lang}]: missing grown-up question`);
    if (!story.theme?.[lang]) errors.push(`${where} [${lang}]: missing theme`);
    if (pageCount === null) pageCount = t.pages?.length;
    else if (t.pages?.length !== pageCount) errors.push(`${where} [${lang}]: page count differs from other languages`);
    const hits = guardHits(story, lang);
    if (hits.length) errors.push(`${where} [${lang}]: contains words that need a person to rewrite: ${hits.join(', ')}`);
  }
  return errors;
}
