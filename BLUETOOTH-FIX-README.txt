MELK Studio Bluetooth connect fix

ROOT CAUSE: www/index.html loaded ble-capacitor.example.js AFTER ble-native.js. The example overwrote Melk.Link and used Capacitor.Plugins.BleClient (undefined), so pressing Connect strip caused Cannot read properties of undefined (reading initialize).

CHANGES:
1. Removed the example adapter script from www/index.html and Android bundled public/index.html.
2. Added explicit BluetoothLe registration fallback in ble-native.js for the actual native adapter.
3. Mirrored fixes to android/app/src/main/assets/public for existing Android project.

REBUILD:
Open this folder in Android Studio. From project root run: npx cap sync android
Then Build > Clean Project, Build > Rebuild Project and reinstall the newly built APK.
If rebuilding from a source folder with tools/prepare-apk.py, use the corrected www/index.html and www/js/ble-native.js.

Note: This is a source-level fix, not a tested APK. Bluetooth permissions and actual LED hardware still need device testing.
