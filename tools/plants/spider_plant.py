"""Spider plant: a fountain of wide arching strap leaves with a pale centre stripe, one plantlet on a runner."""
import math
from lib import head, tail, pot, bez, shape, line, BEIGE, DW

KEY = 'spider-plant'
NAME = 'Spider plant'
MATCH = r'spider plant|chlorophytum|comosum|airplane plant|ribbon plant'


def ribbon(spine, w0, taper=0.35, stop=1.0):
    """Outline of a strap along a centreline: even width, narrowing a little at the base, pointed tip."""
    n = len(spine)
    left, right = [], []
    for i, (x, y) in enumerate(spine):
        t = i / (n - 1)
        if t > stop:
            break
        a, b = spine[max(i - 1, 0)], spine[min(i + 1, n - 1)]
        tx, ty = b[0] - a[0], b[1] - a[1]
        L = math.hypot(tx, ty) or 1
        nx, ny = -ty / L, tx / L
        hw = w0 / 2 * min(1, (1 - t) / taper) ** 0.8 * (0.75 + 0.25 * min(1, t / 0.2))
        left.append((x + nx * hw, y + ny * hw))
        right.append((x - nx * hw, y - ny * hw))
    return left + list(reversed(right))


def strap(spine, w0, stripe=True):
    s = shape(ribbon(spine, w0))
    if stripe:
        # one bold pale stripe down the middle, no outline of its own
        n = len(spine)
        s += line(spine[int(n * 0.12):int(n * 0.72)], 18, BEIGE)
    return s


def plantlet(x, y):
    """A chunky baby plant: three short fat straps fanning up from the runner tip."""
    s = ''
    for (dx, dy) in [(-66, -30), (66, -30), (0, -76)]:
        sp = bez((x, y), (x + dx * 0.2, y + dy * 0.5), (x + dx * 0.6, y + dy * 0.95), (x + dx, y + dy), 16)
        s += shape(ribbon(sp, 54, taper=0.55))
    return s


def draw():
    s = head(NAME)
    # runner first, so leaves and pot sit over it
    s += line(bez((300, 400), (340, 380), (392, 400), (392, 478), 24), DW)
    # (base, control1, control2, tip) — back leaves first, fanning from a wide base so they don't knot
    leaves = [
        ((234, 412), (210, 230), (120, 80), (76, 190)),
        ((266, 412), (290, 230), (380, 80), (424, 190)),
        ((250, 412), (248, 250), (256, 120), (290, 62)),
        ((228, 412), (160, 290), (70, 250), (58, 380)),
        ((272, 412), (340, 290), (430, 250), (442, 380)),
    ]
    for b, c1, c2, tip in leaves:
        s += strap(bez(b, c1, c2, tip, 40), 76)
    s += pot()
    s += plantlet(392, 506)
    return s + tail()
