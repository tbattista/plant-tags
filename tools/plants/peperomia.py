"""Peperomia: a compact mound of thick, round, glossy leaves on short stems."""
from lib import head, tail, pot, tf, shape, line, stem, SW, DW
import math

KEY = 'peperomia'
NAME = 'Peperomia'
MATCH = r'peperomia|baby rubber|radiator plant|caperata'


def obovate(r=44):
    """A thick round-tipped leaf, slightly narrower at the base: base (0, 0)."""
    pts = []
    for i in range(41):
        a = math.pi / 2 + (i / 40) * 2 * math.pi
        x, y = math.cos(a), math.sin(a)
        k = 1 - 0.18 * (y + 1) / 2 if y > 0 else 1  # pinch toward the base
        pts.append((r * x * k, -r - r * y * 1.05))
    return pts


def pep_leaf(x, y, rot, sc=1.0):
    s = shape(tf(obovate(), x, y, rot, sc))
    s += line(tf([(0, -10), (0, -72)], x, y, rot, sc), DW)
    return s


def draw():
    s = head(NAME)
    # back row first, front row last so the overlaps stay clean
    leaves = [(165, 372, -72, 1.35), (335, 372, 72, 1.35), (195, 290, -36, 1.45), (305, 290, 36, 1.45),
              (250, 255, 0, 1.5), (250, 372, 0, 1.3)]
    for (x, y, r, sc) in leaves:
        s += stem((250, 412), (x, y), None, SW)
    for (x, y, r, sc) in leaves:
        s += pep_leaf(x, y, r, sc)
    s += pot()
    return s + tail()
