# MELK Studio 1.0.12 — Persistent Preset Mapper

This update adds an explicit mapping workflow under Studio → Persistent Preset Mapper.
It shows only hardware modes the user marked offline-tested in Effects → Built-in → Rename. Select a scene and a tested mode, save mapping, then play and test with app closed and LED power cycled. Restore original scene removes the mapping.

**Limitation:** This does NOT upload a custom Candle/Party/Sleep animation to the controller. Mapping replaces the animation with the selected native hardware pattern. Smart Auto rotation still requires the app. Only Mode 128 has been independently reported working across a power cycle; all other modes must be verified by the user.

Unmodified: BLE connection and scanning source, protocol.js, native Android bridge, OTA updater behavior. No Android rebuild is required for this web-only release on the existing compatible OTA APK.

Test: backup settings, update, use mapper with Mode 128, verify LEDs physically, then app close and power cycle. Do not test while driving.
