#!/usr/bin/env python3
"""Owner-run enrollment. Keeps an encrypted keystore outside Git; sends secrets through gh stdin."""
import argparse
import base64
import getpass
import hashlib
import os
import pathlib
import subprocess
import sys

REPO='Muhammadusamataj/melk-studio-app'

def quiet(command, data=None, env=None):
    r=subprocess.run(command,input=data,env=env,capture_output=True)
    if r.returncode: raise SystemExit('Owner authentication, key access or secret upload failed. No secret values are displayed. Keep any existing keystore and retry with the SAME file.')
    return r.stdout

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--keystore',required=True,type=pathlib.Path);p.add_argument('--create',action='store_true');p.add_argument('--alias',default='melk-release');a=p.parse_args()
    if not sys.stdin.isatty(): raise SystemExit('Run enrollment in a trusted interactive terminal so password entry cannot fall back to echoed input.')
    store=a.keystore.expanduser().absolute()
    root=pathlib.Path(__file__).resolve().parents[1]
    if store.is_symlink() or root in store.resolve().parents: raise SystemExit('Keep the private keystore outside this repository; symlinks are refused.')
    if a.create and store.exists(): raise SystemExit('Refusing to replace an existing permanent identity. Use the existing key.')
    if not a.create and not store.is_file(): raise SystemExit('Existing keystore is missing. Never create a replacement casually.')
    # Probe authorization BEFORE generating a permanent key. No interactive token login or credential printing.
    quiet(['gh','api',f'repos/{REPO}/actions/secrets/public-key'])
    password=getpass.getpass('Keystore password (keep in your password manager): ')
    if a.create and (len(password)<20 or password!=getpass.getpass('Confirm password: ')): raise SystemExit('Use matching passwords of at least 20 characters.')
    key_password=password if a.create else getpass.getpass('Private-key password: ')
    env=dict(os.environ,MELK_STORE_PASSWORD=password,MELK_KEY_PASSWORD=key_password)
    if a.create:
        store.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
        quiet(['keytool','-genkeypair','-storetype','PKCS12','-keystore',str(store),'-alias',a.alias,'-keyalg','RSA','-keysize','3072','-validity','10000',
            '-dname','CN=MELK Studio Release,O=MELK Studio','-storepass:env','MELK_STORE_PASSWORD','-keypass:env','MELK_KEY_PASSWORD'],env=env)
    os.chmod(store,0o600)
    cert=quiet(['keytool','-exportcert','-keystore',str(store),'-alias',a.alias,'-storepass:env','MELK_STORE_PASSWORD'],env=env)
    pin=hashlib.sha256(cert).hexdigest()
    values={'MELK_KEYSTORE_BASE64':base64.b64encode(store.read_bytes()),'MELK_STORE_PASSWORD':password.encode(),
        'MELK_KEY_ALIAS':a.alias.encode(),'MELK_KEY_PASSWORD':key_password.encode()}
    for name,value in values.items(): quiet(['gh','secret','set',name,'--repo',REPO],data=value)
    quiet(['gh','variable','set','MELK_RELEASE_CERT_SHA256','--repo',REPO],data=pin.encode())
    print('Enrollment complete. Public certificate SHA-256: '+pin)
    print('Retain an encrypted offline backup of the keystore and keep its password in a separate password manager.')
    print('This sets up signing only. No APK or live manifest was published. Obtain identity/migration approval before distribution.')

if __name__=='__main__': main()
