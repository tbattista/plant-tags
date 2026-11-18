"""Money tree: a braided trunk topped with palmate clusters of five leaflets."""
import math
from lib import head, tail, pot, leaf, stem, circle, path_pts, NAVY, BEIGE

KEY = 'money-tree'
NAME = 'Money tree'
MATCH = r'money tree|pachira|guiana chestnut|malabar chestnut'


def palm(x, y, rot, sc=1.0, n=5, spread=150):
    """A hand of n big leaflets fanned around a navy hub (no midribs: too small to print)."""
    s = ''
    for i in range(n):
        a = rot - spread / 2 + spread * i / (n - 1)
        s += leaf('oval', x, y, a, sc, vein=False, length=112, width=38)
    s += circle(x, y, 13, NAVY, 0)
    return s


def strand(pts):
    """One fat trunk strand: navy edges round a beige core."""
    d = path_pts(pts, False)
    return (f'<path d="{d}" fill="none" stroke="{NAVY}" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<path d="{d}" fill="none" stroke="{BEIGE}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>')


def braid(x, y0, y1, amp=26, period=84):
    """Two strands twisting round each other, crossing over and under in turn."""
    def pt(phase, y):
        return (x + phase * amp * math.sin(2 * math.pi * (y0 - y) / period), y)
    s = ''
    # split at the widest points so each piece holds exactly one crossing
    n = int((y0 - y1) / (period / 2)) + 1
    for i in range(n + 1):
        a = max(y1, y0 - (i - 0.5) * period / 2) if i else y0
        b = max(y1, y0 - (i + 0.5) * period / 2)
        if a <= y1:
            break
        seg = lambda ph: [pt(ph, a - (a - b) * j / 10) for j in range(11)]
        under, over = (1, -1) if i % 2 else (-1, 1)
        s += strand(seg(under)) + strand(seg(over))
    return s


def draw():
    s = head(NAME)
    top = 250
    tops = [(140, 236, -62), (360, 236, 62), (250, 156, 0)]
    for (x, y, r) in tops:
        s += stem((250, top + 10), (x, y), ((250 + x) / 2, top - 30 + (y - 156) * 0.3), 16)
    s += braid(250, 404, top + 6)
    for (x, y, r) in tops:
        s += palm(x, y, r, 1.0)
    s += pot()
    return s + tail()
