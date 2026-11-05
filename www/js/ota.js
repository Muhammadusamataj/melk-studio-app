/* MELK Studio self-hosted OTA. No Bluetooth code is changed here. */
(function(g) {
  'use strict';
  const APP_VERSION = '1.2.1';
  const DEFAULT_URL = 'https://muhammadusamataj.github.io/melk-studio-ota-/ota/melk-version.json';
  const KEY_URL = 'melk.ota.url', KEY_PIN = 'melk.admin', KEY_FAIL = 'melk.admin.fail';
  const store = {
    get(k) { try { return g.localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { g.localStorage.setItem(k, v); } catch (_) {} },
    del(k) { try { g.localStorage.removeItem(k); } catch (_) {} },
  };
  // Update server: https only, a .json manifest, no embedded credentials.
  function validUrl(u) {
    try { const x = new URL(String(u).trim()); return x.protocol === 'https:' && !x.username && !x.password && x.hostname.indexOf('.') > 0 && /\.json$/i.test(x.pathname); }
    catch (_) { return false; }
  }
  function activeUrl() { const o = store.get(KEY_URL); return o && validUrl(o) ? o : DEFAULT_URL; }
  const isCustom = () => activeUrl() !== DEFAULT_URL;
  const el = id => document.getElementById(id);
  const native = !!(g.Capacitor && typeof g.Capacitor.isNativePlatform === 'function' && g.Capacitor.isNativePlatform());
  const updater = native && g.Capacitor.Plugins && g.Capacitor.Plugins.CapacitorUpdater;
  let busy = false, available = null;
  function status(message) { const e = el('otaStatus'); if (e) e.textContent = message; }
  function setBusy(b) { busy = b; const e = el('otaCheck'); if (e) e.disabled = b; const i = el('otaInstall'); if (i) i.disabled = b; }
  function newer(current, remote) {
    const a=String(current).split('.').map(Number), b=String(remote).split('.').map(Number);
    for (let i=0;i<3;i++) if ((a[i]||0)!==(b[i]||0)) return (b[i]||0)>(a[i]||0);
    return false;
  }
  async function runningVersion() {
    if (!updater) return APP_VERSION;
    try {
      const r=await updater.current();
      const version=r && r.bundle && r.bundle.version;
      // Capgo identifies the bundled web app as "builtin", not a version number.
      return /^\d+\.\d+\.\d+$/.test(String(version)) ? version : APP_VERSION;
    }
    catch (_) { return APP_VERSION; }
  }
  async function compatible(info) {
    const minimum = info.minNativeVersionCode;
    if (minimum === undefined) return true; // backwards-compatible web-only manifests remain supported
    if (!Number.isInteger(minimum) || minimum < 1 || minimum > 2147483647) throw new Error('Invalid minimum native version');
    const apk = native && g.Capacitor.Plugins && g.Capacitor.Plugins.ApkUpdater;
    if (!apk || typeof apk.getInfo !== 'function') throw new Error('Install a compatible Android APK before this web update (build ' + minimum + '+).');
    const installed = await apk.getInfo();
    if (!Number.isInteger(installed.versionCode) || installed.versionCode < minimum) throw new Error('This web update needs Android app build ' + minimum + '+. Update the APK first.');
    return true;
  }
  async function check(manual) {
    if (busy) return;
    setBusy(true);
    const install=el('otaInstall'); if (install) install.hidden=true;
    available=null;
    status('Checking ' + new URL(activeUrl()).host + ' for updates…');
    try {
      // Prefer Capacitor's native HTTP bridge on Android to avoid WebView CORS.
      // This uses HTTPS and never changes the BLE scanning/connection modules.
      let info;
      const http = native && g.Capacitor && g.Capacitor.Plugins && g.Capacitor.Plugins.CapacitorHttp;
      if (http && typeof http.get === 'function') {
        const res = await http.get({
          url: activeUrl(),
          headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
          connectTimeout: 12000,
          readTimeout: 12000
        });
        if (res.status < 200 || res.status >= 300) throw new Error('Server HTTP '+res.status);
        info = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      } else {
        const res = await fetch(activeUrl(), {cache:'no-store'});
        if (!res.ok) throw new Error('Server HTTP '+res.status);
        info = await res.json();
      }
      if (!info || !/^\d+\.\d+\.\d+$/.test(String(info.version)) ||
        !/^https:\/\//.test(String(info.url)) ||
        new URL(info.url).origin !== new URL(activeUrl()).origin) throw new Error('Invalid update manifest');
      const current=await runningVersion();
      if (!newer(current,info.version)) { status('Up to date (v'+current+'). Server has v'+info.version+' at '+new URL(activeUrl()).host+'.'); return; }
      await compatible(info);
      available=info;
      if (!updater) { status('v'+info.version+' is available, but this APK has no native OTA updater. Rebuild/install an OTA-enabled APK once.'); return; }
      status('New web update v'+info.version+' available. Install only when you are not controlling the strip.');
      if (install) install.hidden=false;
    } catch(e) { status('Update check failed: '+(e.message||e)+' ('+new URL(activeUrl()).host+')'); if (!manual) console.warn('[MELK OTA]',e); }
    finally {setBusy(false);}
  }
  async function install() {
    if (!updater || !available || busy) return;
    const info=available;
    try { await compatible(info); } catch (e) { status(e.message); return; }
    if (!g.confirm('Download MELK Studio v'+info.version+'? Apply after restarting the app.')) return;
    setBusy(true);
    const progress=el('otaProgress');
    if (progress) {progress.hidden=false;progress.removeAttribute('value');}
    status('Downloading update… Keep the app open.');
    try {
      // Native updater requires the SHA-256 checksum of the downloaded ZIP.
      // Read the exact value from the trusted manifest, not from local guesswork.
      if (!/^[a-f0-9]{64}$/i.test(String(info.sha256 || ''))) {
        throw new Error('Update manifest is missing a valid SHA-256 checksum');
      }
      const bundle=await updater.download({url:info.url,version:info.version,checksum:info.sha256});
      if (!bundle || !bundle.id) throw new Error('Updater returned no bundle ID');
      await updater.next({id:bundle.id});
      status('v'+info.version+' downloaded. Close and reopen the app to apply.');
      const i=el('otaInstall'); if(i)i.hidden=true;
    } catch(e) {status('Update failed; current app remains active. '+(e.message||e));}
    finally {if(progress)progress.hidden=true;setBusy(false);}
  }

  /* ---------- admin lock: protects the update-server setting ---------- */
  const toastEl = () => el('toast');
  let toastT;
  function toast(m) { const t = toastEl(); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3000); }
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const enc = new TextEncoder();
  const b64 = (buf) => btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
  const unb64 = (t) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
  async function derive(pin, salt, iter) {
    const key = await g.crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
    return b64(await g.crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256));
  }
  async function savePin(pin) {
    const salt = g.crypto.getRandomValues(new Uint8Array(16)), iter = 150000;
    store.set(KEY_PIN, JSON.stringify({ salt: b64(salt), iter, hash: await derive(pin, salt, iter) }));
  }
  async function pinOk(pin) {
    const rec = JSON.parse(store.get(KEY_PIN));
    return (await derive(pin, unb64(rec.salt), rec.iter)) === rec.hash;
  }
  const failRec = () => { try { return JSON.parse(store.get(KEY_FAIL) || '{}'); } catch (_) { return {}; } };
  const lockMs = () => Math.max(0, (failRec().until || 0) - Date.now());
  function noteFail() { const f = failRec(); f.n = (f.n || 0) + 1; let left = 5 - f.n; if (f.n >= 5) { f.until = Date.now() + 5 * 60000; f.n = 0; left = 0; } store.set(KEY_FAIL, JSON.stringify(f)); return left; }
  let adminUntil = 0;
  const isAdmin = () => Date.now() < adminUntil;

  function showDlg(html, mount) {
    const dlg = el('dlg'), form = el('dlgForm'); if (!dlg || !form) return;
    form.innerHTML = html;
    // Enter must click our primary button, not submit the shared dialog form.
    form.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const b = form.querySelector('[data-primary]'); if (b) b.click(); } }));
    if (mount) mount(form);
    if (!dlg.open) dlg.showModal();
  }
  function closeDlg() { const d = el('dlg'); if (d && d.open) d.close(); }
  function refreshHost() {
    const h = el('otaHost'); if (h) h.textContent = new URL(activeUrl()).host + (isCustom() ? ' (custom)' : '');
  }

  function pinDialog(changing) {
    showDlg('<h3>' + (changing ? 'Change admin PIN' : 'Create admin PIN') + '</h3>' +
      '<p class="hint">At least 6 characters. This PIN protects the update server setting on this phone. If you forget it, clear the app data to reset it.</p>' +
      '<label class="field"><span>New PIN</span><input class="text" type="password" name="a" autocomplete="new-password"></label>' +
      '<label class="field"><span>Repeat PIN</span><input class="text" type="password" name="b" autocomplete="new-password"></label>' +
      '<p class="hint" id="admMsg" role="alert"></p>' +
      '<div class="dlgActs"><button class="btn ghost" type="button" id="admCancel">Cancel</button><button class="btn main" type="button" id="admSave" data-primary>Save PIN</button></div>',
    (f) => {
      f.querySelector('#admCancel').addEventListener('click', closeDlg);
      f.querySelector('#admSave').addEventListener('click', async () => {
        const msg = f.querySelector('#admMsg'), a = f.a.value, b = f.b.value;
        if (a.length < 6) { msg.textContent = 'Use at least 6 characters.'; return; }
        if (a !== b) { msg.textContent = 'The two PINs do not match.'; return; }
        try { await savePin(a); } catch (e) { msg.textContent = 'Could not save the PIN on this device.'; return; }
        adminUntil = Date.now() + 5 * 60000; toast('Admin PIN saved'); panelDialog();
      });
    });
  }
  function loginDialog() {
    showDlg('<h3>Admin login</h3>' +
      '<label class="field"><span>PIN</span><input class="text" type="password" name="p" autocomplete="current-password"></label>' +
      '<p class="hint" id="admMsg" role="alert"></p>' +
      '<div class="dlgActs"><button class="btn ghost" type="button" id="admCancel">Cancel</button><button class="btn main" type="button" id="admGo" data-primary>Log in</button></div>',
    (f) => {
      f.querySelector('#admCancel').addEventListener('click', closeDlg);
      f.querySelector('#admGo').addEventListener('click', async () => {
        const msg = f.querySelector('#admMsg');
        if (lockMs() > 0) { msg.textContent = 'Too many wrong tries. Try again in ' + Math.ceil(lockMs() / 60000) + ' min.'; return; }
        let ok = false;
        try { ok = await pinOk(f.p.value); } catch (_) { msg.textContent = 'Could not check the PIN on this device.'; return; }
        if (ok) { store.del(KEY_FAIL); adminUntil = Date.now() + 5 * 60000; panelDialog(); return; }
        const left = noteFail();
        msg.textContent = left > 0 ? 'Wrong PIN. ' + left + ' tries left.' : 'Locked for 5 minutes.';
        f.p.value = '';
      });
    });
  }
  function panelDialog() {
    showDlg('<h3>Update server</h3>' +
      '<p class="hint">The app will run the code in whatever update this server offers. Enter only a server you control. It must be https and end in .json.</p>' +
      '<label class="field"><span>Manifest URL</span><input class="text" type="url" name="u" value="' + esc(activeUrl()) + '" autocomplete="off" spellcheck="false"></label>' +
      '<p class="hint" id="admMsg" role="status"></p>' +
      '<div class="dlgActs" style="flex-wrap:wrap"><button class="btn ghost" type="button" id="admReset">Reset to default</button><button class="btn main" type="button" id="admSaveUrl" data-primary>Save</button></div>' +
      '<div class="dlgActs" style="flex-wrap:wrap"><button class="btn ghost" type="button" id="admPin">Change PIN</button><button class="btn ghost" type="button" id="admOut">Log out</button></div>',
    (f) => {
      const msg = f.querySelector('#admMsg');
      f.querySelector('#admSaveUrl').addEventListener('click', () => {
        if (!isAdmin()) { loginDialog(); return; }
        const v = f.u.value.trim();
        if (!validUrl(v)) { msg.textContent = 'Not accepted. Use an https link that ends in .json.'; return; }
        if (v === DEFAULT_URL) store.del(KEY_URL); else store.set(KEY_URL, v);
        refreshHost(); msg.textContent = 'Saved. Press Check for Updates to use it.';
      });
      f.querySelector('#admReset').addEventListener('click', () => {
        if (!isAdmin()) { loginDialog(); return; }
        store.del(KEY_URL); f.u.value = DEFAULT_URL; refreshHost(); msg.textContent = 'Back to the default server.';
      });
      f.querySelector('#admPin').addEventListener('click', () => { if (isAdmin()) pinDialog(true); else loginDialog(); });
      f.querySelector('#admOut').addEventListener('click', () => { adminUntil = 0; closeDlg(); toast('Logged out'); });
    });
  }
  function openAdmin() {
    if (!(g.crypto && g.crypto.subtle)) { toast('This device cannot protect the PIN. Admin is unavailable.'); return; }
    if (lockMs() > 0) { toast('Locked. Try again in ' + Math.ceil(lockMs() / 60000) + ' min.'); return; }
    if (!store.get(KEY_PIN)) pinDialog(false);
    else if (isAdmin()) panelDialog();
    else loginDialog();
  }

  function init() {
    if(el('otaVersion'))el('otaVersion').textContent='v'+APP_VERSION;
    if(el('otaCapability'))el('otaCapability').textContent=updater?'Available':'Not installed in APK';
    refreshHost();
    if(el('otaAdmin'))el('otaAdmin').addEventListener('click',openAdmin);
    if(el('otaCheck'))el('otaCheck').addEventListener('click',()=>check(true));
    if(el('otaInstall'))el('otaInstall').addEventListener('click',install);
    if(updater) {
      Promise.resolve(updater.notifyAppReady()).catch(e=>console.warn('[MELK OTA] notifyAppReady:',e));
    }
    // Automatic check is informative only; no surprise downloads or BLE interruption.
    if(native) g.setTimeout(()=>check(false),10000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  g.MelkOta={check:()=>check(true),APP_VERSION,url:activeUrl};
})(window);
