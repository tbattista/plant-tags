"""ZZ plant: upright stems lined with paired, glossy oval leaflets."""
import math
from lib import head, tail, pot, tf, shape, line, oval_leaf, fat_stem, BEIGE

KEY = 'zz-plant'
NAME = 'ZZ plant'
MATCH = r'zz plant|zamioculcas|zanzibar|zz\b'


def _q(p0, c, p1, t):
    u = 1 - t
    x = u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0]
    y = u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]
    dx = 2 * u * (c[0] - p0[0]) + 2 * t * (p1[0] - c[0])
    dy = 2 * u * (c[1] - p0[1]) + 2 * t * (p1[1] - c[1])
    return x, y, math.degrees(math.atan2(dx, -dy))


def zz_leaf(x, y, rot, sc, gloss=True):
    outline, _ = oval_leaf(length=114, width=42)
    s = shape(tf(outline, x, y, rot, sc))
    if gloss:  # one bold shine stroke: the glossy look, wide enough to print
        s += line(tf([(-10, -36), (-11, -72)], x, y, rot, sc), 12, BEIGE)
    return s


def frond(base, tip, c, ts, spread=38):
    """One stem with paired leaflets at ts (fractions along it) and a leaflet at the tip."""
    s = fat_stem(base, tip, c)
    for t in ts:
        x, y, r = _q(base, c, tip, t)
        s += zz_leaf(x, y, r - spread, 1.0)
        s += zz_leaf(x, y, r + spread, 1.0)
    x, y, r = _q(base, c, tip, 1.0)
    return s + zz_leaf(x, y, r, 1.0)


def draw():
    s = head(NAME)
    base = (250, 412)
    s += frond(base, (116, 196), (196, 336), (0.6, 0.82))
    s += frond(base, (384, 196), (304, 336), (0.6, 0.82))
    s += frond(base, (250, 152), (250, 280), (0.56, 0.8))
    s += pot()
    return s + tail()
