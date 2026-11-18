"""Angel-wing begonia: canes of big lopsided, pointed wing leaves with a few bold silver spots, and a hanging red flower cluster."""
from lib import head, tail, pot, tf, bez, shape, line, circle, stem, BEIGE, BRICK, DW

KEY = 'begonia'
NAME = 'Begonia'
MATCH = r'begonia'


def wing(x, y, rot, sc, flip=False, spots=((-36, -40), (-26, -96))):
    """Lopsided wing leaf: a big rounded shoulder on one side of the stalk, a slim other side, curved pointed tip."""
    L = 180
    pts = (bez((0, 0), (-14, 38), (-74, 36), (-80, -6)) + bez((-80, -6), (-86, -72), (-48, -138), (16, -L))[1:] +
           bez((16, -L), (30, -130), (44, -70), (34, -26))[1:] + bez((34, -26), (28, -6), (12, 2), (0, 0))[1:])
    f = -1 if flip else 1
    s = shape(tf([(f * px, py) for px, py in pts], x, y, rot, sc))
    for (px, py) in spots:
        p = tf([(f * px, py)], x, y, rot, sc)[0]
        s += circle(p[0], p[1], 19 * sc, BEIGE, DW)
    return s


def blossom(x, y, rot, sc=1.0):
    """A drooping begonia flower: a rounded heart."""
    out = bez((0, 0), (-10, -18), (-34, -8), (-26, 16)) + bez((-26, 16), (-20, 32), (-6, 40), (0, 44))[1:]
    out = out + [(-px, py) for px, py in reversed(out)][1:-1]
    return shape(tf(out, x, y, rot, sc), BRICK)


def draw():
    s = head(NAME)
    s += stem((238, 410), (166, 190), (214, 300), 14)
    s += stem((262, 410), (330, 196), (288, 300), 14)
    s += wing(224, 300, -112, 1.0, flip=True, spots=((-38, -44),))
    s += wing(166, 190, -24, 1.0)
    s += wing(330, 196, 26, 1.0, flip=True)
    # pendant flower cluster from the right cane
    s += line(bez((300, 270), (340, 270), (360, 296), (360, 324), 10), 12)
    s += blossom(326, 330, 28, 1.2) + blossom(398, 330, -28, 1.2) + blossom(362, 346, 0, 1.2)
    s += pot()
    return s + tail()
