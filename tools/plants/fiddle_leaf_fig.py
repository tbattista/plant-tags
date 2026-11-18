"""Fiddle-leaf fig: big violin-shaped leaves crowning a bare trunk."""
from lib import head, tail, pot, tf, bez, mirror, shape, line, stem

KEY = 'fiddle-leaf-fig'
NAME = 'Fiddle-leaf fig'
MATCH = r'fiddle.?leaf|ficus lyrata|lyrata'


def fiddle(x, y, rot, sc):
    """Violin leaf: narrow base, pinched waist, broad rounded top; just a midrib."""
    L = (bez((0, 0), (-12, -2), (-24, -20), (-27, -44)) + bez((-27, -44), (-29, -60), (-24, -72), (-36, -88))[1:]
         + bez((-36, -88), (-58, -102), (-66, -130), (-50, -146))[1:] + bez((-50, -146), (-40, -160), (-20, -162), (0, -160))[1:])
    s = shape(tf(mirror(L), x, y, rot, sc))
    s += line(tf([(0, -6), (0, -128)], x, y, rot, sc))
    return s


def draw():
    s = head(NAME)
    s += stem((250, 414), (250, 200), (246, 320), 20)
    for (x, y, r, sc) in [(247, 344, -82, 1.06), (253, 314, 78, 1.06), (248, 262, -50, 1.0), (252, 248, 48, 1.0), (250, 200, 0, 1.0)]:
        s += fiddle(x, y, r, sc)
    s += pot()
    return s + tail()
