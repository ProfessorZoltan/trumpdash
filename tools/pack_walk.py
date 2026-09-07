"""Pack a walk-cycle sheet for the game.

    python tools/pack_walk.py <source.png|jpg> [--skip-rows N] [--order 2,3,4,8,5,6,7,1] [--no-key]

The source is a sheet of walk frames laid out in rows (number labels under the frames are fine:
bands shorter than 100 px are ignored). A PNG with transparency is used as is; a JPEG, or any image
without an alpha channel, has its background keyed out: the flat or checkerboard background is
flood-filled from the image border through light neutral pixels, so whites inside the character
(collar, cuffs, eyes) survive because the dark outline fences them off.

--skip-rows N   ignore the first N rows (a row of poses above the walk, say)
--order a,b,... play order of the walk frames, 1-based, numbered left to right and top to bottom
                after the skipped rows; an index may repeat. Default: the frames in sheet order.
--no-key        never key the background, even without an alpha channel

Frames are trimmed, rows after the first are scaled so their tallest frame matches the first row's,
and the frames are packed in play order into resources/walk_sheet.png in one row with the feet on the
bottom edge of every box. The WALK.FRAMES table in src/sprites.js is rewritten: x, y, w, h and `ax`,
the x of the head (hair centroid) inside the box. The renderer anchors frames on the head so it stays
still while the legs swing, instead of centring each frame's bounding box.

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

args = sys.argv[1:]
if not args or args[0].startswith('-'):
    print(__doc__); sys.exit(2)
src_path, skip_rows, order, key = args[0], 0, None, True
i = 1
while i < len(args):
    if args[i] == '--skip-rows': skip_rows = int(args[i + 1]); i += 2
    elif args[i] == '--order': order = [int(t) for t in args[i + 1].split(',')]; i += 2
    elif args[i] == '--no-key': key = False; i += 1
    else: print('unknown option', args[i]); sys.exit(2)

im = Image.open(src_path)
has_alpha = im.mode in ('RGBA', 'LA') or 'transparency' in im.info
im = im.convert('RGBA')
if key and not has_alpha:
    # Key the background: light neutral pixels reachable from the border. One iteration of the
    # loop grows the region by a pixel; a sheet converges in a few hundred.
    a = np.array(im).astype(int)
    mx, mn = a[:, :, :3].max(axis=2), a[:, :, :3].min(axis=2)
    cand = (mx - mn < 22) & (mn > 170)
    m = np.zeros_like(cand)
    m[0, :] = cand[0, :]; m[-1, :] = cand[-1, :]; m[:, 0] = cand[:, 0]; m[:, -1] = cand[:, -1]
    for _ in range(5000):
        n = m.copy()
        n[1:, :] |= m[:-1, :]; n[:-1, :] |= m[1:, :]; n[:, 1:] |= m[:, :-1]; n[:, :-1] |= m[:, 1:]
        n &= cand
        if (n == m).all(): break
        m = n
    # JPEG seams: light, low-saturation pixels touching the background are background too
    edge = np.zeros_like(m)
    edge[1:, :] |= m[:-1, :]; edge[:-1, :] |= m[1:, :]; edge[:, 1:] |= m[:, :-1]; edge[:, :-1] |= m[:, 1:]
    m |= edge & (mx - mn < 40) & (mn > 110)
    a[:, :, 3] = np.where(m, 0, 255)
    im = Image.fromarray(a.astype(np.uint8))
    print('keyed the background: %.1f%% of the image' % (100 * m.mean()))
a = np.array(im)[:, :, 3]

def runs(mask):
    out, start = [], None
    for i, v in enumerate(mask):
        if v and start is None: start = i
        if not v and start is not None: out.append((start, i)); start = None
    if start is not None: out.append((start, len(mask)))
    return out

bands = [r for r in runs((a > TH).any(axis=1)) if r[1] - r[0] > 100]
print('source %dx%d, %d rows' % (im.size[0], im.size[1], len(bands)))
bands = bands[skip_rows:]
crops = []  # (row index, PIL image)
for ri, (y0, y1) in enumerate(bands):
    band = a[y0:y1]
    for (x0, x1) in runs((band > TH).any(axis=0)):
        if x1 - x0 < 40: continue
        ys = np.where((band[:, x0:x1] > TH).any(axis=1))[0]
        crop = im.crop((x0, y0 + ys[0], x1, y0 + ys[-1] + 1))
        ca = np.array(crop); ca[ca[:, :, 3] <= TH] = 0
        crops.append((ri, Image.fromarray(ca)))
print('%d walk frames in %d rows' % (len(crops), len(bands)))

# Rows exported separately come out at slightly different sizes. Scale every row after the first
# so its tallest frame matches the first row's tallest frame.
ref = max(c.size[1] for r, c in crops if r == 0)
frames = []
for ri, c in crops:
    if ri > 0:
        rowmax = max(cc.size[1] for rr, cc in crops if rr == ri)
        k = ref / rowmax
        c = c.resize((round(c.size[0] * k), round(c.size[1] * k)), Image.LANCZOS)
    frames.append(c)
if order:
    bad = [o for o in order if o < 1 or o > len(frames)]
    if bad: print('order refers to frames that do not exist:', bad); sys.exit(1)
    frames = [frames[o - 1] for o in order]
    print('play order:', ','.join(map(str, order)))

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
