#!/usr/bin/env python3
"""Prepare reviewed public Pages paths from a REAL release APK. Does not upload anything."""
import argparse
import importlib.util
import json
import pathlib
import re
import shutil
import apkinfo

spec=importlib.util.spec_from_file_location('manifest',pathlib.Path(__file__).with_name('make-apk-manifest.py'))
manifest=importlib.util.module_from_spec(spec);spec.loader.exec_module(manifest)
BASE='https://muhammadusamataj.github.io/melk-studio-ota-/apk/'

def assess(info,pin,installed,installed_code):
    if not re.fullmatch('[a-f0-9]{64}',pin): raise ValueError('Invalid approved certificate pin')
    if info.get('verified') is not True: raise ValueError('APK signature was not cryptographically verified')
    if info.get('debuggable') or len(info.get('signers',[]))!=1 or info.get('signerCount')!=1: raise ValueError('Expected one verified release signer and a non-debuggable APK')
    signer=info['signers'][0]
    if signer.get('debug') or signer['sha256']!=pin: raise ValueError('APK does not match the pinned permanent signing identity')
    if info['package']!='com.bleled.com' or info['versionCode']<=installed_code: raise ValueError('Package mismatch or non-increasing versionCode')
    if not isinstance(info.get('minSdk'),int) or info['minSdk']<1: raise ValueError('Minimum SDK must come from actual APK metadata')
    if not re.fullmatch('[a-f0-9]{64}',installed): raise ValueError('A complete installed certificate fingerprint is required')
    return {'installedCertSha256':installed,'candidateCertSha256':pin,'installedVersionCode':installed_code,
        'candidateVersionCode':info['versionCode'],'compatibleInPlace':installed==pin,
        'migrationRequired':installed!=pin,'published':False}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('apk',type=pathlib.Path);p.add_argument('--pin',required=True);p.add_argument('--installed-cert',required=True);p.add_argument('--installed-code',required=True,type=int)
    p.add_argument('--allow-migration-staging',action='store_true');p.add_argument('--out',type=pathlib.Path,default=pathlib.Path('release-stage'));a=p.parse_args()
    info=apkinfo.read_apk(a.apk);report=assess(info,a.pin.lower(),a.installed_cert.lower(),a.installed_code)
    if report['migrationRequired'] and not a.allow_migration_staging: raise SystemExit('Signing mismatch: normal update staging refused. Explicit migration staging is required; this cannot update the installed app in place.')
    name='MELK-Studio-'+info['versionName']+'.apk'
    if not re.fullmatch(r'MELK-Studio-\d+\.\d+\.\d+\.apk',name): raise SystemExit('Use a numeric three-part release version')
    apkdir=a.out/'apk';apkdir.mkdir(parents=True,exist_ok=True);dest=apkdir/name
    if dest.exists() or (apkdir/'apk-version.json').exists(): raise SystemExit('Refusing to overwrite an existing staged release')
    shutil.copyfile(a.apk,dest);info['path']=str(dest)
    m=manifest.build_manifest(info,BASE,'com.bleled.com')
    (apkdir/'apk-version.json').write_text(json.dumps(m,indent=2)+'\n')
    (a.out/'compatibility.json').write_text(json.dumps(report,indent=2)+'\n')
    (a.out/'apk-verification.json').write_text(json.dumps(info,indent=2)+'\n')
    (a.out/'NOT-PUBLISHED.txt').write_text('STAGING ONLY. No public URL is live until explicitly approved publication.\n'+('MIGRATION REQUIRED: do not advertise this as an in-place update for the reported installed certificate.\n' if report['migrationRequired'] else 'Current signer matches the reported installed certificate.\n'))
    print(json.dumps(report,indent=2));print('Reserved public URL (not uploaded): '+m['url'])

if __name__=='__main__': main()
