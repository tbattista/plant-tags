"""Pilea (Chinese money plant): round coin leaves on long stalks radiating from a central stem."""
import math
from lib import head, tail, pot, bez, line, ellipse, NAVY, DW

KEY = 'pilea'
NAME = 'Pilea'
MATCH = r'pilea|chinese money|peperomioides|pancake plant|ufo plant|missionary plant'


def draw():
    s = head(NAME)
    trunk = bez((250, 414), (244, 340), (256, 290), (250, 250), 16)
    # (leaf centre x, y, radius, squash, stalk origin on the trunk as an index)
    leaves = [
        (250, 104, 60, 1.0, 16),
        (126, 182, 56, 0.9, 13),
        (374, 182, 56, 0.9, 13),
        (100, 324, 52, 0.84, 8),
        (400, 324, 52, 0.84, 8),
    ]
    for (x, y, r, q, k) in leaves:
        ox, oy = trunk[k]
        ang = math.atan2(oy - y, ox - x)
        ax, ay = x + math.cos(ang) * r * 0.35, y + math.sin(ang) * r * 0.35 * q
        mx, my = (ox + ax) / 2, (oy + ay) / 2 - 22
        s += line(bez((ox, oy), (mx, my), (mx, my), (ax, ay), 12), DW)
    s += line(trunk, 14)
    for (x, y, r, q, k) in leaves:
        ox, oy = trunk[k]
        ang = math.atan2(oy - y, ox - x)
        s += ellipse(x, y, r, r * q, 0 if q == 1.0 else math.degrees(ang) + 90)
        # the navy dot where the stalk joins the middle of the coin
        ax, ay = x + math.cos(ang) * r * 0.35, y + math.sin(ang) * r * 0.35 * q
        s += f'<circle cx="{ax:.1f}" cy="{ay:.1f}" r="11" fill="{NAVY}"/>'
    s += pot()
    return s + tail()
