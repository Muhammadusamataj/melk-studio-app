# MELK Studio 1.2.0 test delivery

Package remains `com.bleled.com`; native version is 1.2.0, versionCode 10200, minimum Android 7/API 24, target/compile API 36. Playback capture needs Android 10/API 29 and SmartAudio API 2. PR #2 handles production signing independently.

## Build and artifact

The `Smart Scenes v1.2.0 test APK` workflow uses JDK 21 and Android SDK 36. It runs JavaScript/tooling tests, Capacitor sync, `assembleDebug`, native unit tests and `lintDebug`. Only after these succeed does `tools/verify-test-apk.py` verify the actual APK using aapt/apksigner, assert package/version/minimum SDK and produce the test APK, `apk-verification.json` and `SHA256SUMS`. Browser suites run independently and all failures are retained in the browser validation artifact. CI success is required before treating the branch as validated.

Download the ZIP artifact from the workflow run's Artifacts section while signed into GitHub, extract it, and inspect INSTALLATION.txt and apk-verification.json. An artifact is a test delivery, not a production release. The key produced by a fresh CI runner is a debug/test key and may differ between runs; do not rely on it as a stable update identity. No keystore/password is stored in source or artifacts.

## Installation and protecting data

Export Settings → Backup from the existing app and save the JSON outside the app before testing. The partial installed fingerprint `06671cef…3d5d` cannot establish compatibility: compare the full installed certificate against the actual artifact's full signer SHA-256. An in-place update requires the same package, a higher versionCode and a compatible signing certificate (or verified Android signing lineage). A debug label alone proves nothing about compatibility.

If the signer matches, Android's normal update installation preserves app data. If it differs, Android will refuse replacement; do not uninstall the existing app to work around this. Uninstalling can erase app-local settings, favourites, scenes, controller verification and credentials. Safest testing options are a spare phone or a supported separate Android user/profile, leaving the original installation intact. Import the exported settings in the test installation and grant BLE/audio permissions afresh. The same package cannot coexist as two ordinary apps within one Android user. A seamless replacement requires the original private signing key, supplied securely, and a rebuild. PR #2's future production key cannot retroactively sign an existing installation.

## Native and web update compatibility

New direct audio support is native and cannot arrive through a web ZIP. SmartAudio capability detection checks API 2/playback support before invoking it; old APKs receive an explicit explanation and retain an explicitly selected legacy microphone path, labelled as level analysis. No microphone starts silently. Web scenes/rotation use existing BLE APIs and packets. Full FFT from native capture requires 1.2.0; browser microphone uses WebAudio frequency analysis when available.

The web APP_VERSION, native version, npm version and service-worker cache are aligned at 1.2.0. Existing saved settings are migrated/sanitized without clearing localStorage. The updater checks semantic versions, HTTPS/same-origin manifests and SHA-256 before scheduling a downloaded web bundle. The APK updater remains separate and validates actual downloads before requesting Android installation. APK signing/release changes in PR #2 are not incorporated here.

Prepare an unpublished web bundle with `python3 tools/make-ota.py 1.2.0 https://muhammadusamataj.github.io/melk-studio-ota-/ota/`. This writes only ota-out. Verify ZIP root index.html, checksum and the complete web asset list, then test an older native fixture and a 1.2.0 APK before production authorization. Do not upload the ZIP or either live manifest during this task. The OTA repository and its live update status are unchanged; users will not receive 1.2.0 from Check for Updates until an approved release is published. A missing live apk/apk-version.json remains a server publication issue, not something this test artifact changes.

## Phone and LED acceptance checklist

- Back up settings; verify artifact checksum, package/version and full certificate before choosing an installation route.
- Connect the controller. Confirm reconnect and app reopen do not overwrite a controller-native scene left running.
- Browse Scenes first (28), All (241), all numbered groups and Magic Lantern Auto Play. Check representative exact scene/mode behavior, brightness and speed against the installed app.
- Use Auto + four native shortcuts + All 28. Edit/remove/reorder slots, relaunch, check recents and restore a settings export. Play custom Relax/Movie from Settings → Scenes; distinguish the native Movie scene.
- Select rotation scenes, verify sequential and shuffle at 30 s, 1 min, 5 min and 15 min. Restart/stop, disconnect/reconnect, background/lock and switch to music/static colour. There must be one driver; the last controller scene should persist when scheduling stops. Rotation does not continue after app closure.
- On Android 10+, start Device Audio, grant/decline fresh MediaProjection and audio consent, revoke capture from Android controls and stop via notification. Test Android 13 notification denial and Android 14+ projection/foreground-service behavior on available phones.
- Start music in each supported source app, then return to MELK Studio. Test each app separately (including YouTube); capture policies and DRM may produce silence. This implementation stops capture when MELK Studio leaves the foreground; it does not promise background music-light control.
- Confirm spectrum/bands/beat react to real audio, silence settles, Smart Auto works without tuning, Bass Pulse/Smooth Flow retain advanced controls, DJ Scenes holds native effects between meaningful changes and does not restart them on every beat.
- Explicitly choose microphone fallback. Check active source and Android privacy indicators; denial must not silently enable another source. Stop/background/disconnect must stop capture and further music BLE writes.
- Enter Driving while rotating/listening and confirm capture/rotation stop, Quick Scenes/editing/full native browsing are blocked, and existing driving brightness/calm scene restrictions remain.
- Exercise Software updates checks offline/online, missing manifest, checksum/signature mismatch and installer cancellation. Test update/relaunch with exported settings preserved. No production manifest is published by CI.

Automated tests cannot establish real controller effect persistence, source-app capture policy, Android OEM behavior, audible latency, battery/thermal performance or signer compatibility with an unavailable installed APK. Those require the phone/controller and actual certificate comparison.
