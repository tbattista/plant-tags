"""Tradescantia: stems of pointed leaves with one bold beige stripe each, trailing over the rim."""
import math
from lib import head, tail, pot, tf, bez, mirror, shape, line, path_pts, NAVY, BEIGE, SW, DW

KEY = 'tradescantia'
NAME = 'Tradescantia'
MATCH = r'tradescantia|wandering (dude|jew)|inch plant|spiderwort'


def trad_leaf(x, y, rot, sc=1.0):
    """Pointed oval leaf with one bold beige stripe (outlined in navy) down the middle, green either side."""
    ln, w = 124, 62
    edge = bez((0, 0), (-w, -ln * 0.22), (-w * 0.95, -ln * 0.7), (0, -ln))
    s = shape(tf(mirror(edge), x, y, rot, sc))
    d = path_pts(tf([(0, -20), (0, -ln * 0.8)], x, y, rot, sc), False)
    s += (f'<path d="{d}" fill="none" stroke="{NAVY}" stroke-width="{18 + 2 * DW}" stroke-linecap="round"/>'
          f'<path d="{d}" fill="none" stroke="{BEIGE}" stroke-width="18" stroke-linecap="round"/>')
    return s


def vine(pts, leaves, sc):
    """A stem with leaves at fractions t along it, each turned `off` degrees from the stem direction."""
    s = line(pts, SW)
    out = ''
    n = len(pts) - 1
    for (t, off) in leaves:
        k = min(int(t * n), n - 1)
        (ax, ay), (bx, by) = pts[k], pts[k + 1]
        ang = math.degrees(math.atan2(by - ay, bx - ax)) + 90
        out += trad_leaf(ax, ay, ang + off, sc)
    return s, out


def draw():
    s = head(NAME)
    stems = [
        (bez((250, 412), (248, 350), (252, 300), (250, 250), 30), [(1.0, 0)], 1.25),
        (bez((250, 412), (215, 360), (185, 330), (160, 312), 30), [(1.0, -6)], 1.2),
        (bez((250, 412), (285, 360), (315, 330), (340, 312), 30), [(1.0, 6)], 1.2),
    ]
    leaves = ''
    for pts, lv, sc in stems:
        a, b = vine(pts, lv, sc)
        s += a
        leaves += b
    s += leaves
    s += pot()
    for side in (-1, 1):
        pts = [(250 + side * (bx - 250), by) for bx, by in bez((196, 404), (150, 372), (112, 392), (108, 440), 30)]
        a, b = vine(pts, [(1.0, 0)], 1.05)
        s += a + b
    return s + tail()
