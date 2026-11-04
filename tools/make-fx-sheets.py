#!/usr/bin/env python3
"""Builds the BEFORE/AFTER sheets for the Effects tab in docs/effects-redesign from the screenshots made by tests/e2e/fx-shots.py."""
import pathlib
from PIL import Image, ImageDraw, ImageFont
D = pathlib.Path(__file__).resolve().parents[1] / 'docs' / 'effects-redesign'
BG, AMBER, TXT, MUTED = (16, 11, 25), (242, 181, 68), (246, 239, 230), (179, 166, 200)
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26); S = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 20)
def sheet(name, title, note, cols):
    ims = [(lab, Image.open(D / path).convert('RGB'), col) for lab, path, col in cols]
    pad, gap, top = 30, 36, 150; h = max(i.height for _, i, _ in ims); W = sum(i.width for _, i, _ in ims) + gap * (len(ims) - 1) + pad * 2
    im = Image.new('RGB', (W, h + top + pad), BG); d = ImageDraw.Draw(im); d.text((pad, 24), title, font=F, fill=TXT); d.text((pad, 64), note, font=S, fill=MUTED); x = pad
    for lab, i, col in ims:
        d.text((x, 108), f'{lab}  ({i.height * 2 // 3}px tall)', font=S, fill=col); im.paste(i, (x, top)); x += i.width + gap
        if x - gap // 2 < W - pad: d.line([(x - gap // 2, top), (x - gap // 2, im.height - pad)], fill=AMBER, width=2)
    im.save(D / name, optimize=True); print(name, im.size)
R, G = (255, 125, 125), (83, 216, 160)
for w in (390, 320, 768):
    sheet(f'effects-before-after-{w}.png', f'Effects tab at {w} px wide', 'Bottom navigation hidden in these captures. The list scrolls inside its own box; the page itself is shorter.', [('BEFORE (28-tile grid)', f'before/effects-{w}.png', R), ('AFTER (chips, list, one panel)', f'after/effects-{w}.png', G)])
sheet('effects-states-390.png', 'The new Effects browser in its states (390 px)', 'Scenes chip, a selected effect, a search, and a search with no match.', [('Scenes', 'after/effects-390-scenes.png', G), ('Selected effect', 'after/effects-390-selected.png', G), ('Search "blue"', 'after/effects-390-search.png', G), ('No match', 'after/effects-390-empty.png', G)])
