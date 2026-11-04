# Regression results: UI cleanup (build 1.1.7)

All results are from the final source tree unzipped to a clean folder. Bluetooth, audio, HTTP and the Android installer are mocked, so these results show what the app does, not what a strip or a phone does. Nothing was built into an APK and nothing was published.

| Suite | Command | Result |
|---|---|---|
| Node unit tests (protocol, write policy, BLE adapter and suspend, scene sharing, OTA client, service worker, app updater, Android config, UI structure) | `npm test` | **111 of 111** |
| Native Java compiled against android-36.jar, with JUnit | `sh tools/android-compile-check/check-native.sh` | **39 of 39** |
| Signing and manifest tools | `npm run test:tools` | **12 of 12** |
| Browser: lifecycle (hardware effects, Rainbow evidence) | `tests/e2e/lifecycle.py` | **20 of 20** |
| Browser: features (navigation, Drive, scenes, music, import, developer options, admin) | `tests/e2e/features.py` | **65 of 65** |
| Browser: upgrade from real 1.1.5 saved data | `tests/e2e/upgrade.py` | **14 of 14** |
| Browser: app-update (APK) flow | `tests/e2e/apk-updater.py` | **51 of 51** |
| Browser: cleanup (new) | `tests/e2e/ui-cleanup.py` | **33 of 33** |
| Repeated-explanation check on 16 screens (new, runs with `--assert`) | `tests/e2e/ui-duplication.py --assert` | **pass, 0 repeats** |
| Layout audit: every screen and every App-update state, widths 320 to 768 | `tests/e2e/ui-audit.py` | **135 views, 0 issues** |
| Parity with the published 1.1.5 (ids, functions, every BLE packet builder) | `tools/compare-release.py` | **NOTHING MISSING** |
| Parity with the delivered 1.1.7 | `tools/compare-release.py` | **NOTHING MISSING** (88 functions kept, 1 added; all packet builders identical) |

## What the new checks cover
- **Power:** Top Power is visible and switches the app state; Light ON / OFF are collapsed by default, open on one tap, still send a power packet to the strip and still change the app state.
- **Connection consistency:** chip, banner, Connection page and Settings row are compared in four states (not connected, connecting, connected, demo): same words, same action, banner only when not connected, page button disabled while connecting, and the page button disconnects and reconnects.
- **Effects and Lab:** Rainbow is one row under 100 px that shows the same status and opens the Lab; the Lab has four blocks; modes use the word "Favourite".
- **Updates:** both cards present, details collapsed, technical lines hidden, at most four short sentences on the screen, "Available" only when there is an update, web card unchanged.
- **Reuse, no new system:** favourites, recents and saved colours still use `favScenes`, `modeFav`, `recent` and `palette`; no other storage key with "fav" exists (also a node test).

## Tests changed, and why
Six assertions (one in lifecycle, two in features, three in apk-updater) read the old wording or layout and were updated to the new one, not loosened: the "phone effects stop when the app closes" sentence (now one sentence plus a PHONE tag), the update server line (now under "Version and server"), the update-explanation text, the "ready" message text, and the mock bridge now answers the ZIP manifest separately so the Web update card does not show a false "invalid manifest" in screenshots.

## Not tested
A real phone (fonts, touch feel, the Back button), a real strip, the Gradle build and APK, and the installer on a device (still `HARDWARE_ACCEPTANCE_APK_UPDATER.md`).
