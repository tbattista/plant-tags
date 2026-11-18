"""Snake plant: upright sword leaves with a couple of bold wavy cross-bands."""
from lib import head, tail, pot, tf, bez, shape, line

KEY = 'snake-plant'
NAME = 'Snake plant'
MATCH = r'snake plant|sansevieria|trifasciata|mother.in.law'


def draw():
    s = head(NAME)
    for (dx, ang, hgt, w) in [(-56, -16, 230, 68), (0, 0, 320, 76), (56, 16, 260, 68)]:
        bx, by = 250 + dx, 412
        outline = bez((-w / 2, 0), (-w / 2 + 2, -hgt * 0.55), (-w * 0.38, -hgt * 0.8), (0, -hgt)) + bez((0, -hgt), (w * 0.38, -hgt * 0.8), (w / 2 - 2, -hgt * 0.55), (w / 2, 0))[1:]
        s += shape(tf(outline, bx, by, ang))
        for f in [0.3, 0.58]:
            yy = -hgt * f
            half = w * 0.26
            band = bez((-half, yy + 6), (-half / 3, yy - 8), (half / 3, yy + 6), (half, yy - 6), 10)
            s += line(tf(band, bx, by, ang))
    s += pot()
    return s + tail()
