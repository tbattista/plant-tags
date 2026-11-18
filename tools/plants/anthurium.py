"""Anthurium: three big glossy red heart spathes with a pale spadix, above a few arrow-heart leaves."""
from lib import head, tail, pot, tf, bez, mirror, shape, line, stem, BRICK, BEIGE, DW

KEY = 'anthurium'
NAME = 'Anthurium'
MATCH = r'anthurium|flamingo flower|laceleaf|tail flower'


def heart(L, w, lobe):
    """Heart from the notch at (0, 0) to the tip at (0, -L); lobes bulge below the notch."""
    return mirror(bez((0, 0), (-6, lobe), (-w * 1.05, lobe * 1.1), (-w, -L * 0.28)) +
                  bez((-w, -L * 0.28), (-w * 0.95, -L * 0.6), (-w * 0.4, -L * 0.8), (0, -L))[1:])


def leaf(x, y, rot, sc):
    s = shape(tf(heart(170, 62, 20), x, y, rot, sc))
    s += line(tf([(0, -6), (0, -140)], x, y, rot, sc))
    return s


def flower(x, y, rot, sc, spadix_rot):
    """Spathe hanging tip-down from its notch at (x, y); spadix pointing up from the notch."""
    s = shape(tf(heart(118, 66, 38), x, y, rot, sc), BRICK)
    spad = [(px + 0.004 * py * py, py) for px, py in mirror(bez((0, 8), (-24, 4), (-18, -70), (0, -86), 10))]
    s += shape(tf(spad, x, y, spadix_rot, sc), BEIGE, DW)
    return s


def draw():
    s = head(NAME)
    leaves = [(206, 392, -64, 1.04), (294, 392, 64, 1.04), (250, 372, 0, 0.98)]
    flowers = [(132, 210, 205, 1.0, -24), (368, 214, 155, 1.0, 24), (250, 140, 180, 1.08, 6)]
    for (x, y, *_r) in flowers:
        s += stem((250, 405), (x, y + 10), ((250 + x) / 2, 300), 12)
    for (x, y, r, sc) in leaves:
        s += stem((250, 405), (x, y), ((250 + x) / 2, 380), 12)
    for (x, y, r, sc) in leaves:
        s += leaf(x, y, r, sc)
    for f in flowers:
        s += flower(*f)
    s += pot()
    return s + tail()
