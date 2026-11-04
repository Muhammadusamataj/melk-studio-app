#!/usr/bin/env python3
"""End-to-end checks for the redesigned interface and the new features (mocked Bluetooth and audio plugins).
Run from the project root:  python3 tests/e2e/features.py"""
import asyncio, json, pathlib, sys
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
URL = (ROOT / 'www' / 'index.html').as_uri()
MOCK = """
window.__w=[]; window.__lis={}; window.__audio={start:0,stop:0,delay:0};
window.Capacitor={isNativePlatform:()=>true, Plugins:{
 BluetoothLe:{ initialize:()=>Promise.resolve(), isEnabled:()=>Promise.resolve({value:true}),
   requestDevice:()=>Promise.resolve({deviceId:'AA:BB:CC:DD:EE:01',name:'MELK-0C21 F1'}),
   connect:()=>Promise.resolve(), disconnect:()=>Promise.resolve(),
   getServices:()=>Promise.resolve({services:[{uuid:'0000fff0-0000-1000-8000-00805f9b34fb',characteristics:[
     {uuid:'0000fff3-0000-1000-8000-00805f9b34fb',properties:{write:false,writeWithoutResponse:true}},
     {uuid:'0000fff4-0000-1000-8000-00805f9b34fb',properties:{notify:true}}]}]}),
   addListener:(k,fn)=>{window.__lis[k]=fn; return Promise.resolve({remove:()=>Promise.resolve()});},
   writeWithoutResponse:(o)=>{ window.__w.push(o.value); return Promise.resolve(); } },
 AudioLevel:{ start:()=>{window.__audio.start++; return new Promise(r=>setTimeout(r,window.__audio.delay));}, stop:()=>{window.__audio.stop++; return Promise.resolve();},
   addListener:(k,fn)=>{window.__lis['audio:'+k]=fn; return Promise.resolve({remove:()=>Promise.resolve()});} },
 CapacitorUpdater:{ notifyAppReady:()=>Promise.resolve({}) } }};
"""
results = []
def check(name, ok, detail=''):
    results.append((name, bool(ok), detail)); print(('PASS ' if ok else 'FAIL ') + name + (' | ' + str(detail)[:300] if detail and not ok else ''))

COLOUR = '7e070503'
async def fresh(browser, connect=True, storage=None):
    ctx = await browser.new_context(viewport={'width': 390, 'height': 844}); pg = await ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    await pg.add_init_script(MOCK)
    if storage: await pg.add_init_script("localStorage.setItem('melk.studio.v1', %s)" % json.dumps(json.dumps(storage)))
    await pg.goto(URL); await pg.wait_for_timeout(300)
    if connect: await pg.click('#btnConn'); await pg.wait_for_timeout(700)
    return pg, errs
async def W(pg): return await pg.evaluate('window.__w')
async def clear(pg): await pg.evaluate('window.__w.length=0')
async def open_page(pg, pid):
    await pg.click('#t-settings'); await pg.click(f'#tab-settings [data-open={pid}]'); await pg.wait_for_timeout(200)
async def close_page(pg, pid): await pg.click(f'#page-{pid} [data-back]'); await pg.wait_for_timeout(150)
async def toast(pg): return await pg.inner_text('#toast')
async def state(pg): return json.loads(await pg.evaluate("localStorage.getItem('melk.studio.v1')"))
async def back(pg): await pg.evaluate('history.back()'); await pg.wait_for_timeout(250)
async def unlock_dev(pg):
    await pg.click('#t-settings')
    for _ in range(7): await pg.click('#aboutVersion')

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()

        # ---------- A. structure and navigation ----------
        pg, errs = await fresh(b, connect=False)
        check('connect banner shows while disconnected', await pg.is_visible('#connBanner'))
        await pg.click('#connBannerBtn'); await pg.wait_for_timeout(700)
        check('connect banner hides once connected', not await pg.is_visible('#connBanner'))
        check('Developer options are hidden by default', await pg.evaluate("document.getElementById('rowDev').hidden"))
        await pg.click('#t-settings')
        check('hero and scene chips are hidden on Settings', not await pg.is_visible('.hero') and not await pg.is_visible('#scenes'))
        await open_page(pg, 'lab')
        check('guided hardware tests are inside the Lab', await pg.locator('#page-lab #rawMode').count() == 1 and await pg.locator('#page-lab #hwRainbow').count() == 1)
        check('the Settings list and normal tabs hold no raw tools', await pg.locator('#tab-settings #rawMode, #tab-color #rawMode, #tab-fx #nativeSel, #tab-music #rawMode').count() == 0)
        await back(pg)
        check('Android back closes a page', await pg.evaluate("document.getElementById('page-lab').hidden"))
        await pg.click('#btnCar'); await pg.wait_for_timeout(150); await back(pg)
        check('Android back closes Car mode', await pg.evaluate("document.getElementById('car').hidden"))
        for _ in range(7): await pg.click('#aboutVersion')
        check('seven taps on the version unlock Developer options', not await pg.evaluate("document.getElementById('rowDev').hidden"))
        await pg.reload(); await pg.wait_for_timeout(400); await pg.click('#t-settings')
        check('unlock survives a restart', not await pg.evaluate("document.getElementById('rowDev').hidden"))
        await pg.click('#rowDev'); await pg.wait_for_timeout(200)
        check('raw protocol tools are inside Developer options', all([await pg.locator(f'#page-dev #{i}').count() == 1 for i in ['labElkOn', 'labElkOff', 'magicSceneSend', 'powerProfile', 'deviceDiagBtn', 'log', 'otaAdmin', 'showAll', 'demoBtn']]))
        await close_page(pg, 'dev'); await open_page(pg, 'lab'); await pg.check('#labConfirm'); await close_page(pg, 'lab')
        await pg.click('#rowDev'); check('parking confirmation is shared between Lab and Protocol Lab', await pg.is_checked('#labConfirm2'))
        await pg.click('#devHide'); await pg.wait_for_timeout(200)
        check('Hide developer options closes the page and hides the row', await pg.evaluate("document.getElementById('rowDev').hidden && document.getElementById('page-dev').hidden"))
        check('no page errors (navigation)', not errs, errs)

        # ---------- B. scenes: favourites, recents, share, import ----------
        pg, errs = await fresh(b)
        await open_page(pg, 'scenes')
        row = '#sceneList .sceneRow:has-text("Movie")'
        await pg.click(row + ' .fav'); await pg.wait_for_timeout(150)
        await close_page(pg, 'scenes'); await pg.click('#t-color'); await pg.wait_for_timeout(100)
        chips = await pg.eval_on_selector_all('#scenes .scene', 'e=>e.map(x=>x.textContent)')
        check('a favourite scene is starred and listed first', chips[1].startswith('★ Movie'), chips[:3])
        await pg.click('#scenes .scene:has-text("Relax")'); await pg.wait_for_timeout(300)
        await open_page(pg, 'scenes')
        check('recent scenes are listed', 'Relax' in await pg.inner_text('#recentList'))
        await pg.evaluate("document.querySelectorAll('#sceneList .srMore').forEach(d=>d.open=true)")
        await pg.click('#sceneList .sceneRow:has-text("Movie") .share'); await pg.wait_for_timeout(200)
        shared = json.loads(await pg.input_value('#dlgForm textarea'))
        check('Share produces a valid scene document', shared.get('melk') == 'scene' and shared.get('name') == 'Movie' and shared.get('type') == 'color', shared)
        await pg.keyboard.press('Escape')
        async def do_import(doc):
            await pg.click('#sceneImport'); await pg.fill('#dlgForm textarea', doc if isinstance(doc, str) else json.dumps(doc)); await pg.click('#okBtn'); await pg.wait_for_timeout(250)
            msg = await pg.inner_text('#impMsg') if await pg.is_visible('#impMsg') else ''
            if await pg.evaluate("document.getElementById('dlg').open"): await pg.keyboard.press('Escape')
            return msg
        n0 = await pg.locator('#sceneList .sceneRow').count()
        await do_import({'melk': 'scene', 'v': 1, 'name': 'Shared glow', 'br': 33, 'type': 'color', 'color': '#00ff88'})
        check('a valid shared scene is imported', await pg.locator('#sceneList .sceneRow').count() == n0 + 1)
        m = await do_import({'melk': 'scene', 'v': 1, 'name': 'Bad', 'type': 'hardware', 'hardware': {'kind': 'mode', 'id': 999}})
        check('an unknown hardware mode is rejected with a reason', 'not in the Magic Lantern list' in m and await pg.locator('#sceneList .sceneRow').count() == n0 + 1, m)
        m = await do_import('{"melk":"scene","v":1,"name":"Raw","type":"color","color":"#ffffff","bytes":[126,4,4,1,0,1,255,0,239]}')
        await pg.evaluate("document.querySelectorAll('#sceneList .srMore').forEach(d=>d.open=true)")
        await do_import({'melk': 'scene', 'v': 1, 'name': 'Fake HW', 'type': 'hardware', 'hardware': {'kind': 'mode', 'id': 103}, 'fallbackColor': '#ff0000'})
        await close_page(pg, 'scenes'); await pg.click('#t-color'); await clear(pg)
        await pg.click('#scenes .scene:has-text("Fake HW")'); await pg.wait_for_timeout(500)
        w = await W(pg)
        check('an unverified shared hardware effect only ever sends a static colour', any(x.startswith(COLOUR) for x in w) and not any(x.startswith('7e0503') or x.startswith('7e0531') for x in w), w[:5])
        check('no page errors (scenes)', not errs, errs)

        # ---------- C. vehicle and Drive ----------
        pg, errs = await fresh(b)
        await pg.click('#btnCar'); await pg.click('#carDriving'); await pg.wait_for_timeout(200)
        grid = await pg.eval_on_selector_all('#carGrid button', 'e=>e.map(x=>x.textContent)')
        check('Driving hides parked-only scenes in Car mode', 'Party' not in grid and 'Night drive' in grid, grid)
        await pg.click('#carExit'); await pg.click('#t-color'); await pg.wait_for_timeout(700); await clear(pg)   # let the brightness limit settle
        await pg.click('#scenes .scene:has-text("Party")'); await pg.wait_for_timeout(300)
        check('a parked-only scene is refused while Driving, and nothing is sent', 'Parked-only' in await toast(pg) and await W(pg) == [], [await toast(pg), await W(pg)])
        await pg.click('#scenes .scene:has-text("Dinner")'); await pg.wait_for_timeout(300)
        check('hardware scenes (Dinner) are refused while Driving', 'Parked-only' in await toast(pg) and not any(x.startswith('7e0531') for x in await W(pg)))
        await pg.evaluate("const r=document.getElementById('br'); r.value=100; r.dispatchEvent(new Event('input',{bubbles:true}))"); await pg.wait_for_timeout(100)
        check('brightness is limited while Driving (40%)', int(await pg.input_value('#br')) == 40, await pg.input_value('#br'))
        await pg.click('#t-music'); await pg.click('#musicBtn'); await pg.wait_for_timeout(300)
        check('music is refused while Driving', 'parked-only' in (await toast(pg)).lower() and await pg.inner_text('#musicBtn') == 'Start listening')
        await open_page(pg, 'lab'); await clear(pg); await pg.click('.rb[data-key="scene:11"] [data-run]'); await pg.wait_for_timeout(300)
        check('Lab hardware tests are refused while Driving', 'parked-only' in (await toast(pg)).lower() and not any(x.startswith('7e0531') for x in await W(pg)))
        await close_page(pg, 'lab')
        # switching to Driving while a hardware effect runs puts the static colour back
        await pg.click('#btnCar'); await pg.click('#carParked'); await pg.click('#carExit')
        await open_page(pg, 'lab'); await pg.fill('#rawMode', '103'); await pg.click('#rawGo'); await pg.wait_for_timeout(300); await close_page(pg, 'lab'); await clear(pg)
        await pg.click('#btnCar'); await pg.click('#carDriving'); await pg.wait_for_timeout(500)
        check('switching to Driving replaces a running hardware effect with the static colour', any(x.startswith(COLOUR) for x in await W(pg)) and 'static colour' in (await toast(pg)).lower(), [await toast(pg), (await W(pg))[:4]])
        await pg.click('#carParked'); await pg.click('#carExit')
        # vehicle profile
        await open_page(pg, 'vehicle')
        await pg.fill('#vehName', 'Daily car'); await pg.evaluate("const r=document.getElementById('vehCap'); r.value=25; r.dispatchEvent(new Event('input',{bubbles:true}))")
        await pg.click('#vehNew'); await pg.wait_for_timeout(150)
        check('a second vehicle can be added and selected', await pg.locator('#vehSel option').count() == 2)
        await pg.select_option('#vehSel', index=0); await pg.wait_for_timeout(100)
        check('vehicle name and driving limit are kept per vehicle', await pg.input_value('#vehName') == 'Daily car' and await pg.input_value('#vehCap') == '25')
        await pg.select_option('#vehSel', index=1); await pg.click('#vehDel'); await pg.click('#okBtn'); await pg.wait_for_timeout(200)
        check('a vehicle can be deleted (never the last one)', await pg.locator('#vehSel option').count() == 1 and await pg.is_disabled('#vehDel'))
        await pg.select_option('#vehStartup', 'movie'); await pg.wait_for_timeout(100)
        await close_page(pg, 'vehicle')
        await pg.click('#btnCar'); await pg.click('#carDriving'); await pg.click('#carExit'); await pg.click('#t-color')
        await pg.evaluate("const r=document.getElementById('br'); r.value=90; r.dispatchEvent(new Event('input',{bubbles:true}))")
        check('the driving limit follows the vehicle profile (25%)', int(await pg.input_value('#br')) == 25, await pg.input_value('#br'))
        await pg.evaluate("localStorage.setItem('melk.x','1')")
        st = await state(pg); await pg.close()
        # start-up scene: applied once when the strip connects
        pg, errs = await fresh(b, connect=False, storage=dict(st, driveMode='parked', native=None))
        await pg.click('#btnConn'); await pg.wait_for_timeout(2600)
        check('the chosen start-up scene is applied when the strip connects', any(x.startswith('7e070503ff9a4d') for x in await W(pg)), (await W(pg))[:6])
        check('no page errors (drive)', not errs, errs)

        # ---------- D. music lifecycle ----------
        pg, errs = await fresh(b)
        await pg.click('#t-music'); await pg.evaluate("window.__audio.delay=400")
        await pg.click('#musicBtn'); await pg.click('#musicBtn'); await pg.wait_for_timeout(900)
        a = await pg.evaluate('window.__audio')
        check('a double tap starts audio capture only once', a['start'] == 1, a)
        check('the button shows Stop listening', await pg.inner_text('#musicBtn') == 'Stop listening')
        await clear(pg)
        for i in range(12): await pg.evaluate(f"window.__lis['audio:frame']({{bass:{0.7 if i%4==0 else 0.08}}})"); await pg.wait_for_timeout(70)
        check('audio frames drive the strip', any(x.startswith(COLOUR) for x in await W(pg)))
        await pg.evaluate("Object.defineProperty(document,'hidden',{value:true,configurable:true}); document.dispatchEvent(new Event('visibilitychange'))"); await pg.wait_for_timeout(300)
        a = await pg.evaluate('window.__audio'); await clear(pg)
        for i in range(6): await pg.evaluate("window.__lis['audio:frame']({bass:0.8})"); await pg.wait_for_timeout(60)
        check('capture stops when the app goes to the background', a['stop'] >= 1 and await pg.inner_text('#musicBtn') == 'Start listening')
        check('no colour is sent after the app is hidden', not any(x.startswith(COLOUR) for x in await W(pg)))
        await pg.evaluate("Object.defineProperty(document,'hidden',{value:false,configurable:true}); document.dispatchEvent(new Event('visibilitychange'))"); await pg.wait_for_timeout(200)
        check('the user is told music was paused', 'paused' in (await toast(pg)).lower(), await toast(pg))
        # DJ patterns keep their hardware pattern when listening stops
        await pg.evaluate("const r=document.getElementById('djInterval'); r.value=4; r.dispatchEvent(new Event('input',{bubbles:true}))")
        await pg.click('[data-ms=dj]'); await pg.wait_for_timeout(4300)
        await pg.click('#musicBtn'); await pg.wait_for_timeout(500); await clear(pg)
        for i in range(30): await pg.evaluate(f"window.__lis['audio:frame']({{bass:{0.9 if i%5==0 else 0.03}}})"); await pg.wait_for_timeout(90)
        w = await W(pg); st = await state(pg)
        check('DJ patterns send a hardware mode and remember it', any(x.startswith('7e0503') for x in w) and st.get('native', {}) and st['native'].get('kind') == 'mode', (w[:4], st.get('native')))
        await clear(pg); await pg.click('#musicBtn'); await pg.wait_for_timeout(400)
        check('stopping DJ leaves the pattern running (no static colour)', not any(x.startswith(COLOUR) for x in await W(pg)), await W(pg))
        check('no page errors (music)', not errs, errs)

        # ---------- E. backup and import ----------
        pg, errs = await fresh(b)
        await open_page(pg, 'backup'); await pg.click('#expBtn'); await pg.wait_for_timeout(100)
        doc = json.loads(await pg.input_value('#backup'))
        check('Show as text exports valid JSON', isinstance(doc, dict) and 'scenes' in doc)
        evil = json.dumps({'br': 999, 'scenes': [{'id': 'a b', 'name': 'x', 'type': 'color'}], 'native': {'kind': 'mode', 'id': 5}, 'evil': 1}).replace('{"br"', '{"__proto__":{"polluted":1},"br"', 1)
        await pg.fill('#backup', evil); await pg.click('#impBtn'); await pg.wait_for_timeout(300)
        st = await state(pg)
        check('an import with bad data is accepted but cleaned', 'ignored' in await toast(pg) and st['br'] <= 100 and st.get('native') is None and 'evil' not in st and len(st['scenes']) >= 8, [await toast(pg), st.get('br')])
        check('prototype pollution through import is impossible', await pg.evaluate("({}).polluted") is None)
        await pg.fill('#backup', 'not json'); await pg.click('#impBtn'); await pg.wait_for_timeout(200)
        check('text that is not settings is refused', 'not valid' in await toast(pg))
        check('the interface still works after a bad import', await pg.evaluate("document.querySelectorAll('#scenes .scene').length") >= 9)
        check('no page errors (backup)', not errs, errs)

        # ---------- F. developer tools ----------
        pg, errs = await fresh(b); await unlock_dev(pg); await pg.wait_for_timeout(2700)
        await pg.click('#rowDev'); await pg.wait_for_timeout(150)
        await pg.click('#deviceDiagBtn'); await pg.wait_for_timeout(300)
        out = await pg.inner_text('#deviceDiagOut')
        check('device info masks the Bluetooth address', 'AA:BB:CC:DD:EE:01' not in out and '(masked)' in out and 'FFF0' in out, out[:200])
        await pg.click('#otaAdmin'); await pg.wait_for_timeout(200)
        check('update-server admin is reached from Developer options and asks for a PIN', 'Create admin PIN' in await pg.inner_text('#dlgForm h3'))
        await pg.keyboard.press('Escape')
        check('no page errors (developer)', not errs, errs)

        # ---------- F2. update-server admin (PIN, URL rules, lockout) ----------
        pg, errs = await fresh(b); await unlock_dev(pg); await pg.wait_for_timeout(2700)
        hits = []
        async def serve(route):
            hits.append(route.request.url)
            await route.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'}, body=json.dumps({'version': '0.0.1', 'url': 'https://mine.example/ota/a.zip', 'sha256': 'a' * 64}))
        await pg.route('**/*melk-version.json*', serve)
        await pg.click('#rowDev'); await pg.click('#otaAdmin'); await pg.wait_for_timeout(200)
        await pg.fill('input[name=a]', '123'); await pg.fill('input[name=b]', '123'); await pg.click('#admSave')
        check('a short admin PIN is refused', 'at least 6' in await pg.inner_text('#admMsg'))
        await pg.fill('input[name=a]', 'secret99'); await pg.fill('input[name=b]', 'secret98'); await pg.click('#admSave')
        check('a mismatched admin PIN is refused', 'do not match' in await pg.inner_text('#admMsg'))
        await pg.fill('input[name=b]', 'secret99'); await pg.press('input[name=b]', 'Enter'); await pg.wait_for_timeout(500)
        check('a valid PIN opens the update-server panel', 'Update server' in await pg.inner_text('#dlgForm h3'))
        raw = await pg.evaluate("localStorage.getItem('melk.admin')")
        check('the PIN is stored as a salted hash, never as text', 'secret99' not in raw and set(json.loads(raw)) == {'salt', 'iter', 'hash'})
        rejected = []
        for bad in ['http://mine.example/ota/melk-version.json', 'javascript:alert(1)', 'https://user:pw@mine.example/m.json', 'https://mine.example/ota/readme.txt', 'https://localhost/m.json']:
            await pg.fill('input[name=u]', bad); await pg.click('#admSaveUrl'); rejected.append('Not accepted' in await pg.inner_text('#admMsg'))
        check('unsafe update URLs are refused', all(rejected), rejected)
        await pg.fill('input[name=u]', 'https://mine.example/ota/melk-version.json'); await pg.click('#admSaveUrl'); await pg.click('#admOut'); await pg.wait_for_timeout(200)
        await close_page(pg, 'dev'); await open_page(pg, 'updates'); await pg.evaluate("document.querySelector('#webUpdateCard details').open = true")
        check('a custom server is shown as custom', 'mine.example (custom)' in await pg.inner_text('#otaHost'))
        await pg.click('#otaCheck'); await pg.wait_for_timeout(700)
        check('Check for updates uses the custom server', any('mine.example' in u for u in hits), hits)
        await close_page(pg, 'updates'); await pg.click('#rowDev'); await pg.click('#otaAdmin'); await pg.wait_for_timeout(200)
        check('after logging out the PIN is needed again', 'Admin login' in await pg.inner_text('#dlgForm h3'))
        for i in range(5): await pg.fill('input[name=p]', 'wrong' + str(i)); await pg.click('#admGo'); await pg.wait_for_timeout(200)
        check('five wrong PINs lock the admin screen', 'Locked' in await pg.inner_text('#admMsg'))
        await pg.fill('input[name=p]', 'secret99'); await pg.click('#admGo'); await pg.wait_for_timeout(200)
        check('the correct PIN is refused while locked', 'Too many' in await pg.inner_text('#admMsg'))
        await pg.evaluate("localStorage.removeItem('melk.admin.fail')"); await pg.fill('input[name=p]', 'secret99'); await pg.click('#admGo'); await pg.wait_for_timeout(500)
        await pg.click('#admReset'); await pg.click('#admOut'); await pg.wait_for_timeout(200)
        await close_page(pg, 'dev'); await open_page(pg, 'updates'); await pg.evaluate("document.querySelector('#webUpdateCard details').open = true")
        check('Reset to default returns to the default server', 'github.io' in await pg.inner_text('#otaHost') and '(custom)' not in await pg.inner_text('#otaHost'))
        check('no page errors (admin)', not errs, errs)

        # ---------- G. language ----------
        pg, errs = await fresh(b); await unlock_dev(pg)
        texts = []
        for t in ['color', 'fx', 'music', 'settings']: await pg.click(f'#t-{t}'); texts.append(await pg.inner_text('.app'))
        for pid in ['connection', 'vehicle', 'scenes', 'automation', 'backup', 'updates', 'lab', 'dev']:
            await pg.click('#t-settings'); await pg.click(f'#tab-settings [data-open={pid}]'); texts.append(await pg.evaluate(f"document.getElementById('page-{pid}').innerText")); await pg.click(f'#page-{pid} [data-back]')
        import re
        bad = re.findall(r'\b(karein|nahi|nahin|dekhein|pehle|rakhein|inhein|hogi|jaye|mein allow)\b', ' '.join(texts), re.I)
        check('all visible text is English', not bad, bad)
        await b.close()
    failed = [r for r in results if not r[1]]
    print(f'\n{len(results) - len(failed)}/{len(results)} passed'); sys.exit(1 if failed else 0)
asyncio.run(main())
