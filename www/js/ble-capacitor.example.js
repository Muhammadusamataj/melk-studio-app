/* UNTESTED example: swap Web Bluetooth for a native plugin so the same UI can ship as an Android APK.
 *   npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor-community/bluetooth-le
 *   npx cap init "MELK Studio" studio.melk.app --web-dir=.
 *   npx cap add android && npx cap sync
 * Then load this file in index.html *after* js/ble.js so it replaces Melk.Link.
 * The class mirrors the interface app.js uses: state events, connect(), disconnect(), send(bytes, key), startDemo(). */
(function (g) {
  const { BleClient } = g.Capacitor.Plugins; // or import from '@capacitor-community/bluetooth-le'
  const P = g.Melk.protocol;
  const Base = g.Melk.Link;

  class NativeLink extends Base {
    get supported() { return true; }
    async connect() {
      this._set('connecting');
      try {
        await BleClient.initialize({ androidNeverForLocation: true });
        const dev = await BleClient.requestDevice({ namePrefix: P.NAME_PREFIX, optionalServices: [P.SERVICE] });
        await BleClient.connect(dev.deviceId, () => { this._set('idle', ''); this.dispatchEvent(new CustomEvent('lost')); });
        this.deviceId = dev.deviceId;
        this._set('connected', dev.name || 'LED strip');
      } catch (e) { this._set('idle', ''); throw e; }
    }
    disconnect() { if (this.deviceId) BleClient.disconnect(this.deviceId); else this._set('idle', ''); }
    async _pump() {
      if (this.pumping) return; this.pumping = true;
      while (this.queue.length) {
        const { bytes } = this.queue.shift();
        try {
          if (this.state === 'connected') await BleClient.writeWithoutResponse(this.deviceId, P.SERVICE, P.CHAR, new DataView(bytes.buffer));
          this.dispatchEvent(new CustomEvent('tx', { detail: P.hex(bytes) }));
        } catch (e) { this.dispatchEvent(new CustomEvent('error', { detail: e })); }
        await new Promise((r) => setTimeout(r, this.gap));
      }
      this.pumping = false;
    }
  }
  g.Melk.Link = NativeLink;
})(window);
