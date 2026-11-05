import importlib.util, json, os, pathlib, shutil, subprocess, sys, tempfile, unittest
ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
import apkinfo
def load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'tools' / file); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
compare = load('compare_apk_signing', 'compare-apk-signing.py')
mk = load('make_apk_manifest', 'make-apk-manifest.py')

# Captured from a real `apksigner verify --verbose --print-certs` and `aapt dump badging` run.
APKSIGNER = """Verifies
Verified using v1 scheme (JAR signing): false
Verified using v2 scheme (APK Signature Scheme v2): false
Verified using v3 scheme (APK Signature Scheme v3): true
Verified using v4 scheme (APK Signature Scheme v4): false
Number of signers: 1
Signer #1 certificate DN: CN=Android, OU=Android, O=Google Inc., L=Mountain View, ST=California, C=US
Signer #1 certificate SHA-256 digest: a19d67592d407a459dab0e563ef29859e5cd34e178548c285fa1a00cd47c3ae8
Signer #1 certificate SHA-1 digest: 5ada290551c4a731a88f060542235a4aa651d4bd
"""
BADGING = "package: name='wl.smartled.rgb' versionCode='148' versionName='6.11.10' platformBuildVersionName='17' compileSdkVersion='37'\nsdkVersion:'32'\ntargetSdkVersion:'37'\n"
A, B, C = 'a' * 64, 'b' * 64, 'c' * 64
def apk(pkg='com.bleled.com', code=10106, key=A, verified=True, signers=None, path='x.apk'):
    return {'path': path, 'package': pkg, 'versionCode': code, 'versionName': '1.1.x', 'minSdk': 24, 'verified': verified, 'size': 1000, 'sha256': 'f' * 64,
            'signers': [{'sha256': key, 'dn': '', 'debug': False}] if signers is None else signers, 'schemes': {2: True}, 'debuggable': False, 'source': {}}

class Parsers(unittest.TestCase):
    def test_apksigner(self):
        r = apkinfo.parse_apksigner(APKSIGNER)
        self.assertTrue(r['verified']); self.assertEqual(r['schemes'], {1: False, 2: False, 3: True, 4: False})
        self.assertEqual(len(r['signers']), 1); self.assertEqual(r['signers'][0]['sha256'], 'a19d67592d407a459dab0e563ef29859e5cd34e178548c285fa1a00cd47c3ae8'); self.assertFalse(r['signers'][0]['debug'])
    def test_debug_key_is_recognised(self):
        r = apkinfo.parse_apksigner(APKSIGNER.replace('CN=Android, OU=Android, O=Google Inc., L=Mountain View, ST=California, C=US', 'CN=Android Debug, O=Android, C=US'))
        self.assertTrue(r['signers'][0]['debug'])
    def test_a_failed_verification_is_not_trusted(self):
        r = apkinfo.parse_apksigner('DOES NOT VERIFY\nERROR: JAR_SIG_NO_SIGNATURES: No JAR signatures\n')
        self.assertFalse(r['verified']); self.assertEqual(r['signers'], [])
    def test_badging(self):
        b = apkinfo.parse_badging(BADGING + 'application-debuggable\n')
        self.assertEqual((b['package'], b['versionCode'], b['versionName'], b['minSdk'], b['debuggable']), ('wl.smartled.rgb', 148, '6.11.10', 32, True))
        self.assertIsNone(apkinfo.parse_badging('garbage'))
    def test_current_aapt2_minimum_sdk_label(self):
        self.assertEqual(apkinfo.parse_badging(BADGING.replace("sdkVersion:'32'", "minSdkVersion:'32'"))['minSdk'], 32)
    def test_repeated_certificate_and_uppercase_digest(self):
        line = 'Signer #1 certificate SHA-256 digest: ' + A.upper() + '\n'
        parsed = apkinfo.parse_apksigner('Verifies\n' + line + line)
        self.assertEqual([s['sha256'] for s in parsed['signers']], [A])
        different = apkinfo.parse_apksigner('Verifies\n' + line + 'Signer #2 certificate SHA-256 digest: ' + B + '\n')
        self.assertEqual(len(different['signers']), 2)
    def test_current_apksigner_scheme_label(self):
        output = APKSIGNER.replace('Signer #1 certificate', 'V2 Signer: certificate')
        parsed = apkinfo.parse_apksigner(output)
        self.assertEqual(parsed['signers'], apkinfo.parse_apksigner(APKSIGNER)['signers'])
        self.assertEqual(parsed['signerCount'], 1)

class Compatibility(unittest.TestCase):
    def test_an_upgrade_signed_with_the_same_key_is_compatible(self):
        ok, why, f = compare.decide(apk(code=10106), apk(code=10107)); self.assertTrue(ok, why); self.assertTrue(f['sameKey'])
    def test_a_different_key_is_blocked(self):
        ok, why, f = compare.decide(apk(key=A), apk(code=10107, key=B)); self.assertFalse(ok); self.assertFalse(f['sameKey']); self.assertTrue(any('DIFFERENT SIGNING KEY' in w for w in why))
    def test_package_downgrade_same_build_and_unsigned_are_blocked(self):
        self.assertFalse(compare.decide(apk(), apk(pkg='com.other', code=10107))[0])
        self.assertTrue(any('LOWER' in w for w in compare.decide(apk(code=10106), apk(code=10100))[1]))
        self.assertTrue(any('SAME build' in w for w in compare.decide(apk(code=10106), apk(code=10106))[1]))
        self.assertTrue(any('not signed' in w for w in compare.decide(apk(), apk(code=10107, signers=[]))[1]))
    def test_a_signature_that_does_not_verify_is_blocked(self):
        self.assertFalse(compare.decide(apk(), apk(code=10107, verified=False))[0])
    def test_overlapping_signers_are_not_proof_of_compatibility(self):
        old = apk(signers=[{'sha256': A, 'dn': '', 'debug': False}, {'sha256': B, 'dn': '', 'debug': False}])
        self.assertFalse(compare.decide(old, apk(code=10107, key=B))[0])

class Manifest(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp(); self.f = os.path.join(self.d, 'MELK-Studio-1.1.8.apk'); pathlib.Path(self.f).write_bytes(os.urandom(5000))
    def tearDown(self): shutil.rmtree(self.d, ignore_errors=True)
    def info(self, **o):
        i = apk(code=10108, path=self.f); i.update(size=os.path.getsize(self.f), sha256=apkinfo.file_sha256(self.f), versionName='1.1.8'); i.update(o); return i
    BASE = 'https://muhammadusamataj.github.io/melk-studio-ota-/apk/'
    def test_values_come_from_the_file(self):
        m = mk.build_manifest(self.info(), self.BASE, 'com.bleled.com', 'Notes')
        self.assertEqual((m['schema'], m['packageName'], m['versionCode'], m['versionName'], m['size']), (1, 'com.bleled.com', 10108, '1.1.8', 5000))
        self.assertEqual(m['sha256'], apkinfo.file_sha256(self.f)); self.assertEqual(m['signingCertSha256'], A)
        self.assertEqual(m['url'], self.BASE + 'MELK-Studio-1.1.8.apk'); self.assertNotIn('0' * 64, json.dumps(m))
    def test_refusals(self):
        for kw, base in [({'package': 'com.other'}, self.BASE), ({'signers': []}, self.BASE), ({}, 'http://x.example/apk/'), ({}, 'https://x.example/apk')]:
            with self.assertRaises(SystemExit): mk.build_manifest(self.info(**kw), base, 'com.bleled.com')
        with self.assertRaises(SystemExit): mk.build_manifest(self.info(path=os.path.join(self.d, 'bad name.apk')), self.BASE, 'com.bleled.com')
    @unittest.skipUnless(shutil.which('node'), 'node not installed')
    def test_the_app_accepts_what_the_tool_writes(self):
        m = mk.build_manifest(self.info(), self.BASE, 'com.bleled.com', 'x')
        js = ("const fs=require('fs'),vm=require('vm');const c=vm.createContext({URL,console});c.window=c;vm.runInContext(fs.readFileSync('www/js/apk-updater.js','utf8'),c);"
              "const r=c.MelkApk.validateManifest(JSON.parse(process.argv[1]),{packageName:'com.bleled.com',manifestUrl:c.MelkApk.MANIFEST_URL});console.log(JSON.stringify({ok:r.ok,errors:r.errors}));")
        out = json.loads(subprocess.run(['node', '-e', js, json.dumps(m)], cwd=ROOT, capture_output=True, text=True).stdout)
        self.assertTrue(out['ok'], out['errors'])
if __name__ == '__main__':
    unittest.main()
