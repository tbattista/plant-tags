"""Phalaenopsis orchid: an arching spike of a few big moth flowers above broad leaves at the rim."""
from lib import head, tail, pot, tf, bez, mirror, shape, line, ellipse, NAVY, BEIGE, BRICK, SW

KEY = 'orchid'
NAME = 'Orchid'
MATCH = r'orchid|phalaenopsis|dendrobium|cymbidium|oncidium'


def broad_leaf(x, y, rot, sc):
    L, w = 160, 70
    out = mirror(bez((0, -2), (-w, -L * 0.1), (-w * 1.0, -L * 0.85), (0, -L)))
    return shape(tf(out, x, y, rot, sc)) + line(tf([(0, -14), (0, -L * 0.82)], x, y, rot, sc))


def flower(cx, cy, sc=1.0, rot=0):
    """One moth flower as a single outlined silhouette (no inner petal lines) with a red lip."""
    def at(px, py):
        return tf([(px, py)], cx, cy, rot, sc)[0]
    parts = []
    # sepals: one up, two down; broad side petals
    for (px, py, rx, ry, a) in [(0, -30, 20, 30, 0), (-18, 24, 18, 28, 30), (18, 24, 18, 28, -30),
                                (-30, -4, 30, 26, -20), (30, -4, 30, 26, 20)]:
        p = at(px, py)
        parts.append((p[0], p[1], rx * sc, ry * sc, a + rot))
    s = ''
    for (x, y, rx, ry, a) in parts:  # double-width navy under, plain fill on top → one outer outline
        s += f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" transform="rotate({a:.1f} {x:.1f} {y:.1f})" fill="{NAVY}" stroke="{NAVY}" stroke-width="{2 * SW}"/>'
    for (x, y, rx, ry, a) in parts:
        s += f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" transform="rotate({a:.1f} {x:.1f} {y:.1f})" fill="{BEIGE}"/>'
    lip = mirror(bez((0, -10), (-24, -10), (-22, 26), (0, 30), 8))
    s += shape(tf(lip, cx, cy, rot, sc), BRICK)
    return s


def bud(cx, cy, rot, sc=1.0):
    return ellipse(cx, cy, 20 * sc, 26 * sc, rot, BEIGE)


def draw():
    s = head(NAME)
    spike = bez((248, 392), (226, 290), (200, 150), (290, 108), 18) + bez((290, 108), (370, 74), (420, 120), (420, 200), 14)[1:]
    s += line(spike, 12)
    s += broad_leaf(242, 400, -96, 1.05) + broad_leaf(258, 400, 96, 1.05) + broad_leaf(250, 398, -58, 0.95)
    s += pot()
    s += bud(420, 214, 0, 1.0)
    for (x, y, sc) in [(354, 112, 1.3), (226, 140, 1.35), (210, 266, 1.35)]:
        s += flower(x, y, sc)
    return s + tail()
