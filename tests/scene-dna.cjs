const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const ctx = vm.createContext({}); ctx.window = ctx;
for (const f of ['protocol', 'scene-dna']) vm.runInContext(fs.readFileSync(`www/js/${f}.js`, 'utf8'), ctx);
const D = ctx.Melk.sceneDna;
// The real defaults, taken from the app source so the test cannot drift from them.
const src = fs.readFileSync('www/js/app.js', 'utf8');
const i = src.indexOf('  const DEF = {'), j = src.indexOf('\n  };', i) + 4;
const DEF = vm.runInContext('(' + src.slice(i + '  const DEF = '.length, j).replace(/;\s*$/, '') + ')', ctx);

const J = (x) => JSON.parse(JSON.stringify(x));   // results come from another vm realm
const base = (o) => Object.assign({ melk: 'scene', v: 1, name: 'Evening', br: 40, type: 'color', color: '#ff9a4d' }, o);
const unverified = { isVerified: () => false }, verified = { isVerified: () => true };
const ALLOWED = ['name', 'br', 'note', 'sleep', 'type', 'color', 'warm', 'nativeScene', 'hardwareMode'];

test('valid colour, white and effect scenes are accepted', () => {
  assert.equal(D.validateScene(base(), unverified).ok, true);
  assert.equal(D.validateScene(base({ type: 'white', warm: 20, color: undefined }), unverified).scene.warm, 20);
  const r = D.validateScene(base({ type: 'seq', speed: 2, steps: [{ c: '#ff0000', fade: 1500, hold: 500 }, { c: '#0000ff', fade: 1500, hold: 500 }] }), unverified);
  assert.equal(r.ok, true); assert.equal(r.seq.steps.length, 2); assert.equal(r.scene.type, 'seq');
});
test('JSON text is parsed, names are cleaned, colours upper-cased', () => {
  const r = D.validateScene(JSON.stringify(base({ name: '  <b>Hi</b>\u0007 ' })), unverified);
  assert.equal(r.scene.name, 'bHi/b'); assert.equal(r.scene.color, '#FF9A4D');
});
test('wrong format, version, size or JSON is rejected', () => {
  assert.equal(D.validateScene({ name: 'x' }, unverified).ok, false);
  assert.equal(D.validateScene(base({ v: 2 }), unverified).ok, false);
  assert.equal(D.validateScene(base({ melk: 'settings' }), unverified).ok, false);
  assert.equal(D.validateScene('{nope', unverified).ok, false);
  assert.equal(D.validateScene('x'.repeat(9000), unverified).ok, false);
  assert.equal(D.validateScene(null, unverified).ok, false);
});
test('bad fields are rejected, out-of-range numbers are clamped', () => {
  assert.equal(D.validateScene(base({ name: '' }), unverified).ok, false);
  assert.equal(D.validateScene(base({ color: 'red' }), unverified).ok, false);
  assert.equal(D.validateScene(base({ br: 'bright' }), unverified).ok, false);
  assert.equal(D.validateScene(base({ br: 500 }), unverified).scene.br, 100);
  assert.equal(D.validateScene(base({ type: 'laser' }), unverified).ok, false);
  assert.equal(D.validateScene(base({ type: 'seq', steps: Array(33).fill({ c: '#ffffff', fade: 1, hold: 1 }) }), unverified).ok, false);
  assert.equal(D.validateScene(base({ type: 'seq', steps: [{ c: 'nope', fade: 1, hold: 1 }] }), unverified).ok, false);
});
test('raw BLE bytes and unknown keys are never copied into a scene', () => {
  const r = D.validateScene(base({ bytes: [126, 4, 4, 1], packet: '7e0404010001ff00ef', __proto__: { x: 1 }, onLoad: 'alert(1)' }), unverified);
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.scene).filter((k) => !ALLOWED.includes(k)), []);
});
test('unknown hardware modes and scenes are rejected', () => {
  assert.equal(D.validateScene(base({ type: 'hardware', hardware: { kind: 'mode', id: 999 } }), verified).ok, false);
  assert.equal(D.validateScene(base({ type: 'hardware', hardware: { kind: 'scene', id: 99 } }), verified).ok, false);
  assert.equal(D.validateScene(base({ type: 'hardware', hardware: { kind: 'raw', id: 1 } }), verified).ok, false);
  assert.equal(D.validateScene(base({ type: 'hardware', hardware: { kind: 'mode', id: 1.5 } }), verified).ok, false);
});
test('hardware effect: verified on this strip stays hardware, otherwise becomes a static colour', () => {
  const hw = base({ type: 'hardware', hardware: { kind: 'mode', id: 103 }, fallbackColor: '#00ff00' });
  const v = D.validateScene(hw, verified); assert.equal(v.scene.hardwareMode, 103); assert.equal(v.scene.type, 'color');
  const u = D.validateScene(hw, unverified); assert.equal(u.scene.hardwareMode, undefined); assert.equal(u.scene.color, '#00FF00'); assert.match(u.notes.join(' '), /not verified/);
  const s = D.validateScene(base({ type: 'hardware', hardware: { kind: 'scene', id: 11 } }), verified); assert.equal(s.scene.nativeScene, 11);
  assert.equal(D.validateScene(base({ type: 'hardware', hardware: { kind: 'scene', id: 11 } }), unverified).scene.color, '#FFB347');
});
test('export then import round-trips for every shareable kind', () => {
  const seqs = [{ id: 'q1', name: 'Slow', speed: 1.5, steps: [{ c: '#112233', fade: 1000, hold: 200 }] }];
  const cases = [{ name: 'A', type: 'color', color: '#112233', br: 30 }, { name: 'B', type: 'white', warm: 70, br: 50 }, { name: 'C', type: 'seq', seq: 'q1', br: 60 },
    { name: 'D', type: 'color', color: '#FF0000', br: 80, nativeScene: 11 }, { name: 'E', type: 'color', color: '#FF0000', br: 80, hardwareMode: 103 }];
  for (const sc of cases) {
    const e = D.exportScene(sc, { seqs, status: () => 'VERIFIED_SUPPORTED' }); assert.equal(e.ok, true, sc.name);
    const r = D.validateScene(JSON.stringify(e.data), { isVerified: () => true }); assert.equal(r.ok, true, sc.name + ': ' + r.errors);
    assert.equal(r.scene.name, sc.name);
  }
});
test('music and mode scenes cannot be shared', () => {
  assert.equal(D.exportScene({ name: 'P', type: 'music' }, {}).ok, false);
  assert.equal(D.exportScene({ name: 'M', type: 'mode', mode: 5 }, {}).ok, false);
});

test('settings import: unknown keys, runtime state and prototype keys are dropped', () => {
  const raw = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"x":1},"br":500,"evil":1,"native":{"kind":"mode","id":5},"lastFail":{"msg":"x"},"tab":"hack","on":"yes"}');
  const r = D.sanitizeSettings(raw, DEF);
  assert.equal(({}).polluted, undefined); assert.equal(vm.runInContext('({}).polluted', ctx), undefined);
  assert.equal(Object.getPrototypeOf(Object.getPrototypeOf(r.settings)), null, 'a plain object'); assert.equal(r.settings.polluted, undefined);
  assert.equal(r.settings.br, 100); assert.equal(r.settings.native, undefined); assert.equal(r.settings.evil, undefined);
  assert.equal(r.settings.tab, undefined); assert.equal(r.settings.on, undefined);
  ['__proto__', 'constructor', 'evil', 'native', 'lastFail', 'tab', 'on'].forEach((k) => assert.ok(J(r.dropped).includes(k), k));
});
test('settings import: structured data is validated item by item', () => {
  const good = { palette: ['#ffffff', '#00ff00'], scenes: [{ id: 'a1', name: 'Ok', type: 'color', color: '#112233', br: 50 }], modeNames: { 130: 'Mine' }, modeFav: { 130: 1 },
    verify: { 'mode:103': { moves: true, appClose: false, powerCycle: 'x' }, 'evil:1': { moves: true } }, vehicles: [{ id: 'v1', name: 'Car', cap: 500, startup: 'keep' }], favScenes: ['a1'] };
  const r = D.sanitizeSettings(good, DEF).settings;
  assert.deepEqual(r.palette, ['#FFFFFF', '#00FF00']); assert.equal(r.scenes.length, 1); assert.equal(r.modeNames['130'], 'Mine');
  assert.equal(r.verify['mode:103'].moves, true); assert.equal(r.verify['mode:103'].powerCycle, undefined); assert.equal(r.verify['evil:1'], undefined);
  assert.equal(r.vehicles[0].cap, 100);
  const bad = D.sanitizeSettings({ palette: ['red'], scenes: [{ id: 'a b', name: 'x', type: 'color' }], seqs: [{ id: 's', name: 'x', steps: [] }], vehicles: [], favScenes: ['ok', 5] }, DEF);
  ['palette', 'scenes', 'seqs', 'vehicles', 'favScenes'].forEach((k) => { assert.equal(bad.settings[k], undefined, k); assert.ok(J(bad.dropped).includes(k), k); });
});
test('settings import: a scene may not carry an unknown hardware id', () => {
  const r = D.sanitizeSettings({ scenes: [{ id: 'a', name: 'x', type: 'color', color: '#ffffff', hardwareMode: 999 }] }, DEF);
  assert.equal(r.settings.scenes, undefined);
});
test('settings import: not an object', () => {
  assert.equal(Object.keys(D.sanitizeSettings([1, 2], DEF).settings).length, 0);
  assert.equal(Object.keys(D.sanitizeSettings('x', DEF).settings).length, 0);
});
test('settings import: the app\'s own default settings survive unchanged', () => {
  const own = JSON.parse(JSON.stringify(DEF)); own.scenes = null; own.seqs = null;
  const r = D.sanitizeSettings(own, DEF);
  const lost = r.dropped.filter((k) => !['native', 'lastFail', 'nativeLast', 'devUnlocked'].includes(k));
  assert.deepEqual(J(lost), [], 'these default keys were rejected: ' + lost);
});
