"""Echeveria (and succulents in general): a rosette of plump pointed leaves, seen from the front.

At 30 mm only a few big leaves survive, so the rosette is three layers of wide,
pointed leaves fanning out from one base — back, middle, front."""
from lib import head, tail, pot, tf, bez, mirror, shape

KEY = 'echeveria'
NAME = 'Echeveria'
MATCH = r'echeveria|hens? and chicks|sempervivum|graptopetalum|graptoveria|succulents?'


def petal(L, w):
    half = bez((0, 0), (-w * 1.1, -L * 0.16), (-w * 0.95, -L * 0.74), (0, -L), 12)
    return mirror(half)


def draw():
    s = head(NAME)
    layers = [  # (base x, base y, angle, length, width), back to front
        (250, 392, -80, 196, 96), (250, 392, 80, 196, 96),
        (250, 384, -42, 200, 96), (250, 384, 42, 200, 96),
        (250, 380, 0, 196, 98),
        (250, 402, -56, 156, 96), (250, 402, 56, 156, 96),
        (250, 408, 0, 128, 100),
    ]
    for (x, y, ang, L, w) in layers:
        s += shape(tf(petal(L, w), x, y, ang))
    s += pot()
    return s + tail()
