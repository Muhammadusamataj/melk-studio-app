# MELK Studio

A customisable controller for MELK Bluetooth LED strips (the ones driven by the Magic Lantern app).
Plain HTML, CSS and JavaScript, wrapped with Capacitor for Android. Version **1.1.7** (review candidate).

## What is in the app
**Four tabs**
* **Colour**: colour wheel, brightness, white, saved colours, direct Light ON / OFF, scene chips (favourites first).
* **Effects**: all 213 of Magic Lantern's strip modes and its 28 strip scenes, in its own groups, with search, favourites, rename and a clear "not tested / verified" label; a Rainbow row; and phone-driven effects you can build yourself.
* **Music**: microphone / phone-audio sync (pulse, shift hue, DJ patterns). Works only while the app is open.
* **Settings**: Connection, Vehicle & Drive, Scenes, Automation & timers, Backup & restore, Software updates.

**Car mode** (the Car button): big buttons, very dim screen. **Driving** shows calm scenes only and limits brightness; **Parked** allows everything. You choose the mode; the app does not detect driving.

**Experimental Lab** (Settings): guided hardware tests. The Hardware Rainbow test lets you run each candidate, record what you saw (moves, keeps moving after the app closes, returns after a power cycle) and only then add it as a scene. Park the car first.

**Developer options** (hidden; tap the version in Settings seven times): raw protocol tools, device info (address masked), packet log, update-server admin (PIN protected).

Two kinds of effect are never mixed up: **hardware effects** run inside the strip and can keep going when the app closes (once you have verified them); **phone effects** are streamed by the app and stop when it closes.

## Run it
| Goal | How |
|---|---|
| Quick look in any browser | open `dist/MELK-Studio-standalone.html` (demo strip, nothing is sent) |
| Local development | `python3 -m http.server 8000 --directory www`, then open `http://localhost:8000` |
| Control a real strip from a browser | host `www/` over **HTTPS** and open it in **Chrome on Android** (Web Bluetooth is not in iOS browsers or Firefox) |
| Android APK | JDK 21 + Android SDK 36, then `npm ci && npm run build:android`. See BUILD-1.1.4.md |

## Tests
```
npm test                 # node tests (protocol and the mode/scene audit against Magic Lantern's arrays, write policy, BLE adapter, scene sharing, OTA client, service worker, UI structure)
npm run test:e2e         # headless Chromium: lifecycle, features, upgrade from 1.1.5 data, app-update flow, UI cleanup, repeated-text check, layout audit
npm run test:tools       # signing / manifest tools (python unittest)
ANDROID_JAR=.../android-36/android.jar sh tools/android-compile-check/check-native.sh   # native Java compile check + JUnit
                         # needs: pip install playwright && playwright install chromium
python3 tools/compare-release.py <unzipped older bundle>   # nothing-missing check against a published release
```
All of these use mocked Bluetooth and audio. They do not prove what a real strip does: see docs/HARDWARE_ACCEPTANCE.md.

## Layout
```
www/index.html            UI shell (tabs, pages, car mode)
www/css/style.css         design system
www/js/protocol.js        9-byte packet builders and the Magic Lantern mode / scene tables (the only file that knows the protocol)
www/js/sync-policy.js     what to write when a connection opens (never overwrite a running hardware effect)
www/js/ble.js, ble-native.js   Web Bluetooth link and the native Capacitor adapter (queue, reconnect, GATT check)
www/js/scene-dna.js       validated scene sharing and settings import
www/js/ota.js             web-update client (version, checksum, admin-protected server address)
www/js/app.js             UI logic, effects engine, music, storage
www/js/audio-native.js    bridge to the Android audio plugin
www/js/pwa.js, www/sw.js  install-to-home-screen support (removed inside the Android app)
tests/, tests/e2e/, tests/fixtures/   suites; fixtures are the published 1.1.5 update client and a real 1.1.5 saved state
tools/                    build-standalone.py, make-ota.py, prepare-apk.py, compare-release.py
docs/                     PRODUCT_PROGRESS, FEATURE_MATRIX, TEST_REPORT, CHANGELOG_DEV, RELEASE_CHECKLIST,
                          HARDWARE_ACCEPTANCE, UI_REDESIGN, MODES_MAPPING_AUDIT, RELEASE_PARITY_1.1.5, PROTOCOL, NATIVE-SCENES
```

## Releases
App updates (a full new APK through Android's installer) are described in docs/APK_UPDATER.md and docs/APK_SIGNING_COMPATIBILITY.md; they need an APK signed with the same key as the installed app.

Web updates go over the air (`tools/make-ota.py`, then upload to the OTA repository). **The 1.1.6 package has not been built or published**; see docs/RELEASE_CHECKLIST.md. Native changes (Java, manifest, permissions) always need a new APK.

## Status
The protocol was decoded from the Magic Lantern APK and checked on one controller (MELK-0C21 F1). Colour, brightness and power work. Which hardware command produces the moving Rainbow is **not yet proven**; use the Lab to find out.

## Native audio (APK only)
The registered AudioLevel plugin reads the phone microphone and emits bass intensity. Audio samples are not stored or uploaded. It does not capture another app's internal playback or sound playing only through earphones. Allow Microphone permission when starting Music. The active Java sources are under `android/app/src/main/java/com/bleled/com/`; files under `native/` are historical examples.
