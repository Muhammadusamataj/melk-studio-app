#!/usr/bin/env python3
"""Builds the side-by-side BEFORE/AFTER sheets in docs/ui-cleanup from the screenshots captured by
tests/e2e/ui-duplication.py --shots (docs/ui-cleanup/before and docs/ui-cleanup/after). Needs Pillow and numpy."""
import pathlib
from PIL import Image, ImageDraw, ImageFont
import numpy as np
D = pathlib.Path(__file__).resolve().parents[1] / 'docs' / 'ui-cleanup'
BG, AMBER, TXT, MUTED = (16, 11, 25), (242, 181, 68), (246, 239, 230), (179, 166, 200)
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26); S = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 20)
TABS = {'home-disconnected', 'colour', 'effects', 'music', 'settings'}
def trim(path, has_nav):
    im = Image.open(path).convert('RGB')
    if im.height < 2200: return im        # already trimmed: only raw 1500 px captures are cropped (trimming twice would eat content)
    a = np.asarray(im).astype(int); limit = a.shape[0] - (105 if has_nav else 0)
    rows = np.where((np.abs(a - np.array(BG)).max(axis=2) > 10)[:limit].any(axis=1))[0]
    last = int(rows.max()) if len(rows) else limit
    out = im.crop((0, 0, im.width, min(a.shape[0], last + 40))); out.save(path, optimize=True); return out
SHEETS = [('1-home-disconnected', 'Home, strip not connected', 'home-disconnected', 'Direct power is tucked away. The banner and chip now use the same words.'),
          ('2-effects', 'Effects', 'effects', 'Rainbow is one slim row. One hint for modes, one word for favourites.'),
          ('3-connection', 'Settings, Connection', 'connection', 'Status card with the same words and button as the top chip. Technical details collapsed.'),
          ('4-software-updates', 'Settings, Software updates (update found)', 'updates-found', 'Two short cards. Server, signing key and build details are collapsed.'),
          ('5-lab', 'Experimental Lab (cropped at 1500 px)', 'lab', 'Seven cards became four. Testers and offline options are grouped.'),
          ('6-scenes', 'Settings, Scenes (cropped at 1500 px)', 'scenes', 'Recent lives in the first card. One explanation instead of three.')]
for shot in ['home-disconnected', 'colour', 'effects', 'music', 'settings', 'connection', 'vehicle', 'scenes', 'automation', 'updates', 'updates-found', 'lab']:
    for side in ('before', 'after'):
        if (D / side / f'{shot}.png').exists(): trim(D / side / f'{shot}.png', shot in TABS)
for name, title, shot, note in SHEETS:
    b = Image.open(D / 'before' / f'{shot}.png').convert('RGB'); a = Image.open(D / 'after' / f'{shot}.png').convert('RGB')
    h = max(b.height, a.height); gap, pad, top = 40, 30, 150
    im = Image.new('RGB', (b.width + a.width + gap + pad * 2, h + top + pad), BG); d = ImageDraw.Draw(im)
    d.text((pad, 24), title, font=F, fill=TXT); d.text((pad, 64), note, font=S, fill=MUTED)
    d.text((pad, 108), f'BEFORE (v1.1.7 as delivered)  {b.height * 2 // 3}px tall', font=S, fill=(255, 125, 125)); d.text((pad + b.width + gap, 108), f'AFTER (cleanup)  {a.height * 2 // 3}px tall', font=S, fill=(83, 216, 160))
    im.paste(b, (pad, top)); im.paste(a, (pad + b.width + gap, top)); d.line([(pad + b.width + gap // 2, top), (pad + b.width + gap // 2, im.height - pad)], fill=AMBER, width=2)
    im.save(D / f'before-after-{name}.png', optimize=True); print(name, im.size, 'before', b.height * 2 // 3, 'after', a.height * 2 // 3)
