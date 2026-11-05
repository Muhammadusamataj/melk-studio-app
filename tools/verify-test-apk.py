#!/usr/bin/env python3
"""Read and verify the actual debug APK; never publish a production manifest."""
import json
import pathlib
import shutil
import zipfile
import apkinfo

source = pathlib.Path('android/app/build/outputs/apk/debug/app-debug.apk')
info = apkinfo.read_apk(source)
print(json.dumps(info, indent=2), flush=True)
signer_tool = apkinfo.find_tool('apksigner')
if signer_tool:
    verify_code, verify_report = apkinfo.run([signer_tool, 'verify', '--verbose', '--print-certs', str(source)])
    print(verify_report, flush=True)
    assert verify_code == 0, 'apksigner verification returned a failure'
assert info['verified'] is True, 'APK signature verification failed'
assert info['package'] == 'com.bleled.com', info['package']
assert info['versionName'] == '1.2.0' and info['versionCode'] == 10200, 'Wrong APK version'
assert len(info['signers']) == 1, 'Unexpected signer count'
assert info['minSdk'] == 24, 'Unexpected minimum Android version'
assert info['debuggable'] is True, 'Expected a test/debug build'
with zipfile.ZipFile(source) as apk:
    dex = b''.join(apk.read(n) for n in apk.namelist() if n.endswith('.dex'))
    for name in [b'SmartAudioPlugin', b'SmartAudioService', b'AudioAnalysis']:
        assert name in dex, 'Missing native audio class: ' + name.decode()
    for name in ['smart-audio', 'smart-scenes', 'smart-music']:
        assert apk.read(f'assets/public/js/{name}.js'), 'Missing web integration'
out = pathlib.Path('test-apk-out')
out.mkdir(exist_ok=True)
destination = out / 'MELK-Studio-v1.2.0-test.apk'
shutil.copyfile(source, destination)
info['path'] = destination.name
signer = info['signers'][0]['sha256']
hint_matches = signer.startswith('06671cef') and signer.endswith('3d5d')
info['installedSignerHint'] = '06671cef…3d5d (user-provided partial fingerprint)'
info['installationCompatibility'] = ('Unverified: partial fingerprint matches, but full certificate comparison is required.' if hint_matches else
    'Incompatible with the reported installed certificate: signer differs. Do not uninstall existing app; use a spare phone/profile or rebuild with the original key.')
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
