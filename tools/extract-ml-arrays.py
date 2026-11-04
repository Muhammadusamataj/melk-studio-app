#!/usr/bin/env python3
"""Reads Magic Lantern's own mode and scene lists out of its APK resources (read only) and writes them as JSON.

    python3 tools/extract-ml-arrays.py /path/to/Magic_Lantern_6_11_10.apk tests/fixtures/ml-apk-arrays.json

Uses `aapt dump --values resources`. The output holds only the facts needed to check our tables: for every mode its group, id and name,
for every scene its id and name, and the app's own group order. tests/modes-audit.cjs compares protocol.js with this file offline."""
import json, re, subprocess, sys
apk, out = sys.argv[1], sys.argv[2]
txt = subprocess.run(['aapt', 'dump', '--values', 'resources', apk], capture_output=True, text=True).stdout
def array(name):
    m = re.search(r'array/%s: <bag>\n(.*?)(?=\n        resource |\Z)' % re.escape(name), txt, re.S)
    if not m: raise SystemExit('array not found: ' + name)
    return [re.sub(r'\\"', '"', v) for v in re.findall(r'#\d+ \(Key=0x[0-9a-f]+\): \((?:string8|string16|int_dec|int_hex)\) "?([^"\n]*)"?', m.group(1))]
groups = array('modes_groups')                 # the app's own group order; the last one is "Scenes"
modes, order = {}, []
for i in range(0, 8):
    names, cmds = array(f'modes_group{i}'), array(f'modes_group{i}_command')
    if len(names) != len(cmds): raise SystemExit(f'group {i}: {len(names)} names but {len(cmds)} commands')
    gname = None
    for n, c in zip(names, cmds): modes[int(c)] = [None, n]
    order.append((i, len(names), [int(c) for c in cmds]))
scenes_n, scenes_c = array('modes_group8'), array('modes_group8_command')
scenes = {int(c): n for n, c in zip(scenes_n, scenes_c)}
# which group NAME belongs to which modes_groupN array: the app lists them in this order
for (i, n, ids), g in zip(order, groups[:8]):
    for c in ids: modes[c][0] = g
json.dump({'source': 'Magic Lantern 6.11.10, res/arrays (array/modes_group0..8, *_command, modes_groups)', 'groupOrder': groups,
           'modes': {str(k): v for k, v in sorted(modes.items())}, 'scenes': {str(k): v for k, v in sorted(scenes.items())}}, open(out, 'w'), indent=1, ensure_ascii=False)
print(f'{len(modes)} modes in {len(set(v[0] for v in modes.values()))} groups, {len(scenes)} scenes; group order: {groups}')
