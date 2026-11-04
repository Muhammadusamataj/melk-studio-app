"""Shared mock of the Android bridge for the app-update tests: Bluetooth, audio, HTTP and the ApkUpdater plugin.
Every call that matters is also appended to window.__order so tests can check the ORDER (music stop, Bluetooth close, installer)."""
APK_MOCK = r"""
window.__w = []; window.__lis = {}; window.__order = []; window.__ble = {connects: 0, disconnects: 0}; window.__audio = {start: 0, stop: 0};
window.__apk = { calls: [], download: 'ok', httpFail: '', held: null, cancelled: false,
  info: { packageName: 'com.bleled.com', versionName: '1.1.7', versionCode: 10107, sdk: 34, canInstall: true, debuggable: false, signingSha256: ['3fa1c07b52d9e4a86c0b91e7d5f2a3c4b8e61f0d9a7c5b3e2d1f0a9b8c7d6e5f'] },
  manifest: { schema: 1, packageName: 'com.bleled.com', versionName: '1.1.8', versionCode: 10108, url: 'https://muhammadusamataj.github.io/melk-studio-ota-/apk/MELK-Studio-1.1.8.apk', sha256: 'b'.repeat(64), size: 48 * 1048576, notes: 'Test build.' } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const plug = {
  BluetoothLe: { initialize: () => Promise.resolve(), isEnabled: () => Promise.resolve({ value: true }),
    requestDevice: () => Promise.resolve({ deviceId: 'AA:BB:CC:DD:EE:01', name: 'MELK-0C21 F1' }),
    connect: () => { window.__ble.connects++; return Promise.resolve(); },
    disconnect: () => { window.__ble.disconnects++; window.__order.push('ble.disconnect'); return Promise.resolve(); },
    getServices: () => Promise.resolve({ services: [{ uuid: '0000fff0-0000-1000-8000-00805f9b34fb', characteristics: [{ uuid: '0000fff3-0000-1000-8000-00805f9b34fb', properties: { writeWithoutResponse: true } }] }] }),
    addListener: (k, fn) => { window.__lis[k] = fn; return Promise.resolve({ remove: () => Promise.resolve() }); },
    writeWithoutResponse: (o) => { window.__w.push(o.value); return Promise.resolve(); } },
  AudioLevel: { start: () => { window.__audio.start++; return Promise.resolve(); }, stop: () => { window.__audio.stop++; window.__order.push('audio.stop'); return Promise.resolve(); },
    addListener: (k, fn) => { window.__lis['audio:' + k] = fn; return Promise.resolve({ remove: () => Promise.resolve() }); } },
  CapacitorUpdater: { notifyAppReady: () => Promise.resolve({}) },
  CapacitorHttp: { get: async (o) => {
    window.__apk.calls.push(['http', o.url]);
    if (/melk-version\.json/.test(o.url)) return { status: 200, data: { version: window.__apk.info.versionName, url: 'https://muhammadusamataj.github.io/melk-studio-ota-/ota/melk-' + window.__apk.info.versionName + '.zip', sha256: 'c'.repeat(64) } };   // the ZIP (web) manifest: nothing newer
    if (window.__apk.httpFail) throw new Error(window.__apk.httpFail);
    return { status: 200, data: window.__apk.manifest }; } },
};
if (!window.__NO_APK_PLUGIN) plug.ApkUpdater = {
  getInfo: async () => Object.assign({}, window.__apk.info, { ready: false, busy: false, freeBytes: 5e9 }),
  addListener: async (e, fn) => { window.__lis['apk:' + e] = fn; return { remove: async () => { delete window.__lis['apk:' + e]; } }; },
  download: async (o) => {
    window.__apk.calls.push(['download', o]); window.__apk.cancelled = false;
    const emit = (p) => window.__lis['apk:downloadProgress'] && window.__lis['apk:downloadProgress']({ percent: p, downloaded: Math.round(o.size * p / 100), total: o.size });
    const mode = window.__apk.download;
    if (mode === 'checksum') throw { code: 'CHECKSUM_MISMATCH', message: 'mismatch' };
    if (mode === 'nospace') throw { code: 'NO_SPACE', message: 'Not enough free storage. About 80 MB is needed and 12 MB is free.' };
    if (mode === 'network') { emit(20); throw { code: 'NETWORK', message: 'lost' }; }
    if (mode === 'invalid') throw { code: 'VALIDATION_FAILED', message: 'The downloaded app is signed with a different key from the installed app, so Android would refuse it.', data: { problems: ['SIGNATURE_MISMATCH'] } };
    if (mode === 'hold') { emit(0); emit(37); await new Promise((res, rej) => { window.__apk.held = { res, rej }; }); }
    else for (const p of [0, 25, 50, 75, 99, 100]) { if (window.__apk.cancelled) throw { code: 'CANCELLED', message: 'Download cancelled.' }; emit(p); await sleep(70); }
    return { ready: true, fromCache: false, versionCode: o.versionCode, versionName: '1.1.8', bytes: o.size, sha256: o.sha256 };
  },
  cancelDownload: async () => { window.__apk.calls.push(['cancel']); window.__apk.cancelled = true; if (window.__apk.held) window.__apk.held.rej({ code: 'CANCELLED', message: 'Download cancelled.' }); },
  install: async () => { window.__order.push('apk.install'); window.__apk.calls.push(['install']); if (!window.__apk.info.canInstall) throw { code: 'INSTALL_PERMISSION', message: 'no permission' }; return { launched: true }; },
  openInstallPermissionSettings: async () => { window.__apk.calls.push(['openSettings']); return { opened: true }; },
  cleanup: async () => { window.__apk.calls.push(['cleanup']); return { deleted: 1 }; },
};
window.Capacitor = { isNativePlatform: () => true, Plugins: plug };
"""
