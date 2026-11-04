/* Web side of the native audio plugin. Only active inside the APK.
 * MelkAudio.start(onFrame) -> onFrame({ bass: 0..1 }) from phone microphone. */
(function (g) {
  'use strict';
  if (!g.Capacitor || !g.Capacitor.isNativePlatform || !g.Capacitor.isNativePlatform()) return;
  const plug = (g.Capacitor.Plugins && g.Capacitor.Plugins.AudioLevel) ||
    (typeof g.Capacitor.registerPlugin === 'function' ? g.Capacitor.registerPlugin('AudioLevel') : null);
  if (!plug) return;
  let handle = null;

  g.MelkAudio = {
    native: true,
    async start(onFrame) {
      await this.stop();
      handle = await plug.addListener('frame', onFrame);
      try {
        await plug.start();
      } catch (e) {
        await this.stop();
        throw e;
      }
    },
    async stop() {
      try { await plug.stop(); } catch (e) { /* already stopped */ }
      if (handle) { try { await handle.remove(); } catch (e) { /* ignore */ } handle = null; }
    },
  };
})(window);
