"""Peace lily: a fan of broad dark lance leaves with three big white spathes (each with a chunky spadix) on tall stems."""
from lib import head, tail, pot, tf, bez, mirror, shape, line, stem, BEIGE, GREEN, DW

KEY = 'peace-lily'
NAME = 'Peace lily'
MATCH = r'peace lily|spathiphyllum'


def lily_leaf(x, y, rot, sc):
    L, w = 210, 74
    out = mirror(bez((0, -4), (-w, -L * 0.25), (-w * 1.0, -L * 0.72), (0, -L)))
    s = shape(tf(out, x, y, rot, sc))
    s += line(tf(bez((0, -16), (2, -L * 0.4), (3, -L * 0.65), (0, -L * 0.8), 10), x, y, rot, sc))
    return s


def spathe(x, y, rot, sc):
    L, w = 160, 86
    out = mirror(bez((0, 0), (-w * 0.9, -L * 0.12), (-w * 1.05, -L * 0.62), (0, -L)))
    s = shape(tf(out, x, y, rot, sc), BEIGE)
    # chunky spadix standing in the cup of the spathe
    spad = mirror(bez((0, -14), (-26, -16), (-24, -78), (0, -88), 10))
    s += shape(tf(spad, x, y, rot, sc), GREEN, DW)
    return s


def draw():
    s = head(NAME)
    flowers = [(150, 236, -20, 1.0), (350, 236, 20, 1.0), (250, 204, 0, 1.08)]
    for (x, y, r, sc) in flowers:
        s += stem((250 + (x - 250) * 0.2, 400), (x, y), ((250 + x) / 2, 320), 12)
    leaves = [(240, 402, -66, 1.0), (260, 402, 66, 1.0), (244, 400, -32, 0.98), (256, 400, 32, 0.98)]
    for (x, y, r, sc) in leaves:
        s += lily_leaf(x, y, r, sc)
    for (x, y, r, sc) in flowers:
        s += spathe(x, y, r, sc)
    s += pot()
    return s + tail()
