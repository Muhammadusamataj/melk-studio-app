# Signing compatibility: debug and release APKs

**Rule:** Android installs an update over an existing app only if the new APK is signed with the **same key** (and has the same package name and a higher `versionCode`). A different key gives "App not installed as package conflicts with an existing package". Nothing in the app can bypass this.

## Status of YOUR key: not verified
`MELK-Studio-v1.1.4-debug.apk` was **not** among the files I received, so I did **not** compare its certificate with anything. Until you run the check below with your real files, treat "the new APK can replace the installed one" as **unproven**. What I verified: the tools detect same-key and different-key on real signed APKs, using throwaway keys that I created and deleted.

## The trap with debug builds
A debug APK is signed with `debug.keystore` that Android Studio creates **per computer** (`~/.android/debug.keystore`, on Windows `%USERPROFILE%\.android\`). A new PC, a reinstalled Android Studio, a deleted `.android` folder, or another developer's machine gives a different key, and every update over the installed app fails. A release key is different again from the debug key.

## Check it (no password is needed or printed)
```
python3 tools/compare-apk-signing.py MELK-Studio-v1.1.4-debug.apk <new-build>.apk
```
Expected for a usable update: `package same`, build number higher, `signing key SAME KEY`, `RESULT: COMPATIBLE`. It prints only public data (package, build, certificate SHA-256 fingerprints). Needs `aapt` and `apksigner` from Android SDK build-tools (found automatically in `ANDROID_HOME` or the default SDK folder), or `pip install androguard` as a fallback (then the signature is read but not cryptographically verified, and the tool says so).
The same check by hand: `apksigner verify --print-certs <file>.apk` and compare the `certificate SHA-256 digest` lines.

## Keep one key for all builds
1. Find the keystore your **installed** app was built with (for the debug APK: the `debug.keystore` of the PC that built it) and back it up somewhere private. If that file is gone, the installed app can no longer be updated in place.
2. Create `android/keystore.properties` (it is git-ignored; never commit or share it):
```
storeFile=C:/path/to/the/same/keystore
storePassword=...
keyAlias=...
keyPassword=...
```
`android/app/build.gradle` then signs **both** debug and release builds with it. Without the file, Gradle behaves exactly as before. If a field is missing the build stops with a clear message that does not repeat any value.
3. Read the fingerprint of the installed key: `keytool -list -v -keystore <keystore>` (it asks for the password itself). Public fingerprints are safe to write down; the keystore and passwords are not.

## Moving from debug to release signing
That is a **different key**, so Android refuses an in-place update. The only way is: Backup & restore (Settings) to save your settings, uninstall, install the release APK, import the backup. Scenes, saved colours and routines come back from the backup; the paired strip is chosen again. Do this once, deliberately, and keep the release keystore safe forever after.

## What the app itself checks
Before installing, the plugin compares the downloaded file's signing certificate with the installed app's (and its key-rotation history) and blocks on a mismatch, so you get a clear message instead of Android's generic failure. This check ran in the JUnit tests on simulated identities and compiled against the real Android API, but **has not run on a phone**.
