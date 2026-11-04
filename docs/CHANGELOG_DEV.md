# Dev changelog

## 1.1.6 (review candidate, not released)
Relative to the published **1.1.5** web bundle (which equals the 1.2.0 work below, with the version string changed).

### New
- **New structure**: Colour, Effects, Music, Settings. Settings opens Connection, Vehicle & Drive, Scenes, Automation & timers, Backup & restore and Software updates as separate pages.
- **Experimental Lab** (Settings): Hardware Rainbow test as collapsible cards with Run first and Untested / Yes / No evidence, mode tester, scene tester, effect explorer, preset mapper, "leave the strip's own effect".
- **Developer options**: hidden until the version is tapped seven times. Protocol Lab, power format, show-all-devices and demo strip, device info, packet log, update-server admin.
- **MELK Drive**: Driving and Parked, calm-only scenes while driving, brightness limit per vehicle, vehicle profiles, optional start-up scene. Set by the user; no detection.
- **Scene DNA**: validated share and import of scenes. A shared hardware effect is only used as hardware if verified on this strip.
- **Scenes**: favourites, recent scenes, previews on chips and rows.
- Connect banner, parking confirmation shared between Lab and Protocol Lab, Android Back button closes pages and Car mode.
- Release tooling: `tools/compare-release.py` (nothing-missing check against a published bundle).

### Changed
- New design system (`css/style.css` rewritten): compact status card, switches, segmented controls, bottom-sheet dialogs, 44 px targets, AA contrast.
- Music: one start at a time, pauses when the app is hidden, ignores stray audio frames, DJ stops without replacing its pattern, refused while Driving.
- Settings import is validated item by item; unknown keys and `__proto__` are dropped; runtime state is never imported.
- Bluetooth device info masks the address.
- Service worker (browser/PWA only): network first, version-named cache, every script listed. The Android app still removes it (`js/pwa.js`).
- All visible text is English (a few Roman Urdu messages were replaced).
- Background page gets `inert` while a page or Car mode is open.
- OTA tests read the packaged version instead of a hard-coded number.

### Unchanged on purpose
BLE packet formats (byte-for-byte), the native Bluetooth adapter's logic, the OTA client's rules and the OTA repository. The only change in `js/ota.js` is the version number; in `js/ble-native.js` two error messages are now English.

## 1.1.5 (already published as melk-1.1.5.zip)
Same web layer as the former "1.2.0" work: connect-time write policy (`sync-policy.js`), Hardware Rainbow candidates with evidence, real Magic Lantern mode names, hardened BLE adapter, controller card, readable errors, test suites.

## 1.1.7 (review candidate, versionCode 10107, not released)
- **App update (full APK) through Android's Package Installer**: native `ApkUpdater` plugin (HTTPS download, SHA-256, package / build / signing-key checks, FileProvider + ACTION_VIEW, install-permission guide), separate `apk/apk-version.json`, new App update card next to the unchanged Web update card. See APK_UPDATER.md.
- BLE: `suspend()` / `unsuspend()` close the connection cleanly for an install and keep the paired strip; automatic reconnect now keeps the strip's name. Packet bytes unchanged.
- Android: `REQUEST_INSTALL_PACKAGES`, `queries` for the installer intent, `files/apk-updates` in the FileProvider, optional fixed signing key through `android/keystore.properties`, versionCode 10107.
- Tools: `compare-apk-signing.py`, `make-apk-manifest.py`, `apkinfo.py`, `android-compile-check/`.
- The browser preview simulates the App update card (flag set only by `tools/build-standalone.py`).
- Web version 1.1.7: this is a **different** web bundle from 1.1.6, so 1.1.6 stays as delivered.

## 1.1.7 UI cleanup (same version, nothing published)
- Duplication audit and cleanup, no new features. See UI_DUPLICATION_AUDIT.md and UI_CLEANUP_TEST_REPORT.md.
- One primary Power control; Light ON / OFF in a collapsed "Direct power" row.
- One connection description (`connView`) for the chip, banner, Connection page and Settings row; the Connection page has a status card with the same action.
- Software updates: two short cards, technical lines collapsed. Effects: slim Rainbow row. Lab: seven cards to four. Scenes: Recent inside the first card.
- One word for favourites; existing stores reused.
- New checks: `ui-cleanup.py`, `ui-duplication.py --assert`, two node tests.

## 1.1.7 Effects redesign (same version, nothing published)
- Effects, Built-in: the 28-tile grid became **category chips** (All, Favourites, Scenes, then Magic Lantern's own groups), a **search box**, a **compact list** with its own maximum height, and **one panel** for the selected effect (Run, Favourite, Rename, speed, status). New module `js/mode-catalog.js`.
- All 213 Magic Lantern modes and its 28 strip scenes are listed, with Magic Lantern's names, checked against its own APK arrays (`docs/MODES_MAPPING_AUDIT.md`). Untested effects are labelled "Not tested", never "unsupported"; "Sent" (last command) is shown apart from "Selected".
- The edit dialog shows the real mode number and name. Favourites, verified and picked modes outside the old 128 to 155 guess now work in the DJ pool, Car mode, the scene mapper and the effect editor. The default DJ pool is unchanged.
- Stores unchanged (`modeNames`, `modeFav`, `modeHidden`, `modePersistent`, `persistentOnly`, `verify`). No new key, no new Settings page. BLE packets, UUIDs, timing, updater and music are untouched.
- Removed element ids (replaced): `modeGrid` -> `fxList`, `modeEdit` -> `fxRename`, `modeHint` -> `fxCatNote`.
- Tools and tests: `tools/extract-ml-arrays.py`, `tools/audit-modes.py`, `tests/modes-audit.cjs`, `tests/mode-catalog.cjs`, `tests/e2e/effects-browser.py`, `tests/e2e/fx-shots.py`.
