# Still pending: tests on a real phone (app update)

Nothing below has been run. The code was compiled against the real Android 36 API jar with stand-ins for Capacitor and AndroidX, and its logic was tested on a normal JVM and in a browser with a mocked bridge. **No APK was built and no Android device or emulator was used.**
Use an installed APK that contains this plugin, a second APK with a higher build number signed with the **same** key, and (for test 9) one signed with a **different** key. Host them yourself; do not publish for this.

| # | Test | Expected | Result |
|---|---|---|---|
| 1 | First launch of the new APK | Settings, Software updates shows Web update and App update; installed version and build are right | PENDING |
| 2 | Same-key APK with a higher build, manifest on a test server | "App update ... available", size shown | PENDING |
| 3 | Download on Wi-Fi | progress 0 to 100%, then "downloaded and verified" | PENDING |
| 4 | Turn "install unknown apps" off for MELK Studio, tap Install | guide appears; **Bluetooth stays connected**; the button opens MELK Studio's page in Android settings; after allowing and returning, Install continues | PENDING |
| 5 | Music on, strip connected, tap Install | music stops, strip disconnects, Android's installer opens (no silent install) | PENDING |
| 6 | Tap Cancel in Android's installer | back in the app: "not completed", strip reconnects by itself | PENDING |
| 7 | Confirm the install | app restarts as the new build, says "updated to ...", strip reconnects, scenes, colours, routines and verified Rainbow are still there | PENDING |
| 8 | Same flow with Android 8, 10, 12, 14 or later if available | installer opens each time; note any differences | PENDING |
| 9 | APK signed with a different key | blocked before the installer, message names the key, file deleted | PENDING |
| 10 | Manifest points to a tampered APK (one byte changed) | "did not match its SHA-256 checksum"; nothing installed | PENDING |
| 11 | Airplane mode part-way through a download | clear network message, partial file gone, retry works | PENDING |
| 12 | Cancel part-way | "Download cancelled."; retry works | PENDING |
| 13 | Fill the phone's storage, then download | "Not enough free storage" before downloading | PENDING |
| 14 | APK with the same or a lower build number | refused as up to date / not newer | PENDING |
| 15 | Install the update and open the strip's app-controlled modes | BLE colour, brightness, music, DJ and scenes behave as before (packet bytes were not changed) | PENDING |
| 16 | After a successful update, check Settings, Web update | still works and uses `ota/melk-version.json` | PENDING |
| 17 | Android 7 (API 24) if you have one | signature check works with v2-only APKs (not tested anywhere) | PENDING |
