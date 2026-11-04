#!/usr/bin/env python3
"""Reads what matters when judging an APK update: package, build number, minimum Android, and the PUBLIC SHA-256
fingerprints of the signing certificate(s). It never opens a keystore and never needs or prints a password.

Tools used, in this order: aapt/aapt2 (package facts) then apksigner (signature check and certificates), both from PATH or the
Android SDK build-tools folder. If a tool is missing, androguard (pip install androguard) is used instead, and the result is
labelled "not cryptographically verified"."""
import hashlib, os, pathlib, re, shutil, subprocess

def find_tool(name):
    exts = ['', '.bat', '.exe'] if os.name == 'nt' else ['']
    for e in exts:
        p = shutil.which(name + e)
        if p: return p
    roots = [os.environ.get('ANDROID_HOME'), os.environ.get('ANDROID_SDK_ROOT'), os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Android', 'Sdk') if os.environ.get('LOCALAPPDATA') else None,
             os.path.expanduser('~/Android/Sdk'), os.path.expanduser('~/Library/Android/sdk')]
    for r in filter(None, roots):
        bt = pathlib.Path(r) / 'build-tools'
        if bt.is_dir():
            for v in sorted(bt.iterdir(), reverse=True):
                for e in exts:
                    c = v / (name + e)
                    if c.exists(): return str(c)
    return None

def run(cmd):
    shell = os.name == 'nt' and cmd[0].lower().endswith('.bat')
    r = subprocess.run(cmd, capture_output=True, text=True, shell=shell)
    return r.returncode, (r.stdout or '') + (r.stderr or '')

# ---------- parsers (kept separate so they can be unit tested with captured output) ----------
def parse_badging(text):
    m = re.search(r"package: name='([^']*)' versionCode='(\d+)' versionName='([^']*)'", text)
    if not m: return None
    sdk = re.search(r"^sdkVersion:'(\d+)'", text, re.M)
    return {'package': m.group(1), 'versionCode': int(m.group(2)), 'versionName': m.group(3), 'minSdk': int(sdk.group(1)) if sdk else None,
            'debuggable': bool(re.search(r'^application-debuggable', text, re.M))}

def parse_apksigner(text):
    schemes = {int(n): v == 'true' for n, v in re.findall(r'Verified using v(\d) scheme[^:]*: (true|false)', text)}
    verified = text.lstrip().startswith('Verifies') and 'DOES NOT VERIFY' not in text
    dns = {int(n): d.strip() for n, d in re.findall(r'Signer #(\d+) certificate DN: (.*)', text)}
    signers = [{'sha256': h, 'dn': dns.get(int(n), ''), 'debug': 'CN=Android Debug' in dns.get(int(n), '')} for n, h in re.findall(r'Signer #(\d+) certificate SHA-256 digest: ([0-9a-f]{64})', text)]
    return {'verified': verified, 'schemes': schemes, 'signers': signers}

def file_sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''): h.update(chunk)
    return h.hexdigest()

# ---------- reader ----------
def read_apk(path):
    path = str(path)
    info = {'path': path, 'size': os.path.getsize(path), 'sha256': file_sha256(path), 'package': None, 'versionCode': None, 'versionName': None, 'minSdk': None,
            'debuggable': False, 'verified': None, 'schemes': {}, 'signers': [], 'source': {}}
    aapt = find_tool('aapt2') or find_tool('aapt')
    if aapt:
        code, out = run([aapt, 'dump', 'badging', path])
        b = parse_badging(out) if code == 0 else None
        if b: info.update(b); info['source']['package'] = os.path.basename(aapt)
    signer = find_tool('apksigner')
    if signer:
        code, out = run([signer, 'verify', '--verbose', '--print-certs', path])
        s = parse_apksigner(out)
        info.update(s); info['source']['signing'] = 'apksigner'
    if info['package'] is None or not info['signers']:
        try:
            from loguru import logger; logger.remove()
        except Exception: pass
        try:
            from androguard.core.apk import APK
            a = APK(path)
            if info['package'] is None:
                info.update({'package': a.get_package(), 'versionCode': int(a.get_androidversion_code()), 'versionName': a.get_androidversion_name(),
                             'minSdk': int(a.get_min_sdk_version()) if a.get_min_sdk_version() else None}); info['source']['package'] = 'androguard'
            if not info['signers']:
                info['signers'] = [{'sha256': hashlib.sha256(c.dump()).hexdigest(), 'dn': '', 'debug': False} for c in a.get_certificates()]
                info['schemes'] = {1: a.is_signed_v1(), 2: a.is_signed_v2(), 3: a.is_signed_v3()}; info['verified'] = None; info['source']['signing'] = 'androguard (not cryptographically verified)'
        except ImportError:
            pass
    if info['package'] is None:
        raise SystemExit('Could not read the APK. Install the Android SDK build-tools (aapt, apksigner) or: pip install androguard')
    return info

def short(h): return (h[:8] + '…' + h[-4:]) if h else 'none'
