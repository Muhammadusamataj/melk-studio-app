/* MELK Studio: full-APK update (Settings, Software updates, "App update").
 *
 * This is separate from the ZIP web update in ota.js. It uses the native ApkUpdater plugin, which downloads over HTTPS,
 * checks SHA-256, package name, build number and signing key, and then opens Android's own Package Installer.
 * The user always confirms there. Nothing is installed silently.
 *
 * Manifest: <OTA site>/apk/apk-version.json (see docs/examples/apk-version.example.json). The ZIP manifest ota/melk-version.json is untouched.
 */
(function (g) {
  'use strict';

  const MANIFEST_URL = 'https://muhammadusamataj.github.io/melk-studio-ota-/apk/apk-version.json';
  const MAX_BYTES = 250 * 1024 * 1024;
  const PENDING_KEY = 'melk.apk.pending';
  const HEX64 = /^[0-9a-f]{64}$/i;

  const fp = (s) => { const t = String(s == null ? '' : s).replace(/[:\s]/g, '').toLowerCase(); return HEX64.test(t) ? t : null; };
  const shortFp = (h) => (h ? h.slice(0, 8) + '…' + h.slice(-4) : 'unknown');
  const mb = (b) => (b / 1048576).toFixed(b >= 10485760 ? 0 : 1) + ' MB';
  const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max);

  /* ---------- manifest ---------- */
  /** Checks apk-version.json. ctx: { packageName (the installed app), manifestUrl }. Nothing from it is trusted until it passes. */
  function validateManifest(raw, ctx) {
    const errors = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['The app-update description is not valid.'], manifest: null };
    if (raw.schema !== 1) errors.push('Unknown description format.');
    if (raw.packageName !== ctx.packageName) errors.push('The update is for a different app (' + clean(raw.packageName, 60) + ').');
    const code = raw.versionCode;
    if (!Number.isInteger(code) || code < 1 || code > 2147483647) errors.push('The build number is invalid.');
    const name = typeof raw.versionName === 'string' && /^[0-9A-Za-z][0-9A-Za-z._+-]{0,31}$/.test(raw.versionName) ? raw.versionName : null;
    if (!name) errors.push('The version name is invalid.');
    let url = null;
    try {
      const u = new URL(String(raw.url)), base = new URL(ctx.manifestUrl);
      if (u.protocol !== 'https:') errors.push('The download address must be https.');
      else if (u.username || u.password) errors.push('The download address must not contain a password.');
      else if (u.origin !== base.origin) errors.push('The download must come from the same server as the description.');
      else if (!/\.apk$/i.test(u.pathname) || String(raw.url).length > 300) errors.push('The download address must be an .apk file.');
      else url = u.href;
    } catch (e) { errors.push('The download address is invalid.'); }
    const sha = typeof raw.sha256 === 'string' && HEX64.test(raw.sha256) ? raw.sha256.toLowerCase() : null;
    if (!sha) errors.push('The SHA-256 checksum is missing or invalid.');
    const size = raw.size;
    if (!Number.isInteger(size) || size < 1 || size > MAX_BYTES) errors.push('The file size is missing or invalid.');
    let cert = null;
    if (raw.signingCertSha256 !== undefined && raw.signingCertSha256 !== null) {
      cert = fp(raw.signingCertSha256);
      if (!cert) errors.push('The signing-key fingerprint is invalid.');
    }
    let minSdk = 0;
    if (raw.minSdk !== undefined && raw.minSdk !== null) {
      if (Number.isInteger(raw.minSdk) && raw.minSdk >= 1 && raw.minSdk <= 99) minSdk = raw.minSdk; else errors.push('minSdk is invalid.');
    }
    if (errors.length) return { ok: false, errors, manifest: null };
    return { ok: true, errors, manifest: { packageName: raw.packageName, versionCode: code, versionName: name, url, sha256: sha, size, signingCertSha256: cert, minSdk, notes: clean(raw.notes, 400) } };
  }

  /* ---------- messages ---------- */
  const FIXED = {
    NETWORK: 'The connection was lost. Check your internet connection and try again.',
    NETWORK_TIMEOUT: 'The connection timed out. Try again on a better connection.',
    CHECKSUM_MISMATCH: 'The downloaded file did not match its SHA-256 checksum, so it was deleted. Nothing was installed.',
    STORAGE_ERROR: 'The phone could not save the update file.',
    CANCELLED: 'Download cancelled.',
    BAD_URL: 'The update address is not usable.',
    BAD_ARGS: 'The update description is not usable.',
    NOT_READY: 'The update file is not ready. Download it again.',
    BUSY: 'An update download is already running.',
    INSTALL_PERMISSION: 'Android needs your permission before MELK Studio can install an update.',
    TOO_LARGE: 'The update file is larger than allowed, so it was refused.',
  };
  const NATIVE_FIRST = ['NO_SPACE', 'HTTP_ERROR', 'SIZE_MISMATCH', 'VALIDATION_FAILED', 'INSTALL_FAILED'];
  function describeError(e) {
    const code = e && e.code, msg = e && e.message;
    if (NATIVE_FIRST.indexOf(code) >= 0 && msg) return msg;
    if (FIXED[code]) return FIXED[code];
    return msg ? String(msg) : 'The update failed for an unknown reason.';
  }

  /* ---------- the controller (no DOM, fully testable) ---------- */
  function create(env) {
    const plugin = env.plugin || null, http = env.http, hooks = env.hooks || {}, storage = env.storage || null;
    const manifestUrl = env.manifestUrl || MANIFEST_URL, onChange = env.onChange || function () {}, now = env.now || (() => Date.now());
    const st = { state: plugin ? 'idle' : 'unavailable', info: null, manifest: null, percent: 0, downloaded: 0, total: 0, message: '', problems: [], fromCache: false, justUpdated: '' };
    let hiddenSeen = false, launchedAt = 0, permAt = 0;
    const emit = (patch) => { Object.assign(st, patch); onChange(snapshot()); };
    const snapshot = () => Object.assign({}, st);
    const notify = (m) => { try { if (hooks.notify) hooks.notify(m); } catch (e) { /* ignore */ } };

    async function refreshInfo() {
      if (!plugin) return null;
      try { st.info = await plugin.getInfo(); } catch (e) { st.info = null; }
      onChange(snapshot());
      return st.info;
    }

    /** Call once at start-up: reads the installed version and reports a finished update. */
    async function start() {
      if (!plugin) { onChange(snapshot()); return; }
      const info = await refreshInfo();
      let pending = null;
      try { pending = storage && JSON.parse(storage.getItem(PENDING_KEY) || 'null'); } catch (e) { pending = null; }
      if (pending && info) {
        try { storage.removeItem(PENDING_KEY); } catch (e) { /* ignore */ }
        if (info.versionCode >= pending.code) {
          try { await plugin.cleanup(); } catch (e) { /* the file is only a convenience copy */ }
          emit({ justUpdated: pending.name || String(info.versionName), message: 'MELK Studio was updated to v' + (info.versionName || pending.name) + '.' });
          notify('MELK Studio updated to v' + (info.versionName || pending.name));
        }
      }
    }

    async function check() {
      if (!plugin || st.state === 'checking' || st.state === 'downloading' || st.state === 'installing') return;
      emit({ state: 'checking', message: '', problems: [], manifest: null, justUpdated: '' });
      try {
        const info = await refreshInfo();
        if (!info) throw new Error('Could not read the installed app details.');
        const raw = await http.getJson(manifestUrl);
        const v = validateManifest(raw, { packageName: info.packageName, manifestUrl });
        if (!v.ok) { emit({ state: 'error', message: v.errors.join(' ') }); return; }
        const m = v.manifest;
        if (m.versionCode <= info.versionCode) { emit({ state: 'uptodate', manifest: m, message: 'MELK Studio is up to date (build ' + info.versionCode + ').' }); return; }
        if (m.minSdk && m.minSdk > info.sdk) { emit({ state: 'error', manifest: m, message: 'This update needs a newer version of Android than this phone has.' }); return; }
        const installedCerts = (info.signingSha256 || []).map(fp).filter(Boolean);
        if (m.signingCertSha256 && (!installedCerts.length || !installedCerts.includes(m.signingCertSha256))) {
          emit({ state: 'incompatible', manifest: m, message: 'This release uses a different signing key. It cannot update this installation in place. Export Settings → Backup and follow the reviewed migration instructions; do not uninstall without a verified backup.' }); return;
        }
        emit({ state: 'available', manifest: m, message: '' });
      } catch (e) {
        // A missing release manifest means no full APK release has been published yet.
        // Do not claim the installed APK is the latest, and do not invent a download.
        const detail = String(e && e.message ? e.message : e);
        if (/\b404\b/.test(detail)) {
          emit({ state: 'idle', message: 'No full-app update has been published yet. Web updates can still be checked above.' });
          return;
        }
        emit({ state: 'error', message: 'Could not check for an app update: ' + detail });
      }
    }

    async function download() {
      if (!plugin || !st.manifest || st.state !== 'available') return;
      const m = st.manifest;
      if (m.versionCode <= (st.info ? st.info.versionCode : 0)) return;
      emit({ state: 'downloading', percent: 0, downloaded: 0, total: m.size, message: '', problems: [], fromCache: false });
      let handle = null;
      try {
        handle = await plugin.addListener('downloadProgress', (e) => {
          if (st.state !== 'downloading') return;
          const p = typeof e.percent === 'number' ? Math.max(st.percent, Math.min(100, e.percent)) : st.percent;
          emit({ percent: e.percent < 0 ? -1 : p, downloaded: e.downloaded || 0, total: e.total || m.size });
        });
        const r = await plugin.download({ url: m.url, sha256: m.sha256, size: m.size, versionCode: m.versionCode, packageName: m.packageName, signingCertSha256: m.signingCertSha256 || '', minSdk: m.minSdk });
        emit({ state: 'ready', percent: 100, downloaded: m.size, fromCache: !!r.fromCache, message: '' });
        await refreshInfo();
      } catch (e) {
        const code = e && e.code;
        emit({ state: 'available', percent: 0, problems: (e && e.data && e.data.problems) || [], message: code === 'CANCELLED' ? FIXED.CANCELLED : describeError(e) });
      } finally {
        if (handle && handle.remove) { try { await handle.remove(); } catch (e) { /* ignore */ } }
      }
    }

    async function cancel() {
      if (plugin && st.state === 'downloading') { try { await plugin.cancelDownload(); } catch (e) { /* ignore */ } }
    }

    async function install() {
      if (!plugin || (st.state !== 'ready' && st.state !== 'permission')) return;
      const info = await refreshInfo();
      if (info && info.canInstall === false) { permAt = now(); emit({ state: 'permission', message: '' }); return; }
      emit({ state: 'installing', message: '' });
      // Leave nothing running: stop music/effects and close the Bluetooth link. Failure here must not block the update.
      try { if (hooks.beforeInstall) await hooks.beforeInstall(); } catch (e) { /* ignore */ }
      try { if (storage && st.manifest) storage.setItem(PENDING_KEY, JSON.stringify({ code: st.manifest.versionCode, name: st.manifest.versionName })); } catch (e) { /* ignore */ }
      try {
        hiddenSeen = false;
        launchedAt = now();
        await plugin.install();
      } catch (e) {
        try { if (storage) storage.removeItem(PENDING_KEY); } catch (e2) { /* ignore */ }
        try { if (hooks.afterInstallCancelled) await hooks.afterInstallCancelled(); } catch (e2) { /* ignore */ }
        if (e && e.code === 'INSTALL_PERMISSION') { permAt = now(); emit({ state: 'permission', message: '' }); return; }
        emit({ state: e && (e.code === 'NOT_READY' || e.code === 'CHECKSUM_MISMATCH' || e.code === 'VALIDATION_FAILED') ? 'available' : 'ready', problems: (e && e.data && e.data.problems) || [], message: describeError(e) });
      }
    }

    async function openPermissionSettings() {
      if (!plugin) return;
      try { permAt = now(); hiddenSeen = false; await plugin.openInstallPermissionSettings(); }
      catch (e) { emit({ message: describeError(e) }); }
    }

    /** The user came back from Android's installer without the app being replaced. */
    async function afterInstaller() {
      if (st.state !== 'installing') return;
      try { if (storage) storage.removeItem(PENDING_KEY); } catch (e) { /* ignore */ }
      emit({ state: 'ready', message: 'The installation was not completed. You can try again, or keep using this version.' });
      try { if (hooks.afterInstallCancelled) await hooks.afterInstallCancelled(); } catch (e) { /* ignore */ }
    }

    async function afterPermission() {
      if (st.state !== 'permission') return;
      const info = await refreshInfo();
      if (info && info.canInstall) emit({ state: 'ready', message: 'Permission allowed. Tap Install update.' });
    }

    function noteHidden() { if (st.state === 'installing' || st.state === 'permission') hiddenSeen = true; }
    function noteVisible() {
      if (st.state === 'installing' && hiddenSeen) afterInstaller();
      else if (st.state === 'permission' && hiddenSeen) afterPermission();
    }
    function noteFocus() {
      if (st.state === 'installing' && launchedAt && now() - launchedAt > 1500) afterInstaller();
      else if (st.state === 'permission' && permAt && now() - permAt > 1000) afterPermission();
    }

    async function cleanup() {
      if (!plugin) return;
      try { await plugin.cleanup(); emit({ state: st.state === 'ready' || st.state === 'permission' ? 'available' : st.state, message: 'The downloaded file was deleted.' }); }
      catch (e) { emit({ message: describeError(e) }); }
    }

    return { st, snapshot, start, check, download, cancel, install, openPermissionSettings, afterInstaller, afterPermission, noteHidden, noteVisible, noteFocus, cleanup, refreshInfo };
  }

  /* ---------- the Settings card ---------- */
  function bindUi(ctrl, doc, flags) {
    const $ = (id) => doc.getElementById(id);
    if (!$('apkCard')) return;
    const set = (id, text) => { const e = $(id); if (e) e.textContent = text; };
    const show = (id, on) => { const e = $(id); if (e) e.hidden = !on; };
    function render(s) {
      const m = s.manifest, info = s.info, busy = s.state === 'checking' || s.state === 'downloading' || s.state === 'installing';
      set('apkInstalled', info ? 'v' + info.versionName + ' (build ' + info.versionCode + ')' : (flags.native ? 'Unknown' : 'Browser preview'));
      set('apkAvailable', m && m.versionCode > (info ? info.versionCode : 0) ? 'v' + m.versionName + ' (build ' + m.versionCode + ', ' + mb(m.size) + ')' : s.state === 'uptodate' ? 'None. You have the newest.' : 'Not checked');
      let text = s.message;
      switch (s.state) {
        case 'unavailable': text = flags.native ? 'App updates are not available in this version. Install the newest MELK Studio APK once to turn them on.' : 'App updates only work inside the Android app.'; break;
        case 'idle': text = text || 'Check whether a newer version of the app is available.'; break;
        case 'checking': text = 'Checking for a newer app version…'; break;
        case 'available': text = (text ? text + ' ' : '') + (m.notes || 'A newer version is ready to download.'); break;
        case 'downloading': text = 'Downloading the update. Keep the app open.'; break;
        case 'ready': text = (text ? text + ' ' : '') + (s.fromCache ? 'Already downloaded. ' : '') + 'Downloaded and verified. Android will ask you to confirm. Music stops and Bluetooth disconnects while it installs.'; break;
        case 'permission': text = ''; break;   // the guide box below carries the instructions
        case 'installing': text = 'Android’s installer is open. Confirm the installation there. Bluetooth reconnects after the update.'; break;
        default: break;
      }
      if (s.justUpdated && s.state === 'idle') text = s.message;
      set('apkStatus', text); show('apkStatus', !!text);
      show('apkAvailRow', !!(m && m.versionCode > (info ? info.versionCode : 0)));
      show('apkProgressRow', s.state === 'downloading');
      const pb = $('apkProgress');
      if (pb) { if (s.percent < 0) pb.removeAttribute('value'); else pb.value = Math.max(0, Math.min(100, s.percent)); }
      set('apkPercent', s.percent < 0 ? 'Downloading…' : Math.round(s.percent) + '%');
      show('apkPermission', s.state === 'permission');
      show('apkCheck', s.state !== 'unavailable' && s.state !== 'downloading' && s.state !== 'installing');
      const ck = $('apkCheck'); if (ck) ck.disabled = busy;
      show('apkDownload', s.state === 'available');
      set('apkDownload', m ? 'Download update (' + mb(m.size) + ')' : 'Download update');
      show('apkCancel', s.state === 'downloading');
      show('apkInstall', s.state === 'ready' || s.state === 'permission');
      show('apkCleanup', s.state === 'ready' || s.state === 'available' || s.state === 'permission');
      if (info) {
        set('apkPackage', info.packageName);
        set('apkBuildType', info.debuggable ? 'Debug build' : 'Release build');
        set('apkSigner', (info.signingSha256 && info.signingSha256.length ? shortFp(info.signingSha256[0]) : 'unknown'));
        set('apkAndroid', 'Android API ' + info.sdk);
      }
      const badge = $('apkBadge'); if (badge) { badge.textContent = flags.preview ? 'PREVIEW' : s.state === 'unavailable' ? 'NOT AVAILABLE' : 'FULL APP'; badge.dataset.s = s.state === 'unavailable' ? 'UNSUPPORTED' : 'UNVERIFIED'; }
    }
    const on = (id, fn) => { const e = $(id); if (e) e.addEventListener('click', fn); };
    on('apkCheck', () => ctrl.check());
    on('apkDownload', () => ctrl.download());
    on('apkCancel', () => ctrl.cancel());
    on('apkInstall', () => ctrl.install());
    on('apkPermOpen', () => ctrl.openPermissionSettings());
    on('apkCleanup', () => ctrl.cleanup());
    return render;
  }

  /* ---------- preview simulation (only the standalone browser preview defines window.MELK_PREVIEW) ---------- */
  function previewEnv() {
    const listeners = {}; let canInstall = false, cancelled = false, ready = false;
    const info = { packageName: 'com.bleled.com', versionName: '1.1.7', versionCode: 10107, sdk: 34, canInstall: false, debuggable: false, signingSha256: ['3fa1c07b52d9e4a86c0b91e7d5f2a3c4b8e61f0d9a7c5b3e2d1f0a9b8c7d6e5f'], freeBytes: 8e9 };
    const emit = (e, d) => (listeners[e] || []).forEach((f) => f(d));
    const plugin = {
      getInfo: async () => Object.assign({}, info, { canInstall, ready }),
      addListener: async (e, f) => { (listeners[e] = listeners[e] || []).push(f); return { remove: async () => { listeners[e] = (listeners[e] || []).filter((x) => x !== f); } }; },
      cancelDownload: async () => { cancelled = true; },
      download: (o) => new Promise((resolve, reject) => {
        cancelled = false; let p = 0;
        const t = setInterval(() => {
          if (cancelled) { clearInterval(t); reject({ code: 'CANCELLED', message: 'Download cancelled.' }); return; }
          p += 4; emit('downloadProgress', { percent: Math.min(99, p), downloaded: Math.round(o.size * p / 100), total: o.size });
          if (p >= 100) { clearInterval(t); ready = true; emit('downloadProgress', { percent: 100, downloaded: o.size, total: o.size }); resolve({ ready: true, fromCache: false, versionCode: o.versionCode, bytes: o.size, sha256: o.sha256 }); }
        }, 150);
      }),
      install: async () => { if (!canInstall) throw { code: 'INSTALL_PERMISSION', message: 'Allow MELK Studio to install apps in Android settings first.' }; setTimeout(() => g.dispatchEvent(new g.Event('focus')), 3800); return { launched: true }; },
      openInstallPermissionSettings: async () => { setTimeout(() => { canInstall = true; g.dispatchEvent(new g.Event('focus')); }, 2200); return { opened: true }; },
      cleanup: async () => { ready = false; return { deleted: 1 }; },
    };
    const manifest = { schema: 1, packageName: 'com.bleled.com', versionName: '1.1.8', versionCode: 10108, url: 'https://muhammadusamataj.github.io/melk-studio-ota-/apk/MELK-Studio-1.1.8.apk', sha256: 'b'.repeat(64), size: 48 * 1048576, notes: 'Preview only: this is a simulation, nothing is downloaded.' };
    return { plugin, http: { getJson: async () => manifest } };
  }

  function makeHttp(native) {
    return {
      async getJson(url) {
        const h = native && g.Capacitor && g.Capacitor.Plugins && g.Capacitor.Plugins.CapacitorHttp;
        if (h && typeof h.get === 'function') {
          const res = await h.get({ url, headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' }, connectTimeout: 12000, readTimeout: 12000 });
          if (res.status < 200 || res.status >= 300) throw new Error('Server answered ' + res.status);
          return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        }
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('Server answered ' + res.status);
        return res.json();
      },
    };
  }

  /** Called by app.js with the hooks that stop music and disconnect Bluetooth around an install. */
  function init(opts) {
    const doc = g.document;
    const native = !!(g.Capacitor && g.Capacitor.isNativePlatform && g.Capacitor.isNativePlatform());
    let plugin = native && g.Capacitor.Plugins && g.Capacitor.Plugins.ApkUpdater ? g.Capacitor.Plugins.ApkUpdater : null;
    let http = makeHttp(native), preview = false;
    if (!plugin && g.MELK_PREVIEW) { const p = previewEnv(); plugin = p.plugin; http = p.http; preview = true; }
    let render = function () {};
    const ctrl = create({ plugin, http, hooks: (opts && opts.hooks) || {}, storage: g.localStorage, onChange: (s) => render(s) });
    render = bindUi(ctrl, doc, { native, preview }) || render;
    doc.addEventListener('visibilitychange', () => { if (doc.hidden) ctrl.noteHidden(); else ctrl.noteVisible(); });
    g.addEventListener('focus', () => ctrl.noteFocus());
    ctrl.start();
    g.MelkApk.controller = ctrl;
    return ctrl;
  }

  g.MelkApk = { create, validateManifest, describeError, init, MANIFEST_URL, PENDING_KEY };
})(typeof window !== 'undefined' ? window : globalThis);
