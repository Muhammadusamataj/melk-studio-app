#!/usr/bin/env python3
"""Can CANDIDATE.apk update INSTALLED.apk? Compares package name, build number and signing certificate.

    python3 tools/compare-apk-signing.py MELK-Studio-v1.1.4-debug.apk app-debug.apk

Prints only PUBLIC data (package, build numbers, certificate fingerprints). It never reads a keystore, never asks for a
password and never prints one. Exit code: 0 compatible, 1 not compatible, 2 could not read the files."""
import argparse, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import apkinfo

def decide(old, new):
    """Returns (ok, reasons[], facts{}) from two read_apk() results. Mirrors ApkRules.java."""
    reasons = []
    if old['package'] != new['package']: reasons.append(f"different package ({old['package']} vs {new['package']})")
    if new['versionCode'] is not None and old['versionCode'] is not None:
        if new['versionCode'] < old['versionCode']: reasons.append(f"candidate build {new['versionCode']} is LOWER than installed {old['versionCode']} (downgrade)")
        elif new['versionCode'] == old['versionCode']: reasons.append(f"candidate has the SAME build number ({new['versionCode']}); Android needs a higher one")
    oc, nc = {s['sha256'] for s in old['signers']}, {s['sha256'] for s in new['signers']}
    if not nc: reasons.append('candidate is not signed')
    elif not oc: reasons.append('installed APK has no readable signature')
    elif oc != nc: reasons.append('DIFFERENT SIGNING KEY: this client requires identical current signing certificates')
    if new.get('verified') is not True: reasons.append('candidate signature is not cryptographically verified (apksigner)')
    if old.get('verified') is not True: reasons.append('installed APK signature is not cryptographically verified (apksigner)')
    return not reasons, reasons, {'sameKey': bool(oc) and oc == nc, 'oldCerts': sorted(oc), 'newCerts': sorted(nc)}

def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0]); ap.add_argument('installed'); ap.add_argument('candidate'); ap.add_argument('--json', action='store_true')
    a = ap.parse_args(argv)
    try:
        old, new = apkinfo.read_apk(a.installed), apkinfo.read_apk(a.candidate)
    except SystemExit as e:
        print(e); return 2
    ok, reasons, facts = decide(old, new)
    if a.json:
        print(json.dumps({'compatible': ok, 'reasons': reasons, **facts}, indent=2)); return 0 if ok else 1
    def line(label, text): print(f'  {label:<15} {text}')
    for tag, i in (('INSTALLED', old), ('CANDIDATE', new)):
        print(f"{tag}: {os.path.basename(i['path'])}")
        line('package', f"{i['package']}  build {i['versionCode']} ({i['versionName']})  minSdk {i['minSdk']}")
        schemes = ', '.join(f'v{k}' for k, v in sorted(i['schemes'].items()) if v) or 'none'
        line('signature', f"schemes {schemes}; verified: {({True: 'yes', False: 'NO', None: 'not checked'})[i['verified']]}")
        for s in i['signers']: line('signing key', f"{s['sha256']}{'  (Android DEBUG key)' if s['debug'] else ''}")
        print()
    print('CHECKS')
    line('package', 'same' if old['package'] == new['package'] else 'DIFFERENT')
    line('build number', f"{old['versionCode']} -> {new['versionCode']}")
    line('signing key', f"SAME KEY ({apkinfo.short(sorted(facts['newCerts'])[0])})" if facts['sameKey'] else 'DIFFERENT KEY')
    print('\nRESULT:', 'COMPATIBLE. The candidate can update the installed app.' if ok else 'NOT COMPATIBLE:')
    for r in reasons: print('  -', r)
    return 0 if ok else 1

if __name__ == '__main__':
    sys.exit(main())
