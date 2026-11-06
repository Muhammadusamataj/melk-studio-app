'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../www/js/ble.js'), 'utf8');

function load(EventTargetCtor) {
  const window = { Melk: { protocol: {} } };
  const context = { window, EventTarget: EventTargetCtor, CustomEvent: class {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
  }, navigator: {}, setTimeout, clearTimeout, Set, Promise };
  vm.runInNewContext(source, context, { filename: 'ble.js' });
  return new window.Melk.Link();
}

test('Android 8.1 legacy WebView with nonconstructible EventTarget boots BLE link', () => {
  class NonConstructibleEventTarget { constructor() { throw new TypeError('Illegal constructor'); } }
  const link = load(NonConstructibleEventTarget);
  const states = [];
  const onState = event => states.push(event.detail.state);
  link.addEventListener('state', onState);
  link.startDemo();
  assert.equal(link.ready, true);
  assert.deepEqual(states, ['demo']);
  link.removeEventListener('state', onState);
  link.disconnect();
  assert.deepEqual(states, ['demo']);
});

test('modern constructible EventTarget retains native event handling', () => {
  class NativeEventTarget {
    constructor() { this.events = []; }
    addEventListener(type, fn) { this.events.push({ type, fn }); }
    dispatchEvent(event) { this.events.filter(e => e.type === event.type).forEach(e => e.fn(event)); return true; }
  }
  const link = load(NativeEventTarget);
  let state = '';
  link.addEventListener('state', e => { state = e.detail.state; });
  link.startDemo();
  assert.equal(state, 'demo');
});
