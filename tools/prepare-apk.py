#!/usr/bin/env python3
"""Copy the latest web files into the Capacitor web folder before `npx cap sync`.

Usage (from the Capacitor project folder that contains capacitor.config.json):
    python3 tools/prepare-apk.py /path/to/melk-studio-source

Reads webDir from capacitor.config.json (dist in your project), replaces its web files
with the source files, and prints the versions that will go into the APK."""
import json, pathlib, re, shutil, sys

project = pathlib.Path.cwd()
src = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else project / 'www'
if not (src / 'index.html').is_file() and (src / 'www' / 'index.html').is_file():
    src = src / 'www'
cfg = json.loads((project / "capacitor.config.json").read_text(encoding="utf-8"))
web = project / cfg["webDir"]

if src.resolve() == web.resolve():
    print(f'Web source already in {web}; no copy needed. Next: npx cap sync android')
    sys.exit(0)
for name in ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons']:
    if not (src / name).exists():
        raise SystemExit(f'Missing source: {src / name}; destination was not changed.')

if web.exists():
    shutil.rmtree(web)
web.mkdir(parents=True)
for name in ["index.html", "manifest.webmanifest", "sw.js"]:
    shutil.copy2(src / name, web / name)
for folder in ["css", "js", "icons"]:
    shutil.copytree(src / folder, web / folder)

ota = (web / "js" / "ota.js").read_text(encoding="utf-8")
ver = re.search(r"APP_VERSION\s*=\s*'([^']+)'", ota)
ble = (web / "js" / "ble-native.js").read_text(encoding="utf-8")
print(f"web folder: {web}")
print(f"  OTA APP_VERSION in APK: {ver.group(1) if ver else '?'}")
print(f"  reconnect fix present: {'_gen' in ble}")
print("Next: npx cap sync android, then Build > Clean, Build > Rebuild, then reinstall the APK.")
