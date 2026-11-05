// The phones that will receive 1.1.6 run the PUBLISHED 1.1.5 update client (tests/fixtures/ota-1.1.5.js, copied from melk-1.1.5.zip).
// These tests prove that exact client will offer, and safely handle, a 1.1.6 manifest. No update package is built or published here.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const ORIGIN = 'https://muhammadusamataj.github.io/melk-studio-ota-/ota/';
async function check(clientFile, running, manifest, opts = {}) {
  const els = new Map(), handlers = {}, calls = [];
  const el = (id) => { if (!els.has(id)) els.set(id, { hidden: true, textContent: '', value: 0, removeAttribute() {}, classList: { add() {}, remove() {} }, addEventListener(t, f) { handlers[id + ':' + t] = f; } }); return els.get(id); };
  const ctx = vm.createContext({ URL, TextEncoder, console, confirm: () => true, document: { readyState: 'complete', getElementById: el }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, setTimeout: () => {},
    Capacitor: { isNativePlatform: () => true, Plugins: { ApkUpdater: opts.nativeCode ? { getInfo: async()=>({versionCode:opts.nativeCode}) } : undefined, CapacitorUpdater: { current: async () => ({ bundle: { version: running } }), notifyAppReady: async () => {}, download: async (o) => { calls.push(['download', o]); return { id: 'b1', version: o.version }; }, next: async (o) => { calls.push(['next', o]); }, set: async (o) => { calls.push(['set', o]); }, addListener: async () => ({ remove() {} }) }, CapacitorHttp: { get: async () => ({ status: 200, data: manifest }) } } } });
  ctx.window = ctx; vm.runInContext(fs.readFileSync(clientFile, 'utf8'), ctx);
  await ctx.MelkOta.check();
  const out = { status: el('otaStatus').textContent, canInstall: !el('otaInstall').hidden, calls };
  if (opts.install && handlers['otaInstall:click']) { await handlers['otaInstall:click'](); out.afterInstall = el('otaStatus').textContent; }
  return out;
}
const man = (v, over) => Object.assign({ version: v, url: ORIGIN + 'melk-' + v + '.zip', sha256: 'a'.repeat(64) }, over);
const OLD = 'tests/fixtures/ota-1.1.5.js', NEW = 'www/js/ota.js';

test('the fixture really is the published 1.1.5 client', () => assert.match(fs.readFileSync(OLD, 'utf8'), /APP_VERSION\s*=\s*'1\.1\.5'/));
test('1.1.5 client (packaged build) is offered 1.1.6', async () => { const r = await check(OLD, 'builtin', man('1.1.6')); assert.match(r.status, /New web update v1\.1\.6/); assert.equal(r.canInstall, true); });
test('1.1.5 client already running an OTA 1.1.5 bundle is offered 1.1.6', async () => { const r = await check(OLD, '1.1.5', man('1.1.6')); assert.match(r.status, /New web update v1\.1\.6/); assert.equal(r.canInstall, true); });
test('1.1.5 client is not offered 1.1.5 again, nor anything older', async () => {
  for (const v of ['1.1.5', '1.1.4', '1.1.0']) { const r = await check(OLD, '1.1.5', man(v)); assert.match(r.status, /Up to date/); assert.equal(r.canInstall, false, v); }
});
test('version order is numeric (1.1.10 is newer than 1.1.9, 1.2.0 newer than 1.1.6)', async () => {
  assert.match((await check(OLD, '1.1.9', man('1.1.10'))).status, /New web update v1\.1\.10/);
  assert.match((await check(OLD, '1.1.6', man('1.2.0'))).status, /New web update v1\.2\.0/);
});
test('1.1.5 client refuses a manifest whose zip is on another server', async () => {
  const r = await check(OLD, '1.1.5', man('1.1.6', { url: 'https://evil.example/melk-1.1.6.zip' })); assert.match(r.status, /Invalid update manifest|failed/i); assert.equal(r.canInstall, false);
});
test('1.1.5 client refuses an http link', async () => {
  const r = await check(OLD, '1.1.5', man('1.1.6', { url: 'http://muhammadusamataj.github.io/melk-studio-ota-/ota/melk-1.1.6.zip' })); assert.equal(r.canInstall, false);
});
test('1.1.5 client hands the manifest checksum to the native updater when installing', async () => {
  const sha = 'b'.repeat(64), r = await check(OLD, '1.1.5', man('1.1.6', { sha256: sha }), { install: true });
  const dl = r.calls.find((c) => c[0] === 'download');
  assert.ok(dl, 'download was started'); assert.equal(dl[1].checksum, sha); assert.equal(dl[1].version, '1.1.6'); assert.equal(dl[1].url, ORIGIN + 'melk-1.1.6.zip');
});
test('1.1.5 client refuses to install a manifest without a valid checksum', async () => {
  for (const bad of [undefined, '', 'xyz', 'a'.repeat(63)]) {
    const r = await check(OLD, '1.1.5', man('1.1.6', { sha256: bad }), { install: true });
    assert.equal(r.calls.some((c) => c[0] === 'download'), false, 'checksum ' + bad); assert.match(r.afterInstall || r.status, /SHA-256|checksum/i);
  }
});
test('the packaged client behaves the same way for the next release', async () => {
  const v = /APP_VERSION\s*=\s*'([^']+)'/.exec(fs.readFileSync(NEW, 'utf8'))[1];
  const [a, b, c] = v.split('.').map(Number), next = [a, b, c + 1].join('.');
  assert.ok(/^\d+\.\d+\.\d+$/.test(v) && (a > 1 || b > 1 || c >= 6), 'packaged version ' + v);
  assert.match((await check(NEW, 'builtin', man(next))).status, new RegExp('New web update v' + next.replace(/\./g, '\\.')));
  assert.match((await check(NEW, 'builtin', man(v))).status, /Up to date/);
});

test('new OTA client enforces minimum native version before offering or downloading',async()=>{
 const version='9.0.0';
 const allowed=await check(NEW,'builtin',man(version,{minNativeVersionCode:10201}),{nativeCode:10201,install:true});assert.equal(allowed.canInstall,true);assert.ok(allowed.calls.some(c=>c[0]==='download'));
 for(const nativeCode of [undefined,10200]){const blocked=await check(NEW,'builtin',man(version,{minNativeVersionCode:10201}),{nativeCode,install:true});assert.equal(blocked.canInstall,false);assert.match(blocked.status,/APK|APK first/);assert.equal(blocked.calls.some(c=>c[0]==='download'),false);}
});
test('invalid native compatibility requirements are refused',async()=>{
 for(const minimum of [0,-1,'10201',1.5,2147483648]){const r=await check(NEW,'builtin',man('9.0.0',{minNativeVersionCode:minimum}),{nativeCode:10201});assert.equal(r.canInstall,false);assert.match(r.status,/Invalid minimum native version/);}
});
