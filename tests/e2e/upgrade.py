#!/usr/bin/env python3
"""Upgrade test: open this build with the saved data of a REAL v1.1.5 install (tests/fixtures/state-1.1.5.json,
captured by running the published melk-1.1.5.zip) and check nothing the user set is lost or overwritten.
Run from the project root:  python3 tests/e2e/upgrade.py"""
import asyncio, json, pathlib, sys
import os
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parents[2]
URL = (ROOT / 'www' / 'index.html').as_uri()
OLD = json.loads((ROOT / 'tests' / 'fixtures' / 'state-1.1.5.json').read_text())
MOCK = (ROOT / 'tests' / 'e2e' / 'lifecycle.py').read_text().split('MOCK = """')[1].split('"""')[0]
results = []
def check(name, ok, detail=''):
    results.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + name + (' | ' + str(detail)[:300] if detail and not ok else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel=os.environ.get('MELK_BROWSER_CHANNEL')); ctx = await b.new_context(viewport={'width': 390, 'height': 844}); pg = await ctx.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
        await pg.add_init_script(MOCK); await pg.add_init_script("localStorage.setItem('melk.studio.v1', %s)" % json.dumps(json.dumps(OLD)))
        await pg.goto(URL); await pg.wait_for_timeout(500)
        check('the app starts on 1.1.5 data without errors', not errs, errs)
        check('the old Studio tab opens as Settings', await pg.get_attribute('#t-settings', 'aria-selected') == 'true' and await pg.is_visible('#tab-settings'))
        await pg.click('#t-color'); await pg.click('#btnConn'); await pg.wait_for_timeout(800)
        w = await pg.evaluate('window.__w')
        check('a hardware scene left running by 1.1.5 is NOT overwritten on connect', w == [], w)
        await pg.click('#t-settings'); await pg.click('#tab-settings [data-open=connection]'); await pg.wait_for_timeout(150)
        check('Connection page still reports the running hardware scene', 'Hardware scene 11 (Rainbow)' in await pg.inner_text('#ctrlInfo'))
        await pg.click('#page-connection [data-back]')
        await pg.click('#tab-settings [data-open=scenes]'); await pg.wait_for_timeout(150)
        names = await pg.eval_on_selector_all('#sceneList .srName b', 'e=>e.map(x=>x.textContent)')
        check('the scene saved in 1.1.5 is still there', 'Upgrade scene' in names, names)
        await pg.click('#page-scenes [data-back]')
        await pg.click('#tab-settings [data-open=automation]'); await pg.wait_for_timeout(150)
        check('the daily routine, fade time and switch are kept', '21:30' in await pg.inner_text('#routineList') and await pg.is_checked('#routineEnabled') and await pg.get_attribute('#fadeSeg [data-fade="2000"]', 'aria-pressed') == 'true')
        await pg.click('#page-automation [data-back]')
        await pg.click('#tab-settings [data-open=lab]'); await pg.wait_for_timeout(200)
        await pg.evaluate("document.querySelectorAll('#hwRbList .rb').forEach(d=>d.open=true)")
        check('the Rainbow candidate you verified in 1.1.5 is still VERIFIED_SUPPORTED', await pg.get_attribute('.rb[data-key="mode:103"]', 'data-s') == 'VERIFIED_SUPPORTED' and (await pg.inner_text('#hwRbStatus')) == 'VERIFIED_SUPPORTED')
        await pg.click('#page-lab [data-back]')
        await pg.click('#t-fx'); await pg.wait_for_timeout(150)
        check('upgraded installs open the native Scenes category', await pg.get_attribute('#fxCats [data-cat=scenes]', 'aria-selected') == 'true')
        await pg.click('#fxCats [data-cat=fav]')
        tiles = await pg.eval_on_selector_all('#fxList .fxName', 'e=>e.map(x=>x.firstChild.textContent)')
        check('a renamed favourite mode keeps its name and is what the list opens on (Favourites)', tiles == ['My flow'] and await pg.get_attribute('#fxCats [data-cat=fav]', 'aria-selected') == 'true', tiles[:6])
        await pg.click('#t-music')
        check('the music style (DJ) is kept', await pg.get_attribute('[data-ms=dj]', 'aria-pressed') == 'true')
        await pg.click('#t-color'); await pg.wait_for_timeout(100)
        check('the saved colours are kept', await pg.locator('#palette .sw:not(.add)').count() == len(OLD['palette']))
        st = json.loads(await pg.evaluate("localStorage.getItem('melk.studio.v1')"))
        lost = [k for k in OLD if k not in st and k not in ('tab',)]
        check('no setting from 1.1.5 is dropped from storage', not lost, lost)
        check('the new settings get safe defaults', st['driveMode'] == 'parked' and st['vehicles'][0]['cap'] == 40 and st['favScenes'] == [] and st['devUnlocked'] is False, {k: st.get(k) for k in ['driveMode', 'vehicles', 'favScenes']})
        check('the running hardware scene is still remembered', st['native'] and st['native']['kind'] == 'scene' and st['native']['id'] == 11)
        check('no page errors after the whole walk-through', not errs, errs)
        await b.close()
    print(f'\n{sum(results)}/{len(results)} passed'); sys.exit(0 if all(results) else 1)
asyncio.run(main())
