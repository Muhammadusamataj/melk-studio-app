# MELK Studio v1.0.5 — experimental improvements

- Music > DJ patterns: bass-onset-driven hardware effect changes, minimum 4–20 seconds. Uses existing native microphone level, NOT full FFT / true verified beat alignment.
- Effects favourites (starred modes) form DJ / Smart Auto effect bank; otherwise the 28 mapped hardware modes 128–155 are used. Claims of 100+ modes are unverified by current protocol implementation.
- Studio > Smart Auto: keep original time-of-day logic, or opt into hardware pattern shuffle at configurable intervals (requires live app connection).
- Studio > Hardware effect memory: optional *do not override controller on reconnect*; does not issue an unverified EEPROM save command. Power-cycle persistence must be tested on physical controller.
- BLE, OTA, audio native adapters unchanged. OTA installed bundle requires existing app with Capgo updater already installed.

TEST FIRST: backup working APK, install OTA and restart, verify Bluetooth and colour; only then try DJ and Smart Auto. No physical device validation performed.
