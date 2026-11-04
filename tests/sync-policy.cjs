const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ctx = vm.createContext({}); ctx.window = ctx;
vm.runInContext(fs.readFileSync('www/js/sync-policy.js', 'utf8'), ctx);
const plan = (o) => ctx.Melk.syncPolicy.planConnectSync(Object.assign({ on: true, native: null, activeMode: null, hasDriver: false, auto: false, pendingScene: false, preserveHardware: false }, o));
const writes = (p) => ['power', 'brightness', 'mode', 'colour'].filter((k) => p[k]);

// Rainbow regression: selecting a hardware effect must not be followed by a static RGB overwrite.
test('hardware scene running: reconnect writes nothing', () => {
  assert.deepEqual(writes(plan({ native: { kind: 'scene', id: 11 } })), []);
});
test('hardware mode running: reopening the app writes nothing', () => {
  assert.deepEqual(writes(plan({ native: { kind: 'mode', id: 103 }, activeMode: 103 })), []);
});
test('static colour: reconnect restores power, brightness and colour', () => {
  assert.deepEqual(writes(plan({})), ['power', 'brightness', 'colour']);
});
test('phone-driven effect running: no static colour is sent over it', () => {
  assert.deepEqual(writes(plan({ hasDriver: true })), ['power', 'brightness']);
});
test('strip logically OFF: only the power state is sent', () => {
  assert.deepEqual(writes(plan({ on: false })), ['power']);
  assert.deepEqual(writes(plan({ on: false, native: { kind: 'mode', id: 5 } })), ['power']);
});
test('a scene or Auto about to run: no stale colour flash first', () => {
  assert.deepEqual(writes(plan({ auto: true })), ['power', 'brightness']);
  assert.deepEqual(writes(plan({ pendingScene: true, native: { kind: 'scene', id: 4 } })), ['power', 'brightness']);
});
test('preserve-hardware option leaves the controller alone', () => {
  assert.deepEqual(writes(plan({ preserveHardware: true })), []);
});
