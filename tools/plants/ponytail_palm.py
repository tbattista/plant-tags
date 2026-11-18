"""Ponytail palm: a swollen bulb of a trunk with a fountain of long, arching strap leaves."""
from lib import head, tail, pot, line, NAVY, GREEN, BRICK, SW

KEY = 'ponytail-palm'
NAME = 'Ponytail palm'
MATCH = r'ponytail palm|pony.?tail|beaucarnea|nolina|elephant.s foot'


def strap(d, w=22):
    return (f'<path d="{d}" fill="none" stroke="{NAVY}" stroke-width="{w + 2 * SW}" stroke-linecap="round"/>'
            f'<path d="{d}" fill="none" stroke="{GREEN}" stroke-width="{w}" stroke-linecap="round"/>')


def draw():
    s = head(NAME)
    leaves = [  # fanned well apart where they start, so no thin slivers of background get trapped
        'M240 270 C180 196 92 190 72 326',
        'M260 270 C320 196 408 190 428 326',
        'M244 266 C222 150 150 120 112 200',
        'M256 266 C278 150 350 120 388 200',
        'M248 266 C246 160 214 104 172 94',
        'M252 266 C254 160 286 104 328 94',
    ]
    for d in leaves:
        s += strap(d)
    # bulbous base trunk
    s += (f'<path d="M156 414 C136 350 196 318 224 294 L228 240 L272 240 L276 294 C304 318 364 350 344 414 Z" '
          f'fill="{BRICK}" stroke="{NAVY}" stroke-width="{SW}" stroke-linejoin="round"/>')
    s += line([(190, 362), (226, 352), (270, 366), (310, 354)])
    s += pot()
    return s + tail()
