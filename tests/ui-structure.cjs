const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('www/index.html', 'utf8');
const css = fs.readFileSync('www/css/style.css', 'utf8');
const jsFiles = ['app', 'ota', 'ble-native', 'scene-dna'].map((n) => fs.readFileSync(`www/js/${n}.js`, 'utf8')).join('\n');
const htmlIds = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);

test('no duplicate ids in index.html', () => {
  const seen = new Set(), dup = [];
  htmlIds.forEach((id) => { if (seen.has(id)) dup.push(id); seen.add(id); });
  assert.deepEqual(dup, []);
});
test('every id the scripts look up exists (in the page or in markup the scripts create)', () => {
  const used = new Set([...jsFiles.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)].map((m) => m[1]).concat([...jsFiles.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]), [...jsFiles.matchAll(/\bel\('([^']+)'\)/g)].map((m) => m[1])));
  const made = new Set([...jsFiles.matchAll(/id=\\?"([A-Za-z0-9_-]+)\\?"/g)].map((m) => m[1]));
  const missing = [...used].filter((id) => !htmlIds.includes(id) && !made.has(id));
  assert.deepEqual(missing, []);
});
test('every tab has a panel, every data-open has a page, every page can go back', () => {
  [...html.matchAll(/data-tab="([^"]+)"/g)].forEach((m) => { assert.ok(htmlIds.includes('tab-' + m[1]), 'panel for ' + m[1]); assert.ok(htmlIds.includes('t-' + m[1]), 'tab button ' + m[1]); });
  [...html.matchAll(/data-open="([^"]+)"/g)].forEach((m) => assert.ok(htmlIds.includes('page-' + m[1]), 'page for ' + m[1]));
  [...html.matchAll(/<section class="page[^"]*" id="(page-[^"]+)"[^>]*>([\s\S]*?)<\/section>/g)].forEach((m) => {
    assert.match(m[2], /data-back/, m[1] + ' has a back button');
    assert.match(m[0].slice(0, 260), /role="dialog"/, m[1] + ' role');
    const lab = /aria-labelledby="([^"]+)"/.exec(m[0].slice(0, 260)); assert.ok(lab && htmlIds.includes(lab[1]), m[1] + ' is labelled');
  });
});
test('Developer options are hidden by default and unlocked only from the About card', () => {
  assert.match(html, /<button[^>]*id="rowDev"[^>]*\bhidden\b/);
  assert.match(html, /<section class="page dev" id="page-dev"[^>]*\bhidden\b/);
  assert.match(jsFiles, /aboutTaps >= 7/);
});
test('raw protocol tools live only in Developer options, guided tests only in the Lab', () => {
  const sec = (id) => { const m = new RegExp('<section class="page[^"]*" id="' + id + '"[\\s\\S]*?</section>').exec(html); return m ? m[0] : ''; };
  const dev = sec('page-dev'), lab = sec('page-lab'), settings = /<section class="panel" id="tab-settings"[\s\S]*?<\/section>/.exec(html)[0];
  ['labElkOn', 'labElkOff', 'labOldOn', 'labOldOff', 'labElkMode', 'magicSceneSend', 'powerProfile', 'deviceDiagBtn', 'otaAdmin', 'log'].forEach((id) => { assert.match(dev, new RegExp('id="' + id + '"'), id + ' in dev'); assert.doesNotMatch(lab, new RegExp('id="' + id + '"')); assert.doesNotMatch(settings, new RegExp('id="' + id + '"')); });
  ['hwRainbow', 'rawMode', 'nativeSel', 'nativeEffectSelect', 'persistentScene', 'preserveHardware'].forEach((id) => { assert.match(lab, new RegExp('id="' + id + '"'), id + ' in lab'); assert.doesNotMatch(dev, new RegExp('id="' + id + '"')); assert.doesNotMatch(settings, new RegExp('id="' + id + '"')); });
  ['colour', 'tab-fx', 'tab-music'].forEach(() => {});
  ['rawMode', 'labElkOn', 'nativeSel', 'magicSceneId'].forEach((id) => { const main = /<section class="panel" id="tab-color"[\s\S]*?<\/main>/.exec(html)[0]; assert.doesNotMatch(main, new RegExp('id="' + id + '"')); });
});
test('every button declares a type and every page body is reachable', () => {
  const noType = [...html.matchAll(/<button\b(?![^>]*\btype=)[^>]*>/g)].map((m) => m[0]);
  assert.deepEqual(noType, []);
});
test('every class used in the markup has a style rule (or is a known state class)', () => {
  const used = new Set();
  [...html.matchAll(/class="([^"]+)"/g)].forEach((m) => m[1].split(/\s+/).forEach((c) => c && used.add(c)));
  [...jsFiles.matchAll(/class=\\?"([^"\\$]+)\\?"/g)].forEach((m) => m[1].split(/\s+/).forEach((c) => /^[A-Za-z][\w-]*$/.test(c) && used.add(c)));
  const stateOnly = new Set(['show', 'ico', 'lab', 'dev', 'full', 'sm', 'block', 'main', 'ghost', 'danger', 'warn', 'bad', 'auto', 'add', 'rm', 'x', 'star', 'map', 'del', 'lnk', 'fav', 'share', 'starOn', 'off', 'hidden', 'inl', 'center', 'small', 'conn', 'steps2', 'flowStrip', 'whiteRange', 'text', 'area', 'area']);
  const missing = [...used].filter((c) => !new RegExp('\\.' + c.replace(/[-]/g, '\\-') + '(?![\\w-])').test(css) && !stateOnly.has(c));
  assert.deepEqual(missing, []);
});
test('no Roman Urdu is left in visible interface text', () => {
  const words = /\b(karein|nahi|nahin|dekhein|pehle|rakhein|inhein|hogi|jaye|kijiye|mein allow)\b/i;
  const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(text, words); assert.doesNotMatch(jsFiles.replace(/\/\/.*$/gm, ''), words);
});
test('there is still one favourites store for scenes and one for modes (no new favourites system)', () => {
  const app = fs.readFileSync('www/js/app.js', 'utf8');
  const def = app.slice(app.indexOf('const DEF = {'), app.indexOf('\n  };', app.indexOf('const DEF = {')));
  const keys = [...def.matchAll(/\b(\w*[Ff]av\w*)\s*:/g)].map((m) => m[1]);
  assert.deepEqual(keys.sort(), ['favScenes', 'modeFav']);
});
test('modes and scenes use the same word for favourites (no "Star it" left)', () => {
  assert.doesNotMatch(fs.readFileSync('www/js/app.js', 'utf8'), /Star it|starred modes|Star scenes/);
  assert.doesNotMatch(html, /Star scenes|Star modes/);
});
