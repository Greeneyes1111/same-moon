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

test('every English interface string has an Arabic version of the same shape', () => {
  const UI = interfaceStrings();
  const en = Object.keys(UI.en);
  assert.ok(en.length > 50, `found ${en.length} keys`);
  assert.deepEqual(en.filter((k) => !(k in UI.ar)), []);
  for (const k of en) assert.equal(typeof UI.ar[k], typeof UI.en[k], k);
  assert.equal(UI.ar.grownUps.length, UI.en.grownUps.length);
  assert.equal(UI.ar.pills.length, UI.en.pills.length);
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
  assert.ok(!/https?:\/\//.test(html.replace(/xmlns="[^"]+"/g, '')), 'index.html should load nothing from other sites');
  assert.ok(!/google-analytics|gtag|facebook|hotjar/i.test(src));
});
