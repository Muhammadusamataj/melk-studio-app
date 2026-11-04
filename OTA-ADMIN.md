# Admin lock and update server (v1.1.3)

Studio -> Software updates -> **Admin**.

- First use: create a PIN (6+ characters). It is stored as a salted PBKDF2 hash, never as plain text.
- After login (5 minutes) you can change the manifest URL, reset it to the default, change the PIN, or log out.
- The URL must be https, end in `.json`, and have no user/password in it.
- The update zip must come from the same server as the manifest, and its SHA-256 must match the manifest.
- 5 wrong PINs lock the admin screen for 5 minutes.
- A forgotten PIN is reset by clearing the app data (this also clears saved scenes).
- The Software updates card now shows which server is used and what version it offers, e.g. "Up to date (v1.1.3). Server has v1.1.0 at host".

## Limits (be honest about them)
- The PIN is a lock for accidents and casual access. Someone with full control of the phone (root, adb, app data) can still change or remove it.
- Whoever controls the update server controls the code the app runs, with Bluetooth, microphone and location access. Only point it at a server you own.
- The strongest protection is a signed manifest (the app holds your public key and rejects anything not signed with your private key). Not implemented yet.
- This feature reaches an older APK only through the update path that already works for it. If an old APK reads a different URL, a new APK is needed once.
