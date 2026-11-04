# Build and test report: app updater (1.1.7, versionCode 10107)

## What could and could not be built here
| Item | Status |
|---|---|
| Gradle build, debug or release APK | **NOT DONE.** No Android SDK/Gradle and no access to Google/Maven repositories in this environment. Run `cd android && ./gradlew assembleDebug testDebugUnitTest lintDebug` on your machine. |
| Native Java compile | **Done** against the real `android-36.jar` (your compileSdk) for all 21 source files, including the unchanged `AudioLevelPlugin` and `MainActivity`. Capacitor 8.5.3 and AndroidX are replaced by small stubs with signatures copied from the real source (`tools/android-compile-check`). This catches wrong Android API calls and type errors; it cannot catch manifest-merge, resource, R8 or Gradle problems. |
| `app/build.gradle` | Groovy syntax checked; the `keystore.properties` logic was run with fake values (absent file = no change, missing key = clear error, values never echoed). Not run by Gradle. |
| AndroidManifest / file_paths | well-formed XML; static tests check permission, `queries`, provider authority, folder match. Not merged by AGP. |
| On a phone or emulator | **Nothing was run.** |

## Results
| Suite | Result |
|---|---|
| Node unit tests (`npm test`) | **109 of 109** (new: apk-updater 21, ble-suspend 8, android-config 11, plus ui/sw/ota tests updated) |
| Native Java JUnit (real local HTTP server) | **39 of 39** |
| Signing/manifest tools (Python) | **12 of 12** |
| Browser end-to-end: lifecycle | 20 of 20 |
| Browser end-to-end: features | 65 of 65 |
| Browser end-to-end: upgrade from real 1.1.5 data | 14 of 14 |
| Browser end-to-end: **app update flow** | **50 of 50** |
| UI audit (every screen and every App-update state, widths 320 to 768) | **135 views, 0 issues** |

## What the tests prove
- **Downloader (JVM, real HTTP):** progress 0 to 100 never goes backwards and 100 appears only after verification; cached file reused; tampered file rejected by SHA-256; size mismatch (declared, or more data than promised); oversized file; cancel mid-stream and before start; connection dropped; stalled server timeout; 404; unreachable server; redirect loop; https-to-http / non-loopback redirect refused; too little free space (no request is made); disk filling while writing; unreadable free-space probe does not block; production mode refuses every non-https, credentialed, malformed or host-less address; partial files never left behind.
- **Rules (JVM):** same key + higher build allowed; different package, different key, unsigned, downgrade, same build, manifest describing another file, promised key not matching, too-old Android: each blocked, all reasons reported; key-rotation overlap accepted.
- **Web flow (mocked bridge):** two separate cards; manifest read from `/apk/apk-version.json` and not the ZIP manifest; exact values sent to the plugin; percentage 0 to 100 shown; cancel; permission guide leaves Bluetooth and music alone; order is music stop, Bluetooth close, installer; nothing sent to the strip while the installer is open; the paired strip is remembered; cancel in Android restores the connection; failures (checksum, storage, network, wrong key) give clear messages and a retry; bad manifests refused; a finished update is announced and the file deleted; scenes, colours, verification and vehicles untouched.
- **Bugs found by these tests and fixed:** the downloader accepted `https:///x.apk` (empty host); Capacitor's `call.getLong()` returns null for small numbers (numbers are now read from the raw data); the "delete downloaded file" link was missing in the permission state; after an automatic reconnect the strip's name showed as "LED strip".
- **Signing tools on real signed APKs** (a real APK re-signed with two throwaway keys that were deleted afterwards): same key reported as SAME KEY, different key as DIFFERENT KEY; the manifest tool refused the different-key and same-build APK and wrote nothing, and wrote a manifest only when no comparison was asked for (with a warning). The app's own validator accepts what the tool writes.

## Not verified
Signing compatibility with **your** installed APK (the v1.1.4 debug APK was not provided). Android's `PackageManager`, `FileProvider`, installer intent and permission screens on any real device. Android 7 behaviour with v2-only APKs. The BLE packet bytes were not changed: `tools/compare-release.py` shows every builder identical to the published 1.1.5.
