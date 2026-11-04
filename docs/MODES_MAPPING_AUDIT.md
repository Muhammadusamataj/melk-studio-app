# Modes and scenes mapping audit (build 1.1.7, Effects redesign)

Done **before** the Effects tab was redesigned. Question: which mode and scene numbers, names and commands does the app really know, what does each one rest on, and what is still unproven on your strip?
Sources: Magic Lantern 6.11.10 (its APK, read only), `www/js/protocol.js`, every id written in `www/js/app.js`, and `docs/NATIVE-SCENES.md`.
Nothing here sends a command, and no command was invented.

## 1. What the tables rest on
| Item | Status | Evidence |
|---|---|---|
| 213 mode numbers, their names and their groups | **Matches Magic Lantern's own arrays exactly** | `tests/modes-audit.cjs` compares `protocol.js` with `tests/fixtures/ml-apk-arrays.json`, which `tools/extract-ml-arrays.py` reads from the APK (`array/modes_group0..7` with their `_command` arrays) |
| 28 scene numbers and names | **Matches exactly** | same test, `array/modes_group8` and `modes_group8_command` |
| Group order: Basic, Curtain, Trans, Water, Flow, Tail, Run, Run back, Scenes | Magic Lantern's own order | `array/modes_groups` |
| Mode command `7E 05 03 [mode] 06 FF FF 00 EF` | Confirmed in Magic Lantern's code (`changeMode`) and produced byte for byte for all 213 numbers | `docs/NATIVE-SCENES.md`, test |
| Scene command `7E 05 31 [scene] 07 FF FF 01 EF` | Confirmed in its code (`changeScene`) and produced for all 28 numbers | same |
| Every number written in the app code (Rainbow candidates 11, 103, 105, 129, default verified mode 128, default scenes) | All exist in Magic Lantern's lists | test |

Limit: the pairing of each `modes_groupN` array with its group title is by position in `modes_groups`; the counts (47, 20, 20, 18, 24, 16, 34, 34) and number ranges agree with `protocol.js`, but the app code that draws the titles was not decompiled again.

## 2. The groups (Magic Lantern's order)
| # | Group (Magic Lantern order) | Modes | Mode numbers |
|---|---|---|---|
| 1 | Basic (`modes_group0`) | 47 | 0–2, 77–88, 181–212 |
| 2 | Curtain (`modes_group1`) | 20 | 57–76 |
| 3 | Trans (`modes_group2`) | 20 | 3–22 |
| 4 | Water (`modes_group3`) | 18 | 39–56 |
| 5 | Flow (`modes_group4`) | 24 | 143–166 |
| 6 | Tail (`modes_group5`) | 16 | 23–38 |
| 7 | Run (`modes_group6`) | 34 | 89–141 (every 2nd), 167–179 (every 2nd) |
| 8 | Run back (`modes_group7`) | 34 | 90–142 (every 2nd), 168–180 (every 2nd) |
| 9 | Scenes (`modes_group8`) | 28 | 1–28 (a different command, see below) |
| | **Total modes** | **213** | |


## 3. Findings
| # | Finding | Effect | What was done |
|---|---|---|---|
| 1 | The old grid showed only modes 128 to 155 (28 of 213). Our own docs call that range "a guess". All 28 are real Magic Lantern modes, but the range is arbitrary. | 185 modes could not be reached from the Effects tab | The Effects tab lists all 213 in Magic Lantern's groups. The range is no longer used to decide what is shown. |
| 2 | The edit dialog said "Mode 1" for mode 128 (a number counted inside the old range) | A number that exists nowhere in Magic Lantern | The dialog shows the real number and name ("Mode 133: 7-Color in Blue Running") |
| 3 | The 128 to 155 range was hard-coded in 8 more places: the DJ pool, Car mode, the scene-to-hardware mapper, the effect editor, the check before playing an effect | A favourite or a verified mode outside the range would be ignored there | Those checks accept any known mode. The default DJ pool (nothing favourited) is still 128 to 155, and your saved data is read exactly as before. |
| 4 | Four names are used for two different numbers in Magic Lantern's own list (section 4) | A list sorted by name could not tell them apart | Every row shows its number; search by number works |
| 5 | Magic Lantern's scene list says "Datiny" (scene 7) and "Warnning" (scene 28) | Probably typos in Magic Lantern | Shown exactly as Magic Lantern spells them; they are its names, not ours |
| 6 | "Scenes" means two things: the controller's own scene list (commands `7E 05 31`) and your saved scenes (Settings, Scenes) | Easy to mix up, and Movie exists in both | They are kept apart: the Scenes chip shows only the controller's scenes and says where your own are. Strip scenes cannot be favourited or renamed (a favourite key would clash with the mode numbers 1 to 28). |
| 7 | Nothing in the app can read which effect the strip is playing; the strip does not report it | "Active" cannot be shown honestly | The row you select and the last command sent are shown separately (see section 6) |

## 4. Names that Magic Lantern gives to two numbers
| Name | Mode numbers |
|---|---|
| Green-Dot in Red Running | 115, 169 |
| Green-Dot in Red Run Back | 116, 170 |
| Cyan-Dot in Yellow Running | 121, 173 |
| Cyan-Dot in Yellow Run Back | 122, 174 |


## 5. Strip scenes (command `7E 05 31 [scene] 07 FF FF 01 EF`)
| Scene | Name | Scene | Name |
|---|---|---|---|
| 1 | Sunrise | 15 | Sleeping |
| 2 | Sunset | 16 | Ocean |
| 3 | Birthday | 17 | Forest |
| 4 | Candlelight | 18 | Reading |
| 5 | Fireworks | 19 | Working |
| 6 | Party | 20 | Dazzle |
| 7 | Datiny | 21 | Gentle |
| 8 | Starry sky | 22 | Wedding |
| 9 | Romantic | 23 | Snow |
| 10 | Disco | 24 | Fire |
| 11 | Rainbow | 25 | Lightning |
| 12 | Movie | 26 | Valentine's Day |
| 13 | Christmas | 27 | Hallowmas |
| 14 | Flowing | 28 | Warnning |


## 6. What each label means in the app
| Label | Meaning | Source of the claim |
|---|---|---|
| The name and number of a row | Magic Lantern's own list | the APK arrays (section 1) |
| Your own name (renamed) | what you typed; Magic Lantern's name stays visible in the panel | your edit |
| ✓ **VERIFIED** | you recorded on **your** strip that it works: the Verified box in the edit dialog, or the Hardware Rainbow test | your evidence only (mode 128 comes pre-marked, as before) |
| **NOT TESTED** | nobody has recorded anything on your strip. **This is not a claim that it is unsupported.** The number and name are from Magic Lantern's list, so the command is a known one; your controller may or may not play every effect | the audit |
| ✕ **DOES NOT WORK** | you recorded that it does not move | your evidence only |
| **SENT** | the last effect command this app sent. The strip does not confirm what it plays, so this is "sent", not "active". It disappears when the app sets a static colour | the app's own record |
| Selected row (amber bar) | what the panel below describes. Selecting sends nothing; **Run on strip** does | the interface |

## 7. Where the 28 tiles of the old grid went
Modes 128 to 155 are now in the **Run back**, **Run** and **Flow** chips (and in All):
<details><summary>table</summary>

| Mode | Name | Chip |
|---|---|---|
| 128 | White-Dot in Red Run Back | Run back |
| 129 | 7-Color in Red Running | Run |
| 130 | 7-Color in Red Run Back | Run back |
| 131 | 7-Color in Green Running | Run |
| 132 | 7-Color in Green Run Back | Run back |
| 133 | 7-Color in Blue Running | Run |
| 134 | 7-Color in Blue Run Back | Run back |
| 135 | 7-Color in Yellow Running | Run |
| 136 | 7-Color in Yellow Run Back | Run back |
| 137 | 7-Color in Cyan Running | Run |
| 138 | 7-Color in Cyan Run Back | Run back |
| 139 | 7-Color in Purple Running | Run |
| 140 | 7-Color in Purple Run Back | Run back |
| 141 | 7-Color in White Running | Run |
| 142 | 7-Color in White Run Back | Run back |
| 143 | W-R-W Flow | Flow |
| 144 | W-R-W Flow Back | Flow |
| 145 | W-G-W Flow | Flow |
| 146 | W-G-W Flow Back | Flow |
| 147 | W-B-W Flow | Flow |
| 148 | W-B-W Flow Back | Flow |
| 149 | W-Y-W Flow | Flow |
| 150 | W-Y-W Flow Back | Flow |
| 151 | W-C-W Flow | Flow |
| 152 | W-C-W Flow Back | Flow |
| 153 | W-P-W Flow | Flow |
| 154 | W-P-W Flow Back | Flow |
| 155 | R-W-R Flow | Flow |

</details>

## 8. Saved data
Nothing was migrated because the storage did not change. `modeNames`, `modeFav`, `modeHidden`, `modePersistent`, `persistentOnly`, `verify` and `native` are read and written as before; no new key was added. Tested with the real saved data of a 1.1.5 install (`tests/e2e/upgrade.py`, `tests/e2e/effects-browser.py`): a renamed favourite ("My flow", mode 133) is what the list opens on. The browser opens on **Favourites** if you have any, otherwise on the group of the last effect sent, otherwise on **All**.

## 9. Not known (and not claimed)
- Which of the 213 modes and 28 scenes the MELK-0C21 actually plays. Only mode 128 (your own earlier test) and what you record yourself are marked verified.
- Whether any mode or scene keeps running after the app closes or after a power cycle (docs/HARDWARE_ACCEPTANCE.md).
- Whether Magic Lantern hides some of these numbers for certain device types (it special-cases mode 156 for DYDS devices, which is not in the list).
- Which Magic Lantern command makes the moving Rainbow: the Hardware Rainbow test is unchanged.

## 10. Re-running the audit
```
python3 tools/extract-ml-arrays.py <Magic_Lantern_6_11_10.apk> tests/fixtures/ml-apk-arrays.json   (needs aapt)
node --test tests/modes-audit.cjs tests/mode-catalog.cjs
python3 tools/audit-modes.py        (prints the tables above)
```
