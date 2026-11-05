const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
function load(plugin, legacy) {
  const c = vm.createContext({ Capacitor: { isNativePlatform: () => true, Plugins: plugin ? { SmartAudio: plugin } : {} }, MelkAudio: legacy });
  c.window = c; vm.runInContext(fs.readFileSync('www/js/smart-audio.js', 'utf8'), c); return c.MelkSmartAudio;
}
function native() {
  const calls = { stops: 0, removed: 0, sources: [] };
  const plugin = {
    getCapabilities: async () => ({ apiVersion: 2, playback: true, microphone: true }),
    stop: async () => { calls.stops++; },
    addListener: async () => ({ remove: async () => { calls.removed++; } }),
    start: async ({ source }) => { calls.sources.push(source); return { source }; }
  };
  return { calls, plugin };
}
test('older APK rejects Auto and Device Audio without silently starting microphone', async () => {
  let starts = 0; const audio = load(null, { start: async () => { starts++; }, stop: async () => {} });
  assert.equal((await audio.capabilities()).playback, false);
  await assert.rejects(audio.start('auto', () => {}), /native 1.2.0/);
  await assert.rejects(audio.start('device', () => {}), /native 1.2.0/);
  assert.equal(starts, 0);
  const result = await audio.start('microphone', () => {});
  assert.equal(result.legacy, true); assert.equal(starts, 1); await audio.stop();
});
test('Auto requests native playback and permission rejection removes listeners without mic fallback', async () => {
  const { plugin, calls } = native(); plugin.start = async ({ source }) => { calls.sources.push(source); throw new Error('CONSENT_DENIED'); };
  const audio = load(plugin); await assert.rejects(audio.start('auto', () => {}), /CONSENT_DENIED/);
  assert.deepEqual(calls.sources, ['device']); assert.equal(calls.removed, 2);
});
test('late failure from cancelled consent cannot stop a newer audio session', async () => {
  const { plugin, calls } = native(); let rejectOld, entered;
  const waiting = new Promise(resolve => { entered = resolve; }); let first = true;
  plugin.start = ({ source }) => { if (first) { first = false; entered(); return new Promise((_, reject) => { rejectOld = reject; }); } return Promise.resolve({ source }); };
  const audio = load(plugin), old = audio.start('device', () => {});
  const rejected = assert.rejects(old, /old consent cancelled/); await waiting;
  await audio.start('microphone', () => {}); const stops = calls.stops;
  rejectOld(new Error('old consent cancelled')); await rejected;
  assert.equal(calls.stops, stops); await audio.stop();
});
test('stop during listener registration disposes the late listener and never starts capture', async () => {
  const { plugin, calls } = native(); let ready, release;
  const waiting = new Promise(resolve => { ready = resolve; });
  plugin.addListener = () => { ready(); return new Promise(resolve => { release = () => resolve({ remove: async () => { calls.removed++; } }); }); };
  const audio = load(plugin), pending = audio.start('device', () => {});
  const rejected = assert.rejects(pending, /cancelled/); await waiting; await audio.stop(); release(); await rejected;
  assert.equal(calls.removed, 1); assert.equal(calls.sources.length, 0);
});
