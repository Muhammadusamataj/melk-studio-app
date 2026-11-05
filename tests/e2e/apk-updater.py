#!/usr/bin/env python3
"""End-to-end checks for Settings, Software updates: the separate Web update and App update cards, the full download and
install flow, permission guidance, cancellation, failures, and the safe handling of Bluetooth and music.
All Android calls are mocked (tests/e2e/apk_mock.py). Run from the project root: python3 tests/e2e/apk-updater.py"""
import asyncio, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from apk_mock import APK_MOCK
import os
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
URL = (ROOT / 'www' / 'index.html').as_uri()
PREVIEW = (ROOT / 'dist' / 'MELK-Studio-standalone.html').as_uri()
results = []
def check(name, ok, detail=''):
    results.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + name + (' | ' + str(detail)[:300] if detail and not ok else ''))

async def new_page(b, storage=None, no_plugin=False, native=True, url=URL, extra_js=None):
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}); pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    if native:
        if no_plugin: await pg.add_init_script('window.__NO_APK_PLUGIN = true;')
        await pg.add_init_script(APK_MOCK)
    if extra_js: await pg.add_init_script(extra_js)
    if storage: await pg.add_init_script("for (const [k,v] of Object.entries(%s)) localStorage.setItem(k, v)" % json.dumps(storage))
    await pg.goto(url); await pg.wait_for_timeout(400)
    return pg, errs
async def to_updates(pg):
    await pg.click('#t-settings'); await pg.click('#tab-settings [data-open=updates]'); await pg.wait_for_timeout(200)
async def status(pg): return (await pg.inner_text('#apkStatus')).strip()
async def vis(pg, sel): return await pg.is_visible(sel)
async def js(pg, code): return await pg.evaluate(code)
async def go_hidden_visible(pg):
    await pg.evaluate("Object.defineProperty(document,'hidden',{value:true,configurable:true}); document.dispatchEvent(new Event('visibilitychange'))"); await pg.wait_for_timeout(100)
    await pg.evaluate("Object.defineProperty(document,'hidden',{value:false,configurable:true}); document.dispatchEvent(new Event('visibilitychange'))"); await pg.wait_for_timeout(250)
async def prepare_ready(pg):
    await pg.click('#apkCheck'); await pg.wait_for_timeout(300); await pg.click('#apkDownload'); await pg.wait_for_selector('#apkInstall', state='visible', timeout=5000)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel=os.environ.get('MELK_BROWSER_CHANNEL'))

        # ---- 1. two separate options
        pg, errs = await new_page(b); await to_updates(pg)
        check('Web update and App update are two separate cards', await pg.locator('#webUpdateCard #otaCheck').count() == 1 and await pg.locator('#apkCard #apkCheck').count() == 1 and await pg.locator('#apkCard #otaCheck').count() == 0 and await pg.locator('#webUpdateCard #apkCheck').count() == 0)
        heads = await pg.eval_on_selector_all('#page-updates .head h2', 'e=>e.map(x=>x.textContent)')
        check('the cards are clearly named', heads[:2] == ['Web update', 'App update'], heads)
        web, app = await pg.inner_text('#webUpdateCard .hint'), await pg.inner_text('#apkCard .hint')
        check('each card says in one line what it is for', 'Bluetooth stays connected' in web and 'installed through Android' in app, [web, app])
        check('there is no separate wall of explanation above the cards', await pg.locator('#page-updates .pageBody > .notice').count() == 0)
        check('the web update controls are unchanged', all([await pg.locator(f'#{i}').count() == 1 for i in ['otaCheck', 'otaInstall', 'otaStatus', 'otaVersion', 'otaHost', 'otaCapability', 'otaProgress']]))
        check('the installed version is shown', 'v1.1.7 (build 10107)' in await pg.inner_text('#apkInstalled'), await pg.inner_text('#apkInstalled'))
        det = await pg.inner_text('#apkCard details')
        await pg.evaluate("document.querySelector('#apkCard details').open = true"); det = await pg.inner_text('#apkCard details')
        check('details show package, build type and the signing key fingerprint (shortened)', 'com.bleled.com' in det and 'Release build' in det and '3fa1c07b…6e5f' in det, det)
        check('no page errors (structure)', not errs, errs)

        # ---- 2. not available
        pg, errs = await new_page(b, no_plugin=True); await to_updates(pg)
        check('an APK without the plugin says so and hides the buttons', 'not available in this version' in await status(pg) and not await vis(pg, '#apkCheck') and await pg.inner_text('#apkBadge') == 'NOT AVAILABLE')
        check('the web update still works there', await vis(pg, '#otaCheck'))
        pg, errs = await new_page(b, native=False); await to_updates(pg)
        check('in a plain browser it says app updates need the Android app', 'only work inside the Android app' in await status(pg))

        # ---- 3. happy path through permission, cancel and install
        pg, errs = await new_page(b)
        before = await js(pg, "(() => { const s = JSON.parse(localStorage.getItem('melk.studio.v1')||'{}'); return JSON.stringify([s.scenes, s.palette, s.verify, s.vehicles]); })()")
        await pg.click('#btnConn'); await pg.wait_for_timeout(700)
        await pg.click('#t-music'); await pg.select_option('#musicSource', 'microphone'); await pg.click('#musicBtn'); await pg.wait_for_timeout(300)
        check('setup: strip connected and music listening', await js(pg, 'window.__ble.connects') == 1 and await js(pg, 'window.__audio.start') >= 1)
        await js(pg, 'window.__order.length = 0')   # starting music logs its own audio.stop; only what happens from here matters
        await to_updates(pg)
        await pg.click('#apkCheck'); await pg.wait_for_timeout(300)
        check('a newer build is offered with its size', 'v1.1.8 (build 10108, 48 MB)' in await pg.inner_text('#apkAvailable') and await vis(pg, '#apkDownload') and not await vis(pg, '#apkInstall'), await pg.inner_text('#apkAvailable'))
        check('the manifest is fetched from the separate apk folder, not the ZIP manifest', any('/apk/apk-version.json' in c[1] and 'melk-version' not in c[1] for c in await js(pg, 'window.__apk.calls') if c[0] == 'http'))
        # hold a download open to look at the progress bar
        await js(pg, "window.__apk.download = 'hold'")
        await pg.click('#apkDownload'); await pg.wait_for_timeout(300)
        bar = await js(pg, "document.getElementById('apkProgress').value")
        check('progress bar shows the percentage while downloading', bar == 37 and (await pg.inner_text('#apkPercent')) == '37%', [bar, await pg.inner_text('#apkPercent')])
        check('only Cancel is offered while downloading', await vis(pg, '#apkCancel') and not await vis(pg, '#apkInstall') and not await vis(pg, '#apkDownload') and not await vis(pg, '#apkCheck'))
        await pg.click('#apkCancel'); await pg.wait_for_timeout(300)
        check('cancelling stops the download and says so', 'Download cancelled' in await status(pg) and await vis(pg, '#apkDownload') and not await vis(pg, '#apkProgressRow'), await status(pg))
        # download 0 -> 100 and watch the numbers
        await js(pg, "window.__apk.download = 'ok'; window.__pv = []; new MutationObserver(() => window.__pv.push(document.getElementById('apkPercent').textContent)).observe(document.getElementById('apkPercent'), {childList: true, characterData: true, subtree: true});")
        await pg.click('#apkDownload'); await pg.wait_for_selector('#apkInstall', state='visible', timeout=6000)
        pv = [int(x.rstrip('%')) for x in await js(pg, 'window.__pv') if x.endswith('%')]
        check('the percentage climbs from 0 to 100', pv and pv[0] <= 25 and pv[-1] == 100 and pv == sorted(pv), pv)
        dl = [c for c in await js(pg, 'window.__apk.calls') if c[0] == 'download'][-1][1]
        check('the plugin gets the exact manifest values', dl['sha256'] == 'b' * 64 and dl['size'] == 48 * 1048576 and dl['versionCode'] == 10108 and dl['packageName'] == 'com.bleled.com' and dl['url'].endswith('MELK-Studio-1.1.8.apk'), dl)
        check('the ready message says what happens next', 'Downloaded and verified' in await status(pg) and 'Bluetooth disconnects' in await status(pg), await status(pg))
        # permission guide first
        await js(pg, "window.__apk.info.canInstall = false")
        await pg.click('#apkInstall'); await pg.wait_for_timeout(300)
        check('without permission a guide is shown and nothing is closed or stopped', await vis(pg, '#apkPermission') and await js(pg, 'window.__order') == [] and await js(pg, 'window.__ble.disconnects') == 0)
        await pg.click('#apkPermOpen'); await pg.wait_for_timeout(100)
        check('the button opens the Android settings screen', any(c[0] == 'openSettings' for c in await js(pg, 'window.__apk.calls')))
        await js(pg, "window.__apk.info.canInstall = true"); await go_hidden_visible(pg)
        check('coming back after allowing continues the update', 'Permission allowed' in await status(pg) and await vis(pg, '#apkInstall') and not await vis(pg, '#apkPermission'), await status(pg))
        # install: order matters
        await pg.click('#apkInstall'); await pg.wait_for_timeout(500)
        order = await js(pg, 'window.__order')
        check('music is stopped, Bluetooth closed, and only then the Android installer opens', order == ['audio.stop', 'ble.disconnect', 'apk.install'] or (order[-2:] == ['ble.disconnect', 'apk.install'] and 'audio.stop' in order), order)
        check('the card tells the user what is happening', 'Android’s installer' in await status(pg) and not await vis(pg, '#apkInstall'))
        check('the strip shows as disconnected, but the paired strip is remembered', (await pg.inner_text('#connLabel')) == 'Connect strip' and await js(pg, "localStorage.getItem('melk.native.deviceId')") == 'AA:BB:CC:DD:EE:01')
        n = len(await js(pg, 'window.__w')); await pg.wait_for_timeout(400)
        check('nothing is sent to the strip while the installer is open', len(await js(pg, 'window.__w')) == n)
        check('the pending update is remembered across the app being replaced', json.loads(await js(pg, "localStorage.getItem('melk.apk.pending')"))['code'] == 10108)
        # the user cancels in Android: back in the app
        await go_hidden_visible(pg); await pg.wait_for_timeout(1700)
        check('cancelling in Android is detected and reconnects the strip', 'not completed' in await status(pg) and await js(pg, 'window.__ble.connects') == 2 and 'MELK' in await pg.inner_text('#connLabel'), [await status(pg), await js(pg, 'window.__ble.connects'), await pg.inner_text('#connLabel')])
        check('and the install can be tried again', await vis(pg, '#apkInstall'))
        after = await js(pg, "(() => { const s = JSON.parse(localStorage.getItem('melk.studio.v1')||'{}'); return JSON.stringify([s.scenes, s.palette, s.verify, s.vehicles]); })()")
        check('scenes, colours, verification and vehicles are untouched by the whole update flow', before == after)
        check('no page errors (happy path)', not errs, errs)

        # ---- 4. failures
        for mode, text in [('checksum', 'deleted. Nothing was installed'), ('nospace', 'Not enough free storage. About 80 MB'), ('network', 'connection was lost'), ('invalid', 'different key')]:
            pg, errs = await new_page(b); await js(pg, f"window.__apk.download = '{mode}'"); await to_updates(pg)
            await pg.click('#apkCheck'); await pg.wait_for_timeout(250); await pg.click('#apkDownload'); await pg.wait_for_timeout(500)
            check(f'{mode}: a clear message, no install offered, retry possible', text in await status(pg) and not await vis(pg, '#apkInstall') and await vis(pg, '#apkDownload') and not await vis(pg, '#apkProgressRow'), await status(pg))
            check(f'{mode}: the app keeps working and nothing was installed', not any(c[0] == 'install' for c in await js(pg, 'window.__apk.calls')) and not errs, errs)

        # ---- 5. bad or irrelevant manifests
        for label, patch, text in [('other app', {'packageName': 'com.other.app'}, 'different app'), ('bad checksum', {'sha256': 'abc'}, 'checksum'), ('other server', {'url': 'https://evil.example/a.apk'}, 'same server'), ('http link', {'url': 'http://muhammadusamataj.github.io/melk-studio-ota-/apk/a.apk'}, 'https')]:
            pg, errs = await new_page(b); await js(pg, "Object.assign(window.__apk.manifest, %s)" % json.dumps(patch)); await to_updates(pg); await pg.click('#apkCheck'); await pg.wait_for_timeout(300)
            check(f'manifest "{label}" is refused with a reason and no download button', text in await status(pg) and not await vis(pg, '#apkDownload'), await status(pg))
        pg, errs = await new_page(b); await js(pg, "window.__apk.manifest.versionCode = 10107"); await to_updates(pg); await pg.click('#apkCheck'); await pg.wait_for_timeout(300)
        check('same or older build: "up to date"', 'up to date (build 10107)' in await status(pg) and not await vis(pg, '#apkDownload'))
        pg, errs = await new_page(b); await js(pg, "window.__apk.httpFail = 'Server answered 404'"); await to_updates(pg); await pg.click('#apkCheck'); await pg.wait_for_timeout(300)
        check('missing release feed explains that no APK is published, without claiming up to date', 'No full-app update has been published' in await status(pg) and not await vis(pg, '#apkDownload'))

        # Signing incompatibility is visible before any transfer, without an uninstall action.
        pg, errs = await new_page(b); await js(pg, "window.__apk.manifest.signingCertSha256 = 'a'.repeat(64)"); await to_updates(pg); await pg.click('#apkCheck'); await pg.wait_for_timeout(300)
        check('different manifest signer blocks download and explains backup/migration', 'cannot update this installation in place' in await status(pg) and not await vis(pg, '#apkDownload') and not any(c[0] == 'download' for c in await js(pg, 'window.__apk.calls')))
        pg, errs = await new_page(b); await js(pg, "window.__apk.manifest.signingCertSha256 = window.__apk.info.signingSha256[0]"); await to_updates(pg); await pg.click('#apkCheck'); await pg.wait_for_timeout(300)
        check('same signer allows the normal update flow', await vis(pg, '#apkDownload'))

        # ---- 6. after the app was replaced
        pg, errs = await new_page(b, storage={'melk.apk.pending': json.dumps({'code': 10108, 'name': '1.1.8'})},
                                  extra_js="window.__apk.info.versionCode = 10108; window.__apk.info.versionName = '1.1.8';")
        await to_updates(pg)
        check('after the update the next start says so and removes the downloaded file', 'updated to v1.1.8' in await status(pg) and any(c[0] == 'cleanup' for c in await js(pg, 'window.__apk.calls')) and await js(pg, "localStorage.getItem('melk.apk.pending')") is None, [await status(pg)])

        # ---- 7. the browser preview simulation
        pg, errs = await new_page(b, native=False, url=PREVIEW); await to_updates(pg)
        check('the standalone preview simulates the card (and says PREVIEW)', await pg.inner_text('#apkBadge') == 'PREVIEW' and 'v1.1.7' in await pg.inner_text('#apkInstalled'), [await pg.inner_text('#apkBadge'), await pg.inner_text('#apkInstalled')])
        await pg.click('#apkCheck'); await pg.wait_for_timeout(300); await pg.click('#apkDownload'); await pg.wait_for_timeout(1200)
        mid = int((await pg.inner_text('#apkPercent')).rstrip('%'))
        check('the preview shows download progress', 0 < mid < 100, mid)
        await pg.wait_for_selector('#apkInstall', state='visible', timeout=9000); await pg.click('#apkInstall'); await pg.wait_for_timeout(300)
        check('the preview shows the permission guide', await vis(pg, '#apkPermission'))
        check('the real page has no preview flag', 'MELK_PREVIEW' not in (ROOT / 'www' / 'index.html').read_text())
        await b.close()
    print(f'\n{sum(results)}/{len(results)} passed'); sys.exit(0 if all(results) else 1)
asyncio.run(main())
