# Permanent APK updates: audit, enrollment and safe release

## Current installation and blocker

The owner confirmed the final v1.2.0 test APK, package `com.bleled.com`, versionCode 10200. Its actual verified signer is:

`95cfeb6e1c3d69a42eda77e468480f129f611d393d51eb191af881c9f7291081`

That APK was generated on an ephemeral GitHub-hosted runner. The test workflow retained APK/public metadata only; it did not retain the private debug keystore in a secret, cache or artifact. A certificate or APK cannot reconstruct the private key. No recoverable copy is available through this session. If an independently saved ORIGINAL keystore exists, enroll it instead of creating another key and compare the full public fingerprint before claiming compatibility.

A new permanent identity cannot update this v1.2.0 installation in place. Do not repeat an uninstall casually. Migration is a separate, explicitly approved operation after a verified backup. After migration to a permanent identity, later higher-version APKs signed with that SAME key can update in place and preserve app-local data.

No permanent certificate has been created or approved by this PR. No live APK manifest or production release has been published.

## Audit and changes

The app uses separate public feeds:

- APK: `https://muhammadusamataj.github.io/melk-studio-ota-/apk/apk-version.json`
- Web ZIP: `https://muhammadusamataj.github.io/melk-studio-ota-/ota/melk-version.json`

The APK URL in the app is correct; the repository path is missing and returns 404. The client additionally had `/\\b404\\b/`, which searched for literal backslashes instead of word boundaries. That bug is fixed and tested: 404 says no full-app release has been published, without falsely claiming the app is current. Other HTTP/network failures remain errors. This change alone does not create a live server file.

The APK client now checks a manifest's stated signing certificate against the installed certificate before downloading. Incompatible updates are blocked with a backup/migration explanation. Downloaded files still undergo native SHA-256, size, package, versionCode and signing checks before Android's visible installer opens. Current signer sets must match exactly; a shared ancestor/history certificate is not treated as proof of a supported rotation or reverse rotation. This client deliberately supports stable identity updates, not an unverified key-rotation shortcut.

Version 1.2.1 / 10201 aligns native, web, npm and cache versions for this candidate. BLE commands, 213 numbered modes, 28 native scenes and settings stores are preserved.

## Owner-only permanent key enrollment

The connected GitHub tool has no Secrets-administration capability. The local `gh auth status` reports an invalid configured token. Therefore this session cannot securely install repository Secrets. The helper refuses to generate a key until owner Secrets access is available; do not send keys, passwords or tokens in chat.

On a trusted owner machine with JDK 21 and GitHub CLI authenticated to this repository with repository Secrets/Variables write access:

1. Keep the private keystore outside the checkout. Prefer an existing recoverable original key if available.
2. To enroll an existing key: `python3 tools/enroll-signing-key.py --keystore /secure/outside/repository/melk-release.p12 --alias YOUR_ALIAS`
3. Only if no original key is recoverable and you accept that a migration will be required: `python3 tools/enroll-signing-key.py --keystore /secure/outside/repository/melk-release.p12 --create`
4. Passwords are entered through hidden prompts, never command-line arguments. The new encrypted PKCS12 uses a 3072-bit RSA key, a 10,000-day certificate, owner-only file permissions and a password of at least 20 characters. Keep the password in a separate password manager. The alias and passwords are sent to `gh secret set` over stdin.
5. The helper configures exactly four repository Secrets: `MELK_KEYSTORE_BASE64`, `MELK_STORE_PASSWORD`, `MELK_KEY_ALIAS`, `MELK_KEY_PASSWORD`. It sets the public repository Variable `MELK_RELEASE_CERT_SHA256` from the actual exported certificate. It never replaces an existing keystore when `--create` is used.
6. Retain at least two encrypted offline backups in controlled locations and verify restoration with `keytool -exportcert`. Do not store the password alongside an unprotected key backup. GitHub Secrets are not a downloadable keystore backup.
7. Return ONLY the public fingerprint for identity approval. Never delete the encrypted key after setup, generate a replacement for a routine release, or rotate the pin casually. On a partial upload failure, retry enrollment with the SAME existing file (without `--create`). Restrict repository workflow/Secrets administration to trusted maintainers.

No key/password is committed, printed or put in artifacts. Signing material exists only in a private temporary runner directory and an ignored 0600 keystore.properties during a prepared build. The workflow always removes them afterwards. It does not grant itself permission to publish anything.

## CI and release staging

`.github/workflows/permanent-updates.yml` has two distinct modes:

- Automatic `validate`: JDK 21/SDK 36; JavaScript/Python tests; native tests/lint; all browser suites; two REAL non-debuggable APK builds with one temporary **CI-ONLY** key. The builds have increasing versionCodes, their real signatures are compared, and the generated manifests use actual APK metadata. A mismatch against the owner's installed test signer must be refused. CI-only APKs/private keys are excluded from artifacts. The evidence explicitly says production identity is not configured.
- Manual `prepare`: requires the four enrolled Secrets and the public pin; verifies the keystore certificate BEFORE building; builds/tests/lints the release; checks actual APK signature/package/version/minSdk/debug flags; and stages an APK plus real metadata. No debug/unsigned fallback is possible. The job has contents:read only and no OTA credential or publication step.

GitHub exposes workflow_dispatch through the default branch once the workflow is approved and present there. Validation runs now on the separate feature branch; owner production preparation will require the reviewed workflow on the default branch (or an explicitly authorized equivalent run). Neither PR #2 nor PR #3 is merged by this task. This updater PR is stacked on the v1.2.0 feature branch so its diff isolates updater work; retarget it to main after that base is merged through normal approval.

For `prepare`, supply the complete installed certificate and current versionCode. An ordinary different-key candidate is refused. `migration_staging=true` is an explicit quarantine path that produces `migrationRequired:true` / `compatibleInPlace:false`, NOT an in-place-update claim. Inspect that report before asking anyone to install.

The reserved public candidate APK URL is:

`https://muhammadusamataj.github.io/melk-studio-ota-/apk/MELK-Studio-1.2.1.apk`

It is NOT live before approval. The staging artifact contains `apk/MELK-Studio-1.2.1.apk` and `apk/apk-version.json`. The manifest includes actual package, versionName, versionCode, file size, SHA-256, certificate SHA-256 and minimum SDK. A real production manifest cannot be finalized until the permanent key is enrolled and a real signed candidate is built. CI-only evidence must never be copied to the live OTA repository.

## One-time migration, only after identity approval

1. Keep the current app installed. Export Settings → Backup to JSON and copy it outside app storage, with a second copy. Check that it contains scenes, colours, favourites, routines, vehicles and controller-verification settings. BLE permissions and Android app permissions must be granted again after a fresh installation.
2. First install the permanent-key candidate in a spare phone or separate Android profile, import that JSON and verify the settings and LED controller. Keep the original JSON intact; do not overwrite the only backup with an empty fresh-install export.
3. Have the owner approve the exact permanent certificate and the incompatible-installation/migration report. Without the original test key, replacement within the SAME Android user requires uninstalling the old package. This erases app-local data and may erase any export stored inside its private directory. Do not proceed until the external backup and restore have been verified and the owner explicitly approves the migration.
4. Install the approved permanently signed APK, import the external backup, reconnect the strip and grant permissions. Record its full certificate as the installed identity for subsequent releases. The package name stays unchanged.
5. Build the next higher version using the SAME enrolled keystore and compare with this permanently signed APK. Only this verified same-key update should be described as an update without uninstalling.

## Publication after separate approval

Before any public write, approve the permanent signer, migration plan and actual candidate report. Confirm the APK's real certificate matches the permanently migrated installation. Review the complete staging artifact and test the Android installer, installer cancellation and settings retention on a phone. Prefer GitHub Environment protections/required reviewers for any future publication automation; do not assume an environment name alone provides protection.

In the OTA repository, use an approved dedicated publication PR containing the exact reviewed APK and its generated `apk/apk-version.json`; upload the APK before exposing the manifest, or deploy both from one atomic Pages commit. Do not invent metadata or point the manifest at an artifact ZIP/login URL. Keep versioned APK filenames immutable. After Pages deployment, GET the public manifest and APK, recheck SHA-256/size/package/certificate and verify a newer build is offered from the in-app APK card. A same-key build should download, verify and invoke Android's installer; the existing installation stays until Android completes the update.

Keeping the live APK manifest missing is intentional until that approval; this PR fixes the implementation and prepares the exact server layout, not the live 404. The current web feed remains unchanged at 1.1.8.

## Independent web OTA

`tools/make-ota.py` can include `--min-native-code`; the updated client validates and checks this against native ApkUpdater.getInfo before offering and again before installing the bundle. Missing native bridge/insufficient build blocks installation. Pure web manifests without a minimum remain supported. Existing SmartAudio capability detection continues to protect older APKs from missing native methods.

Legacy already-installed web clients cannot retroactively enforce a new manifest field. Do not publish a bundle that unconditionally needs a new native method to such clients: keep capability fallbacks or separate a compatible legacy feed/cohort. This candidate's web code retains those fallbacks. Web ZIP and APK feeds remain independent, with separate versions/checksums; a web ZIP never installs native code or repairs a signing mismatch.

## Remaining device checks

Use the permanently signed migration candidate and next same-key release to verify backup restore, true in-place APK replacement, Android unknown-source permission, cancellation/failure recovery and settings retention. Test live Pages URLs only after approved publication. CI does not claim that an unconfigured permanent key or a missing live manifest has already been fixed on the phone.
