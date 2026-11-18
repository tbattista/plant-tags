"""Alocasia (elephant ear): big arrow-shaped leaves with bold pale veins, held up on tall stems."""
from lib import head, tail, pot, tf, bez, shape, mirror, fat_stem, NAVY, BEIGE

KEY = 'alocasia'
NAME = 'Alocasia'
MATCH = r'alocasia|elephant ear|colocasia|african mask|amazonica'


def _path(pts):
    return 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts)


def vein(pts, w=16):
    """A bold pale vein (no edge: at 30 mm a navy edge just thickens into a dark bar)."""
    return f'<path d="{_path(pts)}" fill="none" stroke="{BEIGE}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>'


def arrow_leaf(x, y, rot, sc=1.0):
    """Arrowhead leaf, stalk joining at (0, 0) between the two back lobes, tip at (0, -200)."""
    # left half, from the notch round the back lobe and up to the tip
    L = (bez((0, -40), (-16, -14), (-44, 30), (-70, 58), 8)
         + bez((-70, 58), (-88, 62), (-96, 30), (-88, 2), 8)[1:]
         + bez((-88, 2), (-80, -70), (-34, -150), (0, -206), 14)[1:])
    s = shape(tf(mirror(L), x, y, rot, sc))
    # the midrib and one vein out into each back lobe
    veins = [[(0, -50), (0, -168)]]
    for sgn in (-1, 1):
        veins.append([(sgn * 12, -50), (sgn * 54, 8)])
    for v in veins:
        s += vein(tf(v, x, y, rot, sc))
    return s


def draw():
    s = head(NAME)
    leaves = [  # (stalk top x, y, tilt, scale, stalk bend) — side leaves behind the middle one
        (140, 330, -50, 0.72, (204, 380)),
        (360, 330, 50, 0.72, (296, 380)),
        (250, 236, 0, 0.94, (244, 330)),
    ]
    for (x, y, r, sc, c) in leaves:
        s += fat_stem((250, 412), (x, y), c)
    for (x, y, r, sc, c) in leaves:
        s += arrow_leaf(x, y, r, sc)
    s += pot()
    return s + tail()
