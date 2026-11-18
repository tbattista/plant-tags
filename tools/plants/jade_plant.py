"""Jade plant: a thick woody trunk branching into a few clusters of plump oval leaves."""
import math
from lib import head, tail, pot, ellipse, NAVY, BRICK, SW

KEY = 'jade-plant'
NAME = 'Jade plant'
MATCH = r'jade plant|jade tree|jade|crassula'


def wood(branches):
    """Branches as outlined tubes: every navy edge first, then every fill, so the joints are seamless."""
    s = ''
    for d, w in branches:
        s += f'<path d="{d}" fill="none" stroke="{NAVY}" stroke-width="{w + 2 * SW}" stroke-linecap="round" stroke-linejoin="round"/>'
    for d, w in branches:
        s += f'<path d="{d}" fill="{"none"}" stroke="{BRICK}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>'
    return s


def cluster(x, y, leaves):
    """Leaves fanning from a branch tip: (angle, distance, rx, ry)."""
    s = ''
    for (ang, dist, rx, ry) in leaves:
        a = math.radians(ang)
        cx, cy = x + dist * math.sin(a), y - dist * math.cos(a)
        s += ellipse(cx, cy, rx, ry, ang)
    return s


def draw():
    s = head(NAME)
    s += wood([
        ('M250 430 L250 340 Q244 300 176 262', 38),
        ('M250 340 Q258 296 326 256', 32),
        ('M250 330 Q250 260 250 206', 28),
    ])
    s += cluster(172, 258, [(-105, 54, 32, 48), (-35, 58, 32, 48)])
    s += cluster(330, 252, [(35, 58, 32, 48), (105, 54, 32, 48)])
    s += cluster(250, 202, [(-55, 58, 32, 48), (55, 58, 32, 48), (0, 66, 32, 50)])
    s += pot()
    return s + tail()
