/* Registers the service worker so the app can be installed to the home screen (needs https). */
const nativeApp = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
if (nativeApp && 'serviceWorker' in navigator) {
  // Old cache-first workers otherwise serve stale files after an OTA update.
  navigator.serviceWorker.getRegistrations().then((regs) => Promise.all(regs.map((r) => r.unregister()))).catch(() => {});
  if ('caches' in window) caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('melk-studio-')).map((k) => caches.delete(k)))).catch(() => {});
}
if (!nativeApp && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
