#!/usr/bin/env python3
"""Inline css/ and js/ into one self-contained HTML file for client previews.
Usage: python3 tools/build-standalone.py  ->  dist/MELK-Studio-standalone.html
Tags marked data-pwa (manifest, service worker) are left out of the standalone file."""
import re, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
src = root / "www"
html = (src / "index.html").read_text(encoding="utf-8")

html = re.sub(r'<link[^>]*data-pwa[^>]*>\s*', '', html)
html = re.sub(r'<script[^>]*data-pwa[^>]*></script>\s*', '', html)

def css(m):
    return "<style>\n" + (src / m.group(1)).read_text(encoding="utf-8") + "\n</style>"
def js(m):
    return "<script>\n" + (src / m.group(1)).read_text(encoding="utf-8") + "\n</script>"

html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css, html)
html = re.sub(r'<script src="([^"]+)"></script>', js, html)
# The browser preview (only) simulates the app-update card so the screen can be reviewed.
# The real app (www/index.html) never defines this flag.
html = html.replace('<script>', '<script>window.MELK_PREVIEW = true;</script>\n<script>', 1)

out = root / "dist" / "MELK-Studio-standalone.html"
out.write_text(html, encoding="utf-8")
print(f"wrote {out} ({out.stat().st_size/1024:.1f} KB)")
