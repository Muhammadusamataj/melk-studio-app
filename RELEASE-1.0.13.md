# MELK Studio v1.0.13 – Magic Lantern native Scene Diagnostic

Evidence: Decompilation of user-supplied Magic Lantern 6.11.10 APK DEX method
`Lcom/easylink/colorful/service/BluetoothLEService;->changeScene()`
reveals native scene packet `7E 05 31 XX 07 FF FF 01 EF`.
The same APK method `changeMode()` builds `7E 05 03 XX 06 FF FF 00 EF`,
which matches MELK Studio numbered hardware mode packets exactly.

This release introduces a user-confirmed single scene command diagnostic in Studio Protocol Lab.
It does **not** establish Candle/Party IDs or solve app-generated Candle persistence yet.
Do not run automatic ID sweeps. Test on a stationary vehicle and record results.
Working Bluetooth and OTA bridge source files were not modified.
