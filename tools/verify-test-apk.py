#!/usr/bin/env python3
"""Read and verify the actual debug APK; never publish a production manifest."""
import json
import pathlib
import shutil
import apkinfo

source = pathlib.Path('android/app/build/outputs/apk/debug/app-debug.apk')
info = apkinfo.read_apk(source)
assert info['verified'] is True, 'APK signature verification failed'
assert info['package'] == 'com.bleled.com', info['package']
assert info['versionName'] == '1.2.0' and info['versionCode'] == 10200, 'Wrong APK version'
assert len(info['signers']) == 1, 'Unexpected signer count'
assert info['minSdk'] == 24, 'Unexpected minimum Android version'
out = pathlib.Path('test-apk-out')
out.mkdir(exist_ok=True)
destination = out / 'MELK-Studio-v1.2.0-test.apk'
shutil.copyfile(source, destination)
info['path'] = destination.name
info['installationCompatibility'] = 'Unknown until full installed certificate is compared. Do not uninstall existing app.'
(out / 'apk-verification.json').write_text(json.dumps(info, indent=2) + '\n')
(out / 'SHA256SUMS').write_text(info['sha256'] + '  ' + destination.name + '\n')
(out / 'INSTALLATION.txt').write_text(
    'TEST BUILD ONLY. Package com.bleled.com, version 1.2.0 (10200).\n'
    'Read apk-verification.json for actual SHA-256 and signing certificate.\n'
    'A CI-generated debug key is not a stable release identity.\n'
    'Export Settings > Backup before testing. Do not uninstall your existing app.\n'
    'Update in place only if the complete installed signing certificate matches.\n'
    'If it differs, use a spare phone or separate Android user/profile, or rebuild with the original signing key.\n'
    'Production signing and migration remain separate in PR #2.\n')
print(json.dumps(info, indent=2))
