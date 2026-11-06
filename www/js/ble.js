/* Web Bluetooth link: coalescing write queue, auto-reconnect, demo mode. */
(function (g) {
  'use strict';
  const P = g.Melk.protocol;
  const RETRY_MS = [800, 1500, 3000, 5000, 8000, 12000];

  // Android 8.1 head units can ship Chromium/WebView 61, where EventTarget
  // is available for DOM nodes but is not constructible with `new EventTarget()`.
  // An EventTarget superclass then throws during app boot and every button stays dead.
  // Keep the native EventTarget where supported; use a minimal compatible emitter otherwise.
  const EventBase = (function () {
    try { if (typeof EventTarget === 'function') { new EventTarget(); return EventTarget; } }
    catch (_) { /* Older Android WebView: fall through. */ }
    return class LegacyEventTarget {
      constructor() { this._listeners = {}; }
      addEventListener(type, listener) {
        if (!listener) return;
        (this._listeners[type] || (this._listeners[type] = [])).push(listener);
      }
      removeEventListener(type, listener) {
        const list = this._listeners[type];
        if (!list) return;
        const index = list.indexOf(listener);
        if (index !== -1) list.splice(index, 1);
      }
      dispatchEvent(event) {
        if (!event || !event.type) throw new TypeError('Expected an event');
        (this._listeners[event.type] || []).slice().forEach(listener => {
          if (typeof listener === 'function') listener.call(this, event);
          else if (listener && typeof listener.handleEvent === 'function') listener.handleEvent(event);
        });
        return !event.defaultPrevented;
      }
    };
  })();

  class Link extends EventBase {
    constructor() {
      super();
      this.state = 'idle'; // idle | connecting | connected | demo
      this.name = '';
      this.device = null;
      this.char = null;
      this.queue = [];
      this.pumping = false;
      this.gap = 35; // ms between writes; the strip drops packets if flooded
      this.reconnecting = false;
      this._manual = false;
    }
    get supported() { return typeof navigator !== 'undefined' && !!navigator.bluetooth; }
    get ready() { return this.state === 'connected' || this.state === 'demo'; }
    _set(state, name) {
      this.state = state;
      if (name !== undefined) this.name = name;
      this.dispatchEvent(new CustomEvent('state', { detail: { state, name: this.name } }));
    }
    startDemo() { this._set('demo', 'Demo strip'); }

    async _open() {
      const server = await this.device.gatt.connect();
      const service = await server.getPrimaryService(P.SERVICE);
      this.char = await service.getCharacteristic(P.CHAR);
      this._set('connected', this.device.name || 'LED strip');
    }
    async connect(showAll) {
      if (!this.supported) throw new Error('This browser has no Web Bluetooth. Use Chrome on Android or desktop.');
      this._manual = false;
      this._set('connecting');
      try {
        const opts = showAll
          ? { acceptAllDevices: true, optionalServices: [P.SERVICE] }
          : { filters: [{ namePrefix: P.NAME_PREFIX }], optionalServices: [P.SERVICE] };
        const dev = await navigator.bluetooth.requestDevice(opts);
        if (this.device && this.device !== dev) this.device.removeEventListener('gattserverdisconnected', this._onDrop);
        this.device = dev;
        this._onDrop = () => this._dropped();
        dev.addEventListener('gattserverdisconnected', this._onDrop);
        await this._open();
      } catch (e) {
        this._set('idle', '');
        throw e;
      }
    }
    _dropped() {
      this.char = null;
      this.queue.length = 0;
      if (this._manual) { this._set('idle', ''); return; }
      this._reconnect(RETRY_MS);
    }
    async _reconnect(delays) {
      if (this.reconnecting || !this.device) return;
      this.reconnecting = true;
      this._set('connecting');
      for (const d of delays) {
        await new Promise((r) => setTimeout(r, d));
        if (this._manual) break;
        try {
          await this._open();
          this.reconnecting = false;
          this.dispatchEvent(new CustomEvent('restored'));
          return;
        } catch (e) { /* strip not in range yet, keep trying */ }
      }
      this.reconnecting = false;
      this._set('idle', '');
      this.dispatchEvent(new CustomEvent('lost'));
    }
    /** Call when the page becomes visible again: pick the link back up if it dropped while hidden. */
    resume() {
      if (this.state === 'idle' && this.device && !this._manual && this.supported) this._reconnect([200, 1500, 4000]);
    }
    disconnect() {
      this._manual = true;
      if (this.state === 'demo') return this._set('idle', '');
      if (this.device && this.device.gatt.connected) this.device.gatt.disconnect();
      else this._set('idle', '');
    }
    /** Close the connection for a moment (for example before an app update) but remember the strip, and do not reconnect by itself. */
    async suspend() {
      if (this.state === 'demo') return;
      this._manual = true;
      this.queue.length = 0;
      if (this.device && this.device.gatt && this.device.gatt.connected) this.device.gatt.disconnect();
      else this._set('idle', '');
    }
    /** Undo suspend(): reconnect to the remembered strip. */
    async unsuspend() {
      this._manual = false;
      this.resume();
    }
    /** Queue a packet. A newer packet with the same key replaces an unsent one. */
    send(bytes, key) {
      if (!this.ready) return;
      if (key) {
        const i = this.queue.findIndex((q) => q.key === key);
        if (i >= 0) { this.queue[i].bytes = bytes; return; }
      }
      // Bounded queue: if it ever backs up, drop the oldest unkeyed packet rather than grow without limit.
      if (this.queue.length >= 64) { const i = this.queue.findIndex((q) => !q.key); this.queue.splice(i >= 0 ? i : 0, 1); }
      this.queue.push({ bytes, key });
      this._pump();
    }
    /** Remove queued packets by key, e.g. drop pending colour writes when a hardware effect is chosen. */
    cancel(keys) {
      const set = new Set([].concat(keys));
      this.queue = this.queue.filter((q) => !set.has(q.key));
    }
    async _pump() {
      if (this.pumping) return;
      this.pumping = true;
      while (this.queue.length) {
        const { bytes } = this.queue.shift();
        try {
          if (this.state === 'connected' && this.char) {
            if (this.char.writeValueWithoutResponse) await this.char.writeValueWithoutResponse(bytes);
            else await this.char.writeValue(bytes);
          }
          this.dispatchEvent(new CustomEvent('tx', { detail: P.hex(bytes) }));
        } catch (e) {
          this.dispatchEvent(new CustomEvent('error', { detail: e }));
        }
        await new Promise((r) => setTimeout(r, this.gap));
      }
      this.pumping = false;
    }
  }
  g.Melk.Link = Link;
})(typeof window !== 'undefined' ? window : globalThis);
