"""Hoya (wax plant): thick waxy leaves in pairs on arching vines, with one ball cluster of star flowers."""
import math
from lib import head, tail, pot, tf, bez, shape, line, mirror, BRICK, BEIGE, DW

KEY = 'hoya'
NAME = 'Hoya'
MATCH = r'hoya|wax plant|wax flower|porcelain flower'


def wax_leaf(x, y, rot, sc=1.0):
    """A plump, thick oval leaf with one midrib."""
    L = bez((0, -2), (-50, -16), (-48, -84), (0, -106))
    return shape(tf(mirror(L), x, y, rot, sc)) + line(tf([(0, -14), (0, -80)], x, y, rot, sc))


def star(cx, cy, r, rot=0):
    """A fat five-point star with a pale eye."""
    pts = []
    for i in range(10):
        a = math.radians(rot - 90 + i * 36)
        rr = r if i % 2 == 0 else r * 0.68
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return shape(pts, BRICK) + f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="11" fill="{BEIGE}"/>'


def umbel(cx, cy, r=44, gap=58):
    s = ''
    for i, a in enumerate([-150, -30, 90]):
        s += star(cx + gap * math.cos(math.radians(a)), cy + gap * math.sin(math.radians(a)), r, 12 * i)
    return s + star(cx, cy, r + 4, 0)


def pair(spine, i, sc, spread):
    """Two leaves opposite each other on the vine at spine index i."""
    a, b = spine[i - 1], spine[i + 1]
    th = math.degrees(math.atan2(b[0] - a[0], -(b[1] - a[1])))
    x, y = spine[i]
    return wax_leaf(x, y, th - spread, sc) + wax_leaf(x, y, th + spread, sc)


def draw():
    s = head(NAME)
    # flower stalk, then a vine each side that climbs, arches over and trails down past the pot
    s += line(bez((250, 412), (240, 330), (256, 260), (250, 200), 12), DW)
    vines = [[(250 + sgn * (250 - px), py) for px, py in bez((236, 412), (210, 150), (92, 110), (104, 450), 40)][:39] for sgn in (-1, 1)]
    for v in vines:
        s += line(v, DW) + pair(v, 12, 0.8, 52) + pair(v, 24, 0.8, 52)
    s += umbel(250, 150)
    s += pot()
    # the lowest pair hangs in front of the pot
    for v in vines:
        s += pair(v, 37, 0.76, 58)
    return s + tail()
