"""Calathea / prayer plant: a few big upright oval leaves on long stalks, each with two bold stripes."""
import math
from lib import head, tail, pot, tf, shape, line, stem

KEY = 'calathea'
NAME = 'Calathea'
MATCH = r'calathea|goeppertia|maranta|prayer plant|ctenanthe|stromanthe|rattlesnake plant|peacock plant'


def hw(f, W):
    """Half-width of the leaf at fraction f of its length (0 base, 1 tip)."""
    return W * math.sin(math.pi * min(1, max(0, f)) ** 0.85) ** 0.75


def cal_leaf(x, y, rot, sc, L=220, W=66):
    left = [(-hw(i / 30, W), -L * i / 30) for i in range(31)]
    right = [(hw(1 - i / 30, W), -L * (1 - i / 30)) for i in range(1, 30)]
    s = shape(tf(left + right, x, y, rot, sc))
    # two bold stripes following the margins, halfway in (open-ended so they never pinch into the tip)
    a, b, n = 0.16, 0.74, 30
    for side in (-1, 1):
        stripe = [(side * hw(a + (b - a) * i / n, W) * 0.48, -L * (a + (b - a) * i / n)) for i in range(n + 1)]
        s += line(tf(stripe, x, y, rot, sc))
    return s


def draw():
    s = head(NAME)
    leaves = [(184, 336, -50, 0.82), (316, 336, 50, 0.82), (196, 246, -20, 1.0), (304, 246, 20, 1.0)]
    for (x, y, r, sc) in leaves:
        s += stem((250, 405), (x, y), ((250 + x) / 2, 350), 12)
    for (x, y, r, sc) in leaves:
        s += cal_leaf(x, y, r, sc)
    s += pot()
    return s + tail()
