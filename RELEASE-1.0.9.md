# v1.0.9 — Power control safety patch (test release)

Adds explicit Light ON / Light OFF buttons, suppresses app-generated BLE colour/brightness commands while OFF, cancels driver/fade/sleep timers and clears pending queue on OFF. Reconnect honours saved OFF state without pushing brightness. When ON, a power packet precedes brightness without fade. The hardware power command bytes are unchanged. Numbered modes can persist independently; phone-driven Candle/Party/Sleep animations still cannot be stored on the controller.

Native Bluetooth and OTA transport unchanged. No hardware tests performed. Keep the working APK backup and test ON/OFF before anything else.
