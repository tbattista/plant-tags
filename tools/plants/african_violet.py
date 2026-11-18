"""African violet: a low rosette of big round leaves with a few chunky five-petal flowers in the middle."""
import math
from lib import head, tail, pot, tf, bez, mirror, shape, line, circle, ellipse, BRICK, BEIGE, DW

KEY = 'african-violet'
NAME = 'African violet'
MATCH = r'african violet|saintpaulia|streptocarpus'


def violet_leaf(x, y, rot, sc, rib=True):
    """Round-oval leaf whose blade runs from y -26 (its stalk hidden in the crown) to the blunt tip at -128."""
    blade = mirror(bez((0, -26), (-62, -24), (-66, -124), (0, -128)))
    s = shape(tf(blade, x, y, rot, sc))
    if rib:
        s += line(tf([(0, -40), (0, -104)], x, y, rot, sc))
    return s


def blossom(cx, cy, R=46, rot=0):
    pts = []
    for i in range(61):
        a = i / 60 * 2 * math.pi
        r = R * (0.72 + 0.28 * abs(math.cos(2.5 * (a + math.radians(rot)))))
        pts.append((cx + r * math.sin(a), cy - r * math.cos(a)))
    return shape(pts, BRICK) + circle(cx, cy, 13, BEIGE, DW)


def draw():
    s = head(NAME)
    cx, cy = 250, 412
    s += ellipse(cx, cy - 20, 76, 40, 0)  # leafy crown hiding the stalks
    for (a, sc) in [(-78, 1.3), (78, 1.3), (-46, 1.34), (46, 1.34), (-14, 1.3), (14, 1.3)]:
        s += violet_leaf(cx, cy, a, sc)
    for (x, y, r) in [(250, 228, 18), (194, 286, 0), (306, 286, 6)]:
        s += blossom(x, y, 50, r)
    s += pot()
    return s + tail()
