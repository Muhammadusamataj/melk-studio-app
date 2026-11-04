# Native scenes and built-in modes (Magic Lantern 6.11.10)

## Status of each claim

| Claim | Status | Source |
|---|---|---|
| Mode packet `7E 05 03 [MODE] 06 FF FF 00 EF` | **Confirmed in code** | `BluetoothLEService.changeMode` |
| Scene packet `7E 05 31 [SCENE] 07 FF FF 01 EF` | **Confirmed in code** | `BluetoothLEService.changeScene` (byte 3 is the scene from the intent extra `wl.extra.bluetoothle.scene`) |
| Scene IDs 1–28 and their names | **Confirmed in APK resources** | `array/modes_group8` and `array/modes_group8_command` |
| Built-in mode IDs (table below) | **Confirmed in APK resources** | `array/modes_group0..7` and their `_command` arrays |
| Mode 156 is a special scene command | **Wrong.** Only used for DYDS devices (`hasDYDSDevice`). Not a normal scene. |
| Mode IDs 128–155 as used by earlier MELK Studio builds | **Not confirmed.** They are guesses. Real built-in modes span 0–212 with gaps (213 modes). |
| Native scenes persist after the app closes | **Not verified.** Needs the physical test below. |
| Native scenes persist after the strip is power-cycled | **Not verified.** Needs the physical test below. |

## Native scene IDs (confirmed)
Scene IDs are sent as the byte in `7E 05 31 [SCENE] 07 FF FF 01 EF`.
Candlelight = 4, Party = 6, Sleeping = 15 (Sleep), Movie = 12, Reading = 18.

## Built-in mode IDs (from the APK)
| Group | Name (from APK) | Mode ID |
|---|---|---|
| Basic | Auto Play | 0 |
| Basic | Magic Forward | 1 |
| Basic | Magic Back | 2 |
| Basic | 7-Color Energy | 212 |
| Basic | 7-Color Jump | 193 |
| Basic | R-G-B Jump | 194 |
| Basic | Y-C-P Jump | 195 |
| Basic | 7-Color Strobe | 196 |
| Basic | R-G-B Strobe | 197 |
| Basic | Y-C-P Strobe | 198 |
| Basic | 7-Color Gradual | 199 |
| Basic | R-Y Gradual | 200 |
| Basic | R-P Gradual | 201 |
| Basic | G-C Gradual | 202 |
| Basic | G-Y Gradual | 203 |
| Basic | B-P Gradual | 204 |
| Basic | Red Marquee | 205 |
| Basic | Green Marquee | 206 |
| Basic | Blue Marquee | 207 |
| Basic | Yellow Marquee | 208 |
| Basic | Cyan Marquee | 209 |
| Basic | Purple Marquee | 210 |
| Basic | White Marquee | 211 |
| Basic | 7-Color Race | 77 |
| Basic | 7-Color Race Back | 78 |
| Basic | R-G-B Race | 79 |
| Basic | R-G-B Race Back | 80 |
| Basic | Y-C-P Race | 81 |
| Basic | Y-C-P Race Back | 82 |
| Basic | 7-Color Wave | 83 |
| Basic | 7-Color Wave Back | 84 |
| Basic | R-G-B Wave | 85 |
| Basic | R-G-B Wave Back | 86 |
| Basic | Y-C-P Wave | 87 |
| Basic | Y-C-P Wave Back | 88 |
| Basic | 7-Color Flush | 181 |
| Basic | 7-Color Flush Back | 182 |
| Basic | R-G-B Flush | 183 |
| Basic | R-G-B Flush Back | 184 |
| Basic | Y-C-P Flush | 185 |
| Basic | Y-C-P Flush Back | 186 |
| Basic | 7-Color Flush Close | 187 |
| Basic | 7-Color Flush Open | 188 |
| Basic | R-G-B Flush Close | 189 |
| Basic | R-G-B Flush Open | 190 |
| Basic | Y-C-P Flush Close | 191 |
| Basic | Y-C-P Flush Open | 192 |
| Curtain | 7-Color Close | 57 |
| Curtain | 7-Color Open | 58 |
| Curtain | R-G-B Close | 59 |
| Curtain | R-G-B Open | 60 |
| Curtain | Y-C-P Close | 61 |
| Curtain | Y-C-P Open | 62 |
| Curtain | Red Close | 63 |
| Curtain | Red Open | 64 |
| Curtain | Green Close | 65 |
| Curtain | Green Open | 66 |
| Curtain | Blue Close | 67 |
| Curtain | Blue Open | 68 |
| Curtain | Yellow Close | 69 |
| Curtain | Yellow Open | 70 |
| Curtain | Cyan Close | 71 |
| Curtain | Cyan Open | 72 |
| Curtain | Purple Close | 73 |
| Curtain | Purple Open | 74 |
| Curtain | White Close | 75 |
| Curtain | White Open | 76 |
| Trans | 7-Color Trans | 3 |
| Trans | 7-Color Trans Back | 4 |
| Trans | R-G-B Trans | 5 |
| Trans | R-G-B Trans Back | 6 |
| Trans | Y-C-P Trans | 7 |
| Trans | Y-C-P Trans Back | 8 |
| Trans | 6-Color to Red | 9 |
| Trans | 6-Color to Red Back | 10 |
| Trans | 6-Color to Green | 11 |
| Trans | 6-Color to Green Back | 12 |
| Trans | 6-Color to Blue | 13 |
| Trans | 6-Color to Blue Back | 14 |
| Trans | 6-Color to Cyan | 15 |
| Trans | 6-Color to Cyan Back | 16 |
| Trans | 6-Color to Yellow | 17 |
| Trans | 6-Color to Yellow Back | 18 |
| Trans | 6-Color to Purple | 19 |
| Trans | 6-Color to Purple Back | 20 |
| Trans | 6-Color to White | 21 |
| Trans | 6-Color to White Back | 22 |
| Water | 7-Color Water | 39 |
| Water | 7-Color Water Back | 40 |
| Water | R-G-B Water | 41 |
| Water | R-G-B Water Back | 42 |
| Water | Y-C-P Water | 43 |
| Water | Y-C-P Water Back | 44 |
| Water | R-G Water | 45 |
| Water | R-G Water Back | 46 |
| Water | G-B Water | 47 |
| Water | G-B Water Back | 48 |
| Water | Y-B Water | 49 |
| Water | Y-B Water Back | 50 |
| Water | Y-C Water | 51 |
| Water | Y-C Water Back | 52 |
| Water | C-P Water | 53 |
| Water | C-P Water Back | 54 |
| Water | White Water | 55 |
| Water | White Water Back | 56 |
| Flow | W-R-W Flow | 143 |
| Flow | W-R-W Flow Back | 144 |
| Flow | W-G-W Flow | 145 |
| Flow | W-G-W Flow Back | 146 |
| Flow | W-B-W Flow | 147 |
| Flow | W-B-W Flow Back | 148 |
| Flow | W-Y-W Flow | 149 |
| Flow | W-Y-W Flow Back | 150 |
| Flow | W-C-W Flow | 151 |
| Flow | W-C-W Flow Back | 152 |
| Flow | W-P-W Flow | 153 |
| Flow | W-P-W Flow Back | 154 |
| Flow | R-W-R Flow | 155 |
| Flow | R-W-R Flow Back | 156 |
| Flow | G-W-G Flow | 157 |
| Flow | G-W-G Flow Back | 158 |
| Flow | B-W-B Flow | 159 |
| Flow | B-W-B Flow Back | 160 |
| Flow | Y-W-Y Flow | 161 |
| Flow | Y-W-Y Flow Back | 162 |
| Flow | C-W-C Flow | 163 |
| Flow | C-W-C Flow Back | 164 |
| Flow | P-W-P Flow | 165 |
| Flow | P-W-P Flow Back | 166 |
| Tail | 7-Color Tail | 23 |
| Tail | 7-Color Tail Back | 24 |
| Tail | Red Tail | 25 |
| Tail | Red Tail Back | 26 |
| Tail | Green Tail | 27 |
| Tail | Green Tail Back | 28 |
| Tail | Blue Tail | 29 |
| Tail | Blue Tail Back | 30 |
| Tail | Yellow Tail | 31 |
| Tail | Yellow Tail Back | 32 |
| Tail | Cyan Tail | 33 |
| Tail | Cyan Tail Back | 34 |
| Tail | Purple Tail | 35 |
| Tail | Purple Tail Back | 36 |
| Tail | White Tail | 37 |
| Tail | White Tail Back | 38 |
| Run | Red Running | 89 |
| Run | Green Running | 91 |
| Run | Blue Running | 93 |
| Run | Yellow Running | 95 |
| Run | Cyan Running | 97 |
| Run | Purple Running | 99 |
| Run | White Running | 101 |
| Run | 7-Color Running | 103 |
| Run | R-G-B Running | 105 |
| Run | Y-C-P Running | 107 |
| Run | B-P-C-Y Running | 109 |
| Run | B-G-C-Y Running | 111 |
| Run | Red-Dot in White Running | 113 |
| Run | Green-Dot in Red Running | 115 |
| Run | Blue-Dot in Green Running | 117 |
| Run | Yellow-Dot in Blue Running | 119 |
| Run | Cyan-Dot in Yellow Running | 121 |
| Run | Purple-Dot in Cyan Running | 123 |
| Run | White-Dot in Purple Running | 125 |
| Run | White-Dot in Red Running | 127 |
| Run | 7-Color in Red Running | 129 |
| Run | 7-Color in Green Running | 131 |
| Run | 7-Color in Blue Running | 133 |
| Run | 7-Color in Yellow Running | 135 |
| Run | 7-Color in Cyan Running | 137 |
| Run | 7-Color in Purple Running | 139 |
| Run | 7-Color in White Running | 141 |
| Run | Green-Dot in Blue Running | 167 |
| Run | Green-Dot in Red Running | 169 |
| Run | Red-Dot in Blue Running | 171 |
| Run | Cyan-Dot in Yellow Running | 173 |
| Run | Yellow-Dot in Purple Running | 175 |
| Run | White-Dot in Yelllow Running | 177 |
| Run | Yellow-Dot in White Running | 179 |
| RunBack | Red Run Back | 90 |
| RunBack | Green Run Back | 92 |
| RunBack | Blue Run Back | 94 |
| RunBack | Yellow Run Back | 96 |
| RunBack | Cyan Run Back | 98 |
| RunBack | Purple Run Back | 100 |
| RunBack | White Run Back | 102 |
| RunBack | 7-Color Run Back | 104 |
| RunBack | R-G-B Run Back | 106 |
| RunBack | Y-C-P Run Back | 108 |
| RunBack | B-P-C-Y Run Back | 110 |
| RunBack | B-G-C-Y Run Back | 112 |
| RunBack | Red-Dot in White Run Back | 114 |
| RunBack | Green-Dot in Red Run Back | 116 |
| RunBack | Blue-Dot in Green Run Back | 118 |
| RunBack | Yellow-Dot in Blue Run Back | 120 |
| RunBack | Cyan-Dot in Yellow Run Back | 122 |
| RunBack | Purple-Dot in Cyan Run Back | 124 |
| RunBack | White-Dot in Purple Run Back | 126 |
| RunBack | White-Dot in Red Run Back | 128 |
| RunBack | 7-Color in Red Run Back | 130 |
| RunBack | 7-Color in Green Run Back | 132 |
| RunBack | 7-Color in Blue Run Back | 134 |
| RunBack | 7-Color in Yellow Run Back | 136 |
| RunBack | 7-Color in Cyan Run Back | 138 |
| RunBack | 7-Color in Purple Run Back | 140 |
| RunBack | 7-Color in White Run Back | 142 |
| RunBack | Green-Dot in Blue Run Back | 168 |
| RunBack | Green-Dot in Red Run Back | 170 |
| RunBack | Red-Dot in Blue Run Back | 172 |
| RunBack | Cyan-Dot in Yellow Run Back | 174 |
| RunBack | Yellow-Dot in Purple Run Back | 176 |
| RunBack | White-Dot in Yelllow Run Back | 178 |
| RunBack | Yellow-Dot in White Run Back | 180 |

| Scene name (from APK) | Scene ID |
|---|---|
| Sunrise | 1 |
| Sunset | 2 |
| Birthday | 3 |
| Candlelight | 4 |
| Fireworks | 5 |
| Party | 6 |
| Datiny | 7 |
| Starry sky | 8 |
| Romantic | 9 |
| Disco | 10 |
| Rainbow | 11 |
| Movie | 12 |
| Christmas | 13 |
| Flowing | 14 |
| Sleeping | 15 |
| Ocean | 16 |
| Forest | 17 |
| Reading | 18 |
| Working | 19 |
| Dazzle | 20 |
| Gentle | 21 |
| Wedding | 22 |
| Snow | 23 |
| Fire | 24 |
| Lightning | 25 |
| Valentine's Day | 26 |
| Hallowmas | 27 |
| Warnning | 28 |

## What changed in the MELK Studio source
- `js/protocol.js`: `P.scene(id)` builds the verified scene packet. `P.NATIVE_SCENES` holds the 28 names.
- Scene `Dinner` now sends native Candlelight (4), one packet, instead of the JavaScript candle loop. Saved scenes are migrated once.
- Studio tab: "Native scenes (Magic Lantern)" selector to send any scene 1–28.
- Mode sending (`P.mode`) and the BLE transport were not changed.

## Physical test (do this before trusting any scene)
Use one scene at a time. Record each result in the table.

1. Connect to the strip from MELK Studio. Open Studio → Native scenes. Pick **4 · Candlelight** and press **Send**. The strip should show the scene. Note the appearance.
2. **App-closed test:** while the scene runs, close MELK Studio completely (swipe away, and also Force stop from Android settings). Wait 2 minutes. Does the scene keep running? Y/N.
3. **Power-cycle test:** with the app closed, switch the strip off at the supply for 10 seconds, then on. Does the scene come back by itself? Y/N. Repeat 3 times.
4. **Check the other path:** open the Magic Lantern app only if needed to compare. Do not run both at once.
5. Repeat steps 1–4 for one built-in mode (e.g. ID 143) and for a JavaScript scene (Movie). The JavaScript scene should stop when the app closes. That is the control.

Record results:

| Item | Scene/mode ID | Shows on send | Runs after app closed | Returns after power-cycle (3 tries) |
|---|---|---|---|---|
| Native scene | 4 Candlelight | | | |
| Built-in mode | 143 | | | |
| JS control | Movie (phone) | | | |

Only mark a scene as "persistent" in the app after it passes steps 2 and 3 on the real strip.

## Notes
- The sleep timer in the app still runs its own timer. A native scene does not turn itself off, so the app's sleep timer, if set, will still switch the strip off while the app is open.
- The strip accepts one controller at a time. Close Magic Lantern before testing.
