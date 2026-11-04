const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const ctx = vm.createContext({}); ctx.window = ctx;
vm.runInContext(fs.readFileSync('www/js/protocol.js', 'utf8'), ctx);
const P = ctx.Melk.protocol;
const frame = (u8) => { assert.equal(u8.length, 9); assert.equal(u8[0], 0x7e); assert.equal(u8[8], 0xef); };

test('every packet builder returns a 9-byte 7E..EF frame', () => {
  [P.power(true), P.power(false), P.color(1, 2, 3), P.brightness(50), P.speed(50), P.mode(130), P.scene(11), P.whiteTemp(40, 60)].forEach(frame);
});

test('exact bytes for each command', () => {
  assert.equal(P.hex(P.color(255, 0, 128)), '7E 07 05 03 FF 00 80 10 EF');
  assert.equal(P.hex(P.brightness(80)), '7E 04 01 50 FF FF FF 00 EF');
  assert.equal(P.hex(P.mode(103)), '7E 05 03 67 06 FF FF 00 EF');
  assert.equal(P.hex(P.scene(11)), '7E 05 31 0B 07 FF FF 01 EF');
  assert.equal(P.hex(P.power(true)), '7E 04 04 01 00 01 FF 00 EF');
});

test('boundary values are clamped, never wrapped', () => {
  assert.equal(P.color(-5, 300, 0)[4], 0); assert.equal(P.color(-5, 300, 0)[5], 255);
  assert.equal(P.brightness(150)[3], 100); assert.equal(P.brightness(-1)[3], 0);
  assert.equal(P.speed(101)[3], 100);
  assert.equal(P.scene(0)[3], 1); assert.equal(P.scene(99)[3], 28);
});

test('only the known command builders exist (no speculative protocol writes)', () => {
  const builders = Object.keys(P).filter((k) => typeof P[k] === 'function').sort();
  assert.deepEqual(builders, ['brightness', 'color', 'hex', 'isKnownMode', 'isKnownScene', 'modeGroup', 'modeName', 'mode', 'power', 'scene', 'speed', 'whiteTemp'].sort());
});

test('Magic Lantern mode and scene tables are complete and consistent', () => {
  assert.equal(Object.keys(P.MODES).length, 213);
  for (let i = 0; i <= 212; i++) assert.ok(P.isKnownMode(i), 'mode ' + i);
  assert.equal(P.isKnownMode(213), false); assert.equal(P.isKnownMode(-1), false); assert.equal(P.isKnownMode('x'), false);
  assert.equal(P.modeName(103), '7-Color Running');
  assert.equal(Object.keys(P.NATIVE_SCENES).length, 28);
  assert.equal(P.NATIVE_SCENES[11], 'Rainbow');
  assert.ok(P.isKnownScene(28)); assert.equal(P.isKnownScene(29), false);
});
