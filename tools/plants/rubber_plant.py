"""Rubber plant: thick, glossy oval leaves up a single stem, a brick-red sheath at the tip."""
from lib import head, tail, pot, tf, line, shape, oval_leaf, stem, BRICK

KEY = 'rubber-plant'
NAME = 'Rubber plant'
MATCH = r'rubber plant|rubber tree|ficus elastica|elastica'


def rubber(x, y, rot, sc):
    """Broad oval leaf with the species' red midrib (no other detail: it would close up)."""
    outline, rib = oval_leaf(length=130, width=56)
    s = shape(tf(outline, x, y, rot, sc))
    s += line(tf(rib, x, y, rot, sc), color=BRICK)
    return s


def draw():
    s = head(NAME)
    s += stem((250, 414), (250, 130), (247, 270), 16)
    for (y, r, sc) in [(344, -96, 1.3), (316, 94, 1.3), (264, -60, 1.18), (238, 58, 1.18), (196, -34, 1.02), (184, 32, 1.02)]:
        s += rubber(250, y, r, sc)
    s += shape(tf(oval_leaf(length=96, width=34)[0], 250, 176, 0, 1.0), BRICK)
    s += pot()
    return s + tail()
