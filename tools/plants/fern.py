"""Fern (Boston fern and friends): a few arching fronds, each cut into big pointed leaflets either side of a rib."""
import math
from lib import head, tail, pot, bez, shape, line, DW

KEY = 'fern'
NAME = 'Fern'
MATCH = r'fern|nephrolepis|asplenium|davallia|pteris|adiantum|maidenhair'


def frond(spine, w0, k, start=0.3):
    """A frond along a centreline: half-width w0 tapering to the tip, edge cut into k saw-tooth leaflets per side."""
    n = len(spine)
    acc = [0.0]
    for i in range(1, n):
        acc.append(acc[-1] + math.hypot(spine[i][0] - spine[i - 1][0], spine[i][1] - spine[i - 1][1]))
    total = acc[-1]

    def at(u):
        # point + unit tangent at arc fraction u
        d = u * total
        j = max(1, min(n - 1, next((i for i in range(n) if acc[i] >= d), n - 1)))
        a, b = spine[j - 1], spine[j]
        seg = acc[j] - acc[j - 1] or 1
        f = (d - acc[j - 1]) / seg
        return a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, (b[0] - a[0]) / seg, (b[1] - a[1]) / seg

    def width(u):
        # bare stalk at the base (so fronds don't tangle), widest soon after, pointed tip
        if u < start:
            return 0
        v = (u - start) / (1 - start)
        return w0 * min(1, v / 0.2) ** 0.5 * (1 - v) ** 0.5

    def tooth(f):
        # rises to a point at 70 % of the leaflet, then drops straight back to the notch
        return math.sin(math.pi / 2 * f / 0.7) if f < 0.7 else (1 - f) / 0.3

    step = (1 - start) / k
    sides = []
    for sgn in (1, -1):
        pts = []
        for j in range(k):
            for m in range(10):
                f = m / 10
                u = start + (j + f) * step
                p = tooth(f)
                r = width(u) * (0.1 + 0.9 * p)
                lean = width(u) * 0.3 * p
                x, y, tx, ty = at(min(u, 1))
                nx, ny = -ty * sgn, tx * sgn
                pts.append((x + nx * r + tx * lean, y + ny * r + ty * lean))
        pts.append(at(1)[:2])
        sides.append(pts)
    out = sides[0] + list(reversed(sides[1]))[1:]
    s = line([at(0)[:2], at(start)[:2]], DW)
    s += shape(out)
    s += line([at(u)[:2] for u in [start + (0.82 - start) * i / 12 for i in range(13)]], DW)
    return s


def draw():
    s = head(NAME)
    fronds = [
        # (base, c1, c2, tip, half-width, leaflets per side) — back first
        ((240, 410), (210, 290), (130, 140), (70, 130), 58, 4),
        ((260, 410), (290, 290), (370, 140), (430, 130), 58, 4),
        ((250, 410), (250, 300), (246, 170), (266, 46), 58, 4),
        ((232, 410), (160, 350), (84, 310), (44, 396), 56, 3),
        ((268, 410), (340, 350), (416, 310), (456, 396), 56, 3),
    ]
    for b, c1, c2, tip, w, k in fronds:
        s += frond(bez(b, c1, c2, tip, 40), w, k)
    s += pot()
    return s + tail()
