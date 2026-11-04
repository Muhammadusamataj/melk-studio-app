#!/usr/bin/env python3
"""Prints the mode and scene mapping as Markdown tables, from tests/fixtures/ml-apk-arrays.json (Magic Lantern's own arrays)
and www/js/protocol.js. Used to write docs/MODES_MAPPING_AUDIT.md.   python3 tools/audit-modes.py"""
import json, pathlib, re
R = pathlib.Path(__file__).resolve().parents[1]
ML = json.loads((R / 'tests/fixtures/ml-apk-arrays.json').read_text()); proto = (R / 'www/js/protocol.js').read_text()
first, last = int(re.search(r'MODE_FIRST:\s*(\d+)', proto).group(1)), int(re.search(r'MODE_LAST:\s*(\d+)', proto).group(1))
def ranges(ids):
    """1,2,3 -> "1–3"; 89,91,93 -> "89–93 (every 2nd)"."""
    ids = sorted(ids); out = []; n = 0
    while n < len(ids):
        a = ids[n]; step = (ids[n + 1] - a) if n + 1 < len(ids) and ids[n + 1] - a in (1, 2) else 1; m = n
        while m + 1 < len(ids) and ids[m + 1] - ids[m] == step: m += 1
        b = ids[m]; out.append(str(a) if m == n else f'{a}–{b}' + (' (every 2nd)' if step == 2 else '')); n = m + 1
    return ', '.join(out)
modes = {int(k): v for k, v in ML['modes'].items()}; label = {'RunBack': 'Run back'}
print('| # | Group (Magic Lantern order) | Modes | Mode numbers |\n|---|---|---|---|')
for i, g in enumerate(ML['groupOrder'][:8]):
    ids = [k for k, v in modes.items() if v[0] == g]; print(f'| {i + 1} | {label.get(g, g)} (`modes_group{i}`) | {len(ids)} | {ranges(ids)} |')
print(f'| 9 | Scenes (`modes_group8`) | {len(ML["scenes"])} | 1–28 (a different command, see below) |')
print(f'| | **Total modes** | **{len(modes)}** | |')
print('\n## Names that Magic Lantern gives to two different numbers\n| Name | Mode numbers |\n|---|---|')
by = {}
for k, v in modes.items(): by.setdefault(v[1], []).append(k)
for n, ids in sorted(by.items(), key=lambda x: min(x[1])):
    if len(ids) > 1: print(f'| {n} | {", ".join(str(i) for i in sorted(ids))} |')
print('\n## Strip scenes (command `7E 05 31 [scene] 07 FF FF 01 EF`)\n| Scene | Name | Scene | Name |\n|---|---|---|---|')
sc = {int(k): v for k, v in ML['scenes'].items()}
for i in range(1, 15): print(f'| {i} | {sc[i]} | {i + 14} | {sc[i + 14]} |')
print(f'\n## Where the 28 tiles of the old grid (modes {first} to {last}) went\n| Mode | Name | Chip |\n|---|---|---|')
for i in range(first, last + 1): print(f'| {i} | {modes[i][1]} | {label.get(modes[i][0], modes[i][0])} |')
