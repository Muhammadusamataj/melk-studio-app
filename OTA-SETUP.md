# MELK Studio — OTA setup (Capacitor 8)

**Bluetooth safety:** Existing www/js/ble-native.js, protocol.js, ble.js, and connection/reconnect code have not been edited for OTA.

## One-time APK build (native plugin required)

1. Keep a copy of the confirmed working project/APK.
2. On your development PC with internet access, in the `melk-studio` folder run:
   ```bash
   npm install
   npx cap sync android
   ```
3. Verify `android/app/src/main/assets/capacitor.plugins.json` includes `CapacitorUpdater` **and** `BluetoothLe` after sync.
4. Build and install a new APK using Android Studio. Old APKs cannot receive OTA until they contain the native plugin.
5. Test Bluetooth scan, actual colour control, auto-reconnect, and microphone before publishing the APK.

This source ZIP is prepared for OTA; plugin installation could not be completed in the sandbox. A new APK must be built before OTA can work.

## OTA releases (web-only HTML/CSS/JS)

1. Update `APP_VERSION` in `www/js/ota.js` to a higher semantic version (e.g. `1.0.1`).
2. From project root run:
   ```bash
   python3 tools/make-ota.py 1.0.1 https://super-clafoutis-88fa64.netlify.app/ota/
   ```
3. Upload `ota-out/melk-1.0.1.zip` **and** `ota-out/melk-version.json` to the `/ota/` path of the configured HTTPS host. Verify that the download URLs return public files.
4. Open installed app online; it checks for updates after startup and asks for approval. Downloaded updates activate after app background/restart.
5. Rollback can happen if the updated JS fails to launch/does not notify ready, but this cannot guarantee recovery from all runtime bugs. Keep a tested APK available.

Do not use OTA for changing Android permissions, Java/Kotlin code, plugins, manifest, or native dependencies. Those require another APK.

**Security:** Anyone able to replace the manifest/ZIP at the configured host may distribute app code. Restrict hosting account access and use HTTPS. The JSON SHA256 is generated for publishing verification, but this client does not enforce a signed hash. Do not use this pipeline for sensitive/public releases without integrity/authenticity protection.
