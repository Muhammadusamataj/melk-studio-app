const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ctx = vm.createContext({}); ctx.window = ctx;
for (const f of ['protocol', 'mode-catalog']) vm.runInContext(fs.readFileSync(`www/js/${f}.js`, 'utf8'), ctx);
const P = ctx.Melk.protocol, MC = ctx.Melk.modeCatalog, J = (x) => JSON.parse(JSON.stringify(x));
const ST = (o) => Object.assign({ names: {}, fav: {}, hidden: {}, persistent: { 128: true }, verifyStatus: () => 'UNVERIFIED' }, o);
const all = (st) => { const m = MC.modes(st), s = MC.scenes(st); return { m, s }; };
const rows = (st, opts) => { const { m, s } = all(st); return J(MC.filter(m, s, opts)); };

test('213 modes in Magic Lantern\'s group order, ids ascending inside each group', () => {
  const m = J(MC.modes(ST())); assert.equal(m.length, 213);
  const order = [...new Set(m.map((e) => e.group))]; assert.deepEqual(order, ['Basic', 'Curtain', 'Trans', 'Water', 'Flow', 'Tail', 'Run', 'RunBack']);
  order.forEach((g) => { const ids = m.filter((e) => e.group === g).map((e) => e.id); assert.deepEqual(ids, [...ids].sort((a, b) => a - b)); });
  assert.deepEqual(Object.fromEntries(order.map((g) => [g, m.filter((e) => e.group === g).length])), { Basic: 47, Curtain: 20, Trans: 20, Water: 18, Flow: 24, Tail: 16, Run: 34, RunBack: 34 });
});
test('28 strip scenes are separate from modes: own kind, own keys, never in the mode groups', () => {
  const { m, s } = all(ST()); assert.equal(s.length, 28);
  s.forEach((e) => { assert.equal(e.kind, 'scene'); assert.equal(e.group, 'scenes'); assert.equal(e.name, P.NATIVE_SCENES[e.id]); });
  const keys = new Set(m.concat(s).map((e) => e.key)); assert.equal(keys.size, 213 + 28, 'a scene and a mode with the same number never share a key');
  assert.equal(J(MC.filter(m, s, { cat: 'all' })).some((e) => e.kind === 'scene'), false);
});
test('a rename shows the user\'s name and keeps Magic Lantern\'s name for reference', () => {
  const e = J(MC.modes(ST({ names: { 133: 'Night blue' } }))).find((x) => x.id === 133);
  assert.equal(e.name, 'Night blue'); assert.equal(e.mlName, '7-Color in Blue Running'); assert.equal(e.renamed, true);
});
test('only what the user recorded is "verified" or "unsupported"; everything else is just "untested"', () => {
  const m = J(MC.modes(ST())); assert.equal(m.filter((e) => e.status === 'verified').length, 1); assert.equal(m.find((e) => e.status === 'verified').id, 128);
  assert.equal(m.filter((e) => e.status === 'unsupported').length, 0);
  const v = J(MC.modes(ST({ persistent: {}, verifyStatus: (k) => (k === 'mode:130' ? 'UNSUPPORTED' : k === 'mode:131' ? 'VERIFIED_SUPPORTED' : 'UNVERIFIED') })));
  assert.equal(v.find((e) => e.id === 130).status, 'unsupported'); assert.equal(v.find((e) => e.id === 131).status, 'verified'); assert.equal(v.find((e) => e.id === 132).status, 'untested');
  const s = J(MC.scenes(ST({ verifyStatus: (k) => (k === 'scene:11' ? 'VERIFIED_SUPPORTED' : 'UNVERIFIED') }))); assert.equal(s.find((e) => e.id === 11).status, 'verified'); assert.equal(s.find((e) => e.id === 4).status, 'untested');
});
test('chips: All, Favourites, Scenes, then the groups; Hidden only when something is hidden; counts ignore hidden', () => {
  const { m, s } = all(ST()); const c = J(MC.categories(m, s));
  assert.deepEqual(c.map((x) => x.key), ['all', 'fav', 'scenes', 'Basic', 'Curtain', 'Trans', 'Water', 'Flow', 'Tail', 'Run', 'RunBack']);
  assert.equal(c[0].count, 213); assert.equal(c[1].count, 0); assert.equal(c[2].count, 28); assert.equal(c.find((x) => x.key === 'RunBack').label, 'Run back');
  const st = ST({ fav: { 10: 1, 133: 1 }, hidden: { 133: 1, 0: 1 } }); const a = all(st); const c2 = J(MC.categories(a.m, a.s));
  assert.equal(c2.find((x) => x.key === 'all').count, 211); assert.equal(c2.find((x) => x.key === 'fav').count, 1); assert.equal(c2.at(-1).key, 'hidden'); assert.equal(c2.at(-1).count, 2);
});
test('filtering by chip', () => {
  const st = ST({ fav: { 10: 1, 133: 1 }, hidden: { 133: 1 } });
  assert.equal(rows(st, { cat: 'all' }).length, 212); assert.deepEqual(rows(st, { cat: 'fav' }).map((e) => e.id), [10]);
  assert.deepEqual(rows(st, { cat: 'hidden' }).map((e) => e.id), [133]); assert.equal(rows(st, { cat: 'scenes' }).length, 28);
  assert.ok(rows(st, { cat: 'Flow' }).every((e) => e.group === 'Flow')); assert.equal(rows(st, { cat: 'Flow' }).length, 24);
});
test('search: names, numbers, "#number", several words, scenes included, hidden modes excluded', () => {
  const st = ST({ hidden: { 133: 1 } });
  assert.ok(rows(st, { cat: 'Run', query: 'blue' }).length > 0 && rows(st, { cat: 'Run', query: 'blue' }).every((e) => /blue/i.test(e.name)), 'search ignores the chip');
  assert.ok(rows(st, { cat: 'all', query: 'blue' }).some((e) => e.group === 'Flow') || rows(st, { cat: 'all', query: 'blue' }).length > 0);
  assert.deepEqual(rows(st, { query: '130' }).filter((e) => e.kind === 'mode').map((e) => e.id), [130]); assert.deepEqual(rows(st, { query: '#143' }).map((e) => e.id), [143]);
  const candle = rows(st, { query: 'candle' }); assert.deepEqual(candle.map((e) => e.kind + e.id), ['scene4']);
  assert.ok(rows(st, { query: 'red running' }).every((e) => /red/i.test(e.name) && /running/i.test(e.name)));
  assert.equal(rows(st, { query: '133' }).some((e) => e.id === 133), false, 'hidden modes are not searchable'); assert.equal(rows(st, { query: 'qqqq' }).length, 0);
});
test('"verified only" keeps just what the user verified, inside any chip', () => {
  assert.deepEqual(rows(ST(), { cat: 'all', verifiedOnly: true }).map((e) => e.id), [128]);
  assert.deepEqual(rows(ST(), { cat: 'Run', verifiedOnly: true }), []);
  const st = ST({ verifyStatus: (k) => (k === 'scene:11' ? 'VERIFIED_SUPPORTED' : 'UNVERIFIED') }); assert.deepEqual(rows(st, { cat: 'scenes', verifiedOnly: true }).map((e) => e.id), [11]);
});
