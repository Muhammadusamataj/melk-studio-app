# v1.0.6 – optional native hardware-mode mapping (test release)

- Edit any custom colour-sequence effect (including Candle and Party flash) and OPTIONALLY select a verified built-in mode 128–155. When selected, Play sends the native mode command instead of the repeating phone RGB loop. The mode may continue after closing the app and power cycling if the controller retains it.
- No guessed mapping: Candle -> which built-in mode is UNKNOWN. Compare modes on your LED strip first. This does not store arbitrary colour animations in EEPROM.
- Original phone-driven behaviour is kept when 'Phone-driven colours' selected.
- Working ble-native.js, ble.js, protocol.js, OTA logic unchanged.
- IMPORTANT: Smart Auto timed mode rotation and microphone-driven DJ still require a running connected app.
- Firmware-specific mode ranges and Magic Lantern exact effect IDs unverified.
- Test first on device; save previous APK/bundle backup.
