"""Basil (and herbs generally): a bushy stem of big, soft, cupped oval leaves in opposite pairs."""
from lib import head, tail, pot, tf, bez, mirror, shape, line, stem, SW, DW

KEY = 'basil'
NAME = 'Basil'
MATCH = r'basil|ocimum|mint|mentha|oregano|origanum|herbs?\b'


def cup_leaf(x, y, rot, sc=1.0, vein=True):
    ln, w = 100, 50
    s = shape(tf(mirror(bez((0, 0), (-w, -ln * 0.1), (-w * 1.05, -ln * 0.7), (0, -ln))), x, y, rot, sc))
    if vein:
        s += line(tf([(0, -10), (0, -76)], x, y, rot, sc), DW)
    return s


def draw():
    s = head(NAME)
    tips = [(250, 236), (165, 262), (335, 262)]
    for t in tips:
        s += stem((250, 412), t, ((250 + t[0]) / 2, 340), SW)
    leaves = [
        (250, 386, -78, 1.25, False), (250, 386, 78, 1.25, False),
        (165, 268, -64, 1.12, True), (335, 268, 64, 1.12, True),
        (250, 318, -46, 1.12, True), (250, 318, 46, 1.12, True),
        (250, 240, 0, 1.0, False),
    ]
    for (x, y, r, sc, v) in leaves:
        s += cup_leaf(x, y, r, sc, v)
    s += pot()
    return s + tail()
