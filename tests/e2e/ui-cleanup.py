#!/usr/bin/env python3
"""Checks for the UI cleanup: a clear power hierarchy, one description of the connection everywhere, a slim Rainbow row,
collapsed technical details, short update cards, and no repeated explanations. Mocked Android bridge.
Run from the project root: python3 tests/e2e/ui-cleanup.py"""
import asyncio, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from apk_mock import APK_MOCK
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parents[2]
URL = (ROOT / 'www' / 'index.html').as_uri()
results = []
def check(name, ok, detail=''):
    results.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + name + (' | ' + str(detail)[:300] if detail and not ok else ''))
async def new_page(b, native=True):
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}); pg = await ctx.new_page(); errs = []
    pg.set_default_timeout(8000)
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    if native: await pg.add_init_script(APK_MOCK)
    await pg.goto(URL); await pg.wait_for_timeout(400); return pg, errs
async def js(pg, code): return await pg.evaluate(code)
async def open_page(pg, pid): await pg.click('#t-settings'); await pg.click(f'#tab-settings [data-open={pid}]'); await pg.wait_for_timeout(200)
async def txt(pg, sel): return (await pg.inner_text(sel)).strip()
async def conn_view(pg):
    """What the four places say about the connection right now."""
    await pg.click('#t-color'); await pg.wait_for_timeout(100)
    chip = await txt(pg, '#connLabel'); ban = await pg.is_visible('#connBanner'); bt = await txt(pg, '#connBannerText') if ban else None
    bb = await txt(pg, '#connBannerBtn') if ban else None
    await open_page(pg, 'connection'); page = (await txt(pg, '#connPageLabel'), await txt(pg, '#connPageSub'), await txt(pg, '#connPageBtn'), await pg.is_disabled('#connPageBtn'), await pg.get_attribute('#connPageCard', 'data-s'))
    await pg.click('#page-connection [data-back]'); nav = await txt(pg, '#navConnSub')
    return {'chip': chip, 'banner': (bt, bb) if ban else None, 'page': page, 'nav': nav}

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()

        # ---- power hierarchy
        pg, errs = await new_page(b)
        check('the top Power button is the one primary power control', await pg.is_visible('#btnPower') and await pg.get_attribute('#btnPower', 'aria-pressed') == 'true')
        check('direct Light ON / OFF are tucked away by default', not await pg.is_visible('#forcePowerOn') and not await pg.is_visible('#forcePowerOff'))
        await pg.click('#btnConn'); await pg.wait_for_timeout(800)
        await pg.click('#btnPower'); await pg.wait_for_timeout(400)
        check('the top button switches the app state', await pg.get_attribute('#btnPower', 'aria-pressed') == 'false' and 'off' in (await txt(pg, '#roSub')).lower(), await txt(pg, '#roSub'))
        await pg.click('.directPower summary'); await pg.wait_for_timeout(100)
        check('"Direct power" opens to Light ON and Light OFF with one short explanation', await pg.is_visible('#forcePowerOn') and await pg.is_visible('#forcePowerOff') and 'strip and the app disagree' in await txt(pg, '.directPower .hint'))
        await js(pg, 'window.__w.length = 0'); await pg.click('#forcePowerOn'); await pg.wait_for_timeout(300)
        w = await js(pg, 'window.__w'); check('Light ON still sends a power packet straight to the strip', any(x.startswith('7e0404') for x in w), w[:4])
        check('and it switches the app state back on', await pg.get_attribute('#btnPower', 'aria-pressed') == 'true')
        await js(pg, 'window.__w.length = 0'); await pg.click('#forcePowerOff'); await pg.wait_for_timeout(300)
        check('Light OFF still sends a power packet', any(x.startswith('7e0404') for x in await js(pg, 'window.__w')))
        check('no page errors (power)', not errs, errs)

        # ---- one description of the connection, in four places
        pg, errs = await new_page(b)
        v = await conn_view(pg)
        check('not connected: chip, banner, Connection page and Settings row agree', v['chip'] == 'Connect strip' and v['banner'] == ('Strip not connected', 'Connect strip') and v['page'][0] == 'Not connected' and v['page'][2] == 'Connect strip' and v['page'][4] == 'idle' and v['nav'] == 'Not connected', v)
        await js(pg, "(() => { window.__held = null; const o = window.Capacitor.Plugins.BluetoothLe.connect; window.Capacitor.Plugins.BluetoothLe.connect = () => new Promise((r) => { window.__held = () => { window.Capacitor.Plugins.BluetoothLe.connect = o; o(); r(); }; }); return 'set'; })()")
        await pg.click('#btnConn'); await pg.wait_for_timeout(300)
        v = await conn_view(pg)
        check('connecting: all places say Connecting, the banner steps aside, the page button is disabled', v['chip'] == 'Connecting…' and v['banner'] is None and v['page'][0] == 'Connecting…' and v['page'][3] is True and v['nav'] == 'Connecting…', v)
        await js(pg, "(() => { window.__held(); return 'released'; })()"); await pg.wait_for_timeout(900)
        v = await conn_view(pg)
        check('connected: the strip name and the same action everywhere', 'MELK' in v['chip'] and v['banner'] is None and v['page'][0] == v['chip'] and v['page'][1] == 'Connected' and v['page'][2] == 'Disconnect' and v['page'][4] == 'connected' and v['nav'].startswith(v['chip']), v)
        await open_page(pg, 'connection'); await pg.click('#connPageBtn'); await pg.wait_for_timeout(500); await pg.click('#page-connection [data-back]')
        v = await conn_view(pg)
        check('the Connection page button disconnects and every place follows', v['chip'] == 'Connect strip' and v['banner'] is not None and v['page'][0] == 'Not connected' and v['nav'] == 'Not connected', v)
        await open_page(pg, 'connection'); await pg.click('#connPageBtn'); await pg.wait_for_timeout(900)
        check('the same button connects again', 'MELK' in await txt(pg, '#connPageLabel') and await txt(pg, '#connPageBtn') == 'Disconnect')
        info = await txt(pg, '#ctrlInfo')
        check('the Connection page leads with what matters (profile, effect) and hides the rest', 'Profile' in info and 'FFF3' not in info and not await pg.is_visible('#ctrlTech') and not await pg.is_visible('.tipsBox .tips'))
        await pg.evaluate("document.querySelector('#ctrlTech').closest('details').open = true")
        check('technical details are still there when opened', 'FFF0 service' in await txt(pg, '#ctrlTech') and 'Hardware Rainbow' in await txt(pg, '#ctrlTech'))
        check('no page errors (connection)', not errs, errs)
        pg, errs = await new_page(b, native=False); await pg.click('#btnConn'); await pg.wait_for_timeout(400)
        v = await conn_view(pg)
        check('demo: chip, page and Settings row agree', v['chip'] == 'Demo strip' and v['banner'] is None and v['page'][0] == 'Demo strip' and v['page'][2] == 'Stop demo' and v['nav'] == 'Demo strip', v)

        # ---- Effects and the Lab
        pg, errs = await new_page(b); await pg.click('#t-fx'); await pg.wait_for_timeout(150)
        box = await pg.locator('#fxRainbow').bounding_box()
        check('Effects shows Rainbow as one slim row, not a card that repeats the Lab', box['height'] < 100 and await pg.locator('#tab-fx .rbSummary').count() == 0, box)
        check('the row shows the same status as the Lab', (await txt(pg, '#fxRbStatus')) == 'UNVERIFIED')
        await pg.click('#fxRainbow'); await pg.wait_for_timeout(250)
        check('tapping it opens the Lab where the test is', await pg.is_visible('#page-lab') and await pg.is_visible('#hwRainbow'))
        check('the Lab has four blocks (notice, Rainbow, testers, keep-on-strip) instead of seven', await pg.locator('#page-lab .pageBody > .sect, #page-lab .pageBody > .notice').count() == 4, await pg.locator('#page-lab .pageBody > .sect, #page-lab .pageBody > .notice').count())
        await pg.click('#page-lab [data-back]'); await pg.click('#fxCats [data-cat=all]'); await pg.click('#fxList .fxRow >> nth=3'); await pg.click('#fxRename'); await pg.wait_for_timeout(200)
        label = await txt(pg, '#dlgForm .check')
        check('modes use the same word as scenes: Favourite', 'Favourite' in label and 'Star' not in label, label); await pg.keyboard.press('Escape')
        check('no page errors (effects)', not errs, errs)

        # ---- Software updates
        pg, errs = await new_page(b); await open_page(pg, 'updates')
        check('both cards keep their details collapsed', not await js(pg, "document.querySelector('#webUpdateCard details').open") and not await js(pg, "document.querySelector('#apkCard details').open"))
        check('technical lines (server, signing key, build type) are not on show', not await pg.is_visible('#otaHost') and not await pg.is_visible('#apkSigner') and not await pg.is_visible('#apkAvailRow'))
        n = await js(pg, "[...document.querySelectorAll('#page-updates p')].filter(e => e.offsetParent && !e.hidden && !e.closest('details:not([open])') && e.textContent.trim().split(/\\s+/).length > 3).length")
        check('at most four short sentences are visible on the whole screen', n <= 4, n)
        await pg.click('#apkCheck'); await pg.wait_for_timeout(300)
        check('"Available" appears only when there is something available', await pg.is_visible('#apkAvailRow') and 'v1.1.8' in await txt(pg, '#apkAvailable'))
        check('the web update card still works on its own', await pg.is_visible('#otaCheck') and await pg.locator('#webUpdateCard #otaStatus').count() == 1)

        # ---- scenes, favourites, recent: the existing ones are reused
        await pg.click('#page-updates [data-back]'); await open_page(pg, 'scenes')
        check('Recent is hidden until there is something recent', not await pg.is_visible('#recentWrap'))
        await pg.click('#sceneList .sceneRow:has-text("Relax") .customPlay'); await pg.wait_for_timeout(300)
        check('Recent shows the scene you just used, inside the first card', await pg.is_visible('#recentWrap') and 'Relax' in await txt(pg, '#recentList'))
        rows = await pg.eval_on_selector_all('#sceneList .srName small', 'e => e.map(x => x.textContent)')
        check('scene rows no longer repeat the "stops when the app closes" sentence', not any('stops when' in r for r in rows) and any(r.startswith('Phone effect') for r in rows), rows[:4])
        st = json.loads(await js(pg, "localStorage.getItem('melk.studio.v1')"))
        check('favourites, recents and saved colours still use the existing stores (no new favourites system)', 'favScenes' in st and 'modeFav' in st and 'recent' in st and 'palette' in st and not [k for k in st if 'fav' in k.lower() and k not in ('favScenes', 'modeFav', 'nativeSceneFav')], [k for k in st if 'fav' in k.lower()])
        check('no page errors (updates and scenes)', not errs, errs)
        await b.close()
    print(f'\n{sum(results)}/{len(results)} passed'); sys.exit(0 if all(results) else 1)
asyncio.run(main())
