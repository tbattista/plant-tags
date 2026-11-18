"""Croton: a few broad leathery leaves, each splashed with one bold band of brick or beige down the vein."""
from lib import head, tail, pot, tf, bez, mirror, shape, stem, NAVY, BEIGE, BRICK, GREEN, SW, DW

KEY = 'croton'
NAME = 'Croton'
MATCH = r'croton|codiaeum|joseph.s coat'


def band(pts, color, w=14):
    d = 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts)
    return (f'<path d="{d}" fill="none" stroke="{NAVY}" stroke-width="{w + 2 * DW}" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>')


def cro_leaf(x, y, rot, sc, fill, vein):
    ln, w = 140, 62
    s = shape(tf(mirror(bez((0, 0), (-w, -ln * 0.18), (-w * 1.05, -ln * 0.7), (0, -ln))), x, y, rot, sc), fill)
    s += band(tf([(0, -14), (0, -112)], x, y, rot, sc), vein)
    return s


def draw():
    s = head(NAME)
    leaves = [(180, 362, -66, 1.1, GREEN, BRICK), (320, 362, 66, 1.1, BRICK, BEIGE), (196, 282, -27, 1.2, BRICK, BEIGE),
              (304, 282, 27, 1.2, GREEN, BRICK), (250, 252, 0, 1.3, GREEN, BEIGE)]
    for (x, y, *_r) in leaves:
        s += stem((250, 412), (x, y), None, SW)
    for (x, y, r, sc, f, v) in leaves:
        s += cro_leaf(x, y, r, sc, f, v)
    s += pot()
    return s + tail()
