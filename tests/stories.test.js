import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadStories, validateStory, guardHits, textHash, storyLangs, minutesFor } from '../shared/stories.js';

const stories = loadStories();

test('there are ten stories, in order, each in English, Arabic and Spanish', () => {
  assert.equal(stories.length, 10);
  assert.deepEqual(stories.map((s) => s.order), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const s of stories) assert.deepEqual(storyLangs(s), ['en', 'ar', 'es'], s.id);
});

test('every story passes the checks (structure, matching pages, no frightening words)', () => {
  const errors = stories.flatMap(validateStory);
  assert.deepEqual(errors, []);
});

test('ids are unique', () => {
  assert.equal(new Set(stories.map((s) => s.id)).size, stories.length);
});

test('stories are bedtime length (1 to 5 minutes read aloud)', () => {
  for (const s of stories) for (const l of storyLangs(s)) {
    const m = minutesFor(s, l);
    assert.ok(m >= 1 && m <= 5, `${s.id} [${l}] is ${m} min`);
  }
});

test('the word guard catches frightening words in English', () => {
  const s = structuredClone(stories[0]);
  s.en.pages[0] += ' The soldiers came.';
  assert.deepEqual(guardHits(s, 'en'), ['soldiers']);
  assert.ok(validateStory(s).some((e) => e.includes('soldiers')));
});

test('the word guard catches Arabic words with attached prefixes', () => {
  const s = structuredClone(stories[0]);
  s.ar.pages[0] += ' وبالحرب جاء الجنود.';
  const hits = guardHits(s, 'ar');
  assert.ok(hits.includes('حرب'), hits.join(','));
  assert.ok(hits.includes('جنود'), hits.join(','));
});

test('the word guard catches frightening words in Spanish', () => {
  const s = structuredClone(stories[0]);
  s.es.pages[0] += ' Llegaron los soldados.';
  assert.deepEqual(guardHits(s, 'es'), ['soldados']);
});

test('the word guard does not flag innocent words that contain a guarded word', () => {
  const s = structuredClone(stories[0]);
  s.ar.pages[0] += ' تعلّمت كلمات جديدة. قلم رصاص.';
  s.en.pages[0] += ' She played with the warm armchair cushions.';
  assert.deepEqual(guardHits(s, 'ar'), []);
  assert.deepEqual(guardHits(s, 'en'), []);
});

test('the approval hash changes when a single word changes', () => {
  const s = structuredClone(stories[1]);
  const before = textHash(s, 'en');
  s.en.pages[2] = s.en.pages[2].replace('song', 'tune');
  assert.notEqual(textHash(s, 'en'), before);
  assert.equal(textHash(s, 'ar'), textHash(stories[1], 'ar'));
});
