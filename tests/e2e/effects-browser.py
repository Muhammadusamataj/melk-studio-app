#!/usr/bin/env python3
"""End-to-end checks for the Effects browser (category chips, compact list, one selected-effect panel), with a mocked Android bridge.
Run from the project root: python3 tests/e2e/effects-browser.py"""
import asyncio, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from apk_mock import APK_MOCK
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parents[2]
URL = (ROOT / 'www' / 'index.html').as_uri()
ML = json.loads((ROOT / 'tests' / 'fixtures' / 'ml-apk-arrays.json').read_text())
OLD = json.loads((ROOT / 'tests' / 'fixtures' / 'state-1.1.5.json').read_text())
results = []
def check(name, ok, detail=''):
    results.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + name + (' | ' + str(detail)[:300] if detail and not ok else ''), flush=True)
async def new_page(b, storage=None, connect=True, width=390):
    ctx = await b.new_context(viewport={'width': width, 'height': 900}); pg = await ctx.new_page(); errs = []
    pg.set_default_timeout(8000)
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    await pg.add_init_script(APK_MOCK)
    if storage is not None: await pg.add_init_script("localStorage.setItem('melk.studio.v1', %s)" % json.dumps(json.dumps(storage)))
    await pg.goto(URL); await pg.wait_for_timeout(350)
    if connect: await pg.click('#btnConn'); await pg.wait_for_timeout(800)
    await pg.click('#t-fx'); await pg.wait_for_timeout(200)
    return pg, errs
js = lambda pg, code: pg.evaluate(code)
async def state(pg): return json.loads(await pg.evaluate("localStorage.getItem('melk.studio.v1')"))
async def chip(pg, c): await pg.click(f'#fxCats [data-cat="{c}"]'); await pg.wait_for_timeout(120)
async def rowkeys(pg): return await pg.eval_on_selector_all('#fxList .fxRow', 'e=>e.map(x=>x.dataset.key)')
async def names(pg): return await pg.eval_on_selector_all('#fxList .fxName', 'e=>e.map(x=>x.firstChild.textContent)')
async def selkey(pg): return await pg.evaluate("(document.querySelector('#fxList .fxRow[aria-selected=true]')||{dataset:{}}).dataset.key")
async def writes(pg): return await js(pg, 'window.__w')
async def clear(pg): await js(pg, 'window.__w.length = 0')
async def toast(pg): return (await pg.inner_text('#toast')).strip()
def pkt_mode(i): return '7e0503%02x06ffff00ef' % i
def pkt_scene(i): return '7e0531%02x07ffff01ef' % i

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()

        # ---------- structure ----------
        pg, errs = await new_page(b)
        cats = await pg.eval_on_selector_all('#fxCats .fxCat', 'e=>e.map(x=>x.dataset.cat)')
        check('chips follow Magic Lantern\'s order: All, Favourites, Scenes, then its groups', cats == ['all', 'fav', 'scenes'] + ML['groupOrder'][:8], cats)
        check('a fresh install opens on All with all 213 strip modes listed', await pg.get_attribute('#fxCats [data-cat=all]', 'aria-selected') == 'true' and len(await rowkeys(pg)) == 213)
        check('the old tile grid, the old Rename toggle and the old hint are gone', await pg.locator('#modeGrid, #modeEdit, #modeHint, #tab-fx .tile').count() == 0)
        hs = await js(pg, "[...document.querySelectorAll('#tab-fx *')].filter(e => { const c = getComputedStyle(e); return (c.overflowX === 'auto' || c.overflowX === 'scroll') && e.scrollWidth > e.clientWidth + 1; }).map(e => e.id)")
        vs = await js(pg, "[...document.querySelectorAll('#tab-fx *')].filter(e => { const c = getComputedStyle(e); return (c.overflowY === 'auto' || c.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 1; }).map(e => e.id)")
        check('only the category chips scroll sideways', hs == ['fxCats'], hs)
        check('the only vertical scroller on the tab is the effects list', vs == ['fxList'], vs)
        lh = await js(pg, "document.getElementById('fxList').getBoundingClientRect().height"); ob = await js(pg, "getComputedStyle(document.getElementById('fxList')).overscrollBehaviorY")
        check('the list has a sensible maximum height and does not chain scrolling to the page', lh <= 361 and ob == 'contain', [lh, ob])
        rh = await js(pg, "Math.max(...[...document.querySelectorAll('#fxList .fxRow')].map(e => e.getBoundingClientRect().height))")
        check('rows are compact (no card per mode) but still touch-sized', 44 <= rh <= 72, rh)
        check('no new Settings page and no second favourites control', await js(pg, "document.querySelectorAll('.page').length") == 8 and await pg.locator('#fxFav').count() == 1 and await pg.locator('#tab-fx [id*=avourite]').count() == 0)
        names_all = await names(pg)
        check('names are exactly Magic Lantern\'s for all 213 modes (mode 130 and 143 spot-checked)', names_all == [ML['modes'][k][1] for g in ML['groupOrder'][:8] for k in sorted((k for k in ML['modes'] if ML['modes'][k][0] == g), key=int)] and names_all[0] == 'Auto Play', names_all[:3])
        counts = {g: sum(1 for v in ML['modes'].values() if v[0] == g) for g in ML['groupOrder'][:8]}; ok = True
        for g, n in counts.items(): await chip(pg, g); ok = ok and len(await rowkeys(pg)) == n
        check('each group lists exactly the modes Magic Lantern puts in it', ok, counts)

        # ---------- selecting is not running ----------
        await chip(pg, 'Run'); await clear(pg)
        await pg.click('#fxList .fxRow >> nth=2'); await pg.wait_for_timeout(150); k1 = await selkey(pg)
        check('tapping a row selects it (one highlighted row) and sends nothing', k1 and await pg.locator('#fxList .fxRow[aria-selected=true]').count() == 1 and await writes(pg) == [], [k1, await writes(pg)])
        check('the panel describes the selected row, with its number and group', (await pg.inner_text('#fxSelName')) == ML['modes'][k1[1:]][1] and f'Mode {k1[1:]}' in await pg.inner_text('#fxSelMeta') and 'Run group' in await pg.inner_text('#fxSelMeta'))
        check('an untested mode says so plainly and does not claim it is unsupported', (await pg.inner_text('#fxSelBadge')) == 'NOT TESTED' and 'Not tested on your strip yet' in await pg.inner_text('#fxSelStatus') and 'unsupported' not in (await pg.inner_text('#fxSelStatus')).lower() and 'not supported' not in (await pg.inner_text('#fxSelStatus')).lower())
        await pg.click('#fxRun'); await pg.wait_for_timeout(300)
        check('Run on strip sends exactly the documented mode packet', pkt_mode(int(k1[1:])) in await writes(pg), (await writes(pg))[:4])
        check('the row now carries SENT, the selection is unchanged', await pg.locator('#fxList .fxRow[data-key="%s"] .mk.sent' % k1).count() == 1 and await selkey(pg) == k1)
        await pg.click('#fxList .fxRow >> nth=5'); await pg.wait_for_timeout(150); k2 = await selkey(pg)
        sent_row = await pg.eval_on_selector_all('.mk.sent', 'e=>e.map(x=>x.closest(".fxRow").dataset.key)')
        check('selected and sent are different things: SENT stays on the first row while another is selected', k2 != k1 and sent_row == [k1], [k1, k2, sent_row])
        s = await pg.inner_text('#fxSelSent')
        check('the panel names the last command sent and says the strip does not confirm', ML['modes'][k1[1:]][1] in s and 'does not confirm' in s, s)
        await pg.click('#t-color'); await pg.click('#wheel', position={'x': 150, 'y': 150}); await pg.wait_for_timeout(300); await pg.click('#t-fx'); await pg.wait_for_timeout(200)
        check('setting a static colour clears SENT (nothing is claimed about the strip)', await pg.locator('.mk.sent').count() == 0, await pg.inner_text('#fxSelSent'))

        # ---------- every group: the right packet ----------
        ok, bad = True, None
        for g in ML['groupOrder'][:8]:
            await chip(pg, g); await pg.click('#fxList .fxRow >> nth=0'); await clear(pg); await pg.click('#fxRun'); await pg.wait_for_timeout(120)
            want = pkt_mode(int((await selkey(pg))[1:])); got = await writes(pg)
            if want not in got: ok, bad = False, (g, want, got[:3])
        check('the first mode of each of the 8 groups sends its exact packet', ok, bad)

        # ---------- strip scenes ----------
        top_before = await pg.eval_on_selector_all('#scenes .scene', 'e=>e.map(x=>x.textContent)')
        await chip(pg, 'scenes')
        check('Scenes lists Magic Lantern\'s 28 scenes with their names', await names(pg) == [ML['scenes'][str(i)] for i in range(1, 29)])
        check('and says clearly that your saved scenes live elsewhere', 'saved scenes are in the row at the top and in Settings, Scenes' in await pg.inner_text('#fxCatNote'))
        await pg.click('#fxList [data-key="s4"]'); await clear(pg)
        check('a scene has no Favourite, Rename or speed (not applicable)', await pg.is_hidden('#fxFav') and await pg.is_hidden('#fxRename') and await pg.is_hidden('#fxSpeedRow'))
        check('the panel calls it a strip scene', 'Strip scene 4' in await pg.inner_text('#fxSelMeta') and (await pg.inner_text('#fxSelName')) == 'Candlelight')
        await pg.click('#fxRun'); await pg.wait_for_timeout(300)
        check('Run sends the documented scene packet', pkt_scene(4) in await writes(pg), (await writes(pg))[:3])
        check('your own scene chips at the top are untouched', await pg.eval_on_selector_all('#scenes .scene', 'e=>e.map(x=>x.textContent)') == top_before)
        await chip(pg, 'all')
        check('scenes never appear among the modes', not [k for k in await rowkeys(pg) if k.startswith('s')])

        # ---------- search and the verified filter ----------
        await chip(pg, 'all'); await pg.fill('#fxSearch', 'blue'); await pg.wait_for_timeout(150)
        r = await names(pg)
        check('searching "blue" finds only matching names, across every group', len(r) >= 5 and all('blue' in n.lower() for n in r) and 'matches for “blue” in every group' in await pg.inner_text('#fxCatNote'), r[:4])
        check('while a search is active no chip looks selected', await pg.locator('#fxCats [aria-selected=true]').count() == 0)
        await pg.fill('#fxSearch', '143'); await pg.wait_for_timeout(120); check('a number finds that mode', (await rowkeys(pg))[0] == 'm143', await rowkeys(pg))
        await pg.fill('#fxSearch', '#130'); await pg.wait_for_timeout(120); check('"#130" works too', (await rowkeys(pg))[0] == 'm130')
        await pg.fill('#fxSearch', 'candle'); await pg.wait_for_timeout(120)
        check('search also finds strip scenes and tags them', await rowkeys(pg) == ['s4'] and 'Strip scene' in await pg.inner_text('#fxList'))
        await pg.fill('#fxSearch', 'zzzz'); await pg.wait_for_timeout(120)
        check('no match shows a plain message with a way back', 'No effects match' in await pg.inner_text('#fxList') and await pg.locator('#fxClear').count() == 1)
        check('with nothing listed the panel selects nothing and Run is off (no hidden choice can be run)', (await pg.inner_text('#fxSelName')) == 'Choose an effect' and await pg.is_disabled('#fxRun') and await pg.is_hidden('#fxFav'))
        await pg.click('#fxClear'); await pg.wait_for_timeout(150)
        check('Clear restores the full list', len(await rowkeys(pg)) == 213 and await pg.input_value('#fxSearch') == '')
        await pg.fill('#fxSearch', 'blue'); await pg.focus('#fxSearch'); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(120)
        check('Escape clears the search', await pg.input_value('#fxSearch') == '' and len(await rowkeys(pg)) == 213)
        await pg.click('#persistentOnly'); await pg.wait_for_timeout(150)
        check('"Verified only" keeps just the mode you verified (128)', await rowkeys(pg) == ['m128'] and 'only effects you verified' in await pg.inner_text('#fxCatNote'), await rowkeys(pg))
        check('and that mode shows a tick and VERIFIED', await pg.locator('.fxRow .mk.ok').count() == 1 and (await pg.inner_text('#fxSelBadge')) == 'VERIFIED' and 'You confirmed this effect on your strip' in await pg.inner_text('#fxSelStatus'))
        await pg.click('#persistentOnly'); await pg.wait_for_timeout(120)

        # ---------- favourites (the existing modeFav store) ----------
        before_keys = sorted((await state(pg)).keys())
        await chip(pg, 'Flow'); await pg.click('#fxList .fxRow >> nth=1'); fav_key = await selkey(pg); fid = fav_key[1:]
        await pg.click('#fxFav'); await pg.wait_for_timeout(150); st = await state(pg)
        check('Favourite writes to the existing modeFav store', st['modeFav'].get(fid) == 1, st.get('modeFav'))
        check('the Favourites chip counts it and lists it', (await pg.inner_text('#fxCats [data-cat=fav]')).strip().endswith('1')); await chip(pg, 'fav')
        check('with a star on the row', await rowkeys(pg) == [fav_key] and await pg.locator('.fxRow .mk.fav').count() == 1)
        check('no new storage keys were created', sorted((await state(pg)).keys()) == before_keys)
        await pg.reload(); await pg.wait_for_timeout(500); await pg.click('#t-fx'); await pg.wait_for_timeout(150)
        check('after a restart the list opens on Favourites', await pg.get_attribute('#fxCats [data-cat=fav]', 'aria-selected') == 'true' and await rowkeys(pg) == [fav_key])
        await pg.click('#fxFav'); await pg.wait_for_timeout(150)
        check('removing the favourite deletes the key', fid not in (await state(pg))['modeFav'] and 'No favourites yet' in await pg.inner_text('#fxList'))

        # ---------- rename, hide, verified (the existing edit dialog) ----------
        await chip(pg, 'all'); await pg.fill('#fxSearch', '133'); await pg.wait_for_timeout(120); await pg.click('#fxList [data-key="m133"]'); await pg.click('#fxRename'); await pg.wait_for_timeout(200)
        check('the dialog shows the real Magic Lantern number and name', (await pg.inner_text('#dlgForm h3')) == 'Mode 133: 7-Color in Blue Running' and await pg.get_attribute('#dlgForm input[name=n]', 'placeholder') == '7-Color in Blue Running')
        await pg.fill('#dlgForm input[name=n]', 'Night blue'); await pg.click('#okBtn'); await pg.wait_for_timeout(250)
        st = await state(pg)
        check('rename is saved in modeNames and shown in the list and panel', st['modeNames'].get('133') == 'Night blue' and (await names(pg))[0] == 'Night blue' and 'renamed from “7-Color in Blue Running”' in await pg.inner_text('#fxSelMeta'))
        await pg.fill('#fxSearch', 'night'); await pg.wait_for_timeout(120); check('and the new name is searchable', await rowkeys(pg) == ['m133'])
        await pg.fill('#fxSearch', '133'); await pg.click('#fxRename'); await pg.click('#dlgForm input[name=p]'); await pg.click('#dlgForm input[name=h]'); await pg.click('#okBtn'); await pg.wait_for_timeout(250)
        st = await state(pg)
        check('hiding removes it from All and search, and a Hidden chip appears', st['modeHidden'].get('133') == 1 and await pg.locator('#fxCats [data-cat=hidden]').count() == 1 and await rowkeys(pg) == [])
        await pg.fill('#fxSearch', ''); await chip(pg, 'hidden'); check('Hidden lists it so it can be shown again', await rowkeys(pg) == ['m133'])
        await pg.click('#fxRename'); await pg.click('#dlgForm input[name=h]'); await pg.click('#okBtn'); await pg.wait_for_timeout(250)
        check('showing it again removes the Hidden chip', await pg.locator('#fxCats [data-cat=hidden]').count() == 0 and 'modeHidden' in await state(pg) and '133' not in (await state(pg))['modeHidden'])
        await chip(pg, 'all'); await pg.click('#persistentOnly'); await pg.wait_for_timeout(150)
        check('the Verified box in the dialog counts for "Verified only"', sorted(await rowkeys(pg)) == ['m128', 'm133'] and (await state(pg))['modePersistent'].get('133') is True, await rowkeys(pg)); await pg.click('#persistentOnly')

        # ---------- speed ----------
        await chip(pg, 'Run'); await pg.click('#fxList .fxRow >> nth=0'); await clear(pg)
        await js(pg, "(() => { const r = document.getElementById('sp'); r.value = 70; r.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()"); await pg.wait_for_timeout(200)
        check('the speed control sits in the selected-effect panel and still sends the speed packet', await pg.is_visible('#sp') and '7e040246ffffff00ef' in await writes(pg) and (await state(pg))['speed'] == 70, (await writes(pg))[:3])

        # ---------- keyboard ----------
        await chip(pg, 'Water'); await pg.focus('#fxList .fxRow[aria-selected=true]'); k0 = await selkey(pg)
        check('the list is one tab stop (only the selected row is focusable)', await pg.locator('#fxList .fxRow[tabindex="0"]').count() == 1)
        await pg.keyboard.press('ArrowDown'); await pg.wait_for_timeout(100); k1 = await selkey(pg); fo = await js(pg, "document.activeElement.dataset.key")
        check('ArrowDown selects and focuses the next row', k1 != k0 and fo == k1 and (await rowkeys(pg)).index(k1) == (await rowkeys(pg)).index(k0) + 1)
        await pg.keyboard.press('End'); await pg.wait_for_timeout(100); check('End goes to the last row', await selkey(pg) == (await rowkeys(pg))[-1])
        await pg.keyboard.press('Home'); await pg.wait_for_timeout(100); check('Home goes to the first row', await selkey(pg) == (await rowkeys(pg))[0])
        await pg.focus('#fxCats [data-cat=Water]'); await pg.keyboard.press('ArrowRight'); await pg.wait_for_timeout(150)
        check('ArrowRight moves to the next chip and shows it', await pg.get_attribute('#fxCats [data-cat=Flow]', 'aria-selected') == 'true' and await js(pg, "document.activeElement.dataset.cat") == 'Flow')
        await pg.focus('#fxRun'); await clear(pg); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
        check('Enter on Run on strip runs the selected effect', any(w.startswith('7e0503') for w in await writes(pg)))

        # ---------- guards ----------
        await b.close(); b = await p.chromium.launch()
        pg, errs2 = await new_page(b, connect=False); await clear(pg); await pg.click('#fxRun'); await pg.wait_for_timeout(300)
        check('not connected: Run says so, sends nothing and marks nothing as sent', 'Connect the strip first' in await toast(pg) and await writes(pg) == [] and await pg.locator('.mk.sent').count() == 0)
        pg, errs3 = await new_page(b, storage={'driveMode': 'driving'}); await clear(pg); await pg.click('#fxRun'); await pg.wait_for_timeout(300)
        check('Driving: effects are refused (parked-only) and nothing is marked as sent', 'parked-only' in (await toast(pg)).lower() and not any(w.startswith('7e0503') for w in await writes(pg)) and await pg.locator('.mk.sent').count() == 0)
        pg, errs4 = await new_page(b, storage={'verify': {'mode:130': {'moves': False, 'at': 'x'}}}); await chip(pg, 'RunBack'); await pg.click('#fxList [data-key="m130"]')
        check('an effect you recorded as not working says exactly that', (await pg.inner_text('#fxSelBadge')) == 'DOES NOT WORK' and 'you recorded' in (await pg.inner_text('#fxSelStatus')).lower() and await pg.locator('#fxList [data-key="m130"] .mk.bad').count() == 1)

        # ---------- saved data from real installs ----------
        pg, errs5 = await new_page(b, storage=OLD)
        check('real 1.1.5 data: the list opens on Favourites with the renamed mode', await pg.get_attribute('#fxCats [data-cat=fav]', 'aria-selected') == 'true' and await names(pg) == ['My flow'], await names(pg))
        check('the selection matches what you see, and the last-sent scene is described separately', (await pg.inner_text('#fxSelName')) == 'My flow' and 'Last effect command sent: “Rainbow” (scene 11)' in await pg.inner_text('#fxSelSent'), await pg.inner_text('#fxSelSent'))
        st = await state(pg); check('names, favourites, verification and the running scene are all still stored', st['modeNames'] == OLD['modeNames'] and st['modeFav'] == OLD['modeFav'] and st['verify']['mode:103']['appClose'] is True and st['native']['id'] == 11)
        pg, errs6 = await new_page(b, storage={'modeFav': {'10': 1, '133': 1}})
        await pg.click('#t-color'); await pg.click('#btnCar'); await pg.wait_for_timeout(200); car = await pg.eval_on_selector_all('#carGrid button', 'e=>e.map(x=>x.textContent)')
        check('a favourite outside the old 128 to 155 range works everywhere (list and Car mode)', ML['modes']['10'][1] in ' '.join(car) and len(car) >= 2, car)

        # ---------- responsive ----------
        bad = []
        for w in (320, 360, 390, 412, 768):
            pg, e7 = await new_page(b, width=w); await chip(pg, 'Run'); await pg.click('#fxList .fxRow >> nth=1')
            m = await js(pg, """(() => { const vw = innerWidth, r = (s) => document.querySelector(s).getBoundingClientRect();
              const over = [...document.querySelectorAll('#fxBrowser *')].filter(e => !e.closest('#fxCats') && e.getBoundingClientRect().right > vw + 1).length;
              return { docOver: document.documentElement.scrollWidth > vw + 1, over, search: r('#fxSearch').width, run: r('#fxRun').height, fav: r('#fxFav').height, ren: r('#fxRename').height, chip: r('#fxCats .fxCat').height, list: r('#fxList').height,
                       panelInside: r('#fxSel').right <= vw + 1 && r('#fxSel').left >= -1 }; })()""")
            if m['docOver'] or m['over'] or m['search'] < 110 or min(m['run'], m['fav'], m['ren'], m['chip']) < 44 or m['list'] > 361 or not m['panelInside'] or e7: bad.append((w, m, e7))
        check('320, 360, 390, 412 and 768 px: no overflow, touch-sized controls, list within its maximum height', not bad, bad)
        pg, e8 = await new_page(b); h = await js(pg, "document.documentElement.scrollHeight")
        check('the Effects page is much shorter than before (was 2038 px at 390 wide)', h < 1750, h)
        check('no page errors anywhere', not (errs + errs2 + errs3 + errs4 + errs5 + errs6 + e8), (errs + errs2 + errs3 + errs4 + errs5 + errs6 + e8))
        await b.close()
    print(f'\n{sum(results)}/{len(results)} passed'); sys.exit(0 if all(results) else 1)
asyncio.run(main())
