"""String of pearls: a mound of round pearls with strands spilling over the pot rim."""
import math
from lib import head, tail, pot, circle, line, bez, path_pts, NAVY, DW

KEY = 'string-of-pearls'
NAME = 'String of pearls'
MATCH = r'string.of.pearls|string.of.beads|rowleyanus|senecio|curio'

R = 22  # pearl radius: big enough to stay a green ball at 30 mm


def strand(p0, p1, p2, p3, gap=64, r=R, first=34):
    """A navy stem along a curve with pearls spaced along it."""
    pts = bez(p0, p1, p2, p3, 80)
    acc, last, pearls, end = gap - first, pts[0], [], 0
    for i, p in enumerate(pts[1:], 1):
        acc += math.hypot(p[0] - last[0], p[1] - last[1])
        last = p
        if acc >= gap:
            pearls.append(p)
            acc, end = 0, i
    # the stem stops at the last pearl, so no navy stub hangs below it
    return line(pts[:end + 1], DW) + ''.join(circle(x, y, r) for (x, y) in pearls)


def draw():
    s = head(NAME)
    # the mound in the pot: back rows first
    rows = [(316, [228, 272]), (350, [184, 228, 272, 316]), (384, [162, 206, 250, 294, 338])]
    # a navy backing so the gaps between packed pearls read as shadow, not specks of background
    hull = [(r[1][0], r[0]) for r in rows] + [(r[1][-1], r[0]) for r in reversed(rows)]
    s += f'<path d="{path_pts(hull)}" fill="{NAVY}" stroke="{NAVY}" stroke-width="36" stroke-linejoin="round"/>'
    for (y, xs) in rows:
        for x in xs:
            s += circle(x, y, R)
    s += pot()
    # strands draped over the rim
    s += strand((160, 404), (100, 400), (82, 440), (86, 548), gap=58)
    s += strand((340, 404), (400, 400), (418, 440), (414, 548), gap=58)
    return s + tail()
