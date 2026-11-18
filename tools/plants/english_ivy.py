"""English ivy: a few big five-pointed ivy leaves on a mound, one trailing down each side of the pot."""
import math
from lib import head, tail, pot, tf, bez, shape, line, mirror, DW

KEY = 'english-ivy'
NAME = 'English ivy'
MATCH = r'english ivy|common ivy|hedera|ivy'

# right half of the leaf, base (0, 0) to tip (0, -96): basal lobe, side lobe, big top lobe
_HALF = [(0, -2), (14, 6), (40, 2), (34, -20), (62, -40), (26, -50), (0, -96)]
_TIPS = [(36, 0), (58, -38), (0, -90)]


def ivy_outline():
    pts = [(-x, y) for x, y in _HALF]
    out = []
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        dx, dy = b[0] - a[0], b[1] - a[1]
        # bulge each edge a little to the outside so the lobes look plump
        nx, ny = dy * 0.12, -dx * 0.12
        out += bez(a, (a[0] + (mx + nx - a[0]) * 1.3, a[1] + (my + ny - a[1]) * 1.3), (b[0] + (mx + nx - b[0]) * 1.3, b[1] + (my + ny - b[1]) * 1.3), b, 6)[:-1]
    out.append(pts[-1])
    return mirror(out)


def ivy(x, y, rot, sc=1.0):
    """One leaf with a single bold midrib — the side veins are too fine at 30 mm."""
    return shape(tf(ivy_outline(), x, y, rot, sc)) + line(tf([(0, -6), (0, -62)], x, y, rot, sc))


def draw():
    s = head(NAME)
    # (leaf base x, y, tilt, scale) — back leaves first
    mound = [(178, 236, -38, 1.45), (322, 236, 38, 1.45), (250, 208, 0, 1.6)]
    for (x, y, r, sc) in mound:
        s += line(bez((250, 412), (250, 340), (x, y + 70), (x, y), 12), DW)
    trail = [(132, 424, -150, 1.2), (368, 424, 150, 1.2)]
    for (x, y, r, sc) in trail:
        s += line(bez((250 + (x - 250) * 0.45, 404), (250 + (x - 250) * 0.9, 380), (x, 396), (x, y), 12), DW)
    for (x, y, r, sc) in mound:
        s += ivy(x, y, r, sc)
    s += pot()
    for (x, y, r, sc) in trail:
        s += ivy(x, y, r, sc)
    return s + tail()
