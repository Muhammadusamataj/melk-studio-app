# MELK Studio OTA UI

Studio tab now has a manual Check for Updates button and explicit updater-capability status. On APKs without Capgo CapacitorUpdater, it can check the Netlify manifest but **cannot install** ZIP files. Auto-check after 10 seconds on native builds is informational only.

## Required one-time build

`npm install` then `npx cap sync android` on a computer with internet. Confirm **both** `BluetoothLe` and `CapacitorUpdater` are present in `android/app/src/main/assets/capacitor.plugins.json` after sync. Install fresh APK once; confirm real BLE scan/reconnect and colour control still work. Keep original working APK. Do not manually fake plugin registration.

Netlify manifest: https://super-clafoutis-88fa64.netlify.app/ota/melk-version.json. Existing v1.0.2 zip is NOT automatically validated as compatible and was not downloaded/tested here. Do not publish/activate untested web bundles. Hash in manifest is not cryptographically authenticated by this code; signing is advised for wider rollout.

Note: Android permission/native plugin changes require an APK, not OTA. Working Bluetooth JavaScript/native connection files have not been edited by these UI changes.
