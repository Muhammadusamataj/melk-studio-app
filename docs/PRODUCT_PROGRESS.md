# MELK Studio: product progress

Target version: **1.1.6** (review candidate). Controller under test: MELK-0C21 F1 (FFF0 / FFF3 / FFF4).
Status words: TODO, IN_PROGRESS, CODE_COMPLETE, TESTED, HARDWARE_PENDING, BLOCKED, DONE. Nothing that needs the real strip or a real phone is DONE.

**Release state: ON HOLD for review.** No 1.1.6 OTA ZIP or manifest has been built or published. The OTA GitHub repository has not been touched (it was only read, to fetch the published 1.1.5 bundle for comparison).

| Phase | Task | Status | Evidence / what is left |
|---|---|---|---|
| A | Baseline and architecture | DONE | Source read once; baseline tests recorded; progress docs kept up to date. |
| B | Rainbow and native-effect lifecycle | TESTED (mock), HARDWARE_PENDING | The overwrite bug (reconnect and reopen replaced a running hardware effect with a static colour) is reproduced and fixed. Real Rainbow still needs the strip. |
| C | BLE connection reliability | TESTED (mock), HARDWARE_PENDING | Bluetooth-off check, 12 s timeout, GATT profile check, duplicate-connect guard, bounded queue, write-failure recovery, readable errors. |
| D | Preserve and repair existing features | TESTED | Parity tool: nothing missing vs the published 1.1.5 (see RELEASE_PARITY_1.1.5.md). A real 1.1.5 install's saved data loads intact (upgrade test). Behaviour of routines, Smart Auto, sunset dimming and sleep timer was not re-tested this round (data kept, layout audited). |
| E | Hardware intelligence | CODE_COMPLETE, TESTED (mock) | Controller card on Settings, Connection. |
| F | Flow Studio | CODE_COMPLETE, HARDWARE_PENDING | Real Magic Lantern mode names, Rainbow summary on Effects, collapsible Rainbow test cards, scene previews, favourites, recents. Per-effect speed and direction are not exposed because they are unverified. |
| G | MELK Drive | CODE_COMPLETE, TESTED (mock) | Driving / Parked set by you (no detection), calm-only scenes, brightness limit, vehicle profiles, start-up scene. |
| H | Scene DNA | CODE_COMPLETE, TESTED | Strict validator, share and import, hardware effects only imported as hardware when verified on this strip. Text sharing only; no QR codes. |
| I | Music intelligence | CODE_COMPLETE, TESTED (mock), HARDWARE_PENDING | Single start, pauses in the background, ignores stray frames, DJ keeps its pattern. Battery and real microphone behaviour need a phone. |
| J | UI/UX redesign | CODE_COMPLETE, TESTED | New structure, design system, 95-view audit at five widths with 0 issues, screenshots reviewed. Needs a look on the real phone (Android fonts). |
| K | Security and performance | CODE_COMPLETE | Import sanitiser, masked Bluetooth address, bounded queue, version-aware network-first service worker, `inert` background for modal pages. `npm audit` lists 4 moderate advisories in build tooling (see TEST_REPORT); not applied, your decision. |
| L | Automated tests | TESTED | 69 node tests, 99 end-to-end checks, 95 audited views. |
| M | Physical acceptance preparation | DONE | HARDWARE_ACCEPTANCE.md (all PENDING). |
| N | Debug APK | BLOCKED | No Android SDK, JDK 21 or Gradle here. |
| O | 1.1.6 OTA package | ON HOLD | Waiting for your explicit approval. |

## What changed in the structure
Normal features stay in four tabs. Guided hardware experiments are in **Settings, Experimental Lab**. Raw protocol tools are in **Developer options**, hidden until you tap the version seven times. See UI_REDESIGN.md.

## Still not proven
- Which Magic Lantern command makes the moving Rainbow you see is **not proven**. Candidates to test: scene 11, modes 103, 105, 129.
- The `7E 05 31 0D ...` packet in your log is scene 13 (**Christmas**), not Rainbow (scene 11).
- No hardware-native effect has been confirmed by this work to move, keep running after the app closes, or survive a power cycle. Mode 128 is the only entry carried over from your earlier note.

## Next
1. Review this package (preview HTML first).
2. Run HARDWARE_ACCEPTANCE.md on the car and on the phone.
3. Approve, and then the 1.1.6 OTA package is built, verified and handed to you to upload. I do not push to the OTA repository.

## Phase P: app update (APK) installer, build 1.1.7
| Task | Status |
|---|---|
| Native plugin, downloader, rules, FileProvider, permission flow | CODE_COMPLETE, compiled against android-36.jar, JVM-tested (39 tests) |
| Settings, Software updates: Web update and App update as separate cards | CODE_COMPLETE, TESTED (mock bridge, 50 checks, 135 audited views) |
| BLE and music handled around the install | CODE_COMPLETE, TESTED (mock) |
| apk-version.json example, manifest and signing tools | DONE (tools tested on real signed APKs with throwaway keys) |
| Signing compatibility with YOUR installed APK | **NOT VERIFIED** (the v1.1.4 debug APK was not provided) |
| Gradle build, APK, real-device install | **BLOCKED** here; see HARDWARE_ACCEPTANCE_APK_UPDATER.md |
| Publishing | NOT DONE, awaiting your approval |

## UI cleanup (1.1.7)
| Task | Status |
|---|---|
| Duplication audit (measured, before and after) | DONE |
| Power, connection, updates, Rainbow, Lab, Scenes cleanup | CODE_COMPLETE, TESTED (mock) |
| Existing favourites, recents, saved colours and shortcuts reused | DONE (tested) |
| Real-phone look and feel | NOT CHECKED |

## Effects redesign (1.1.7)
| Task | Status |
|---|---|
| Mode and scene mapping audit against Magic Lantern's APK | DONE (213 of 213 modes, 28 of 28 scenes match) |
| Chips, search, compact list, single selected-effect panel | CODE_COMPLETE, TESTED (mock) |
| Strip scenes kept apart from your saved scenes | DONE (tested) |
| Saved names, favourites and verification carried over | DONE (tested with real 1.1.5 data) |
| Which modes and scenes the MELK-0C21 really plays | **NOT KNOWN**: see HARDWARE_ACCEPTANCE_EFFECTS.md |
