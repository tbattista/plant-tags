"""Philodendron: a few big glossy heart leaves held up on long stems, with bold beige pinstripes."""
from lib import head, tail, pot, tf, bez, mirror, shape, line, stem, NAVY, BEIGE, SW, DW

KEY = 'philodendron'
NAME = 'Philodendron'
MATCH = r'philodendron|birkin|hederaceum|heart.?leaf'


def big_heart():
    """Deeper-lobed, longer heart than the pothos one: base (0, 0), tip (0, -104)."""
    L = bez((0, 0), (-16, 16), (-52, 12), (-52, -26)) + bez((-52, -26), (-52, -62), (-22, -82), (0, -106))[1:]
    return mirror(L)


def stripe(pts, w=14):
    """A bold beige pinstripe outlined in navy (wide enough to survive the 30 mm print)."""
    d = 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts)
    return (f'<path d="{d}" fill="none" stroke="{NAVY}" stroke-width="{w + 2 * DW}" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<path d="{d}" fill="none" stroke="{BEIGE}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>')


def ph_leaf(x, y, rot, sc):
    s = shape(tf(big_heart(), x, y, rot, sc))
    # one bold stripe either side of the midrib, sweeping out toward the edge
    for side in (-1, 1):
        s += stripe(tf(bez((side * 12, -30), (side * 20, -36), (side * 28, -46), (side * 32, -62), 8), x, y, rot, sc))
    s += line(tf([(0, -6), (0, -90)], x, y, rot, sc), DW)
    return s


def draw():
    s = head(NAME)
    leaves = [(132, 318, -50, 1.4), (368, 318, 50, 1.4), (200, 212, -16, 1.45), (302, 214, 17, 1.42)]
    for (x, y, r, sc) in leaves:
        s += stem((250, 412), (x, y), ((250 + x) / 2, (412 + y) / 2 + 10), SW)
    for (x, y, r, sc) in leaves:
        s += ph_leaf(x, y, r, sc)
    s += pot()
    return s + tail()
