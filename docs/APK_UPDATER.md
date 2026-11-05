# App update (full APK) through Android's Package Installer

Updater introduced in build 1.1.7; current 1.2.1 candidate procedure is in [Permanent updates](PERMANENT_UPDATES.md). Package `com.bleled.com`. **Nothing here has been published.** It is separate from the ZIP web update.

## Two kinds of update
| | Web update (existing) | App update (new) |
|---|---|---|
| What changes | screens, settings, fixes (the web layer) | the whole app, including Java, permissions and plugins |
| How | `@capgo/capacitor-updater`, `ota/melk-version.json`, `melk-x.y.z.zip` | `ApkUpdater` plugin, `apk/apk-version.json`, `MELK-Studio-x.y.z.apk` |
| Android asks you | no | yes, in its own installer screen |
| Bluetooth | stays connected | closed first, restored after |
| Where in the app | Settings, Software updates, **Web update** | Settings, Software updates, **App update** |
Neither touches the other's manifest. Use a web update when only the web layer changed; use an app update when Java, the manifest or permissions changed.

## How an app update runs
1. **Check**: the app reads `https://muhammadusamataj.github.io/melk-studio-ota-/apk/apk-version.json`. It is accepted only if: schema 1, package `com.bleled.com`, a build number above the installed one, an `https` `.apk` address on the **same server**, a 64-hex SHA-256, a size up to 250 MB. Otherwise the reason is shown.
2. **Download** (plugin, HTTPS only, 15 s connect / 30 s read timeouts, up to 5 redirects that must stay https): progress 0 to 100% in the card; the file is hashed while it streams and saved as `files/apk-updates/melk-<build>.apk.part`.
3. **Verify** before it can be installed: size equals the manifest, SHA-256 equals the manifest, then Android reads the file's own package, build number and signing certificate and the rules below are applied. Any failure deletes the file.
4. **Permission** (Android 8+): if "install unknown apps" is off for MELK Studio, a guide appears with a button to the exact Android settings page. Nothing is stopped or disconnected yet. When you come back it continues.
5. **Install**: music and phone effects stop, Bluetooth is closed cleanly (the paired strip is remembered), the plugin re-checks the file hash and the rules once more, and opens **Android's own Package Installer** with an `ACTION_VIEW` intent on a `FileProvider` URI with read permission granted. You confirm there. There is no silent install, root, or shell command.
6. **After**: if you cancel in Android, the app notices when you return, says so, and reconnects the strip. If the update installs, the new app starts, says "updated to v...", deletes the downloaded file and reconnects the strip by itself.

## What blocks an install (`ApkRules`)
Different package name, build number lower or equal to the installed one, not signed, **CURRENT signing-certificate set different from the installed app**, the manifest describing a different package / build / signing key than the file, Android older than `minSdk`. All reasons are reported, not only the first.

## Failure handling
| Situation | Result |
|---|---|
| Cancel | download stops, partial file deleted, "Download cancelled." |
| No internet, connection dropped, timeout | clear message, partial file deleted, retry button |
| Missing manifest (404) | no APK release published yet; no up-to-date claim or download |
| Other HTTP error, redirect to http, bad address | refused with the server's status |
| Checksum or size mismatch | file deleted, "Nothing was installed." |
| Not enough storage | checked before downloading (needs file size + 32 MB), and also if the disk fills while writing |
| Wrong key / package / downgrade | blocked, reasons shown, file deleted |
| Permission off | guide, nothing disconnected |
| Installer cancelled | state restored, Bluetooth reconnects |

## Security model
- The web layer never passes a file path: `install()` only accepts the file the plugin itself downloaded and verified.
- The manifest cannot make Android install a differently-signed app: the installed app's own certificate is the reference, and Android enforces the same rule again.
- `https` only, no credentials in addresses, same-server rule, 250 MB cap, hash computed while streaming.
- **Google Play:** `REQUEST_INSTALL_PACKAGES` is a restricted permission. Do not ship this plugin or permission in a build published on Google Play; remove `ApkUpdaterPlugin` registration and the permission for that build.
- The `FileProvider` already had broad `external-path` and `cache-path` entries (from the Capacitor template); only `files/apk-updates/` was added.

## Files
`android/app/src/main/java/com/bleled/com/`: `ApkUpdaterPlugin.java` (Android glue), `ApkDownloader.java`, `ApkRules.java`, `Hashes.java`, `UpdateException.java` (pure Java). Tests: `android/app/src/test/java/com/bleled/com/`. Web: `www/js/apk-updater.js`, the App update card in `www/index.html`, `suspend()/unsuspend()` in `ble.js` and `ble-native.js`. Tools: `tools/make-apk-manifest.py`, `tools/compare-apk-signing.py`, `tools/apkinfo.py`. Compile check: `tools/android-compile-check/`.

## Install and release (first time and every release)
1. **Once:** install an APK that contains this plugin (this build, 1.1.7 or newer). Phones on older APKs show "App updates are not available in this version" and keep working; web updates still work.
2. Build with the **same signing key as the installed app** (see APK_SIGNING_COMPATIBILITY.md), with a higher `versionCode`.
3. `python3 tools/compare-apk-signing.py <installed.apk> <new.apk>` must say COMPATIBLE.
4. `python3 tools/make-apk-manifest.py <new.apk> --base-url https://muhammadusamataj.github.io/melk-studio-ota-/apk/ --installed-apk <installed.apk> --notes "..."`. It reads every value from the file and refuses a bad update.
5. **You** upload `apk/MELK-Studio-x.y.z.apk` first and `apk/apk-version.json` last. Nothing in this project uploads anything. Keep `ota/melk-version.json` as it is.
6. See `examples/apk-version.example.json` for the shape (its placeholders are deliberately invalid).

## Not built
No Play-Store-safe variant, no resume of a half-finished download (it restarts), no update-server address editor for the APK manifest (the address is a constant in `apk-updater.js`).
