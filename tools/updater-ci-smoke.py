#!/usr/bin/env python3
"""CI-only integration proof. Throwaway key is NEVER enrolled or used for production."""
import importlib.util
import hashlib
import json
import os
import pathlib
import secrets
import shutil
import subprocess
import tempfile

ROOT=pathlib.Path(__file__).resolve().parents[1]
INSTALLED='95cfeb6e1c3d69a42eda77e468480f129f611d393d51eb191af881c9f7291081'

def load(name):
    spec=importlib.util.spec_from_file_location(name,ROOT/'tools'/f'{name}.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

def run(command,env): subprocess.run(command,cwd=ROOT,env=env,check=True)

def main():
    material=load('signing-material')
    props=ROOT/'android/keystore.properties'
    if props.exists(): raise SystemExit('Refusing to use any pre-existing signing material for a smoke test')
    out=ROOT/'updater-ci-evidence';out.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='melk-ci-only-') as temp:
        private=pathlib.Path(temp);key=private/'ci-only.p12'
        env=dict(os.environ,MELK_STORE_PASSWORD=secrets.token_hex(32),MELK_KEY_PASSWORD='')
        env['MELK_KEY_PASSWORD']=env['MELK_STORE_PASSWORD'];env['MELK_KEY_ALIAS']='ci-only'
        try:
            subprocess.run(['keytool','-genkeypair','-keystore',str(key),'-storetype','PKCS12','-alias','ci-only','-keyalg','RSA','-keysize','3072','-validity','2',
                '-dname','CN=MELK CI ONLY DO NOT RELEASE','-storepass:env','MELK_STORE_PASSWORD','-keypass:env','MELK_KEY_PASSWORD'],env=env,check=True,capture_output=True)
            cert=subprocess.run(['keytool','-exportcert','-keystore',str(key),'-alias','ci-only','-storepass:env','MELK_STORE_PASSWORD'],env=env,check=True,capture_output=True).stdout
            import base64
            pin=hashlib.sha256(cert).hexdigest();env['MELK_RELEASE_CERT_SHA256']=pin;env['MELK_KEYSTORE_BASE64']=base64.b64encode(key.read_bytes()).decode()
            material.materialize(private/'build-key',props,env)
            run(['bash','android/gradlew','-p','android',':app:assembleRelease',':app:lintRelease',':app:testDebugUnitTest',':host-tests:test','--no-daemon'],env)
            first=private/'first.apk';shutil.copyfile(ROOT/'android/app/build/outputs/apk/release/app-release.apk',first)
            newer=dict(env,MELK_VERSION_NAME='1.2.2',MELK_VERSION_CODE='10202')
            run(['bash','android/gradlew','-p','android',':app:assembleRelease','--no-daemon'],newer)
            second=ROOT/'android/app/build/outputs/apk/release/app-release.apk'
            run(['python3','tools/compare-apk-signing.py',str(first),str(second),'--json'],env)
            run(['python3','tools/stage-apk-release.py',str(second),'--pin',pin,'--installed-cert',pin,'--installed-code','10201','--out',str(out/'same-key')],env)
            # A new key must NOT be described as an update for the user's installed test identity.
            denied=subprocess.run(['python3','tools/stage-apk-release.py',str(second),'--pin',pin,'--installed-cert',INSTALLED,'--installed-code','10200','--out',str(out/'must-not-exist')],env=env,capture_output=True)
            assert denied.returncode and not (out/'must-not-exist').exists(),'Different-key update was not blocked'
            run(['python3','tools/stage-apk-release.py',str(second),'--pin',pin,'--installed-cert',INSTALLED,'--installed-code','10200','--allow-migration-staging','--out',str(out/'migration-only')],env)
            # No CI-only APK is offered for installation, and no private key enters an artifact.
            for apk in out.rglob('*.apk'): apk.unlink()
            summary={'ciOnly':True,'productionIdentityConfigured':False,'sameKeyUpdateVerified':True,'mismatchedUserIdentityBlocked':True,'privateKeyRetained':False}
            (out/'CI-ONLY.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary))
        finally:
            props.unlink(missing_ok=True)
            for apk in out.rglob('*.apk'): apk.unlink()

if __name__=='__main__':main()
