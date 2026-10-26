# MELK Studio v1.1.0 — Feature update (test build)

Based on v1.0.13. The following files are byte-for-byte unchanged from that baseline:
`www/js/ble.js`, `www/js/ble-native.js`, `www/js/protocol.js`, `www/js/audio-native.js`.
The OTA logic in `www/js/ota.js` is unchanged except for APP_VERSION.

## Implemented
- Music: adaptive onset beat detection on the native plugin's bass level, beat threshold and cooldown sliders, on-screen beat count. Existing Pulse, Shift Hue, DJ patterns remain.
- Car: starred built-in modes show as large quick controls alongside existing car scenes. Uses the existing star list.
- Automation: configurable daily local-time scene/OFF routines. No duplicate sleep timer; existing sleep/sunset remain. The routines only run while app is open, visible, and BLE connected; missed routines are NOT replayed. They are NOT Android background alarms.
- Favourites: existing starred modes reused by Car and DJ/Auto, no separate conflicting favourite storage.

## Cautions
- Music implementation is audio *onset* based, not guaranteed BPM or full FFT. The native audio plugin only exposes bass-level measurements.
- Routine scheduling is a foreground-only JS timer; closing the app stops scheduling. Avoid interacting with app while driving.
- Bluetooth, OTA install, physical LED behaviour, and Android APK build are not hardware-tested in this environment.

## Deploy
- Deploy contents of Netlify package as a site, keeping `ota/melk-version.json` and `ota/melk-1.1.0.zip` publicly readable.
- Keep original APK/source backups. OTA loads on app restart.
