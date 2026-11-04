# Parity with the published 1.1.5

## What was compared
Your OTA repository (public, read only) holds the published bundle `ota/melk-1.1.5.zip` with `melk-version.json`. It was downloaded and checked:
- SHA-256 of the ZIP equals the value in the manifest (`3fcfee6c...7a54`); the ZIP is valid.
- Its `APP_VERSION` is 1.1.5.

## Finding 1: the published 1.1.5 web bundle equals the earlier 1.2.0 work
Compared with the 1.2.0 source I delivered before the redesign, **every file is identical except one line**: `APP_VERSION` is `'1.1.5'` instead of `'1.2.0'`. So 1.1.5 contains no web change that is missing from this build.

## Finding 2: what 1.1.6 changes over 1.1.5 (web layer)
`python3 tools/compare-release.py <unzipped melk-1.1.5.zip>` result:

| Check | Result |
|---|---|
| Files byte-identical | `icons/icon.svg`, `js/audio-native.js`, `js/ble-capacitor.example.js`, `js/ble.js`, `js/protocol.js`, `js/pwa.js`, `js/sync-policy.js`, `manifest.webmanifest` |
| Files changed | `index.html` and `css/style.css` (redesign), `js/app.js` (new features), `js/ota.js` (version number only), `js/ble-native.js` (two error messages now English), `sw.js` (version-aware, network first) |
| New file | `js/scene-dna.js` |
| Element ids | 143 of 143 old ids still exist; `t-studio` and `tab-studio` are now `t-settings` and `tab-settings` (the tab was renamed). 48 ids added |
| `app.js` functions | 70 of 70 old functions still exist; 18 added |
| BLE packets | every packet builder gives identical bytes for the same inputs, and the service, characteristic and name prefix are unchanged |
| Result | **NOTHING MISSING** |

## Finding 3: saved data survives
The saved settings of a real 1.1.5 run (captured by running the published bundle, kept as `tests/fixtures/state-1.1.5.json`) load in 1.1.6 with nothing lost: scenes, saved colours, renamed and starred modes, the verified Rainbow candidate, routines, fade time, music style, and the running hardware scene. New settings get safe defaults. 14 of 14 upgrade checks pass.

## Limits of this comparison
- Only the **web layer** can be compared. The native Android layer (Java, manifest, Gradle, permissions) of your installed 1.1.5 APK is not in any file I can read: the OTA bundle holds web files only, and the GitHub `main` branch of `melk-studio-app` holds no `www/` or `android/` folder (only old release notes and config from the 1.1.0 era, 2 commits). The last native source I have is the v1.1.4 archive you uploaded. This release does not change any native file, so an OTA update does not touch your installed native layer.
- If your own 1.1.5 had web changes made **after** publishing the bundle, they are not in the ZIP and I cannot see them. Tell me if there are any.
