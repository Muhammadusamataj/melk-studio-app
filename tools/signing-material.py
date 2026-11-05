#!/usr/bin/env python3
"""Materialize configured signing secrets for one build. Never emits secret values."""
import argparse
import base64
import hashlib
import os
import pathlib
import re
import subprocess
import sys

NAMES = ['MELK_KEYSTORE_BASE64', 'MELK_STORE_PASSWORD', 'MELK_KEY_ALIAS', 'MELK_KEY_PASSWORD']

def property_value(value):
    out = ''
    for c in value:
        if c in '\\:=#! ': out += '\\' + c
        elif c == '\n': out += '\\n'
        elif c == '\r': out += '\\r'
        elif c == '\t': out += '\\t'
        elif ord(c) > 126 or ord(c) < 32:
            out += ''.join('\\u%04x' % int.from_bytes(c.encode('utf-16-be')[i:i+2], 'big') for i in range(0,len(c.encode('utf-16-be')),2))
        else: out += c
    return out

def materialize(directory, properties, env):
    if any(not env.get(n) for n in NAMES): raise SystemExit('Signing secrets are missing; no release can be produced.')
    pin = env.get('MELK_RELEASE_CERT_SHA256', '').lower()
    if not re.fullmatch('[a-f0-9]{64}', pin): raise SystemExit('Configure the approved public certificate pin first.')
    if properties.exists(): raise SystemExit('Refusing to overwrite an existing keystore.properties.')
    directory.mkdir(mode=0o700, parents=True, exist_ok=False)
    store = directory / 'release.p12'
    try:
        data = base64.b64decode(env['MELK_KEYSTORE_BASE64'], validate=True)
        if not 32 < len(data) <= 2*1024*1024: raise ValueError('size')
        with store.open('xb') as f: os.chmod(store, 0o600); f.write(data)
        result = subprocess.run(['keytool','-exportcert','-keystore',str(store),'-alias',env['MELK_KEY_ALIAS'],
            '-storepass:env','MELK_STORE_PASSWORD'], env=env, capture_output=True)
        if result.returncode or not result.stdout: raise ValueError('keytool')
        certificate = hashlib.sha256(result.stdout).hexdigest()
        if certificate != pin: raise SystemExit('Configured keystore does not match the approved certificate pin.')
        entries = {'storeFile':str(store.resolve()), 'storePassword':env['MELK_STORE_PASSWORD'],
            'keyAlias':env['MELK_KEY_ALIAS'], 'keyPassword':env['MELK_KEY_PASSWORD']}
        with properties.open('x', encoding='ascii') as f:
            os.chmod(properties, 0o600)
            f.write(''.join(k+'='+property_value(v)+'\n' for k,v in entries.items()))
        print('Signing material checked against the public certificate pin.')
    except (ValueError, OSError):
        raise SystemExit('Signing material could not be verified. Secret values are not displayed.')
    finally:
        if not properties.exists(): store.unlink(missing_ok=True); directory.rmdir()

if __name__ == '__main__':
    p=argparse.ArgumentParser(); p.add_argument('--directory',required=True,type=pathlib.Path); p.add_argument('--properties',default='android/keystore.properties',type=pathlib.Path)
    a=p.parse_args(); materialize(a.directory,a.properties,dict(os.environ))
