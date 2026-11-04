# MELK Studio 1.1.4

## Fixes

- Android metadata was 1.0 / code 1, while web code was 1.1.3. Both now use 1.1.4; Android versionCode is 10104.
- The checked-in Android plugin configuration omitted CapacitorUpdater. Regenerated it with `npx cap sync android`; BluetoothLe and CapacitorUpdater are included.
- Native BLE ignored the Show all devices preference. It now passes the appropriate scan filter.
- Cancelled/failed native connection attempts were swallowed, allowing the UI to toast Connected. They now reject to the UI handler.
- Manual native disconnect clears pending packets and removes its disconnect listener.
- `androidNeverForLocation: true` lacked the corresponding BLUETOOTH_SCAN manifest flag. Added `neverForLocation`.
- Capgo returns `builtin` for the packaged web bundle. OTA now uses the packaged semantic version in that case, so an older server bundle is not offered as an upgrade.
- Disabled service worker registration inside the native app and remove old MELK worker registrations/caches, avoiding stale cache-first files overriding OTA assets.
- Native microphone capture checks session identity so a previous capture thread cannot continue emitting after a rapid restart.
- Added an explicit microphone permission check immediately before constructing AudioRecord, resolving Android lint's MissingPermission error.
- Fixed standalone/prepare scripts for this archive's `www/` layout. Preparation validates inputs and never deletes its own source folder.
- Added npm lockfile and build commands. Corrected README's microphone/internal-audio claims.

## Rebuild

Use Node 22+, **JDK 21 including javac**, and Android SDK Platform 36 with Build Tools 35.0.0/36.0.0. Set ANDROID_HOME or create your own `android/local.properties` pointing to the SDK. The original archive contained a machine-specific Windows SDK path; do not copy it to another computer.

```sh
npm ci
npm test
npm run build:android
cd android
bash gradlew lintDebug
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`.
Standalone preview: `npm run build:preview`.
Web source of truth: `www/`; run `npx cap sync android` after editing it.

## Final build result

`assembleDebug lintDebug`: BUILD SUCCESSFUL. App lint: 0 errors, 17 warnings (mostly template resources and dependency version notices). APK signature verified with apksigner. Packaged assets match `www/`, and both BluetoothLe and CapacitorUpdater are present.

## Validation and limits

- Six automated BLE/OTA regression checks (`npm test`). BLE calls are mocked; these checks do not establish radio connectivity.
- Chromium smoke check: demo connection and Color, Effects, Music and Studio tabs; no page JavaScript errors.
- All `www/js/*.js` syntax checked with Node.
- OTA server responded with version 1.1.2 during review on 2026-10-29. It must be updated separately before newer web updates will be offered.
- Physical LED strip commands, real Bluetooth permissions/reconnection, microphone capture and OTA activation require an Android phone and compatible strip. These have not been tested on hardware here.

## Installation

The supplied build is a debug-signed test APK. No existing release signing key was included in the source archive. If Android reports a signature conflict with an installed MELK Studio, back up your settings before uninstalling that old app; uninstalling erases its local data. Production updates require signing with the original release key.

Music reads the microphone. Sound playing only in earphones is not captured internally.
