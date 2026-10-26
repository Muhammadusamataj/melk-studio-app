# MELK Studio

A customisable controller for MELK Bluetooth LED strips (the ones driven by the Magic Lantern app).
No build step. Plain HTML, CSS and JavaScript.

## What you can customise
* **My colours**: save, reorder and delete your own palette.
* **My effects**: build looping colour sequences (colour, fade time, hold time, overall speed). Five presets included.
* **Strip modes**: rename, star and hide the strip's built-in modes. Names are saved.
* **Music**: microphone-driven pulse or hue shift with sensitivity control.
* **Scenes**: one tap sets colour or effect, brightness and sleep timer (Movie, Reading, Sleep, Night drive and more). **Auto** picks one by time of day.
* **Car mode**: big buttons, very dim screen, brightness steps.
* **Smooth changes**: scenes and power fade in and out (Studio sets the fade time).
* **Night dimming**: brightness drops after sunset and returns at sunrise (uses location once, kept on the phone).
* **Auto-reconnect**: if the strip drops (ignition off/on), the app reconnects without the picker.
* **Home screen shortcuts**: `index.html#scene=<id>` runs a scene. Copy a link per scene in Studio, or use the four shortcuts in the manifest (long-press the installed app icon).
* **Music**: beat detection with soft decay, pulse or hue-shift styles.
* **Sleep timer**, **white temperature**, **raw mode tester**, **backup to a file or text**, **packet log**.

Chrome cannot connect without a tap, so a shortcut opens the app and asks for one tap on **Connect strip**; the scene runs right after.

## Run it
| Goal | How |
|---|---|
| Quick look in any browser | open `dist/MELK-Studio-standalone.html` (demo strip, nothing is sent) |
| Control a real strip | host the folder over **HTTPS** (GitHub Pages, Netlify, Cloudflare Pages) and open it in **Chrome on Android**. Web Bluetooth does not exist in iOS browsers or Firefox |
| Local development | `python3 -m http.server 8000` then open `http://localhost:8000` in desktop Chrome |
| Install on the phone | open the HTTPS link in Chrome, menu, **Add to Home screen** (manifest and service worker included) |
| Real APK | see `src/ble-capacitor.example.js` (Capacitor + native Bluetooth plugin, untested) |

## Layout
```
index.html            UI shell
css/style.css         design tokens and components
js/protocol.js        9-byte packet builders (the only file that knows the protocol)
js/ble.js             Web Bluetooth link, write queue, demo mode
js/app.js             UI logic, effects engine, music, storage
js/pwa.js, sw.js      install-to-home-screen support
docs/PROTOCOL.md      what was decoded from the APK and what is still open
tools/build-standalone.py   rebuilds dist/MELK-Studio-standalone.html
```

## Status
The protocol was decoded from the APK's code, not captured from a live strip, and this build was tested in a
headless browser with the demo strip. First run on real hardware: connect, then try colour, brightness, power and a
few modes, and use **Studio, Try any mode number** to confirm the mode range. Report anything that misbehaves
and it is a one-line change in `js/protocol.js`.


## Native audio (APK only)
Whole-phone sound sync (YouTube, Spotify, earphones) uses Android's Visualizer API.
Files: `native/android/AudioLevelPlugin.java`, `native/android/MainActivity.java` (replace the existing one),
and `native/android/AndroidManifest-add.txt` (two permission lines). `js/audio-native.js` is the web side.
Copy the two Java files to `android/app/src/main/java/studio/melk/app/`, add the permissions, then `npx cap sync` and rebuild.
Some phones or apps block Visualizer; in that case the app still works with the microphone in the browser.
