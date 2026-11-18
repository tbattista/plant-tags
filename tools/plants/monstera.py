"""Monstera: three big split leaves on thick stems."""
import math
from lib import head, tail, pot, tf, shape, line, NAVY, GREEN, SW

KEY = 'monstera'
NAME = 'Monstera'
MATCH = r'monstera|swiss cheese'


def petiole(p0, p1, c):
    """A chunky green stem with navy edges, wide enough that the green survives at 30 mm."""
    d = f'M{p0[0]:.1f} {p0[1]:.1f} Q{c[0]:.1f} {c[1]:.1f} {p1[0]:.1f} {p1[1]:.1f}'
    return (f'<path d="{d}" fill="none" stroke="{NAVY}" stroke-width="{20 + 2 * SW}" stroke-linecap="round"/>'
            f'<path d="{d}" fill="none" stroke="{GREEN}" stroke-width="20" stroke-linecap="round"/>')


def monstera_leaf(x, y, rot, sc):
    """Round-heart leaf with two wide slits a side, running from the edge almost to the midrib
    (slanted toward the tip like the veins), wide enough to stay open at 30 mm."""
    n = 240
    half = []
    for i in range(n // 2 + 1):  # left half, base → tip
        th = i / n * 2 * math.pi
        half.append((-math.sin(th) * 84 * (1 - 0.14 * math.cos(th)), -84 + math.cos(th) * 88))
    a = math.radians(24)
    d = (-math.cos(a), -math.sin(a))   # along the slit, from the midrib out
    pu = (-d[1], d[0])                 # across the slit
    if pu[1] > 0:
        pu = (-pu[0], -pu[1])
    hw = 15
    for (ix, iy) in [(-22, -56), (-22, -124)]:
        out, inside = [], False
        for (px, py) in half:
            s_ = (px - ix) * d[0] + (py - iy) * d[1]
            q = (px - ix) * pu[0] + (py - iy) * pu[1]
            hit = s_ > 0 and abs(q) < hw
            if hit and not inside:
                out += [(ix - pu[0] * hw, iy - pu[1] * hw), (ix + pu[0] * hw, iy + pu[1] * hw)]
            if not hit:
                out.append((px, py))
            inside = hit
        half = out
    half[0] = (0, -16)
    outline = half + [(-px, py) for (px, py) in reversed(half)][1:]
    s = shape(tf(outline, x, y, rot, sc))
    s += line(tf([(0, -16), (0, -150)], x, y, rot, sc))
    return s


def draw():
    s = head(NAME)
    s += petiole((250, 410), (208, 330), (218, 380)) + petiole((250, 410), (292, 330), (282, 380)) + petiole((250, 410), (250, 220), (246, 330))
    # the centre leaf sits behind the two side leaves
    s += monstera_leaf(250, 222, 0, 1.06) + monstera_leaf(208, 334, -64, 0.96) + monstera_leaf(292, 334, 64, 0.96)
    s += pot()
    return s + tail()
