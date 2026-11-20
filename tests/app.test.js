import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../services/web/public/app.js', import.meta.url), 'utf8');

test('the app script parses', () => {
  assert.doesNotThrow(() => new vm.Script(src));
});

function interfaceStrings() {
  const start = src.indexOf('const UI = {');
  const end = src.indexOf('\n  };', start);
  const code = `${src.slice(src.indexOf('const arNum'), src.indexOf('\n', src.indexOf('const arNum')))}\n${src.slice(start, end + 4)}\nUI;`;
  return vm.runInNewContext(code);
}

test('every English interface string has an Arabic and a Spanish version of the same shape', () => {
  const UI = interfaceStrings();
  const en = Object.keys(UI.en);
  assert.ok(en.length > 50, `found ${en.length} keys`);
  for (const lang of ['ar', 'es']) {
    assert.deepEqual(en.filter((k) => !(k in UI[lang])), [], lang);
    for (const k of en) assert.equal(typeof UI[lang][k], typeof UI.en[k], `${lang}.${k}`);
    assert.equal(UI[lang].grownUps.length, UI.en.grownUps.length, lang);
    assert.equal(UI[lang].pills.length, UI.en.pills.length, lang);
  }
});

test('Arabic minutes use the right plural forms', () => {
  const { ar } = interfaceStrings();
  assert.equal(ar.min(1), 'دقيقة واحدة');
  assert.equal(ar.min(2), 'دقيقتان');
  assert.equal(ar.min(3), '٣ دقائق');
  assert.equal(ar.min(11), '١١ دقيقة');
});

test('no third-party scripts, fonts or trackers in the page', () => {
  const html = fs.readFileSync(new URL('../services/web/public/index.html', import.meta.url), 'utf8');
  // Link-preview tags must use full addresses on our own domain; the page itself never loads them.
  const shareTags = /<meta (?:property="og:[a-z:_]+"|name="twitter:[a-z:_]+") content="https:\/\/samemoon\.world\/[^"]*">/g;
  assert.ok(!/https?:\/\//.test(html.replace(/xmlns="[^"]+"/g, '').replace(shareTags, '')), 'index.html should load nothing from other sites');
  assert.ok(!/google-analytics|gtag|facebook|hotjar/i.test(src));
});

test('link previews have a picture that exists', () => {
  const html = fs.readFileSync(new URL('../services/web/public/index.html', import.meta.url), 'utf8');
  assert.match(html, /<meta property="og:image" content="https:\/\/samemoon\.world\/icons\/og\.png">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  const png = fs.readFileSync(new URL('../services/web/public/icons/og.png', import.meta.url));
  assert.equal(png.readUInt32BE(16), 1200, 'og.png is 1200 wide');
  assert.equal(png.readUInt32BE(20), 630, 'og.png is 630 high');
  assert.ok(png.length < 600 * 1024, 'og.png stays small enough for WhatsApp');
});
