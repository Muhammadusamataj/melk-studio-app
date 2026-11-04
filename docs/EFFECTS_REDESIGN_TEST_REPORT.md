# Regression results: Effects redesign (build 1.1.7)

All results come from the final source tree copied to a clean folder. Bluetooth, audio, HTTP and the Android installer are mocked, so these results show what the app does, not what a strip or a phone does. Nothing was built into an APK and nothing was published.

| Suite | Command | Result |
|---|---|---|
| Node unit tests (now including the mode and scene audit and the catalogue) | `npm test` | **127 of 127** (was 111; 16 new) |
| Native Java compiled against android-36.jar, with JUnit | `sh tools/android-compile-check/check-native.sh` | **39 of 39** |
| Signing and manifest tools | `npm run test:tools` | **12 of 12** |
| Browser: lifecycle (hardware effects, Rainbow evidence) | `tests/e2e/lifecycle.py` | **20 of 20** |
| Browser: features | `tests/e2e/features.py` | **65 of 65** |
| Browser: upgrade from real 1.1.5 saved data | `tests/e2e/upgrade.py` | **14 of 14** |
| Browser: app-update (APK) flow | `tests/e2e/apk-updater.py` | **51 of 51** |
| Browser: UI cleanup | `tests/e2e/ui-cleanup.py` | **33 of 33** |
| Browser: **Effects browser (new)** | `tests/e2e/effects-browser.py` | **67 of 67** |
| Repeated-explanation check on 16 screens | `tests/e2e/ui-duplication.py --assert` | pass, 0 repeats |
| Layout audit: every screen and state, 320 to 768 px, now including Effects with Scenes, a selected group, and no-match | `tests/e2e/ui-audit.py` | **150 views, 0 issues** (was 135) |
| Parity with the delivered cleanup build and with the published 1.1.5 | `tools/compare-release.py` | **NOTHING MISSING** |

Browser checks in total: 250. Every BLE packet builder is byte-for-byte identical to the published 1.1.5 and to the delivered cleanup build (`compare-release.py` compares them with the same inputs).

## What the new tests prove
- **The audit (`tests/modes-audit.cjs`)**: all 213 modes (number, group, name) and all 28 scenes equal Magic Lantern's own arrays; the group order is Magic Lantern's; every mode and scene produces exactly its documented packet; every number written in the app code exists; the four repeated names are repeated in Magic Lantern's list too.
- **The catalogue (`tests/mode-catalog.cjs`)**: groups, counts, chip order, Hidden chip only when needed, search (names, numbers, `#number`, several words, scenes, hidden excluded), verified-only, and that only what you recorded is ever "verified" or "unsupported".
- **The browser (`tests/e2e/effects-browser.py`)**: chips in Magic Lantern's order; 213 modes; each group lists exactly its modes; only the chips scroll sideways and only the list scrolls vertically (maximum 360 px, no scroll chaining); rows compact but touch-sized; the old grid is gone; no new Settings page or favourites control; selecting sends nothing; Run sends the exact packet (first mode of each of the 8 groups, and a scene); SENT and selected are separate and SENT clears on a static colour; untested effects never say "unsupported"; search, Escape, empty state and clear; Verified-only; favourites in `modeFav` with no new storage key; rename, hide, show again and Verified through the existing dialog; the speed packet; keyboard (one tab stop, arrows, Home, End, chips with arrows, Enter); not connected and Driving guards; "does not work" shown only from your own record; real 1.1.5 saved data; a favourite outside the old 128 to 155 range in the list and in Car mode; five widths (320, 360, 390, 412, 768).

## Page height of the Effects tab
| Width | Before (28 tiles) | After |
|---|---|---|
| 320 px | 2203 px | 1720 px |
| 390 px | 2038 px | 1571 px |
| 768 px | 1620 px | 1487 px |
The whole list of 213 effects now lives in one box of at most 360 px, with about 6 rows visible at a time.

## Measured clutter (Effects, Built-in, 390 px, `ui-duplication.py`)
| Measure | Before | After |
|---|---|---|
| Words on screen | 240 | 145 |
| Cards | 3 | 2 |
| Action buttons | 2 | 4 (Run, Favourite, Rename and the Rainbow row: the controls that used to be "tap a tile" are now explicit) |
| Explanation paragraphs | 1 | 3 (the list note, the status and the "last sent" line: this text is what labels untested effects honestly) |
So the page is shorter and the list is organised, but the screen is **not** wordless: the status text is deliberate.

## Tests changed, and why
Four assertions read the old tile grid and were updated, not loosened: mode names (now read from the list), the renamed favourite after an upgrade (now the list opens on Favourites), the favourite wording in the edit dialog, and the repeated-text metric (list rows count as items). The layout audit also now ignores text that is scrolled out of a scroll box.

## Found and fixed while doing this
The edit dialog numbered mode 128 as "Mode 1"; the 128 to 155 range was hard-coded in eight more places; an empty search left the panel pointing at an invisible effect with Run active; at first the panel's three buttons wrapped awkwardly.

## Not tested
A real phone (fonts, touch feel), a real strip (which effects it plays), the Gradle build and APK, and the installer on a device. See `HARDWARE_ACCEPTANCE_EFFECTS.md` and `HARDWARE_ACCEPTANCE_APK_UPDATER.md`.
