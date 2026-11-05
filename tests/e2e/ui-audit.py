#!/usr/bin/env python3
"""Automated UI audit in headless Chromium at five phone/tablet widths.
Checks every main tab, every Settings page, the Lab, Developer options, Car mode and two dialogs for:
horizontal overflow, content past the screen edge, overlapping text, clipped text, tap targets under 40 px,
controls without an accessible name, duplicate ids, and console errors.
Run from the project root:  python3 tests/e2e/ui-audit.py"""
import asyncio, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from apk_mock import APK_MOCK
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
URL = (ROOT / 'www' / 'index.html').as_uri()
SIZES = [(320, 640), (360, 740), (390, 844), (412, 915), (768, 1024)]
MIN_TARGET = 40

AUDIT = """
(rootSel) => {
  const root = document.querySelector(rootSel); const issues = [];
  if (!root) return ['missing root ' + rootSel];
  const vw = window.innerWidth;
  // Content of a closed <details> keeps a layout box in Chromium but is not visible, so it is treated as hidden.
  const inClosed = (el) => { for (let a = el.closest('details'); a; a = a.parentElement && a.parentElement.closest('details')) { if (!a.open) { const sm = Array.from(a.children).find((c) => c.tagName === 'SUMMARY'); if (!(sm && sm.contains(el))) return true; } } return false; };
  const shown = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden]') && !inClosed(el); };
  const label = (el) => (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/)[0] : '')) + ' "' + (el.textContent || '').trim().slice(0, 28) + '"';
  const scrollers = ['.scenes', '.log', 'textarea', '.fxCats', '.fxList'];
  // 1. horizontal overflow of the scroll container
  const sc = rootSel === '.app' ? document.documentElement : root;
  if (sc.scrollWidth > sc.clientWidth + 1) issues.push('horizontal overflow: scrollWidth ' + sc.scrollWidth + ' > ' + sc.clientWidth);
  const all = Array.from(root.querySelectorAll('*')).filter(shown);
  // 2. past the screen edge
  all.forEach((el) => { if (scrollers.some((s) => el.closest(s)) || el.closest('.tabs') && false) return; const r = el.getBoundingClientRect(); if (r.right > vw + 1 || r.left < -1) issues.push('off-screen: ' + label(el) + ' [' + Math.round(r.left) + ',' + Math.round(r.right) + ']'); });
  // 3. tap targets
  const tapSel = 'button, summary, select, a[href], [role=tab], input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=range])';
  all.filter((el) => el.matches(tapSel)).forEach((el) => { if (el.closest('.scenes') && false) return; const r = el.getBoundingClientRect(); if (r.height < MIN || r.width < MIN) issues.push('small target ' + Math.round(r.width) + 'x' + Math.round(r.height) + ': ' + label(el)); });
  all.filter((el) => el.matches('input[type=checkbox]')).forEach((el) => { const r = (el.closest('label') || el).getBoundingClientRect(); if (r.height < MIN) issues.push('small switch row ' + Math.round(r.height) + ': ' + label(el)); });
  all.filter((el) => el.matches('input[type=range]')).forEach((el) => { const r = el.getBoundingClientRect(); if (r.height < MIN) issues.push('small slider ' + Math.round(r.height) + ': ' + label(el)); });
  // 4. accessible names
  all.filter((el) => el.matches('button, [role=tab], summary')).forEach((el) => { const n = (el.getAttribute('aria-label') || el.textContent || '').trim(); if (!n) issues.push('no accessible name: ' + label(el)); });
  all.filter((el) => el.matches('input:not([type=hidden]), select, textarea')).forEach((el) => { const has = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || (el.labels && el.labels.length) || el.closest('label'); if (!has) issues.push('no label: ' + label(el)); });
  // 5. clipped text
  all.filter((el) => el.matches('button, b, span, small, strong, p, label, h1, h2, h3, summary')).forEach((el) => {
    const cs = getComputedStyle(el); if (cs.overflow !== 'visible' && cs.textOverflow !== 'ellipsis' && (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) && !el.closest('.scenes')) issues.push('clipped text: ' + label(el));
  });
  // 6. overlapping text
  const rects = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode; if (!n.textContent.trim()) continue; const p = n.parentElement;
    if (!p || !shown(p) || p.closest('.toast, .tabs, .pageBar, .scenes, option, script, style')) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    const box = p.closest('.fxList, .fxCats'); const clip = box ? box.getBoundingClientRect() : null;   // text scrolled out of a scroll box is not visible
    Array.from(rg.getClientRects()).forEach((r) => { if (clip && (r.bottom <= clip.top || r.top >= clip.bottom || r.right <= clip.left || r.left >= clip.right)) return; if (r.width > 1 && r.height > 1) rects.push({ r, p, t: n.textContent.trim().slice(0, 24) }); });
  }
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j]; if (a.p === b.p || a.p.contains(b.p) || b.p.contains(a.p)) continue;
    const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (w > 3 && h > 3) issues.push('text overlap: "' + a.t + '" with "' + b.t + '"');
  }
  // 7. duplicate ids
  const ids = {}; document.querySelectorAll('[id]').forEach((e) => { ids[e.id] = (ids[e.id] || 0) + 1; });
  Object.keys(ids).filter((k) => ids[k] > 1).forEach((k) => issues.push('duplicate id: ' + k));
  return Array.from(new Set(issues));
}
""".replace('MIN', str(MIN_TARGET))

total = []
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for (w, h) in SIZES:
            ctx = await b.new_context(viewport={'width': w, 'height': h}); pg = await ctx.new_page()
            errs = []; pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e))); pg.on('console', lambda m: errs.append('CONSOLE ' + m.text) if m.type == 'error' else None)
            await pg.goto(URL); await pg.wait_for_timeout(400)
            html_lang = await pg.evaluate('document.documentElement.lang')
            if not html_lang: total.append((w, 'document', ['html has no lang']))
            async def audit(name, sel):
                await pg.wait_for_timeout(150)
                iss = await pg.evaluate(AUDIT, sel)
                total.append((w, name, iss)); print(f'{w:>4}px  {name:<22} {"ok" if not iss else str(len(iss)) + " issue(s)"}')
                for i in iss[:6]: print('        -', i)
            await audit('colour (disconnected)', '.app')
            await pg.click('#btnConn'); await pg.wait_for_timeout(300); await pg.wait_for_timeout(2800)   # let the toast go
            await audit('colour', '.app')
            await pg.click('#t-fx'); await audit('effects built-in', '.app')
            await pg.click('#fxCats [data-cat=scenes]'); await audit('effects: scenes', '.app')
            await pg.click('#fxCats [data-cat=Run]'); await pg.click('#fxList .fxRow >> nth=1'); await audit('effects: group+selected', '.app')
            await pg.fill('#fxSearch', 'zzzz'); await audit('effects: no match', '.app'); await pg.fill('#fxSearch', ''); await pg.click('#fxCats [data-cat=all]')
            await pg.click('#segMine'); await audit('effects mine', '.app'); await pg.click('#segBuilt')
            await pg.click('#t-music'); await audit('music', '.app')
            await pg.click('#t-settings'); await audit('settings', '.app')
            for i in range(7): await pg.click('#aboutVersion')
            await pg.wait_for_timeout(2800)
            await audit('settings + dev row', '.app')
            for pid in ['connection', 'vehicle', 'scenes', 'automation', 'backup', 'updates', 'lab', 'dev']:
                await pg.click(f'#tab-settings [data-open={pid}]'); await pg.wait_for_timeout(120)
                if pid == 'lab':
                    await pg.evaluate("document.querySelectorAll('#hwRbList .rb').forEach(d=>d.open=true)")
                if pid == 'scenes':
                    await pg.evaluate("document.querySelectorAll('#sceneList .srMore').forEach(d=>d.open=true)")
                await audit('page: ' + pid, '#page-' + pid)
                await pg.click(f'#page-{pid} [data-back]')
            await pg.click('#btnCar'); await audit('car parked', '#car'); await pg.click('#carDriving'); await audit('car driving', '#car'); await pg.click('#carParked'); await pg.click('#carExit')
            await pg.click('#t-settings'); await pg.click('#tab-settings [data-open=scenes]'); await pg.click('#sceneSave'); await audit('dialog: save scene', '#dlg'); await pg.keyboard.press('Escape')
            await pg.click('#sceneImport'); await audit('dialog: import scene', '#dlg'); await pg.keyboard.press('Escape')
            if errs: total.append((w, 'console', errs))
            await ctx.close()

            # ---- the App update card in every state, with the Android bridge mocked
            ctx2 = await b.new_context(viewport={'width': w, 'height': h}); p2 = await ctx2.new_page(); errs2 = []
            p2.on('pageerror', lambda e: errs2.append('PAGEERR ' + str(e))); p2.on('console', lambda m: errs2.append('CONSOLE ' + m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
            await p2.add_init_script(APK_MOCK); await p2.goto(URL); await p2.wait_for_timeout(400)
            async def audit2(name):
                await p2.wait_for_timeout(200)
                iss = await p2.evaluate(AUDIT, '#page-updates')
                total.append((w, 'app update: ' + name, iss)); print(f'{w:>4}px  app update: {name:<16} {"ok" if not iss else str(len(iss)) + " issue(s)"}')
                for i in iss[:6]: print('        -', i)
            await p2.click('#t-settings'); await p2.click('#tab-settings [data-open=updates]'); await p2.wait_for_timeout(250)
            await audit2('idle')
            await p2.evaluate("document.querySelector('#apkCard details').open = true"); await audit2('details open'); await p2.evaluate("document.querySelector('#apkCard details').open = false")
            await p2.click('#apkCheck'); await p2.wait_for_timeout(300); await audit2('available')
            await p2.evaluate("window.__apk.download = 'hold'"); await p2.click('#apkDownload'); await p2.wait_for_timeout(300); await audit2('downloading 37%')
            await p2.click('#apkCancel'); await p2.wait_for_timeout(250)
            await p2.evaluate("window.__apk.download = 'ok'"); await p2.click('#apkDownload'); await p2.wait_for_selector('#apkInstall', state='visible', timeout=6000); await audit2('ready')
            await p2.evaluate("window.__apk.info.canInstall = false"); await p2.click('#apkInstall'); await p2.wait_for_timeout(300); await audit2('permission guide')
            await p2.evaluate("document.querySelector('#apkCard details').open = true"); await p2.click('#apkCleanup'); await p2.wait_for_timeout(200)
            await p2.evaluate("window.__apk.download = 'invalid'"); await p2.click('#apkCheck'); await p2.wait_for_timeout(250); await p2.click('#apkDownload'); await p2.wait_for_timeout(400); await audit2('blocked package')
            await p2.evaluate("window.__apk.download = 'nospace'"); await p2.click('#apkDownload'); await p2.wait_for_timeout(400); await audit2('no storage')
            if errs2: total.append((w, 'console (app update)', errs2))
            await ctx2.close()
        await b.close()
    bad = [t for t in total if t[2]]
    print('\n%d views audited, %d with issues' % (len(total), len(bad)))
    sys.exit(1 if bad else 0)
asyncio.run(main())
