"""Aloe vera: a rosette of thick, fleshy, pointed leaves curving out of the pot."""
import math
from lib import head, tail, pot, shape, line, GREEN

KEY = 'aloe'
NAME = 'Aloe vera'
MATCH = r'aloe vera|aloe|barbadensis'


def aloe_leaf(bx, by, ang, bend, length, w, rib=False):
    """A fleshy tapered leaf along a curving centreline (smooth edges: teeth vanish at 30 mm)."""
    n = 40
    pts, a = [(bx, by)], math.radians(ang)
    step = length / n
    for i in range(n):
        a += math.radians(bend) / n
        x, y = pts[-1]
        pts.append((x + step * math.sin(a), y - step * math.cos(a)))
    left, right = [], []
    for i, (x, y) in enumerate(pts):
        j = min(i, n - 1)
        dx, dy = pts[j + 1][0] - pts[j][0], pts[j + 1][1] - pts[j][1]
        L = math.hypot(dx, dy)
        nx, ny = -dy / L, dx / L
        t = i / n
        half = w / 2 * (1 - t) ** 0.7
        left.append((x - nx * half, y - ny * half))
        right.append((x + nx * half, y + ny * half))
    s = shape(left + right[::-1], GREEN)
    if rib:
        s += line(pts[4:int(n * 0.5)])
    return s


def draw():
    s = head(NAME)
    leaves = [  # (base dx, angle, bend, length, width, midrib)
        (-44, -70, 34, 200, 92, False), (44, 70, -34, 200, 92, False),
        (-24, -30, 6, 270, 100, False), (24, 30, -6, 270, 100, False),
        (0, 0, 0, 320, 112, True),
    ]
    for (dx, ang, bend, length, w, rib) in leaves:
        s += aloe_leaf(250 + dx, 420, ang, bend, length, w, rib)
    s += pot()
    return s + tail()
