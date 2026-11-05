#!/usr/bin/env python3
"""Build an over-the-air update.

Usage:  python3 tools/make-ota.py 1.0.1 https://YOUR-SITE.netlify.app/ota/ [--src www]

It checks that js/ota.js has APP_VERSION = '1.0.1' (so you cannot forget to bump it),
zips the web files, and writes ota-out/melk-version.json plus ota-out/melk-1.0.1.zip.
Upload both files to the /ota/ folder of your site."""
import argparse, hashlib, json, pathlib, re, zipfile

ap = argparse.ArgumentParser()
ap.add_argument("version")
ap.add_argument("base_url")
ap.add_argument("--src", default="www", help="web folder (the one Capacitor uses as webDir)")
ap.add_argument('--min-native-code', type=int, help='minimum native build; older clients cannot retroactively enforce this field')
a = ap.parse_args()
if a.min_native_code is not None and not 1 <= a.min_native_code <= 2147483647: raise SystemExit('Invalid minimum native versionCode')

src = pathlib.Path(a.src)
if not (src / "index.html").exists():
    raise SystemExit(f"index.html not found in {src}")

ota_js = (src / "js" / "ota.js").read_text(encoding="utf-8")
m = re.search(r"APP_VERSION\s*=\s*'([^']+)'", ota_js)
if not m or m.group(1) != a.version:
    raise SystemExit(f"js/ota.js has APP_VERSION={m.group(1) if m else '?'}, expected {a.version}. Bump it first.")

out = pathlib.Path("ota-out")
out.mkdir(exist_ok=True)
zip_path = out / f"melk-{a.version}.zip"
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
    for f in sorted(src.rglob("*")):
        if f.is_file():
            z.write(f, f.relative_to(src).as_posix())   # index.html must sit at the zip root

digest = hashlib.sha256(zip_path.read_bytes()).hexdigest()
base = a.base_url.rstrip("/") + "/"
info = {"version": a.version, "url": base + zip_path.name, "sha256": digest}
if a.min_native_code is not None: info["minNativeVersionCode"] = a.min_native_code
(out / "melk-version.json").write_text(json.dumps(info, indent=2), encoding="utf-8")
print(f"wrote {zip_path} and {out/'melk-version.json'}")
print(json.dumps(info, indent=2))
