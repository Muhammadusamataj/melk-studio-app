const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const SVC = '0000fff0-0000-1000-8000-00805f9b34fb';
function setup() {
  const store = new Map(), calls = [], writes = [];
  const plugin = { initialize: async () => {}, isEnabled: async () => ({ value: true }), requestDevice: async () => ({ deviceId: 'dev-1', name: 'MELK-0C21 F1' }),
    connect: async () => { calls.push('connect'); }, disconnect: async () => { calls.push('disconnect'); }, getServices: async () => ({ services: [{ uuid: SVC, characteristics: [] }] }),
    addListener: async (k, fn) => { plugin.listeners[k] = fn; return { remove: async () => {} }; }, writeWithoutResponse: async (o) => { writes.push(o.value); }, listeners: {} };
  const ctx = vm.createContext({ EventTarget, Event, CustomEvent, setTimeout, clearTimeout, navigator: {},
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) },
    Capacitor: { isNativePlatform: () => true, Plugins: { BluetoothLe: plugin } } });
  ctx.window = ctx;
  for (const n of ['protocol', 'ble', 'ble-native']) vm.runInContext(fs.readFileSync(`www/js/${n}.js`, 'utf8'), ctx);
  const link = new ctx.Melk.Link(); link.gap = 1;
  return { link, plugin, calls, writes, store, P: ctx.Melk.protocol };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('suspend closes the connection but remembers the strip', async () => {
  const { link, calls, store } = setup(); await link.connect(false);
  assert.equal(store.get('melk.native.deviceId'), 'dev-1');
  await link.suspend();
  assert.ok(calls.includes('disconnect')); assert.equal(link.state, 'idle'); assert.equal(link.ready, false);
  assert.equal(store.get('melk.native.deviceId'), 'dev-1', 'the saved strip is kept so the updated app reconnects by itself');
});
test('after suspend nothing reconnects by itself, even when the strip signals a drop', async () => {
  const { link, calls, plugin } = setup(); await link.connect(false); await link.suspend();
  const n = calls.filter((c) => c === 'connect').length;
  plugin.listeners['disconnected|dev-1'] && plugin.listeners['disconnected|dev-1']();
  await sleep(1300);
  assert.equal(calls.filter((c) => c === 'connect').length, n); assert.equal(link.state, 'idle');
});
test('suspend sends nothing more to the strip, queued writes are dropped', async () => {
  const { link, writes } = setup(); await link.connect(false);
  link.send(Uint8Array.of(1), 'a'); link.send(Uint8Array.of(2), 'b'); link.send(Uint8Array.of(3), 'c');
  await link.suspend(); const n = writes.length; link.send(Uint8Array.of(9), 'late'); await sleep(80);
  assert.equal(writes.length, n); assert.equal(link.queue.length, 0);
});
test('suspend waits for a write that is already in flight', async () => {
  const { link, plugin, calls } = setup(); let release; const gate = new Promise((r) => { release = r; });
  plugin.writeWithoutResponse = async () => { calls.push('write-start'); await gate; calls.push('write-end'); };
  await link.connect(false); link.send(Uint8Array.of(1), 'x'); await sleep(10);
  const s = link.suspend(); await sleep(60); assert.ok(!calls.includes('disconnect'), 'not closed while a write is running');
  release(); await s; assert.ok(calls.indexOf('write-end') < calls.indexOf('disconnect'));
});
test('unsuspend reconnects to the remembered strip (update cancelled)', async () => {
  const { link, calls } = setup(); await link.connect(false); await link.suspend();
  const n = calls.filter((c) => c === 'connect').length; await link.unsuspend(); await sleep(1100);
  assert.equal(calls.filter((c) => c === 'connect').length, n + 1); assert.equal(link.state, 'connected');
  await link.disconnect();
});
test('a normal disconnect still forgets the strip (unchanged behaviour)', async () => {
  const { link, store } = setup(); await link.connect(false); await link.disconnect();
  assert.equal(store.has('melk.native.deviceId'), false);
});
test('suspend does nothing in demo mode', async () => {
  const { link } = setup(); link.startDemo(); await link.suspend(); assert.equal(link.state, 'demo');
});
test('Web Bluetooth link: suspend disconnects and blocks reconnect, unsuspend allows it', async () => {
  const ctx = vm.createContext({ EventTarget, Event, CustomEvent, setTimeout, clearTimeout, navigator: {} }); ctx.window = ctx;
  for (const n of ['protocol', 'ble']) vm.runInContext(fs.readFileSync(`www/js/${n}.js`, 'utf8'), ctx);
  const link = new ctx.Melk.Link(); let disconnects = 0;
  link.device = { gatt: { connected: true, disconnect() { this.connected = false; disconnects++; } } };
  link.state = 'connected'; link.char = {};
  await link.suspend(); assert.equal(disconnects, 1); assert.equal(link._manual, true);
  await link.unsuspend(); assert.equal(link._manual, false);
});
