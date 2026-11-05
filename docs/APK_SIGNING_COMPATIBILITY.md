# APK signing compatibility

Current guidance and the owner-confirmed v1.2.0 certificate are in [Permanent updates](PERMANENT_UPDATES.md). That guide supersedes the earlier debug-signing instructions.

Android update compatibility depends on the package and signing identity, not the Debug/Release label alone. This app requires identical CURRENT signer sets and a higher versionCode; it does not infer compatibility from overlapping historical certificates. Android makes the final installation decision.

The installed v1.2.0 test key was not retained by the disposable build runner. The public certificate cannot recover its private key. Do not uninstall the app now: keep an external settings backup and verify restore before any separately approved one-time migration to a permanent identity.

Future releases must use the SAME encrypted keystore, enrolled once into the protected main-only release-signing GitHub Environment with required reviewers, backed up offline and pinned by its public SHA-256. Release staging fails without signing material or on a pin mismatch. Private keys/passwords never belong in the repository, logs, chat or artifacts.

Use `python3 tools/compare-apk-signing.py installed.apk candidate.apk` to compare ACTUAL signed APKs. Both signatures must be cryptographically verified. A compatible result cannot be manufactured by editing version JSON or certificate metadata.

No production signing identity has been provisioned by this session because Secrets administration/authentication is unavailable. See the owner enrollment and publication procedure in the linked guide.
