# MELK Studio v1.1.1 — GitHub OTA cleanup

Replaced remaining Netlify wording in the Studio update panel and bundled Android OTA assets; kept BLE transport, hardware protocol, music, automation, favorites and OTA installer unchanged.

Deploy the separate GitHub Pages ZIP to the repository root, preserving `ota/`. GitHub Pages must be enabled for `main` branch /root. Existing APKs whose active OTA code still points to Netlify will not automatically migrate merely by uploading GitHub files.
