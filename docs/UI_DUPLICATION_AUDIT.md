# UI cleanup and duplication audit (build 1.1.7)

Scope: remove repeated buttons, repeated explanations, overlapping settings and clutter from v1.1.7 **without adding features**. Nothing was published. Look and feel is unchanged (dark plum and amber).
Before/after screenshots: `docs/ui-cleanup/before-after-*.png` (full sets in `docs/ui-cleanup/before` and `after`).

## How it was measured
`tests/e2e/ui-duplication.py` opens 16 screens at 390 px in headless Chromium (mocked Android bridge) and counts what a person can see: action buttons, words, explanation paragraphs, cards, collapsed sections, and any explanation that appears twice on one screen. It was run on the v1.1.7 exactly as delivered (`--root`) and on the cleaned version. The same script now runs in the regression suite with `--assert`, so a repeated explanation fails the build.

| Measure (all 16 screens) | Before | After |
|---|---|---|
| Visible action buttons | 74 | 65 |
| Collapsed sections ("Details" style) | 20 | 29 |
| Visible words | 2088 | 1494 (-28%) |
| Explanation paragraphs | 57 | 33 |
| Cards | 50 | 44 |
| Repeated explanations on one screen | 3 | 0 |

| Screen | Words before -> after | Cards before -> after |
|---|---|---|
| Settings, Connection | 113 -> 19 | 2 -> 2 (status card added, tips and technical rows collapsed) |
| Settings, Software updates (update found) | 184 -> 73 | 3 -> 2 |
| Experimental Lab | 363 -> 234 | 7 -> 4 |
| Settings, Scenes | 139 -> 99 | 3 -> 2 |
| Effects, My effects | 138 -> 94 | 2 -> 2 (explanation paragraphs 8 -> 1) |
Screen height: Connection 1051 -> 563 px, Software updates 1291 -> 779 px. Home is about the same height (the gain there is hierarchy, not length).

## Findings and decisions
| # | Duplication or clutter | Where | Decision | Done |
|---|---|---|---|---|
| 1 | Three power controls competing: top Power, always-visible Light ON / Light OFF, Car mode Off | every tab | **Top Power is the one primary control.** Light ON / OFF moved into a collapsed "Direct power" row with one line ("use it if the strip and the app disagree"). Same handlers, same packets. Car mode Off stays (a separate full-screen mode). | yes |
| 2 | Connection described three different ways: chip "Connect strip", banner "The strip is not connected." + "Connect", Connection page with no action at all. The banner also showed while connecting. | Home, Connection, Settings | One `connView()` feeds the chip, the banner, a new status card on the Connection page and the Settings row, so words and the button always agree. Banner appears only when not connected. Page button does exactly what the chip does. | yes |
| 3 | Controller card repeated the status (Connection, Device) and listed capability statements and services | Connection | Status card replaces the first two rows; Profile and Effect now stay; services, capability notes and "matched on" go under "Technical details"; "Can't connect?" collapsed | yes |
| 4 | Software updates explained Web vs App four times (notice, card text, extra hint, details) and showed server, updater, package, build type and signing key all the time | Software updates | Top notice removed; each card has one line; "Version and server" and "Package and signing" collapsed; "Available" row only when something is available; permission text not repeated. The two cards stay separate, all IDs unchanged. | yes |
| 5 | Rainbow shown as a full card on Effects (status, two lines, button) that repeated the Lab; "phone Rainbow stops when the app closes" said in four places | Effects, Lab | Effects shows one slim row (badge and status) that opens the Lab. The Lab is the single detailed place. | yes |
| 6 | "Phone-driven / Phone effect, stops when the app closes" repeated on every effect card and scene row (11 times) | My effects, Scenes | Said once above the list; each phone effect gets a short PHONE tag; scene rows say "Phone effect" | yes |
| 7 | Lab had seven cards with overlapping hints | Lab | Four blocks: notice, Rainbow test, Effect testers (mode, scene, explorer), Keep effects on the strip (with preset mapper). Hints shortened. Two "Send" buttons are now "Send mode" and "Send scene". | yes |
| 8 | Favourites worded three ways (Star, starred, Favourite); Recent list in its own card with an empty-state sentence | Effects, Scenes, Car | **No new favourites system.** The existing stores (`favScenes` for scenes, `modeFav` for modes), Recent (`recent`), saved colours (`palette`) and shortcut links are reused as they were. One word, "Favourite", everywhere. Recent moved into the first Scenes card and hides when empty. | yes |
| 9 | Driving/Parked explained on the Vehicle page, in Car mode hints and next to a second big "Open Car mode" button | Vehicle & Drive, Car | One explanation; the big button became a text link (the top Car button is the main entry) | yes |
| 10 | Long copy in Music, Automation, Backup, Scenes | several | Shortened, nothing removed | yes |

## Kept on purpose (looks like duplication, is not)
- **Connection chip and banner** both say "Connect strip" when not connected. The banner is the explicit call to action; the wording is now identical.
- **Car button (top) and the link on Vehicle & Drive**: two entry points to the same mode from different contexts; only one is a button now.
- **Parking confirmation** in the Lab and in Developer options is one stored choice mirrored on two pages.
- **Recent scenes and the scene chips**: different jobs (history vs the current favourites-first row).

## Not changed
All element IDs (none removed), BLE logic and every packet (builders compared byte for byte), the updater, saved-settings schema (no new keys), scenes, routines, music, Lab tests and Developer options. Tests that asserted old wording were updated; behaviour tests were not weakened.

## Found and fixed while doing this
The banner said "not connected" while a connection was in progress; the Connection page had no connect button; at 320 px the mode-number box in the Lab shrank to 30 px when "Send" became "Send mode" (caught by the layout audit, fixed by letting the row wrap).

## Limits
Screenshots are from headless Chromium with a sandbox font, not a phone. The Lab and Scenes sheets are cropped at 1500 px. The word and paragraph counts are a proxy for clutter, not a usability study: please judge the sheets yourself.
