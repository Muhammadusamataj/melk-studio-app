/* MELK Studio service worker (browser / installed-PWA use only; the Android app removes it, see js/pwa.js).
 * Network first, so a new release is picked up straight away. The cache is only an offline fallback.
 * The cache name carries the app version: bump it with every release (tests/sw.cjs checks it matches ota.js). */
const CACHE = 'melk-studio-1.2.1';
const FILES = ['./', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icons/icon.svg',
  'js/protocol.js', 'js/ble.js', 'js/sync-policy.js', 'js/ble-native.js', 'js/audio-native.js', 'js/smart-audio.js', 'js/smart-scenes.js', 'js/smart-music.js', 'js/scene-dna.js', 'js/mode-catalog.js', 'js/ota.js', 'js/apk-updater.js', 'js/app.js', 'js/pwa.js'];

self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); });
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;      // never touch other sites (OTA manifest, downloads)
  e.respondWith(fetch(req).then((res) => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then((hit) => hit || Promise.reject(new Error('offline')))));
});
