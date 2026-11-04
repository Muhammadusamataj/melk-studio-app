# Feature matrix (build 1.1.6, from the repository)

"Checked" says what was done this pass. **Present** means the control exists and the code is unchanged, but its behaviour was not re-tested now.
"HW" means only the real strip (or the real phone) can confirm it.

| Feature | Where in the app | Checked this pass | HW |
|---|---|---|---|
| Colour wheel, hex, RGB, brightness, white | Colour tab | Layout audited; colour restore and overwrite rules tested | Yes |
| Saved colours | Colour tab | Kept through the 1.1.5 upgrade (tested) | No |
| Scene chips (favourites first, previews) | Under the status card | Tested | No |
| Direct Light ON / OFF | Status card | Present, restyled | Yes |
| Rainbow summary | Effects, Built-in | Tested | No |
| Hardware Rainbow test (collapsible cards, 3-state evidence) | Settings, Experimental Lab | Tested (mock) | **Yes** |
| Strip modes (real names, rename, star, hide, verified-only filter) | Effects, Built-in | Tested | Yes |
| Phone effects, Colour flow | Effects, My effects | Tested: labelled as stopping when the app closes | No |
| Scenes: save, favourite, recent, share, import, link, map to hardware, reset | Settings, Scenes | Tested | Hardware mapping needs the strip |
| Auto scenes, Smart Auto 2.0 | Settings, Automation | Moved, layout audited, data kept | Yes |
| Daily routines | Settings, Automation | Moved, layout audited, data kept (upgrade test). Execution not re-tested | Yes |
| Sleep timer, Night dimming, Smooth changes | Settings, Automation | Moved, layout audited, settings kept | Yes |
| Vehicle profiles, Driving / Parked, start-up scene | Settings, Vehicle & Drive and Car button | Tested | Yes |
| Car mode | Car button | Tested (Driving filter, brightness limit, back button) | No |
| Music (microphone / phone audio, DJ patterns) | Music tab | Tested (mock): single start, background pause, stray frames, DJ | Yes |
| Mode tester, Scene tester | Settings, Experimental Lab | Tested; blocked while Driving | Yes |
| Effect explorer, Keep effects on the strip, Preset mapper | Settings, Experimental Lab | Moved, layout audited. Behaviour not re-tested | Yes |
| Protocol Lab, power format, show-all-devices, demo strip | Developer options | Moved, layout audited. Unlock and hiding tested | Yes |
| Bluetooth device info (address masked), packet log | Developer options | Tested (masking) | Yes |
| Update-server admin (PIN, URL rules, lockout) | Developer options | Tested | No |
| Software updates (check, install) | Settings, Software updates | Published 1.1.5 client tested against a 1.1.6 manifest | Yes (phone) |
| Backup: file and text, validated import | Settings, Backup & restore | Text import tested. File save/load not tested | No |
| Controller card (profile, capabilities, last problem) | Settings, Connection | Tested | Yes |
| Auto-reconnect, connect-time write policy | Always on | Tested (mock) | Yes |
| Shortcut links (`#scene=`) | Scenes, Link | Present; copy fallback dialog | No |
| Independent door / dashboard zones | not offered | Not verified on this controller | Yes |

## Where each kind of feature lives (the rule)
- **Normal features**: the four tabs and Settings pages. Only known-safe actions.
- **Experimental Lab**: guided tests that send a known hardware effect and record what you saw. Needs the parking confirmation. Nothing here changes your scenes unless you press Add.
- **Developer options**: raw packets, protocol switches and diagnostics. Hidden by default.

## Capability states
`VERIFIED_SUPPORTED`: you recorded that the effect moves AND keeps moving after the app closes.
`UNVERIFIED`: not tested enough. `UNSUPPORTED`: you recorded that it does not move.
Survives power cycle and survives Bluetooth disconnect are recorded separately and never inferred.

| App update (full APK) via Android's installer | Settings, Software updates, App update | JVM, mock-bridge and audit tests pass; Android calls compile-checked only | **Yes (phone)** |
| Web update (ZIP) | Settings, Software updates, Web update | unchanged; separate manifest | Yes (phone) |

| Effects browser: chips, search, compact list, selected-effect panel (213 modes) | Effects, Built-in | Tested (mock); which modes the strip plays is unknown | **Yes** |
| Strip scenes (Magic Lantern's 28), kept apart from My scenes | Effects, Built-in, Scenes chip | Tested (mock) | **Yes** |
| Mode favourites, rename, hide, verified (existing stores) | Effects panel and edit dialog | Tested, saved data carried over | No |
