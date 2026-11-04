# UI/UX redesign (1.1.6)

## Information architecture
```
Top bar:  [connection chip]            [Car] [power]
Status card (orb, colour, connect banner, collapsed Direct power)   <- hidden on Settings
Scene chips (favourites first, preview dots)                 <- hidden on Settings
Tabs:  Colour | Effects | Music | Settings

Settings
  Connection            status card with the same action as the top chip, controller, collapsed details
  Vehicle & Drive       profiles, driving limit, start-up scene, open Car mode
  Scenes                save, import, recent, all scenes (favourite, share, link, hardware, delete)
  Automation & timers   auto scenes, daily routines, sleep timer, night dimming, smooth changes
  Backup & restore      file and text, validated import
  Software updates      version, check, install
  Experimental Lab      (amber)  guided hardware tests
  Developer options     (red, hidden until the version is tapped 7 times)
  About card            version, tap target for the unlock
Effects, Built-in:   Rainbow row, then one card: search + Verified-only, category chips (the only sideways scroll),
                      a compact list (own max height, vertical scroll), and one panel for the selected effect
Car mode (full screen): Driving | Parked, big scene buttons, brightness, Off
```

## What goes where
| Kind | Rule | Examples |
|---|---|---|
| Normal | Safe for anyone; no raw commands | Colour, Effects, Music, scenes, Drive, automation, backup, updates |
| Experimental Lab | Sends a *known* Magic Lantern effect and records what you saw. Needs the parking confirmation. Blocked while Driving | Rainbow test, mode tester, scene tester, effect explorer, preset mapper |
| Developer options | Raw packets, protocol switches, diagnostics, update-server address | Protocol Lab, power format, device info, packet log, show all devices, demo strip, update-server admin |

## Rainbow hardware test (redesigned)
One summary at the top (status badge, progress bar, "N of 4 candidates tested", collapsible "How to test"). Then one collapsible card per candidate: title and source, status badge, "N of 3 recorded". Inside: **Run on strip** first, then three steps (Moves along the strip, Still moving after the app is closed, Comes back after power off and on), each Untested / Yes / No. A candidate becomes `VERIFIED_SUPPORTED` only when it moves AND keeps moving after the app closes; only then does **Add as scene** appear. "Back to a static colour" is an explicit button.

## Design system (css/style.css)
- Colours: plum background, lantern amber accent, state colours for ok / warn / bad. Every text pair is at least 4.5:1.
- Spacing 4/8/12/16/20/24 px; radii 12 / 16 / 22 px; 44 px minimum for buttons, rows and tabs (40 px inside segmented controls).
- Components: cards, list rows with icon and subtitle, real switches, segmented controls, badges, key-value lines, bottom-sheet dialogs, full-screen pages with a back button.
- Behaviour: pages are modal (background is `inert`), Esc and the Android Back button close them, focus returns to where you were, reduced-motion is respected.

## Limits
- Fonts follow the phone (Avenir Next, then Nunito, Segoe UI, then the system font such as Roboto). Screenshots were reviewed with the sandbox font, so check spacing on the real phone (HARDWARE_ACCEPTANCE test 19).
- Developer options are hidden, not locked: anyone who finds the seven-tap gesture can open them. The update-server address still needs the admin PIN.
