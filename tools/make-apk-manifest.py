#!/usr/bin/env python3
"""Writes apk/apk-version.json for a REAL, signed APK. Every value (size, SHA-256, package, build number, signing certificate) is
read from the file itself, so nothing can be a placeholder. The ZIP-update manifest (ota/melk-version.json) is not touched.

    python3 tools/make-apk-manifest.py MELK-Studio-1.1.8.apk \\
        --base-url https://muhammadusamataj.github.io/melk-studio-ota-/apk/ \\
        --installed-apk MELK-Studio-v1.1.4-debug.apk --notes "What changed"

With --installed-apk the signing key and build number are compared first, and the manifest is NOT written if the update would be refused.
It only writes a file. It does not upload or publish anything."""
import argparse, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import apkinfo
import importlib.util
_spec = importlib.util.spec_from_file_location('compare_apk_signing', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'compare-apk-signing.py'))
compare = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(compare)

def build_manifest(info, base_url, package, notes=''):
    if info['package'] != package: raise SystemExit(f"This APK is {info['package']}, expected {package}.")
    if not re.fullmatch(r'[A-Za-z0-9._-]+\.apk', os.path.basename(info['path'])): raise SystemExit('Use a simple file name such as MELK-Studio-1.1.8.apk (letters, digits, dot, dash, underscore).')
    if info['size'] > 250 * 1024 * 1024: raise SystemExit('The APK is larger than the 250 MB the app accepts.')
    if not re.fullmatch(r'https://[^/\s]+/\S*/', base_url): raise SystemExit('--base-url must be https and end with a slash.')
    if not info['signers']: raise SystemExit('The APK is not signed.')
    m = {'schema': 1, 'packageName': info['package'], 'versionName': info['versionName'], 'versionCode': info['versionCode'], 'url': base_url + os.path.basename(info['path']),
         'sha256': info['sha256'], 'size': info['size'], 'signingCertSha256': info['signers'][0]['sha256']}
    if info['minSdk']: m['minSdk'] = info['minSdk']
    if notes: m['notes'] = notes[:400]
    return m

def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0]); ap.add_argument('apk'); ap.add_argument('--base-url', required=True)
    ap.add_argument('--package', default='com.bleled.com'); ap.add_argument('--installed-apk'); ap.add_argument('--notes', default=''); ap.add_argument('--out', default='apk-version.json')
    ap.add_argument('--allow-unverified', action='store_true', help='accept a signature that apksigner could not verify (not recommended)')
    a = ap.parse_args(argv)
    info = apkinfo.read_apk(a.apk)
    if info['verified'] is not True and not a.allow_unverified: raise SystemExit('The APK signature could not be verified with apksigner. Install the Android build-tools, or pass --allow-unverified.')
    if len(info['signers']) != 1: raise SystemExit(f"Expected exactly one signing certificate, found {len(info['signers'])}.")
    if a.installed_apk:
        ok, reasons, _ = compare.decide(apkinfo.read_apk(a.installed_apk), info)
        if not ok: raise SystemExit('Not written. The installed app would refuse this update:\n  - ' + '\n  - '.join(reasons))
        print('Signing and build number compared with the installed APK: compatible.')
    else:
        print('WARNING: --installed-apk not given, so signing compatibility was NOT checked.')
    m = build_manifest(info, a.base_url, a.package, a.notes)
    with open(a.out, 'w', encoding='utf-8') as f: json.dump(m, f, indent=2); f.write('\n')
    print(f'Wrote {a.out}: v{m["versionName"]} build {m["versionCode"]}, {m["size"]} bytes, sha256 {m["sha256"][:12]}…')
    print('Upload the APK first, the manifest last. Nothing was published by this tool.')

if __name__ == '__main__':
    main()
