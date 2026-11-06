/* Native Bluetooth adapter for the Capacitor APK.
 * Calls the bluetooth-le plugin with the argument shapes it expects:
 *   connect({ deviceId }), disconnect({ deviceId }),
 *   writeWithoutResponse({ deviceId, service, characteristic, value: <hex string> }).
 * Does nothing in a normal browser (the web preview keeps using Web Bluetooth). */
(function (g) {
  'use strict';
  if (!g.Capacitor || !g.Capacitor.isNativePlatform || !g.Capacitor.isNativePlatform()) return;

  const P = g.Melk.protocol;
  const Base = g.Melk.Link;
  const KEY = 'melk.native.deviceId';
  const RETRY_MS = [800, 1500, 3000, 5000, 8000, 12000];
  const CONNECT_TIMEOUT = 12000;   // ms; the plugin default is 10000
  const NOTIFY_UUID = '0000fff4-0000-1000-8000-00805f9b34fb';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

  function ble() {
    const p = (g.Capacitor.Plugins && g.Capacitor.Plugins.BluetoothLe) ||
      (typeof g.Capacitor.registerPlugin === 'function'
        ? g.Capacitor.registerPlugin('BluetoothLe') : null);
    if (!p) throw new Error('Bluetooth plugin not found. Run npx cap sync and rebuild the APK.');
    return p;
  }

  class NativeLink extends Base {
    constructor() {
      super();
      this.deviceId = null;
      this.listener = null;
      this._manual = false;
      this.reconnecting = false;
      this._gen = 0;   // bumped by every connect/disconnect, cancels older retry loops
      this.gap = 40;
      this._connecting = false;
      this._fail = 0;          // consecutive write failures
      this.info = null;        // last GATT inspection result, shown in the Controller card
      // App khulte hi pichli strip se khud judne ki koshish
      const saved = localStorage.getItem(KEY);
      if (saved) { this.deviceId = saved; setTimeout(() => this._reconnect(), 1200); }
    }
    get supported() { return true; }

    async _init() {
      const p = ble();
      await p.initialize({ androidNeverForLocation: true });
      if (typeof p.isEnabled === 'function') {
        let on = true;
        try { const r = await p.isEnabled(); on = r && typeof r === 'object' ? r.value !== false : r !== false; } catch (e) { /* unknown, carry on */ }
        if (!on && typeof p.requestEnable === 'function') { try { await p.requestEnable(); on = true; } catch (e) { on = false; } }
        if (!on) { const err = new Error('Bluetooth is turned off.'); err.code = 'BT_OFF'; throw err; }
      }
    }

    // Read the controller's GATT layout. Only a missing FFF0 service is a hard failure; anything
    // odd about FFF3/FFF4 is recorded as a warning so a working strip is never blocked.
    async _inspect(id, name) {
      const info = { name: name || null, checked: false, services: [], fff0: null, fff3: null, fff4: null, warn: [] };
      const p = ble();
      if (typeof p.getServices === 'function') {
        try {
          const res = await p.getServices({ deviceId: id });
          const list = (res && res.services) || [];
          const low = (u) => String(u).toLowerCase();
          info.checked = list.length > 0;
          info.services = list.map((x) => low(x.uuid));
          const svc = list.find((x) => low(x.uuid) === P.SERVICE || /^(0x)?fff0$/.test(low(x.uuid)));
          info.fff0 = info.checked ? !!svc : null;
          if (svc) {
            const find = (short, full) => (svc.characteristics || []).find((c) => low(c.uuid) === full || new RegExp('^(0x)?' + short + '$').test(low(c.uuid)));
            const c3 = find('fff3', P.CHAR), c4 = find('fff4', NOTIFY_UUID);
            info.fff3 = c3 ? { write: !!(c3.properties && c3.properties.write), writeWithoutResponse: !!(c3.properties && c3.properties.writeWithoutResponse) } : null;
            info.fff4 = c4 ? { notify: !!(c4.properties && c4.properties.notify) } : null;
            if (!c3) info.warn.push('FFF3 command characteristic not listed');
            else if (!info.fff3.writeWithoutResponse) info.warn.push('FFF3 does not report write-without-response');
          }
        } catch (e) { info.warn.push('Could not read services: ' + ((e && e.message) || e)); }
      }
      if (info.checked && info.fff0 === false) {
        try { await p.disconnect({ deviceId: id }); } catch (e) { /* ignore */ }
        const err = new Error('This device does not offer the MELK control service (FFF0).'); err.code = 'NO_SERVICE'; throw err;
      }
      this.info = info;
      return info;
    }

    async _open(id, name) {
      await ble().connect({ deviceId: id, timeout: CONNECT_TIMEOUT });
      await this._inspect(id, name);
      if (this.listener) { try { await this.listener.remove(); } catch (e) { /* already gone */ } }
      this.listener = await ble().addListener('disconnected|' + id, () => this._dropped());
      this.deviceId = id;
      localStorage.setItem(KEY, id);
      if (name) this.deviceName = name;                       // remembered so an automatic reconnect shows the real name too
      this._set('connected', name || this.deviceName || 'LED strip');
    }

    async connect(showAll) {
      if (this._connecting) { const err = new Error('A connection attempt is already running.'); err.code = 'BUSY'; throw err; }
      this._connecting = true;
      try { await this._connect(showAll); } finally { this._connecting = false; }
    }

    async _connect(showAll) {
      this._gen++;               // cancel any background retry loop
      this.reconnecting = false;
      this._manual = false;
      this._set('connecting');
      try {
        await this._init();      // asks for Bluetooth permission if not yet granted
        // Native Android picker should show all nearby BLE devices. Some controllers advertise\n        // a different name (or no name), so the web-only prefix filter hides them.\n        const dev = await ble().requestDevice({});
        const id = dev && (dev.deviceId || dev.id);
        if (!id) throw new Error('No device was selected. Please try again.');
        await this._open(id, dev.name);
      } catch (e) {
        this._set('idle', '');
        const msg = (e && e.message) || '';
        // Let the UI report failure; a cancelled picker must never say Connected.
        if (/cancel/i.test(msg)) e.name = 'NotFoundError';
        throw e;
      }
    }

    _dropped() {
      this.queue.length = 0;
      if (this._manual || !this.deviceId) { this._set('idle', ''); return; }
      this._reconnect();
    }

    async _reconnect() {
      if (this.reconnecting || !this.deviceId) return;
      const my = ++this._gen;
      this.reconnecting = true;
      this._set('connecting');
      try {
        await this._init();      // permission prompt happens here on launch too
      } catch (e) {
        this.reconnecting = false;
        this._set('idle', '');
        this.dispatchEvent(new CustomEvent('error', { detail: e }));
        return;
      }
      for (const d of RETRY_MS) {
        await sleep(d);
        if (my !== this._gen || this._manual || !this.deviceId) return;   // cancelled
        try {
          await this._open(this.deviceId, this.deviceName);
          this.reconnecting = false;
          this.dispatchEvent(new CustomEvent('restored'));
          return;
        } catch (e) { /* strip not in range yet */ }
      }
      if (my !== this._gen) return;
      this.reconnecting = false;
      this._set('idle', '');
      this.dispatchEvent(new CustomEvent('lost'));
    }

    async _recover() {
      if (this._manual || !this.deviceId || this.reconnecting) return;
      this.dispatchEvent(new CustomEvent('recovering'));
      try { await ble().disconnect({ deviceId: this.deviceId }); } catch (e) { /* ignore */ }
      this._reconnect();         // no-op if the disconnect callback already started it
    }

    /**
     * Close the Bluetooth connection cleanly before an app update, but keep the saved strip so the updated app (or this one,
     * if the update is cancelled) reconnects by itself. Unlike disconnect(), the remembered device id is NOT cleared.
     */
    async suspend() {
      if (this.state === 'demo') return;
      this._manual = true; this._gen++; this.reconnecting = false;     // stops any retry loop and blocks auto-reconnect
      const t0 = Date.now();
      while (this.pumping && Date.now() - t0 < 600) await sleep(20);   // let a write that is already in flight finish
      this.queue.length = 0;
      const id = this.deviceId;
      if (id && this.state !== 'idle') { try { await ble().disconnect({ deviceId: id }); } catch (e) { /* already closed */ } }
      this._set('idle', '');
    }

    /** Undo suspend(): reconnect to the remembered strip. */
    async unsuspend() {
      this._manual = false;
      if (this.deviceId) this._reconnect();
    }

    resume() { if (this.state === 'idle' && this.deviceId && !this._manual) this._reconnect(); }

    async disconnect() {
      this._manual = true;
      this._gen++;
      this.reconnecting = false;
      this.queue.length = 0;
      const id = this.deviceId;
      this.deviceId = null;
      localStorage.removeItem(KEY);
      if (id) { try { await ble().disconnect({ deviceId: id }); } catch (e) { /* ignore */ } }
      if (this.listener) { try { await this.listener.remove(); } catch (e) { /* ignore */ } this.listener = null; }
      this._set('idle', '');
    }

    startDemo() { this._set('demo', 'Demo strip'); }

    async _pump() {
      if (this.pumping) return;
      this.pumping = true;
      while (this.queue.length) {
        const { bytes } = this.queue.shift();
        try {
          if (this.state === 'connected' && this.deviceId) {
            await ble().writeWithoutResponse({
              deviceId: this.deviceId,
              service: P.SERVICE,
              characteristic: P.CHAR,
              value: hex(bytes),
            });
          }
          this._fail = 0;
          this.dispatchEvent(new CustomEvent('tx', { detail: P.hex(bytes) }));
        } catch (e) {
          this.dispatchEvent(new CustomEvent('error', { detail: e }));
          if (++this._fail >= 3) {   // the link is probably dead even though Android did not say so
            this._fail = 0; this.queue.length = 0; this.pumping = false;
            this._recover();
            return;
          }
        }
        await sleep(this.gap);
      }
      this.pumping = false;
    }
  }
  g.Melk.Link = NativeLink;
})(window);
