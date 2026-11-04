# Test report (build 1.1.6 review candidate)

Every Bluetooth, audio and update call in these tests is a mock. They show what the app does. They do **not** show that a strip executed anything, or how it looks and behaves on a real phone.

## Final results
| Suite | Command | Result |
|---|---|---|
| Node unit tests | `node --test "tests/*.cjs"` | **69 of 69 passed** |
| Lifecycle (hardware effects, Rainbow evidence) | `python3 tests/e2e/lifecycle.py` | **20 of 20 passed** |
| Features (navigation, Drive, scenes, music, import, developer, admin) | `python3 tests/e2e/features.py` | **65 of 65 passed** |
| Upgrade from a real 1.1.5 install | `python3 tests/e2e/upgrade.py` | **14 of 14 passed** |
| UI audit (95 views: 19 screens x 5 widths) | `python3 tests/e2e/ui-audit.py` | **0 issues** |
| Parity with the published 1.1.5 | `python3 tools/compare-release.py <unzipped melk-1.1.5.zip>` | **NOTHING MISSING** |

Node files: protocol 5, sync-policy 7, link-reliability 12, native-link 3, ota 3, ota-upgrade 10, scene-dna 14, sw 7, ui-structure 8.
The same commands were also run from the delivered source ZIP after unzipping it (see the end of this file).

## What the UI audit checks
Screens: Colour (before and after connecting), Effects (two views), Music, Settings (with and without Developer options), the six Settings pages, the Lab (all Rainbow cards open), Developer options, Car mode (Parked and Driving), and the Save and Import scene dialogs. Widths: 320, 360, 390, 412 and 768 px.
For each: horizontal overflow, content past the screen edge, overlapping text, clipped text, tap targets under 40 px, switches and sliders under 40 px, buttons and fields without an accessible name, duplicate ids, console errors.
Colour contrast of the design tokens was computed: every text pair is at least 4.5:1 (one grey was lightened to get there).

### Problems the audit and my own screenshot review found, now fixed
- The large status orb filled the first screen on every tab. It is now a compact card, and it is hidden on Settings.
- The "More" row on a scene was 36 px tall (now 44).
- Two text boxes (Import scene, Share and link dialogs) had no label.
- At 320 px the Music style and Sleep timer buttons cut their labels. They now wrap.
- Cards on the Effects tab touched each other.
- The Light ON / Light OFF buttons did not look tappable.
- After the listener was removed, a stray audio frame could still colour the strip. Frames are now ignored unless listening.

## Earlier results that still hold
- The overwrite bug was reproduced on the unmodified v1.1.4 code: reconnecting, or reopening the app, while a hardware scene or mode was running wrote `7e0404010001ff00ef`, `7e040150ffffff00ef`, `7e070503ffac4710ef` (a static colour on top of the effect). With the fix, both cases write nothing. This is covered by `sync-policy.cjs`, `lifecycle.py` and `upgrade.py`.
- Update path: the **published 1.1.5 update client** (kept as `tests/fixtures/ota-1.1.5.js`) offers a 1.1.6 manifest, ignores 1.1.5 and older, orders versions numerically, refuses another server or an http link, and passes the manifest checksum to the native updater (and refuses to install without one).

## Not tested here (cannot be)
- A real phone: Android fonts, scrolling feel, the real Back button, notches and rotation.
- A real strip: every physical LED behaviour. Hardware Rainbow stays `HARDWARE_PENDING`.
- Android build, lint, APK signing, runtime permission dialogs.
- The real native updater switching bundles on a phone. After an update, check the version shown at the bottom of Settings (see RELEASE_CHECKLIST.md).
- File download for backup, QR codes (not built).

## Dependency audit
`npm audit` reports 4 moderate advisories, for example `minimatch` pulled in by `@capacitor/cli`. These are build-time tools, not code in the app. The suggested fix is a breaking downgrade of the Capacitor CLI, so it was not applied.
