const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
  const values = new Map(), calls = [];
  const plugin = {
    initialize: async () => {},
    requestDevice: async (options) => { calls.push(options); return { deviceId: 'test-strip', name: 'Test strip' }; },
    connect: async () => {}, disconnect: async () => {},
    addListener: async () => ({ remove: async () => {} }),
    writeWithoutResponse: async (options) => { calls.push(options); },
  };
  const context = vm.createContext({ EventTarget, Event, CustomEvent, setTimeout, clearTimeout,
    navigator: {}, localStorage: { getItem: k => values.get(k), setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) },
    Capacitor: { isNativePlatform: () => true, Plugins: { BluetoothLe: plugin } },
  });
  context.window = context;
  for (const name of ['protocol', 'ble', 'ble-native']) vm.runInContext(fs.readFileSync(`www/js/${name}.js`, 'utf8'), context);
  return { link: new context.Melk.Link(), plugin, calls, P: context.Melk.protocol };
}

test('native scan shows all nearby devices regardless of old prefix preference', async () => {
  const {link,calls,P} = setup();
  await link.connect(false);
  assert.equal(Object.keys(calls[0]).length, 0);
  await link.disconnect();
  await link.connect(true);
  assert.equal(Object.keys(calls[1]).length, 0);
  assert.equal(link.state, 'connected');
  await link.disconnect();
});

test('picker cancellation rejects so the UI cannot report a successful connection', async () => {
  const {link,plugin} = setup();
  plugin.requestDevice = async () => { throw new Error('Selection cancelled'); };
  await assert.rejects(link.connect(), { name: 'NotFoundError' });
  assert.equal(link.state, 'idle');
});

test('native write encodes bytes as plugin hex and disconnect clears pending writes', async () => {
  const {link,calls} = setup();
  await link.connect(true);
  link.send(Uint8Array.of(0x7e,0x00,0xff,0xef));
  assert.equal(calls[1].value, '7e00ffef');
  link.queue.push({bytes:Uint8Array.of(1)});
  await link.disconnect();
  assert.equal(link.queue.length, 0);
  assert.equal(link.deviceId, null);
});
