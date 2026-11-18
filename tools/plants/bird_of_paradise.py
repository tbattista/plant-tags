"""Bird of paradise: big paddle leaves on long stalks, one crane-head flower."""
from lib import head, tail, pot, tf, bez, mirror, shape, line, fat_stem, BRICK, NAVY

KEY = 'bird-of-paradise'
NAME = 'Bird of paradise'
MATCH = r'bird.of.paradise|strelitzia|nicolai|reginae'


def paddle(x, y, rot, sc):
    """Long, broad paddle with a single midrib."""
    L = bez((0, 0), (-30, -4), (-42, -28), (-42, -60)) + [(-42, -128)] + bez((-42, -128), (-42, -160), (-22, -186), (0, -198))[1:]
    s = shape(tf(mirror(L), x, y, rot, sc))
    s += line(tf([(0, -6), (0, -176)], x, y, rot, sc))
    return s


def flower(x, y, sc=1.0):
    """Crane head with its stalk joining at (x, y): a navy beak pointing right and a
    crest of three bold brick petals leaning forward over it (no tongue: it would blot)."""
    s = ''
    for (r, ln) in [(-4, 108), (28, 122), (60, 100)]:
        pts = tf(mirror(bez((0, 0), (-30, -22), (-24, -ln * 0.72), (0, -ln))), 18, -12, r)
        s += shape(tf(pts, x, y, 0, sc), BRICK)
    beak = [(-16, 6)] + bez((-16, 6), (16, -26), (76, -16), (122, -4))[1:] + bez((122, -4), (80, 18), (24, 40), (-16, 6))[1:]
    s += shape(tf(beak, x, y, 0, sc), NAVY)
    return s


def draw():
    s = head(NAME)
    leaves = [(160, 290, -58, 0.84), (204, 244, -22, 0.9), (346, 304, 58, 0.82)]
    for (x, y, r, sc) in leaves:
        s += fat_stem((250, 412), (x, y), ((250 + x) / 2, (412 + y) / 2 + 20))
    s += fat_stem((250, 412), (256, 196), (270, 310))
    for (x, y, r, sc) in leaves:
        s += paddle(x, y, r, sc)
    s += flower(256, 196, 1.2)
    s += pot()
    return s + tail()
