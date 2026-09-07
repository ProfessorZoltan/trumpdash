"""Pack a walk-cycle sheet for the game.

    python tools/pack_walk.py <source.png>

The source is a transparent PNG of the 20 walk frames laid out in rows (as exported from the
image tool, number labels under the frames are fine: bands shorter than 100 px are ignored).
Frames are numbered left to right, top to bottom, and play in that order. The script trims each
frame, scales the second row so its standing pose matches the first row's, and packs the frames in
one row into resources/walk_sheet.png with the feet on the bottom edge of every box. It then
rewrites the WALK.FRAMES table in src/sprites.js: x, y, w, h and `ax`, the x of the head (hair
centroid) inside the box. The renderer anchors frames on the head so it stays still while the legs
swing, instead of centring each frame's bounding box, which made the whole sprite jitter sideways.

Needs Pillow and numpy.
"""
import io, os, re, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'resources', 'walk_sheet.png')
SPRITES = os.path.join(ROOT, 'src', 'sprites.js')
TH = 16   # alpha threshold: faint fringe pixels are ignored (and cleared in the packed sheet)
PAD = 4   # gutter between packed frames

if len(sys.argv) < 2:
    print(__doc__); sys.exit(2)
im = Image.open(sys.argv[1]).convert('RGBA')
a = np.array(im)[:, :, 3]

def runs(mask):
    out, start = [], None
    for i, v in enumerate(mask):
        if v and start is None: start = i
        if not v and start is not None: out.append((start, i)); start = None
    if start is not None: out.append((start, len(mask)))
    return out

bands = [r for r in runs((a > TH).any(axis=1)) if r[1] - r[0] > 100]
crops = []  # (row index, PIL image)
for ri, (y0, y1) in enumerate(bands):
    band = a[y0:y1]
    for (x0, x1) in runs((band > TH).any(axis=0)):
        if x1 - x0 < 40: continue
        ys = np.where((band[:, x0:x1] > TH).any(axis=1))[0]
        crop = im.crop((x0, y0 + ys[0], x1, y0 + ys[-1] + 1))
        ca = np.array(crop); ca[ca[:, :, 3] <= TH] = 0
        crops.append((ri, Image.fromarray(ca)))
print('source %dx%d, %d rows, %d frames' % (im.size[0], im.size[1], len(bands), len(crops)))

# Rows exported separately come out at slightly different sizes. Scale every row after the first
# so its tallest frame (the standing pose at the row's end) matches the first row's tallest frame.
ref = max(c.size[1] for r, c in crops if r == 0)
frames = []
for ri, c in crops:
    if ri > 0:
        rowmax = max(cc.size[1] for rr, cc in crops if rr == ri)
        k = ref / rowmax
        c = c.resize((round(c.size[0] * k), round(c.size[1] * k)), Image.LANCZOS)
    frames.append(c)

def head_x(c):
    f = np.array(c).astype(int)
    hair = (f[:, :, 3] > TH) & (f[:, :, 0] > 190) & (f[:, :, 1] > 130) & (f[:, :, 2] < 110)
    xs = np.where(hair)[1]
    return float(xs.mean()) if len(xs) else c.size[0] / 2

maxh = max(c.size[1] for c in frames)
sheet = Image.new('RGBA', (sum(c.size[0] for c in frames) + PAD * (len(frames) + 1), maxh + PAD * 2), (0, 0, 0, 0))
table, x = [], PAD
for c in frames:
    w, h = c.size
    y = PAD + maxh - h
    sheet.paste(c, (x, y))
    table.append((x, y, w, h, round(head_x(c), 1)))
    x += w + PAD
# A 256-colour palette makes the file about a sixth of the size; the game draws the frames at a
# quarter scale (half on high-density screens), where the quantisation is invisible.
sheet.quantize(256, method=Image.Quantize.FASTOCTREE).save(OUT, optimize=True)
print('packed %dx%d, %d bytes -> %s' % (sheet.size[0], sheet.size[1], os.path.getsize(OUT), os.path.relpath(OUT, ROOT)))
for i, t in enumerate(table): print('  %2d x=%4d y=%2d w=%3d h=%3d ax=%.1f' % ((i + 1,) + t))

src = io.open(SPRITES, encoding='utf-8', newline='').read()
if '// WALK_FRAMES_BEGIN' not in src or '// WALK_FRAMES_END' not in src:
    print('src/sprites.js has no WALK_FRAMES markers'); sys.exit(1)
nl = '\r\n' if '\r\n' in src else '\n'
block = nl.join('      { x: %d, y: %d, w: %d, h: %d, ax: %s },' % t for t in table)
new = re.sub(r'(// WALK_FRAMES_BEGIN\r?\n)(?:.*?\r?\n)?(\s*// WALK_FRAMES_END)', lambda m: m.group(1) + block + nl + m.group(2), src, count=1, flags=re.S)
new = re.sub(r'(SCALE: 72 / )\d+', lambda m: m.group(1) + str(maxh), new, count=1)
if new == src: print('src/sprites.js already up to date: %d frames, SCALE 72 / %d' % (len(table), maxh))
else:
    io.open(SPRITES, 'w', encoding='utf-8', newline='').write(new)
    print('updated src/sprites.js: %d frames, SCALE 72 / %d' % (len(table), maxh))
