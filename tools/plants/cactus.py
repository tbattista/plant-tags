"""Cactus: an upright ribbed column with two ribbed arms and a brick flower (spines are too fine for 30 mm)."""
from lib import head, tail, pot, line, circle, NAVY, GREEN, BRICK, SW

KEY = 'cactus'
NAME = 'Cactus'
MATCH = r'cact(us|i)|saguaro|opuntia|prickly pear|mammillaria|echinocactus|cereus'


def tube(d, w, fill=GREEN):
    return (f'<path d="{d}" fill="none" stroke="{NAVY}" stroke-width="{w + 2 * SW}" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<path d="{d}" fill="none" stroke="{fill}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>')


def draw():
    s = head(NAME)
    # arms first, so the trunk covers where they join
    s += tube('M220 320 L166 320 Q132 320 132 286 L132 214', 66)
    s += tube('M280 268 L334 268 Q368 268 368 234 L368 168', 66)
    s += line([(132, 296), (132, 214)]) + line([(368, 246), (368, 168)])
    # trunk: a rounded column with two ribs
    s += (f'<path d="M184 430 L184 166 Q184 100 250 100 Q316 100 316 166 L316 430 Z" fill="{GREEN}" '
          f'stroke="{NAVY}" stroke-width="{SW}" stroke-linejoin="round"/>')
    s += line([(228, 400), (228, 150)]) + line([(272, 400), (272, 150)])
    # flower on top
    for (dx, dy) in [(-22, -2), (22, -2), (0, -18)]:
        s += circle(250 + dx, 98 + dy, 22, BRICK)
    s += pot()
    return s + tail()
