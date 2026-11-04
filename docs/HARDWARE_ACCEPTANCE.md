# Hardware acceptance: MELK-0C21 F1 and your phone

Build: 1.1.6 review candidate (source, no commit id). Profile: MELK FFF0 family.
Park the car first. Close Magic Lantern and LED LAMP so only one app holds the strip.
Mark a row PASS only for what you actually saw. Everything starts as PENDING.

Where things are now: **Settings, Experimental Lab** holds the Rainbow test, the mode tester and the scene tester. Tick "I am parked..." at the top of the Lab first.

## A. On the strip (car)
| # | Test | Expected | Observed | Result |
|---|---|---|---|---|
| 1 | Open MELK Studio with the strip powered | Connects on its own within about 15 s, or one tap on Connect strip | | PENDING |
| 2 | Colour tab: pick red, then blue | Strip changes at once | | PENDING |
| 3 | Brightness 100, 50, 10 | Strip dims smoothly | | PENDING |
| 4 | White slider | Warm to cool white, or note "no change" | | PENDING |
| 5 | Effects, Strip modes: run three different modes | Each runs a different pattern | | PENDING |
| 6 | Lab, Hardware Rainbow test: open each of the 4 cards, press Run on strip, answer "Moves along the strip" | You see which one matches Magic Lantern's moving rainbow | | PENDING |
| 7 | With the best card running, swipe the app away and Force stop it. Wait 2 minutes | Rainbow is still moving. Reopen, answer "Still moving after the app is closed" | | PENDING |
| 8 | With it running, switch the phone's Bluetooth off for 30 s, then on | Strip keeps moving while disconnected | | PENDING |
| 9 | Reopen MELK Studio and let it connect | **Pattern is not interrupted and no static colour appears.** Settings, Connection shows the hardware effect under Effect now | | PENDING |
| 10 | Switch the strip off at its supply for 10 s, then on, three times | Note whether it returns. Answer "Comes back after power off and on" | | PENDING |
| 11 | Toggle phone Bluetooth off and on while the app is open | Shows Reconnecting, then Connected, without a tap; the effect is not interrupted | | PENDING |
| 12 | Turn the strip off, tap Connect, then power it on | A clear message first (for example "Could not reach the strip"), then it connects | | PENDING |

Control: run "Rainbow (phone)" (Effects, My effects), then swipe the app away. **It should freeze on the last colour.** That is the difference between a phone effect and a hardware effect.
If test 7 passes for a card, press Add as scene. It appears as "Rainbow (hardware)".

## B. Drive (car)
| # | Test | Expected | Observed | Result |
|---|---|---|---|---|
| 13 | Car, tap Driving | Moving or hardware effects are replaced by your static colour; brightness drops to the limit (default 40%) | | PENDING |
| 14 | While Driving, tap Party, Dinner, or start Music | Refused with "parked-only"; the strip does not change | | PENDING |
| 15 | Settings, Vehicle & Drive: set the limit to 25% and a start-up scene; close the app, reopen, connect | Driving brightness stops at 25%; the start-up scene plays after connecting | | PENDING |

## C. On the phone
| # | Test | Expected | Observed | Result |
|---|---|---|---|---|
| 16 | Settings: tap the version seven times | "Developer options" appears; Hide developer options removes it again | | PENDING |
| 17 | Open every Settings page and the Lab; press the phone's Back button | Back closes the page (does not leave the app) | | PENDING |
| 18 | Music: Start listening, then switch to another app | Listening stops; a message appears when you return | | PENDING |
| 19 | Check text sizes and spacing on your phone, portrait | Nothing overlaps or is cut off | | PENDING |
| 20 | **Update test (after approval and publishing):** on a phone running 1.1.5, install 1.1.6 from Software updates, close the app, open it | Bottom of Settings shows Version 1.1.6, and your scenes, colours, routines and verified Rainbow are still there | | PENDING |

Record, for each result: controller profile (MELK FFF0 family), software build (1.1.6 review candidate) and your evidence (what you saw, or a photo).
