const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const SVC = '0000fff0-0000-1000-8000-00805f9b34fb';
const goodServices = () => ({ services: [{ uuid: SVC, characteristics: [
  { uuid: '0000fff3-0000-1000-8000-00805f9b34fb', properties: { write: false, writeWithoutResponse: true } },
  { uuid: '0000fff4-0000-1000-8000-00805f9b34fb', properties: { notify: true } } ] }] });

function setup(over = {}) {
  const store = new Map(), writes = [], calls = [];
  const plugin = Object.assign({
    initialize: async () => {}, isEnabled: async () => ({ value: true }), requestEnable: async () => {},
    requestDevice: async () => ({ deviceId: 'dev-1', name: 'MELK-0C21 F1' }),
    connect: async (o) => { calls.push(['connect', o]); }, disconnect: async () => { calls.push(['disconnect']); },
    getServices: async () => goodServices(),
    addListener: async (k, fn) => { plugin.listeners[k] = fn; return { remove: async () => {} }; },
    writeWithoutResponse: async (o) => { writes.push(o.value); },
    listeners: {},
  }, over);
  const ctx = vm.createContext({ EventTarget, Event, CustomEvent, setTimeout, clearTimeout, navigator: {},
    localStorage: { getItem: (k) => store.get(k), setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) },
    Capacitor: { isNativePlatform: () => true, Plugins: { BluetoothLe: plugin } } });
  ctx.window = ctx;
  for (const n of ['protocol', 'ble', 'ble-native']) vm.runInContext(fs.readFileSync(`www/js/${n}.js`, 'utf8'), ctx);
  const link = new ctx.Melk.Link(); link.gap = 1;
  return { link, plugin, writes, calls, P: ctx.Melk.protocol };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('GATT profile is read and recorded (FFF0, FFF3 write-without-response, FFF4 notify)', async () => {
  const { link } = setup(); await link.connect(false);
  assert.equal(link.info.fff0, true); assert.equal(link.info.fff3.writeWithoutResponse, true); assert.equal(link.info.fff4.notify, true);
  await link.disconnect();
});
test('a device without the FFF0 service is rejected and disconnected', async () => {
  const { link, calls } = setup({ getServices: async () => ({ services: [{ uuid: '0000180f-0000-1000-8000-00805f9b34fb', characteristics: [] }] }) });
  await assert.rejects(link.connect(false), { code: 'NO_SERVICE' });
  assert.equal(link.state, 'idle'); assert.ok(calls.some((c) => c[0] === 'disconnect'));
});
test('an unreadable service list never blocks a working strip', async () => {
  const { link } = setup({ getServices: async () => { throw new Error('boom'); } });
  await link.connect(false); assert.equal(link.state, 'connected'); assert.ok(link.info.warn.length > 0);
  await link.disconnect();
});
test('Bluetooth off is detected before scanning', async () => {
  const { link } = setup({ isEnabled: async () => ({ value: false }), requestEnable: async () => { throw new Error('refused'); } });
  await assert.rejects(link.connect(false), { code: 'BT_OFF' }); assert.equal(link.state, 'idle');
});
test('permission denied surfaces as an error and leaves the link idle', async () => {
  const { link } = setup({ initialize: async () => { throw new Error('Permission denied'); } });
  await assert.rejects(link.connect(false), /Permission denied/); assert.equal(link.state, 'idle');
});
test('a second connect while one is running is rejected (no duplicate connections)', async () => {
  let release; const gate = new Promise((r) => { release = r; });
  const { link } = setup({ requestDevice: async () => { await gate; return { deviceId: 'dev-1', name: 'MELK' }; } });
  const first = link.connect(false);
  await assert.rejects(link.connect(false), { code: 'BUSY' });
  release(); await first; assert.equal(link.state, 'connected'); await link.disconnect();
});
test('connect uses a bounded timeout', async () => {
  const { link, calls } = setup(); await link.connect(false);
  assert.equal(calls.find((c) => c[0] === 'connect')[1].timeout, 12000); await link.disconnect();
});
test('cancel() drops queued colour packets but keeps the effect command', () => {
  const { link } = setup(); link.startDemo();
  link.send(Uint8Array.of(1), 'a'); link.send(Uint8Array.of(2), 'color'); link.send(Uint8Array.of(3), 'mode'); link.send(Uint8Array.of(4), 'color');
  link.cancel(['color']);
  assert.ok(!link.queue.some((q) => q.key === 'color')); assert.ok(link.queue.some((q) => q.key === 'mode'));
});
test('the write queue is bounded', () => {
  const { link } = setup(); link.startDemo();
  for (let i = 0; i < 300; i++) link.send(Uint8Array.of(i & 255));
  assert.ok(link.queue.length <= 64, 'queue length ' + link.queue.length);
});
test('a dropped link reconnects without writing anything on its own', async () => {
  const { link, plugin, writes } = setup(); await link.connect(false);
  const before = writes.length;
  plugin.listeners['disconnected|dev-1'](); assert.equal(link.reconnecting, true);
  await sleep(1100); assert.equal(link.state, 'connected');
  assert.equal(writes.length, before, 'the transport layer must not send commands by itself');
  await link.disconnect();
});
test('three failed writes in a row trigger recovery', async () => {
  let fail = true; const events = [];
  const { link, calls } = setup({ writeWithoutResponse: async () => { if (fail) throw new Error('GATT error'); } });
  await link.connect(false); link.addEventListener('recovering', () => events.push('recovering'));
  fail = true; for (let i = 0; i < 3; i++) link.send(Uint8Array.of(i), 'k' + i);
  await sleep(150); assert.deepEqual(events, ['recovering']); assert.ok(calls.some((c) => c[0] === 'disconnect'));
  fail = false; await link.disconnect();
});
test('a manual disconnect never auto-reconnects', async () => {
  const { link, calls } = setup(); await link.connect(false); await link.disconnect();
  const n = calls.filter((c) => c[0] === 'connect').length; await sleep(1100);
  assert.equal(calls.filter((c) => c[0] === 'connect').length, n); assert.equal(link.state, 'idle');
});
