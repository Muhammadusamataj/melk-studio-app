#!/usr/bin/env python3
"""Duplication and clutter audit. For every screen it counts what a person actually sees (buttons, words, explanatory paragraphs) and
finds explanations that are repeated on the same screen. Optionally saves a screenshot of each screen.

    python3 tests/e2e/ui-duplication.py [--root DIR] [--shots OUTDIR] [--json FILE] [--assert]

--root   project folder to audit (default: this project). Use it to compare two versions.
--assert exit 1 if any screen repeats an explanation (used by the regression suite)."""
import argparse, asyncio, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from apk_mock import APK_MOCK
import os
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--root', default=str(pathlib.Path(__file__).resolve().parents[2])); ap.add_argument('--shots'); ap.add_argument('--json'); ap.add_argument('--assert', dest='do_assert', action='store_true')
args = ap.parse_args()
URL = (pathlib.Path(args.root) / 'www' / 'index.html').as_uri()

METRICS = r"""
(rootSel) => {
  const root = document.querySelector(rootSel);
  const inClosed = (el) => { for (let a = el.closest('details'); a; a = a.parentElement && a.parentElement.closest('details')) { if (!a.open) { const sm = Array.from(a.children).find((c) => c.tagName === 'SUMMARY'); if (!(sm && sm.contains(el))) return true; } } return false; };
  const shown = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden]') && !inClosed(el); };
  const norm = (t) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const skip = (el) => el.closest('.tabs, .scenes, .top, .toast');
  const buttons = Array.from(root.querySelectorAll('button, a[href]')).filter((b) => shown(b) && !skip(b) && !b.closest('.tile, .fxRow, .fxCats, .sw, .sceneRow, .rb, .card, .routine-item, .seg:not(.directPower), .palette, .carGrid'));
  const collapsed = Array.from(root.querySelectorAll('details:not([open]) > summary')).filter((b) => shown(b) && !skip(b)).length;
  const allButtons = Array.from(root.querySelectorAll('button, summary, a[href]')).filter((b) => shown(b) && !skip(b));
  let words = 0; const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode, p = n.parentElement; if (!n.textContent.trim() || !p || !shown(p) || p.closest('.toast, .tabs, option, script, style')) continue;
    const box = p.closest('.fxList, .fxCats'); if (box) { const a = p.getBoundingClientRect(), c = box.getBoundingClientRect(); if (a.bottom <= c.top || a.top >= c.bottom || a.right <= c.left || a.left >= c.right) continue; }   // text scrolled out of a scroll box is not on screen
    words += n.textContent.trim().split(/\s+/).length;
  }
  const paras = Array.from(root.querySelectorAll('p, .hint, small, .carHint')).filter((p) => shown(p) && !skip(p) && !p.closest('.navrow') && !p.closest('.kv') && !p.closest('.rbTitle') && norm(p.textContent).split(' ').length >= 6).map((p) => p.textContent.trim());
  // identical text repeated (one finding with a count) and near-identical text (similar wording, not templated list metadata)
  const groups = {}; paras.forEach((t) => { const k = norm(t); (groups[k] = groups[k] || { text: t, n: 0 }).n++; });
  const dups = Object.values(groups).filter((g) => g.n > 1).map((g) => [g.text.slice(0, 70), g.n + ' times', 100]);
  const uniq = Object.values(groups).map((g) => g.text);
  for (let i = 0; i < uniq.length; i++) for (let j = i + 1; j < uniq.length; j++) {
    if (/ (scene|mode) \d+ · \d of 3 recorded$/.test(uniq[i]) || / recorded$/.test(uniq[j])) continue;
    const a = new Set(norm(uniq[i]).split(' ')), b = new Set(norm(uniq[j]).split(' ')); let inter = 0; a.forEach((w) => { if (b.has(w)) inter++; });
    const jac = inter / (a.size + b.size - inter); if (jac >= 0.6) dups.push([uniq[i].slice(0, 70), uniq[j].slice(0, 70), Math.round(jac * 100)]);
  }
  const labels = {}; buttons.forEach((b) => { const t = (b.getAttribute('aria-label') || b.textContent).trim().replace(/\s+/g, ' '); if (t) labels[t] = (labels[t] || 0) + 1; });
  const sameLabel = Object.keys(labels).filter((k) => labels[k] > 1 && !/^(Back|More|Share|Link|Hardware|Delete|Run on strip|Untested|Yes|No|Details)$/.test(k) && !/ favourite$/.test(k));
  const cards = Array.from(root.querySelectorAll('.sect, .notice, .group, .aboutCard')).filter((c) => shown(c) && !c.closest('.sect, .group') || c.matches('.sect, .group')).filter(shown).length;
  return { buttons: buttons.length, collapsed, allButtons: allButtons.length, words, paragraphs: paras.length, cards, repeated: dups, sameLabel };
}
"""

async def main():
    out = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(channel=os.environ.get('MELK_BROWSER_CHANNEL'))
        async def page(connect=True):
            ctx = await b.new_context(viewport={'width': 390, 'height': 1500}, device_scale_factor=1.5); pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.add_init_script(APK_MOCK); await pg.goto(URL); await pg.wait_for_timeout(450)
            if connect: await pg.click('#btnConn'); await pg.wait_for_timeout(900)
            return pg
        async def record(pg, name, root, shot=None):
            await pg.wait_for_timeout(220)
            out[name] = await pg.evaluate(METRICS, root)
            if args.shots and shot:
                pathlib.Path(args.shots).mkdir(parents=True, exist_ok=True)
                await pg.screenshot(path=str(pathlib.Path(args.shots) / f'{shot}.png'), clip={'x': 0, 'y': 0, 'width': 390, 'height': await pg.evaluate("Math.min(1500, Math.ceil(document.querySelector('%s').scrollHeight))" % root) if root != '.app' else 1500})
        pg = await page(connect=False)
        await record(pg, 'Home (strip not connected)', '.app', 'home-disconnected')
        await pg.click('#btnConn'); await pg.wait_for_timeout(900)
        await record(pg, 'Colour', '.app', 'colour')
        await pg.click('#t-fx'); await record(pg, 'Effects: built-in', '.app', 'effects')
        await pg.click('#segMine'); await record(pg, 'Effects: my effects', '.app'); await pg.click('#segBuilt')
        await pg.click('#t-music'); await record(pg, 'Music', '.app', 'music')
        await pg.click('#t-settings'); await record(pg, 'Settings home', '.app', 'settings')
        for i in range(7): await pg.click('#aboutVersion')
        await pg.wait_for_timeout(2700)
        for pid, label, shot in [('connection', 'Settings: Connection', 'connection'), ('vehicle', 'Settings: Vehicle & Drive', 'vehicle'), ('scenes', 'Settings: Scenes', 'scenes'), ('automation', 'Settings: Automation', 'automation'),
                                 ('backup', 'Settings: Backup', None), ('updates', 'Settings: Software updates', 'updates'), ('lab', 'Experimental Lab', 'lab'), ('dev', 'Developer options', None)]:
            await pg.click('#t-settings'); await pg.click(f'#tab-settings [data-open={pid}]'); await pg.wait_for_timeout(250)
            await record(pg, label, f'#page-{pid}', shot)
            if pid == 'updates':
                await pg.click('#apkCheck'); await pg.wait_for_timeout(350); await record(pg, 'Settings: Software updates (update found)', '#page-updates', 'updates-found')
            await pg.click(f'#page-{pid} [data-back]')
        await pg.click('#btnCar'); await record(pg, 'Car mode', '#car'); 
        await b.close()
    w = max(len(k) for k in out)
    print(f"{'screen':<{w}}  actions  collapsed  words  paragraphs  cards  repeated")
    bad = 0
    for k, v in out.items():
        print(f"{k:<{w}}  {v['buttons']:>7}  {v['collapsed']:>9}  {v['words']:>5}  {v['paragraphs']:>10}  {v['cards']:>5}  {len(v['repeated']) + len(v['sameLabel'])}")
        for r in v['repeated']:
            print(f"    repeated {r[1]}: \"{r[0]}…\"" if r[2] == 100 and 'times' in str(r[1]) else f"    near-duplicate ({r[2]}%): \"{r[0]}…\"  ~  \"{r[1]}…\""); bad += 1
        for s in v['sameLabel']: print(f"    same button label shown more than once: \"{s}\"")
    tot = lambda key: sum(v[key] for v in out.values())
    print(f"{'TOTAL':<{w}}  {tot('buttons'):>7}  {tot('collapsed'):>9}  {tot('words'):>5}  {tot('paragraphs'):>10}  {tot('cards'):>5}")
    if args.json: pathlib.Path(args.json).write_text(json.dumps(out, indent=1))
    if args.do_assert and bad: sys.exit(1)
asyncio.run(main())
