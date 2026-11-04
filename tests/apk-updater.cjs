const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const ctx = vm.createContext({ URL, console }); ctx.window = ctx;
vm.runInContext(fs.readFileSync('www/js/apk-updater.js', 'utf8'), ctx);
const A = ctx.MelkApk;
const J = (x) => JSON.parse(JSON.stringify(x));
const MURL = A.MANIFEST_URL, BASE = MURL.replace(/apk-version\.json$/, '');
const SHA = 'a'.repeat(64);
const good = (o) => Object.assign({ schema: 1, packageName: 'com.bleled.com', versionCode: 10108, versionName: '1.1.8', url: BASE + 'MELK-Studio-1.1.8.apk', sha256: SHA, size: 5_000_000 }, o);
const v = (raw) => A.validateManifest(raw, { packageName: 'com.bleled.com', manifestUrl: MURL });

// ---------------- manifest validation ----------------
test('a correct manifest is accepted and normalised', () => {
  const r = v(good({ sha256: 'A'.repeat(64), signingCertSha256: 'AB:CD:' + 'ef'.repeat(30), minSdk: 24, notes: '  <b>Fixes</b>\u0007 ', extra: 'ignored' }));
  assert.equal(r.ok, true, r.errors.join(' '));
  assert.equal(r.manifest.sha256, SHA); assert.equal(r.manifest.signingCertSha256, 'abcd' + 'ef'.repeat(30)); assert.equal(r.manifest.minSdk, 24);
  assert.equal(r.manifest.notes, 'bFixes/b'); assert.equal(r.manifest.extra, undefined);
});
test('every way a manifest can be wrong is refused with a reason', () => {
  const bad = {
    'not an object': null, 'an array': [], 'wrong schema': good({ schema: 2 }), 'other app': good({ packageName: 'com.other.app' }),
    'build as text': good({ versionCode: '10108' }), 'build zero': good({ versionCode: 0 }), 'build fraction': good({ versionCode: 1.5 }), 'build too big': good({ versionCode: 2147483648 }),
    'bad version name': good({ versionName: '../x' }), 'no checksum': good({ sha256: undefined }), 'short checksum': good({ sha256: 'abc' }), 'non-hex checksum': good({ sha256: 'z'.repeat(64) }),
    'size zero': good({ size: 0 }), 'size negative': good({ size: -5 }), 'size fraction': good({ size: 1.5 }), 'size too big': good({ size: 251 * 1024 * 1024 }), 'size as text': good({ size: '5' }),
    'http url': good({ url: BASE.replace('https', 'http') + 'a.apk' }), 'other server': good({ url: 'https://evil.example/a.apk' }), 'not an apk': good({ url: BASE + 'a.zip' }),
    'password in url': good({ url: 'https://user:pw@muhammadusamataj.github.io/melk-studio-ota-/apk/a.apk' }), 'garbage url': good({ url: 'not a url' }), 'missing url': good({ url: undefined }),
    'bad cert': good({ signingCertSha256: 'nope' }), 'bad minSdk': good({ minSdk: 0 }),
  };
  for (const [name, raw] of Object.entries(bad)) { const r = v(raw); assert.equal(r.ok, false, name); assert.ok(r.errors.length > 0 && r.manifest === null, name); }
});
test('the update must come from the same server as its description', () => {
  assert.equal(v(good({ url: 'https://muhammadusamataj.github.io.evil.example/a.apk' })).ok, false);
  assert.equal(v(good({ url: 'https://muhammadusamataj.github.io:8443/a.apk' })).ok, false);
});

// ---------------- error messages ----------------
test('failures are described in plain English, with the phone\'s own detail where it helps', () => {
  assert.match(A.describeError({ code: 'CHECKSUM_MISMATCH', message: 'x' }), /deleted\. Nothing was installed/);
  assert.match(A.describeError({ code: 'NETWORK' }), /connection was lost/);
  assert.match(A.describeError({ code: 'NETWORK_TIMEOUT' }), /timed out/);
  assert.equal(A.describeError({ code: 'NO_SPACE', message: 'Not enough free storage. About 80 MB is needed and 12 MB is free.' }), 'Not enough free storage. About 80 MB is needed and 12 MB is free.');
  assert.match(A.describeError({ code: 'VALIDATION_FAILED', message: 'The downloaded app is signed with a different key from the installed app' }), /different key/);
  assert.match(A.describeError({}), /unknown reason/);
});

// ---------------- the controller ----------------
function rig(over = {}) {
  const calls = [], order = [], listeners = {}, store = new Map();
  let info = Object.assign({ packageName: 'com.bleled.com', versionName: '1.1.7', versionCode: 10107, sdk: 34, canInstall: true, debuggable: false, signingSha256: ['c'.repeat(64)] }, over.info);
  const plugin = Object.assign({
    getInfo: async () => J(info),
    addListener: async (e, f) => { listeners[e] = f; return { remove: async () => { delete listeners[e]; calls.push(['removeListener', e]); } }; },
    download: async (o) => { calls.push(['download', o]); for (const p of [0, 20, 60, 99, 100]) listeners.downloadProgress && listeners.downloadProgress({ percent: p, downloaded: p * 50000, total: 5_000_000 }); return { ready: true, fromCache: false, versionCode: o.versionCode, bytes: o.size }; },
    cancelDownload: async () => { calls.push(['cancelDownload']); },
    install: async () => { order.push('plugin.install'); calls.push(['install']); return { launched: true }; },
    openInstallPermissionSettings: async () => { calls.push(['openSettings']); return { opened: true }; },
    cleanup: async () => { calls.push(['cleanup']); return { deleted: 1 }; },
  }, over.plugin);
  const hooks = { beforeInstall: async () => { order.push('hook.before'); }, afterInstallCancelled: async () => { order.push('hook.after'); }, notify: (m) => calls.push(['notify', m]), ...over.hooks };
  let clock = 1_000_000;
  const states = [];
  const c = A.create({ plugin: over.noPlugin ? null : plugin, http: { getJson: over.getJson || (async () => good()) }, hooks, storage: { getItem: (k) => store.get(k) || null, setItem: (k, x) => store.set(k, x), removeItem: (k) => store.delete(k) }, onChange: (s) => states.push(s.state), now: () => clock });
  return { c, calls, order, store, listeners, states, setInfo: (o) => Object.assign(info, o), tick: (ms) => { clock += ms; } };
}

test('no plugin (browser or an old APK): unavailable, nothing is requested', async () => {
  let asked = 0; const r = rig({ noPlugin: true, getJson: async () => { asked++; return good(); } });
  await r.c.check(); assert.equal(r.c.st.state, 'unavailable'); assert.equal(asked, 0);
});
test('check: newer build is offered, same or older is "up to date"', async () => {
  let r = rig(); await r.c.check(); assert.equal(r.c.st.state, 'available'); assert.equal(r.c.st.manifest.versionCode, 10108);
  r = rig({ getJson: async () => good({ versionCode: 10107, versionName: '1.1.7' }) }); await r.c.check(); assert.equal(r.c.st.state, 'uptodate');
  r = rig({ getJson: async () => good({ versionCode: 10100, versionName: '1.1.0' }) }); await r.c.check(); assert.equal(r.c.st.state, 'uptodate');
});
test('check: bad manifest, other package, network failure and too-old Android are errors with a reason', async () => {
  let r = rig({ getJson: async () => good({ sha256: 'bad' }) }); await r.c.check(); assert.equal(r.c.st.state, 'error'); assert.match(r.c.st.message, /checksum/i); assert.equal(r.c.st.manifest, null);
  r = rig({ getJson: async () => good({ packageName: 'com.other.app' }) }); await r.c.check(); assert.equal(r.c.st.state, 'error'); assert.match(r.c.st.message, /different app/);
  r = rig({ getJson: async () => { throw new Error('Server answered 404'); } }); await r.c.check(); assert.equal(r.c.st.state, 'error'); assert.match(r.c.st.message, /404/);
  r = rig({ getJson: async () => good({ minSdk: 40 }) }); await r.c.check(); assert.equal(r.c.st.state, 'error'); assert.match(r.c.st.message, /newer version of Android/);
});
test('download: sends exactly the verified manifest fields and ends at 100 percent', async () => {
  const r = rig(); await r.c.check(); await r.c.download();
  const dl = r.calls.find((x) => x[0] === 'download')[1];
  assert.deepEqual(J(dl), { url: BASE + 'MELK-Studio-1.1.8.apk', sha256: SHA, size: 5_000_000, versionCode: 10108, packageName: 'com.bleled.com', signingCertSha256: '', minSdk: 0 });
  assert.equal(r.c.st.state, 'ready'); assert.equal(r.c.st.percent, 100);
  assert.ok(r.calls.some((x) => x[0] === 'removeListener'), 'the progress listener is removed');
});
test('download: percent never goes backwards, even if events arrive out of order', async () => {
  const seen = []; let push;
  const c = A.create({ plugin: { getInfo: async () => ({ packageName: 'com.bleled.com', versionCode: 10107, sdk: 34, canInstall: true }), addListener: async (e, f) => { push = f; return { remove: async () => {} }; },
    download: async () => { for (const p of [10, 5, 40, 30, 100]) push({ percent: p, downloaded: 1, total: 2 }); return { ready: true }; }, cancelDownload: async () => {} },
    http: { getJson: async () => good() }, onChange: (s) => { if (s.state === 'downloading') seen.push(s.percent); } });
  await c.check(); await c.download();
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] >= seen[i - 1], 'progress ' + seen);
  assert.ok(seen.includes(100) || c.st.percent === 100);
});
test('download failures keep the app usable and can be retried', async () => {
  const cases = [['CHECKSUM_MISMATCH', 'deleted'], ['NETWORK', 'connection was lost'], ['NETWORK_TIMEOUT', 'timed out'], ['NO_SPACE', 'free storage'], ['HTTP_ERROR', '404'], ['STORAGE_ERROR', 'could not save']];
  for (const [code, text] of cases) {
    const r = rig({ plugin: { download: async () => { throw { code, message: code === 'NO_SPACE' ? 'Not enough free storage. About 80 MB is needed.' : code === 'HTTP_ERROR' ? 'The update server answered 404 (file not found).' : 'x' }; } } });
    await r.c.check(); await r.c.download();
    assert.equal(r.c.st.state, 'available', code); assert.match(r.c.st.message, new RegExp(text, 'i'), code);
    assert.equal(r.calls.filter((x) => x[0] === 'install').length, 0, code + ': never installs');
  }
});
test('a rejected package (wrong key, wrong app, downgrade) is blocked and the reasons are kept', async () => {
  const r = rig({ plugin: { download: async () => { throw { code: 'VALIDATION_FAILED', message: 'The downloaded app is signed with a different key from the installed app, so Android would refuse it.', data: { problems: ['SIGNATURE_MISMATCH'] } }; } } });
  await r.c.check(); await r.c.download();
  assert.equal(r.c.st.state, 'available'); assert.deepEqual(J(r.c.st.problems), ['SIGNATURE_MISMATCH']); assert.match(r.c.st.message, /different key/);
  await r.c.install(); assert.equal(r.calls.filter((x) => x[0] === 'install').length, 0);
});
test('cancel: asks the plugin to stop, and the user gets "Download cancelled."', async () => {
  let release; const gate = new Promise((res) => { release = res; });
  const r = rig({ plugin: { download: async () => { await gate; throw { code: 'CANCELLED', message: 'Download cancelled.' }; } } });
  await r.c.check(); const p = r.c.download(); await new Promise((x) => setImmediate(x));
  assert.equal(r.c.st.state, 'downloading'); await r.c.cancel(); assert.ok(r.calls.some((x) => x[0] === 'cancelDownload')); release(); await p;
  assert.equal(r.c.st.state, 'available'); assert.equal(r.c.st.message, 'Download cancelled.');
  await r.c.cancel(); assert.equal(r.calls.filter((x) => x[0] === 'cancelDownload').length, 1, 'cancel does nothing when not downloading');
});
test('install: music and Bluetooth are closed BEFORE the installer opens', async () => {
  const r = rig(); await r.c.check(); await r.c.download(); await r.c.install();
  assert.deepEqual(r.order, ['hook.before', 'plugin.install']); assert.equal(r.c.st.state, 'installing');
  assert.deepEqual(JSON.parse(r.store.get(A.PENDING_KEY)), { code: 10108, name: '1.1.8' });
});
test('install: nothing is touched when Android has not allowed installing yet (permission guide first)', async () => {
  const r = rig({ info: { canInstall: false } }); await r.c.check(); await r.c.download(); await r.c.install();
  assert.equal(r.c.st.state, 'permission'); assert.deepEqual(r.order, [], 'Bluetooth and music are left alone');
  await r.c.openPermissionSettings(); assert.ok(r.calls.some((x) => x[0] === 'openSettings'));
  r.setInfo({ canInstall: true }); r.c.noteHidden(); r.c.noteVisible(); await new Promise((x) => setImmediate(x)); await new Promise((x) => setImmediate(x));
  assert.equal(r.c.st.state, 'ready'); assert.match(r.c.st.message, /Permission allowed/);
  await r.c.install(); assert.deepEqual(r.order, ['hook.before', 'plugin.install']);
});
test('install: a permission refusal from the plugin also restores Bluetooth', async () => {
  const r = rig({ plugin: { install: async () => { throw { code: 'INSTALL_PERMISSION', message: 'x' }; } } }); await r.c.check(); await r.c.download(); await r.c.install();
  assert.equal(r.c.st.state, 'permission'); assert.deepEqual(r.order, ['hook.before', 'hook.after']);
  assert.equal(r.store.get(A.PENDING_KEY), undefined);
});
test('install: coming back without installing reconnects Bluetooth and says so', async () => {
  const r = rig(); await r.c.check(); await r.c.download(); await r.c.install();
  r.c.noteHidden(); r.c.noteVisible(); await new Promise((x) => setImmediate(x));
  assert.equal(r.c.st.state, 'ready'); assert.match(r.c.st.message, /not completed/); assert.deepEqual(r.order, ['hook.before', 'plugin.install', 'hook.after']);
  assert.equal(r.store.get(A.PENDING_KEY), undefined);
});
test('install: the focus fallback works too, but not instantly after launch', async () => {
  const r = rig(); await r.c.check(); await r.c.download(); await r.c.install();
  r.c.noteFocus(); assert.equal(r.c.st.state, 'installing', 'the installer is still opening');
  r.tick(2000); r.c.noteFocus(); await new Promise((x) => setImmediate(x)); assert.equal(r.c.st.state, 'ready');
});
test('install: a failing hook never blocks the update', async () => {
  const r = rig({ hooks: { beforeInstall: async () => { throw new Error('boom'); } } }); await r.c.check(); await r.c.download(); await r.c.install();
  assert.equal(r.calls.filter((x) => x[0] === 'install').length, 1);
});
test('install is ignored unless a verified update is ready', async () => {
  const r = rig(); await r.c.install(); await r.c.check(); await r.c.install(); assert.equal(r.calls.filter((x) => x[0] === 'install').length, 0);
});
test('after a finished update the next start reports it and deletes the downloaded file', async () => {
  const r = rig(); r.store.set(A.PENDING_KEY, JSON.stringify({ code: 10108, name: '1.1.8' })); r.setInfo({ versionCode: 10108, versionName: '1.1.8' });
  await r.c.start(); assert.match(r.c.st.message, /updated to v1\.1\.8/); assert.ok(r.calls.some((x) => x[0] === 'cleanup')); assert.equal(r.store.get(A.PENDING_KEY), undefined);
});
test('a pending marker from an install that never happened is dropped silently', async () => {
  const r = rig(); r.store.set(A.PENDING_KEY, JSON.stringify({ code: 10108, name: '1.1.8' })); await r.c.start();
  assert.equal(r.c.st.message, ''); assert.equal(r.store.get(A.PENDING_KEY), undefined); assert.equal(r.calls.some((x) => x[0] === 'cleanup'), false);
});
