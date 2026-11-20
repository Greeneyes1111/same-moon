import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVoice, requestBody, judgeVerdict, chosenVoice } from '../shared/tts.js';

test('a "model:Name" voice is a Gemini voice', () => {
  assert.deepEqual(parseVoice('gemini-2.5-pro-tts:Callirrhoe', 'en-GB'),
    { id: 'gemini-2.5-pro-tts:Callirrhoe', languageCode: 'en-GB', name: 'Callirrhoe', modelName: 'gemini-2.5-pro-tts' });
  assert.deepEqual(parseVoice('es-US-Chirp3-HD-Achernar', 'es-US'),
    { id: 'es-US-Chirp3-HD-Achernar', languageCode: 'es-US', name: 'es-US-Chirp3-HD-Achernar' });
});

test('Gemini requests carry the style prompt and no speaking rate', () => {
  const b = requestBody('Hello moon.', 'en', parseVoice(chosenVoice('en'), 'en-GB'), true);
  assert.equal(b.voice.modelName, 'gemini-2.5-pro-tts');
  assert.match(b.input.prompt, /British/);
  assert.equal(b.audioConfig.speakingRate, undefined);
  const c = requestBody('Hola luna.', 'es', parseVoice('es-US-Chirp3-HD-Achernar', 'es-US'), true);
  assert.equal(c.input.prompt, undefined);
  assert.equal(c.audioConfig.speakingRate, 0.9);
});

test('a page passes only with the right accent and exactly the approved words', () => {
  const chk = { accent: 'British' };
  assert.equal(judgeVerdict('{"accent":"British (RP)","accent_confidence":90,"words_match":true}', chk).ok, true);
  assert.equal(judgeVerdict('{"accent":"General American","accent_confidence":95,"words_match":true}', chk).ok, false);
  assert.equal(judgeVerdict('{"accent":"British","accent_confidence":90,"words_match":false,"differences":"added very"}', chk).ok, false);
  assert.equal(judgeVerdict('{"accent":"British","accent_confidence":50,"words_match":true}', chk).ok, false);
  assert.equal(judgeVerdict('not json', chk).ok, false);
});
