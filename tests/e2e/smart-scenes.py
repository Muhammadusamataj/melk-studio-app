"""Smart Scenes and Music UI integration against explicitly mocked native capture and BLE."""
import asyncio
import json
import pathlib
from playwright.async_api import async_playwright
from apk_mock import APK_MOCK

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'tests/e2e/out'
OUT.mkdir(exist_ok=True)
SMART = r"""
window.__capture={sources:[],stops:0,deny:false,listeners:{}};
window.Capacitor.Plugins.SmartAudio={
 getCapabilities:async()=>({apiVersion:2,playback:true,microphone:true}),
 start:async o=>{if(__capture.deny)throw Error('Capture consent declined');__capture.sources.push(o.source);return o;},
 stop:async()=>{__capture.stops++;},
 addListener:async(k,fn)=>{__capture.listeners[k]=fn;return{remove:async()=>{delete __capture.listeners[k];}};}
};
"""

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width':390,'height':844})
        page = await context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.add_init_script(APK_MOCK + SMART)
        await page.goto((ROOT/'www/index.html').as_uri())
        await page.click('#btnConn'); await page.wait_for_timeout(900)
        labels = await page.locator('#scenes button').all_text_contents()
        assert labels == ['Auto','Sunrise','Ocean','Rainbow','Party','All 28'], labels
        await page.screenshot(path=str(OUT/'quick-scenes.png'), full_page=True)
        await page.click('#quickEdit')
        for i, value in enumerate(['16','11','6','']): await page.select_option(f'#quickSlot{i}', value)
        await page.click('#saveQuick')
        await page.click('#scenes button:has-text("All 28")')
        assert await page.locator('#fxList .fxRow').count() == 28
        assert await page.get_attribute('#fxCats [data-cat=scenes]', 'aria-selected') == 'true'
        await page.click('#fxList [data-key=s4]'); await page.click('#fxQuick')
        await page.click('#fxFav'); await page.click('#fxRun'); await page.wait_for_timeout(200)
        assert '7e05310407ffff01ef' in await page.evaluate('__w')
        state = json.loads(await page.evaluate("localStorage.getItem('melk.studio.v1')"))
        assert state['smartScenes']['quick'] == [16,11,6,4]
        assert state['smartScenes']['recent'][0] == 4 and 4 in state['nativeSceneFav']
        await page.reload(); await page.wait_for_timeout(300)
        await page.click('#btnConn'); await page.wait_for_timeout(900)
        await page.click('#t-color'); await page.click('#scenes button:has-text("Auto")')
        assert await page.locator('#rotationScenes input').count() == 28
        await page.select_option('#rotationInterval','30000')
        await page.click('#rotationStart'); await page.wait_for_timeout(200)
        assert 'Rotating' in await page.inner_text('#rotationStatus')
        await page.screenshot(path=str(OUT/'rotation.png'),full_page=True)
        await page.click('#rotationStop')
        assert 'Stopped' in await page.inner_text('#rotationStatus')
        await page.click('#page-rotation [data-back]'); await page.click('#t-music')
        assert await page.input_value('#musicSource') == 'auto'
        assert await page.get_attribute('[data-ms=smart]','aria-pressed') == 'true'
        await page.click('#musicBtn'); await page.wait_for_timeout(200)
        assert await page.evaluate('__capture.sources') == ['device']
        for i in range(8):
            await page.evaluate("__capture.listeners.frame({source:'device',rms:.2,energy:.6,bass:.8,mid:.3,treble:.15,beat:true,silence:false,spectrum:Array(16).fill(.6)})")
            await page.wait_for_timeout(150)
        assert await page.input_value('#music-bass') == '0.8'
        assert await page.evaluate("document.getElementById('musicSpectrum').getContext('2d').getImageData(2,50,1,1).data[3]") > 0
        await page.screenshot(path=str(OUT/'music-sync.png'),full_page=True)
        await page.evaluate("Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'))")
        await page.wait_for_timeout(200)
        assert await page.inner_text('#musicBtn') == 'Start listening'
        await page.evaluate("Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));__capture.deny=true")
        await page.click('#musicBtn'); await page.wait_for_timeout(200)
        assert 'declined' in await page.inner_text('#musicNotice')
        assert await page.evaluate('__capture.sources') == ['device']
        await page.evaluate('__capture.deny=false')
        await page.click('#musicFallback'); await page.wait_for_timeout(200)
        assert await page.evaluate('__capture.sources') == ['device','microphone']
        await page.click('#musicBtn'); await page.click('#t-color'); await page.click('#btnCar'); await page.click('#carDriving'); await page.click('#carExit')
        assert await page.locator('#quickEdit').is_disabled()
        assert await page.eval_on_selector_all('#scenes button','es=>es.every(e=>e.disabled)')
        await page.click('#t-fx')
        assert await page.locator('#tab-fx').is_hidden()
        assert not errors, errors
        await browser.close()
    print('PASS Quick Scenes persistence/recents, native packets, rotation controls, real-data visual rendering, source consent/fallback, background cleanup and driving guards')

asyncio.run(main())
