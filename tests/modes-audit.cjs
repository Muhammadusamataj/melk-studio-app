// Audit of the mode and scene mapping. Compares protocol.js with Magic Lantern's own arrays (extracted from its APK into
// tests/fixtures/ml-apk-arrays.json by tools/extract-ml-arrays.py) and checks every id the app uses.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const ctx = vm.createContext({}); ctx.window = ctx;
vm.runInContext(fs.readFileSync('www/js/protocol.js', 'utf8'), ctx);
const P = ctx.Melk.protocol;
const ML = JSON.parse(fs.readFileSync('tests/fixtures/ml-apk-arrays.json', 'utf8'));
const app = fs.readFileSync('www/js/app.js', 'utf8');
const J = (x) => JSON.parse(JSON.stringify(x));
const norm = (h) => h.replace(/ /g, '').toLowerCase();

test('all 213 mode ids, groups and names equal Magic Lantern\'s own arrays', () => {
  assert.equal(Object.keys(ML.modes).length, 213);
  assert.deepEqual(J(P.MODES), ML.modes);
});
test('all 28 strip scene ids and names equal Magic Lantern\'s Scenes array', () => {
  assert.equal(Object.keys(ML.scenes).length, 28);
  assert.deepEqual(J(P.NATIVE_SCENES), ML.scenes);
});
test('the group order used by the Effects tab is Magic Lantern\'s own (Scenes is its ninth group)', () => {
  const cat = loadCatalog();
  assert.deepEqual(J(cat.GROUP_ORDER), ML.groupOrder.slice(0, 8)); assert.equal(ML.groupOrder[8], 'Scenes');
});
test('a name that appears twice does so in Magic Lantern\'s list too (so rows must show the number)', () => {
  const names = Object.values(ML.modes).map((v) => v[1]); const dup = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
  assert.deepEqual(dup.sort(), ['Cyan-Dot in Yellow Run Back', 'Cyan-Dot in Yellow Running', 'Green-Dot in Red Run Back', 'Green-Dot in Red Running']);
  dup.forEach((n) => assert.ok(Object.keys(ML.modes).filter((k) => ML.modes[k][1] === n).length >= 2));
});
test('every mode and scene produces exactly the documented packet', () => {
  for (const id of Object.keys(P.MODES).map(Number)) assert.equal(norm(P.hex(P.mode(id))), '7e0503' + id.toString(16).padStart(2, '0') + '06ffff00ef', 'mode ' + id);
  for (const id of Object.keys(P.NATIVE_SCENES).map(Number)) assert.equal(norm(P.hex(P.scene(id))), '7e0531' + id.toString(16).padStart(2, '0') + '07ffff01ef', 'scene ' + id);
});
test('every mode or scene id written in the app code exists in Magic Lantern\'s lists', () => {
  const modeRefs = [...app.matchAll(/hardwareMode:\s*(\d+)/g)].map((m) => +m[1]).concat([...app.matchAll(/key:\s*'mode:(\d+)'/g)].map((m) => +m[1]), [...app.matchAll(/type:\s*'mode',\s*id:\s*(\d+)/g)].map((m) => +m[1]));
  const sceneRefs = [...app.matchAll(/nativeScene:\s*(\d+)/g)].map((m) => +m[1]).concat([...app.matchAll(/key:\s*'scene:(\d+)'/g)].map((m) => +m[1]), [...app.matchAll(/type:\s*'scene',\s*id:\s*(\d+)/g)].map((m) => +m[1]));
  assert.ok(modeRefs.length >= 3 && sceneRefs.length >= 3, 'found ' + modeRefs.length + ' mode and ' + sceneRefs.length + ' scene references');
  modeRefs.forEach((id) => assert.ok(P.isKnownMode(id), 'mode ' + id)); sceneRefs.forEach((id) => assert.ok(P.isKnownScene(id), 'scene ' + id));
});
test('the Rainbow candidates and the default verified mode are real entries with the names the Lab shows', () => {
  assert.equal(P.NATIVE_SCENES[11], 'Rainbow'); assert.ok(P.isKnownMode(103) && P.isKnownMode(105) && P.isKnownMode(129) && P.isKnownMode(128));
  assert.equal(P.MODES[128][1], 'White-Dot in Red Run Back');
});
test('the old 128 to 155 range is valid but is only 28 of 213 modes (the new list no longer depends on it)', () => {
  for (let i = P.MODE_FIRST; i <= P.MODE_LAST; i++) assert.ok(P.isKnownMode(i));
  assert.equal(P.MODE_LAST - P.MODE_FIRST + 1, 28);
});
function loadCatalog() { const c = vm.createContext({}); c.window = c; for (const f of ['protocol', 'mode-catalog']) vm.runInContext(fs.readFileSync(`www/js/${f}.js`, 'utf8'), c); return c.Melk.modeCatalog; }
