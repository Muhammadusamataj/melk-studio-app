#!/usr/bin/env python3
"""Compare the current web layer against a released bundle and report anything that went missing.

Usage:  python3 tools/compare-release.py /path/to/unzipped/release [--www www]

Checks (a removal is only accepted if it is listed in RENAMED below):
  1. every element id in the old index.html still exists
  2. every function the old app.js declared still exists
  3. every BLE packet builder in protocol.js produces identical bytes
  4. files that were byte-identical are reported, changed files get a line count
Exit code 1 when something went missing."""
import argparse, pathlib, re, subprocess, sys, json

ap = argparse.ArgumentParser(); ap.add_argument('old'); ap.add_argument('--www', default='www'); a = ap.parse_args()
old, new = pathlib.Path(a.old), pathlib.Path(a.www)
# deliberate renames/moves in the redesign: old name -> new name (or None when replaced by a differently-named control)
RENAMED = {'t-studio': 't-settings', 'tab-studio': 'tab-settings',
           'modeGrid': 'fxList', 'modeEdit': 'fxRename', 'modeHint': 'fxCatNote'}   # the 28-tile grid became the Effects browser (1.1.7 effects redesign)
REMOVED_FUNCTIONS = {'modePersistNote': 'tile caption; the list now shows a tick and the panel states the status'}
read = lambda p: p.read_text(encoding='utf-8')
ids = lambda s: set(re.findall(r'\bid="([^"]+)"', s))
funcs = lambda s: set(re.findall(r'^\s*(?:async\s+)?function\s+(\w+)\s*\(', s, re.M))
bad = []

print('== files')
for f in sorted({str(p.relative_to(old)) for p in old.rglob('*') if p.is_file()}):
    n = new / f
    if not n.exists(): print(f'  MISSING  {f}'); bad.append('file ' + f); continue
    same = read(old / f) == read(n) if f.endswith(('.js', '.css', '.html', '.json', '.svg', '.webmanifest')) else (old / f).read_bytes() == n.read_bytes()
    if same: print(f'  same     {f}')
    else:
        d = subprocess.run(['diff', str(old / f), str(n)], capture_output=True, text=True).stdout.splitlines()
        print(f'  changed  {f}  (+{sum(1 for l in d if l.startswith(">"))} / -{sum(1 for l in d if l.startswith("<"))} lines)')
for f in sorted({str(p.relative_to(new)) for p in new.rglob('*') if p.is_file()} - {str(p.relative_to(old)) for p in old.rglob('*') if p.is_file()}):
    print(f'  new      {f}')

print('== element ids')
oi, ni = ids(read(old / 'index.html')), ids(read(new / 'index.html'))
for i in sorted(oi - ni):
    if i in RENAMED and RENAMED[i] in ni: print(f'  renamed  {i} -> {RENAMED[i]}')
    else: print(f'  MISSING  #{i}'); bad.append('id ' + i)
print(f'  {len(oi)} old ids, {len(ni)} now, {len(ni - oi)} added')

print('== app.js functions')
of, nf = funcs(read(old / 'js/app.js')), funcs(read(new / 'js/app.js'))
for fn in sorted(of - nf):
    if fn in REMOVED_FUNCTIONS: print(f'  replaced {fn}()  ({REMOVED_FUNCTIONS[fn]})'); continue
    print(f'  MISSING  {fn}()'); bad.append('function ' + fn)
print(f'  {len(of)} old functions, {len(nf)} now, {len(nf - of)} added')

print('== BLE packets (protocol.js builders, same inputs, same bytes)')
js = r"""
const fs=require('fs'),vm=require('vm');
const load=(dir)=>{const c=vm.createContext({});c.window=c;vm.runInContext(fs.readFileSync(dir+'/js/protocol.js','utf8'),c);return c.Melk.protocol;};
const A=load(process.argv[1]),B=load(process.argv[2]);const out=[];
const inputs={power:[[true],[false]],color:[[0,0,0],[255,128,1],[300,-5,7]],brightness:[[0],[50],[100],[150]],speed:[[0],[40],[100]],mode:[[0],[103],[130],[212],[255]],scene:[[1],[11],[28]],whiteTemp:[[0,100],[70,30]]};
for(const k of Object.keys(A)){ if(typeof A[k]!=='function'||!inputs[k]) continue;
  if(typeof B[k]!=='function'){out.push('MISSING builder '+k);continue;}
  for(const args of inputs[k]){const x=A.hex(A[k](...args)),y=B.hex(B[k](...args));if(x!==y)out.push('DIFFERENT '+k+JSON.stringify(args)+': '+x+' vs '+y);}}
for(const k of ['SERVICE','CHAR','NAME_PREFIX']) if(A[k]!==B[k]) out.push('DIFFERENT constant '+k);
console.log(JSON.stringify(out));
"""
r = subprocess.run(['node', '-e', js, str(old), str(new)], capture_output=True, text=True)
try: diffs = json.loads(r.stdout.strip() or '[]')
except Exception: diffs = ['could not run: ' + r.stderr[:200]]
for d in diffs: print('  ' + d); bad.append(d)
if not diffs: print('  all builders identical')
print('\nRESULT:', 'NOTHING MISSING' if not bad else f'{len(bad)} PROBLEM(S): ' + '; '.join(bad[:10]))
sys.exit(1 if bad else 0)
