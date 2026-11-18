"""Dracaena marginata: bare, curving canes topped with starbursts of spiky leaves."""
from lib import head, tail, pot, tf, bez, shape, stem, mirror

KEY = 'dracaena'
NAME = 'Dracaena'
MATCH = r'dracaena|dragon tree|marginata|corn plant|fragrans|massangeana'


def spike(length, width):
    """A strap leaf with a sharp tip, wide enough that its green survives printing."""
    return mirror(bez((0, 0), (-width, -length * 0.15), (-width * 0.8, -length * 0.7), (0, -length)))


def rosette(x, y, angles, sc=1.0):
    s = ''
    for a in angles:
        length = 150 - abs(a) * 0.3
        s += shape(tf(spike(length, 28), x, y, a, sc))
    return s


def draw():
    s = head(NAME)
    canes = [((136, 262), (206, 340)), ((364, 232), (300, 330)), ((246, 172), (262, 300))]
    for tip, c in canes:
        s += stem((250, 414), tip, c, 16)
    # each starburst leans away from the others so the three stay apart
    fans = [(-126, 30, -86, -8, -46), (126, -30, 86, 8, 46), (-104, 104, -52, 52, 0)]
    for (tip, c), fan in zip(canes, fans):
        s += rosette(tip[0], tip[1], fan, 0.86)
    s += pot()
    return s + tail()
