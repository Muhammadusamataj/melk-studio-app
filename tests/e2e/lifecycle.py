#!/usr/bin/env python3
"""End-to-end checks in headless Chromium with a mocked Bluetooth plugin.
Run from the project root:  pip install playwright && playwright install chromium && python3 tests/e2e/lifecycle.py
These checks use a MOCK. They prove the app's behaviour, not that a real LED strip executed anything."""
import asyncio, pathlib, sys
import os
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
URL = (ROOT / 'www' / 'index.html').as_uri()
MOCK = """
window.__w=[]; window.__lis={};
window.Capacitor={isNativePlatform:()=>true, Plugins:{
 BluetoothLe:{ initialize:()=>Promise.resolve(), isEnabled:()=>Promise.resolve({value:true}),
   requestDevice:()=>Promise.resolve({deviceId:'AA:01',name:'MELK-0C21 F1'}),
   connect:()=>Promise.resolve(), disconnect:()=>Promise.resolve(),
   getServices:()=>Promise.resolve({services:[{uuid:'0000fff0-0000-1000-8000-00805f9b34fb',characteristics:[
     {uuid:'0000fff3-0000-1000-8000-00805f9b34fb',properties:{write:false,writeWithoutResponse:true}},
     {uuid:'0000fff4-0000-1000-8000-00805f9b34fb',properties:{notify:true}}]}]}),
   addListener:(k,fn)=>{window.__lis[k]=fn; return Promise.resolve({remove:()=>Promise.resolve()});},
   writeWithoutResponse:(o)=>{ window.__w.push(o.value); return Promise.resolve(); } },
 CapacitorUpdater:{ notifyAppReady:()=>Promise.resolve({}) } }};
"""
results = []
def check(name, ok, detail=''):
    results.append((name, bool(ok), detail)); print(('PASS ' if ok else 'FAIL ') + name + (' | ' + str(detail) if detail and not ok else ''))

COLOUR = '7e070503'
async def fresh(browser):
    ctx = await browser.new_context(viewport={'width': 390, 'height': 800}); pg = await ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); await pg.add_init_script(MOCK)
    await pg.goto(URL); await pg.wait_for_timeout(300)
    return pg, errs
async def connect(pg):
    await pg.click('#btnConn'); await pg.wait_for_timeout(700)
async def writes(pg): return await pg.evaluate('window.__w')
async def clear(pg): await pg.evaluate('window.__w.length=0')
async def drop(pg): await pg.evaluate("window.__lis['disconnected|AA:01'] && window.__lis['disconnected|AA:01']('AA:01')")


async def open_page(pg, pid):
    await pg.click('#t-settings'); await pg.click(f'#tab-settings [data-open={pid}]'); await pg.wait_for_timeout(200)
async def close_page(pg, pid):
    await pg.click(f'#page-{pid} [data-back]'); await pg.wait_for_timeout(150)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel=os.environ.get('MELK_BROWSER_CHANNEL'))

        # 1. Hardware scene is not overwritten by a reconnect
        pg, errs = await fresh(b); await connect(pg)
        await open_page(pg, 'lab'); await pg.select_option('#nativeSel', '11'); await pg.click('#nativeGo'); await pg.wait_for_timeout(500); await close_page(pg, 'lab')
        w = await writes(pg); check('hardware scene 11 is sent as a scene packet', '7e05310b07ffff01ef' in w, w[-4:])
        check('no static colour is sent after the scene command', not any(x.startswith(COLOUR) for x in w[w.index('7e05310b07ffff01ef'):]) if '7e05310b07ffff01ef' in w else False)
        await clear(pg); await drop(pg); await pg.wait_for_timeout(2600)
        check('reconnect after a drop writes nothing (scene keeps running)', await writes(pg) == [], await writes(pg))
        check('no page errors', not errs, errs)

        # 2. Hardware mode survives closing and reopening the app
        await open_page(pg, 'lab'); await pg.fill('#rawMode', '103'); await pg.click('#rawGo'); await pg.wait_for_timeout(400); await close_page(pg, 'lab')
        await clear(pg); await pg.reload(); await pg.wait_for_timeout(1500)
        await connect(pg)
        check('reopening the app and connecting writes nothing over a hardware mode', await writes(pg) == [], await writes(pg))
        await open_page(pg, 'connection')
        info = await pg.inner_text('#ctrlInfo')
        check('Controller card shows the hardware effect and the matched profile', 'Hardware mode 103 (7-Color Running)' in info and 'MELK FFF0 family' in info, info[:200]); await close_page(pg, 'connection')

        # 3. A static colour afterwards ends the hardware effect (so later reconnects restore the colour)
        await pg.click('#t-color'); await pg.wait_for_timeout(100); box = await pg.locator('#wheel').bounding_box()
        await pg.mouse.click(box['x'] + box['width'] * 0.7, box['y'] + box['height'] * 0.5); await pg.wait_for_timeout(300)
        await clear(pg); await drop(pg); await pg.wait_for_timeout(2600)
        check('after choosing a static colour, reconnect restores that colour', any(x.startswith(COLOUR) for x in await writes(pg)))

        # 4. Pending colour writes cannot land after a hardware effect command
        await pg.click('#t-fx'); await pg.click('#segMine'); await pg.click('[data-seq=p4] [data-play]'); await pg.wait_for_timeout(500)
        await open_page(pg, 'lab'); await pg.evaluate("document.querySelector('.rb[data-key=\"mode:103\"]').open = true"); await pg.wait_for_timeout(120)
        await clear(pg)
        await pg.click('.rb[data-key="mode:103"] [data-run]'); await pg.wait_for_timeout(500)
        w = await writes(pg); i = next((k for k, x in enumerate(w) if x.startswith('7e050367')), -1)
        check('mode command was sent', i >= 0, w[:6])
        check('phone Rainbow stops sending colours once a hardware effect is chosen', i >= 0 and not any(x.startswith(COLOUR) for x in w[i:]), w[i:i+6])
        await close_page(pg, 'lab')

        # 5. Rainbow classification is honest
        await pg.click('#t-fx'); await pg.click('#segMine')
        card = await pg.inner_text('[data-seq=p4]'); mine = await pg.inner_text('#fxMine')
        check('phone Rainbow is labelled as a phone effect, and the list says phone effects stop when the app closes', 'Rainbow (phone)' in card and 'PHONE' in card and 'Phone effects stop when the app closes' in mine, [card, mine[:200]])
        await pg.click('#segBuilt')
        check('Effects tab summary shows hardware Rainbow as UNVERIFIED', (await pg.inner_text('#fxRbStatus')) == 'UNVERIFIED')
        await open_page(pg, 'lab')
        check('hardware Rainbow starts as UNVERIFIED', (await pg.inner_text('#hwRbStatus')) == 'UNVERIFIED')

        # 6. Verification model: candidates only reach scenes after the user records evidence
        row = '.rb[data-key="mode:103"]'
        await pg.evaluate("document.querySelector('.rb[data-key=\"mode:103\"]').open = true"); await pg.wait_for_timeout(120)
        check('no Add-as-scene button before verification', await pg.locator(row + ' [data-add]').count() == 0)
        await pg.click(row + ' button[data-f=moves][data-v=yes]'); await pg.wait_for_timeout(100)
        check('moving alone is not enough to verify', (await pg.inner_text('#hwRbStatus')) == 'UNVERIFIED')
        await pg.click(row + ' button[data-f=appClose][data-v=yes]'); await pg.wait_for_timeout(100)
        check('moves + keeps moving after app close = VERIFIED_SUPPORTED', (await pg.inner_text('#hwRbStatus')) == 'VERIFIED_SUPPORTED')
        check('card stays expanded after recording', await pg.evaluate("document.querySelector('.rb[data-key=\"mode:103\"]').open"))
        await pg.click(row + ' [data-add]'); await pg.wait_for_timeout(200)
        await close_page(pg, 'lab')
        await open_page(pg, 'scenes')
        chips = await pg.eval_on_selector_all('#sceneList .srName b', 'e=>e.map(x=>x.textContent)')
        check('verified Rainbow is added as a scene chip', any('Rainbow (hardware)' in c for c in chips), chips)
        await clear(pg); await pg.click('#sceneList .sceneRow:has-text("Rainbow (hardware)") .customPlay'); await pg.wait_for_timeout(500)
        w = await writes(pg)
        check('the Rainbow scene sends the verified hardware mode and no colour', '7e05036706ffff00ef' in w and not any(x.startswith(COLOUR) for x in w), w[:6])
        await close_page(pg, 'scenes'); await open_page(pg, 'lab'); await pg.evaluate("document.querySelector('.rb[data-key=\"mode:103\"]').open = true"); await pg.wait_for_timeout(120)
        await pg.click(row + ' button[data-f=moves][data-v=no]'); await pg.wait_for_timeout(100)
        check('a candidate that does not move becomes UNSUPPORTED', 'UNSUPPORTED' in await pg.inner_text(row))
        await close_page(pg, 'lab')

        # 7. Real mode names
        await pg.reload(); await pg.wait_for_timeout(600); await pg.click('#t-fx')
        await pg.click('#fxCats [data-cat=all]')
        names = await pg.eval_on_selector_all('#fxList .fxName', 'e=>e.map(x=>x.firstChild.textContent)')
        check('built-in modes use Magic Lantern names, not Mode N', any('Flow' in n or 'Running' in n or 'Run Back' in n for n in names) and not any(n.startswith('Mode ') for n in names) and len(names) == 241, [len(names), names[:4]])
        await b.close()
    failed = [r for r in results if not r[1]]
    print(f'\n{len(results) - len(failed)}/{len(results)} passed'); sys.exit(1 if failed else 0)
asyncio.run(main())
