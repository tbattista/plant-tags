"""Pothos: big heart leaves on stems from the pot, two vines trailing over the rim."""
from lib import head, tail, pot, leaf, stem, line, bez, DW

KEY = 'pothos'
NAME = 'Pothos'
MATCH = r"pothos|epipremnum|scindapsus|devil.?s ivy"


def draw():
    s = head(NAME)
    stems = [(250, 222, 0, 2.1), (166, 270, -36, 1.95), (334, 270, 36, 1.95)]
    for (x, y, r, sc) in stems:
        s += stem((250, 412), (x, y), ((250 + x) / 2, (412 + y) / 2 + 30), DW)
    for (x, y, r, sc) in stems:
        s += leaf('heart', x, y, r, sc)
    s += pot()
    s += line(bez((166, 424), (118, 420), (96, 450), (98, 480)), DW)
    s += line(bez((334, 424), (382, 420), (404, 450), (402, 480)), DW)
    for (x, y, r, sc) in [(98, 474, -176, 1.4), (402, 474, 176, 1.4)]:
        s += leaf('heart', x, y, r, sc, vein=False)
    return s + tail()
