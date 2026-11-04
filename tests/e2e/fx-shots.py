#!/usr/bin/env python3
"""Screenshots of the Effects tab (built-in view) at 320, 390 and 768 px. Run on any version of the project:
    python3 tests/e2e/fx-shots.py --root DIR --out OUTDIR [--states]
--states also captures the new browser in its different states (only meaningful on the redesigned version)."""
import argparse, asyncio, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from apk_mock import APK_MOCK
from playwright.async_api import async_playwright
ap = argparse.ArgumentParser(); ap.add_argument('--root', required=True); ap.add_argument('--out', required=True); ap.add_argument('--states', action='store_true'); a = ap.parse_args()
URL = (pathlib.Path(a.root) / 'www' / 'index.html').as_uri(); OUT = pathlib.Path(a.out); OUT.mkdir(parents=True, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w, h in [(320, 700), (390, 800), (768, 1000)]:
            ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1.5); pg = await ctx.new_page()
            await pg.add_init_script(APK_MOCK); await pg.goto(URL); await pg.wait_for_timeout(400)
            await pg.click('#btnConn'); await pg.wait_for_timeout(2900)           # let the toast go
            await pg.click('#t-fx'); await pg.wait_for_timeout(300)
            await pg.add_style_tag(content='.tabs{display:none!important}')      # the fixed bottom bar would sit in the middle of a full-page capture
            await pg.screenshot(path=str(OUT / f'effects-{w}.png'), full_page=True)
            if a.states and w == 390:
                async def shot(n): await pg.wait_for_timeout(250); await pg.screenshot(path=str(OUT / f'effects-{w}-{n}.png'), full_page=True)
                await pg.click('#fxCats [data-cat=scenes]'); await shot('scenes')
                await pg.click('#fxCats [data-cat=Flow]'); await pg.click('#fxList [role=option] >> nth=2'); await shot('selected')
                await pg.fill('#fxSearch', 'blue'); await shot('search')
                await pg.fill('#fxSearch', 'zzzz'); await shot('empty')
            await ctx.close()
        await b.close()
asyncio.run(main())
