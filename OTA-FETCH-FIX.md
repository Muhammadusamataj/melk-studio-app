MELK Studio OTA manifest fetch fix

Changed only www/js/ota.js and the synced Android public/js/ota.js.
Native Android: uses CapacitorHttp.get to request the Netlify JSON manifest, avoiding WebView CORS restrictions. Browser fallback: fetch() requires valid CORS response headers.
Native OTA bundle download continues through CapacitorUpdater.download and has not been validated on device.

Build: npm install && npx cap sync android; then build and install APK.
Test Check for Updates. Do NOT install the existing v1.0.2 OTA bundle until its contents, SHA256 and compatibility have been verified.
Confirmed BLE source files were not modified.

If the update check still fails, inspect Android Logcat for the native HTTP status or network/TLS errors and verify the device browser can load the manifest.
