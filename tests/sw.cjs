const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const SRC = fs.readFileSync('www/sw.js', 'utf8');
const CURRENT = /const CACHE = '([^']+)'/.exec(SRC)[1];   // the cache this release owns; it must survive activation
function boot({ online = true } = {}) {
  const handlers = {}, store = new Map(), deleted = [], log = { fetched: [] };
  const caches = {
    open: async () => ({ addAll: async () => {}, put: async (r, res) => { store.set(r.url, res); } }),
    keys: async () => ['melk-studio-v1', CURRENT, 'melk-studio-0.0.1', 'other'], delete: async (k) => { deleted.push(k); return true; },
    match: async (r) => store.get(r.url),
  };
  const self = { addEventListener: (t, f) => { handlers[t] = f; }, location: { origin: 'https://app.example' }, skipWaiting: () => { log.skipped = true; }, clients: { claim: async () => { log.claimed = true; } } };
  const fetch = async (r) => { log.fetched.push(r.url); if (!online) throw new Error('net'); return { ok: true, url: r.url, clone() { return this; } }; };
  vm.runInContext(SRC, vm.createContext({ self, caches, fetch, URL, Promise, Error }));
  const req = (url, method = 'GET') => ({ url, method });
  const dispatch = async (r) => { let p; handlers.fetch({ request: r, respondWith: (x) => { p = x; } }); return p === undefined ? undefined : p; };
  return { handlers, store, deleted, log, req, dispatch };
}

test('cache name carries the app version so every release gets a fresh cache', () => {
  const v = /APP_VERSION\s*=\s*'([^']+)'/.exec(fs.readFileSync('www/js/ota.js', 'utf8'))[1];
  assert.equal(/const CACHE = '([^']+)'/.exec(SRC)[1], 'melk-studio-' + v);
});
test('every script the page loads is in the offline file list', () => {
  const html = fs.readFileSync('www/index.html', 'utf8');
  const scripts = [...html.matchAll(/<script src="(js\/[^"]+)"/g)].map((m) => m[1]);
  const list = /const FILES = (\[[\s\S]*?\]);/.exec(SRC)[1];
  scripts.forEach((s) => assert.ok(list.includes("'" + s + "'"), s + ' missing from FILES'));
});
test('network first: a fresh copy is used and cached when online', async () => {
  const t = boot(); const r = await t.dispatch(t.req('https://app.example/js/app.js')).then((x) => x);
  assert.equal(r.url, 'https://app.example/js/app.js'); assert.equal(t.log.fetched.length, 1);
  await new Promise((r) => setImmediate(r)); assert.ok(t.store.has('https://app.example/js/app.js'));
});
test('offline: the cached copy is the fallback, an uncached file fails cleanly', async () => {
  const on = boot(); await on.dispatch(on.req('https://app.example/index.html')); await new Promise((r) => setImmediate(r));
  const off = boot({ online: false }); off.store.set('https://app.example/index.html', { cached: true });
  assert.deepEqual(await off.dispatch(off.req('https://app.example/index.html')), { cached: true });
  await assert.rejects(off.dispatch(off.req('https://app.example/missing.js')), /offline/);
});
test('other sites and non-GET requests are never intercepted (OTA manifest, update download)', async () => {
  const t = boot();
  assert.equal(await t.dispatch(t.req('https://muhammadusamataj.github.io/melk-studio-ota-/ota/melk-version.json')), undefined);
  assert.equal(await t.dispatch(t.req('https://app.example/x', 'POST')), undefined);
  assert.equal(t.log.fetched.length, 0);
});
test('activate removes old caches (including the old cache-first one) and takes over', async () => {
  const t = boot(); let p; t.handlers.activate({ waitUntil: (x) => { p = x; } }); await p;
  assert.deepEqual([...t.deleted].sort(), ['melk-studio-0.0.1', 'melk-studio-v1', 'other']); assert.ok(!t.deleted.includes(CURRENT));
  assert.ok(t.log.claimed);
});
test('install activates immediately', () => { const t = boot(); t.handlers.install({ waitUntil: () => {} }); assert.ok(t.log.skipped); });
