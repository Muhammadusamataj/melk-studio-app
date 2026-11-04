# Release checklist: 1.1.6

**Gate: nothing below "Release" happens until you approve.**

## Done (review candidate)
- [x] Redesign and all phases implemented
- [x] 69 node tests, 99 end-to-end checks, 95-view UI audit: all pass (mocked hardware)
- [x] Nothing missing vs the published 1.1.5 (RELEASE_PARITY_1.1.5.md)
- [x] A real 1.1.5 install's saved data loads intact (upgrade test)
- [x] The published 1.1.5 update client accepts a 1.1.6 manifest (ota-upgrade test)
- [x] Android `assets/public` mirrors `www/`; version 1.1.6 / versionCode 10106
- [x] No OTA ZIP or manifest built; OTA repository untouched

## Before you approve
- [ ] Open `MELK-Studio-preview.html` and click through every screen
- [ ] Run HARDWARE_ACCEPTANCE.md on the car (tests 1 to 12) and the phone checks (13 to 20)
- [ ] Decide what the production Rainbow is (from the Lab results)
- [ ] Decide about the 4 moderate `npm audit` advisories (build tooling)

## Release (only after your explicit approval)
1. I build `melk-1.1.6.zip` with `tools/make-ota.py 1.1.6 https://muhammadusamataj.github.io/melk-studio-ota-/ota/ --src www`, compute the real SHA-256, and write `melk-version.json`.
2. I re-verify the ZIP (layout, version inside, checksum, scripts parse) and replay the published 1.1.5 client against it.
3. You upload to the OTA repository. **Upload `melk-1.1.6.zip` first, `melk-version.json` last**, so no phone is ever told about a file that is not there yet. Wait for GitHub Pages (up to about 10 minutes), then open the manifest URL with `?x=1` on the phone and check it says 1.1.6.
4. On a phone running 1.1.5: Settings, Software updates, Check, Download and install, close the app completely, open it. The bottom of Settings should say **Version 1.1.6**. If it still says 1.1.5, open it once more (the old service worker, if any, is removed on that launch).
5. Keep `melk-1.1.5.zip` in the OTA repository for one more release so you can roll back by restoring the old manifest.

## Not in this release
- Android Java/manifest changes (none were needed). Any native change needs a new APK, not OTA.
- A signed APK or Play upload.

## 1.1.7 app updater (separate from the 1.1.6 web update)
- [ ] Build with `./gradlew assembleDebug testDebugUnitTest lintDebug` on your machine
- [ ] Put the key your installed app uses in `android/keystore.properties` (APK_SIGNING_COMPATIBILITY.md)
- [ ] `tools/compare-apk-signing.py <installed.apk> <new.apk>` says COMPATIBLE
- [ ] Run HARDWARE_ACCEPTANCE_APK_UPDATER.md
- [ ] Decide what happens to the 1.1.6 web update: 1.1.7 changes the web layer too
- [ ] After approval: upload the APK first, `apk/apk-version.json` last (I never upload)
