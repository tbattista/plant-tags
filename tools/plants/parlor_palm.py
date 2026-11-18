"""Parlour palm: three arching fronds of a few wide paired leaflets that droop toward the tips."""
import math
from lib import head, tail, pot, tf, bez, mirror, shape, line, SW

KEY = 'parlor-palm'
NAME = 'Parlour palm'
MATCH = r'parlou?r palm|chamaedorea|areca|dypsis|kentia|howea|\bpalms?\b'


def leaflet(ln, w):
    return mirror(bez((0, 0), (-w, -ln * 0.28), (-w * 0.75, -ln * 0.72), (0, -ln)))


def frond(ctrl, ts, ln=100, wd=32, spread=62, droop=0.3, tip=0.75):
    """Leaflet pairs at fractions `ts` along a Bézier rib, swept `spread` degrees off the rib and pulled
    down by `droop`; one leaflet finishes the tip (tip=0: the last pair does). Leaflets are few and wide so they stay apart at 30 mm."""
    rib = bez(*ctrl, 60)
    s = ''
    n = len(ts)
    for i, t in enumerate(ts):
        k = min(int(t * 60), 59)
        (ax, ay), (bx, by) = rib[k], rib[k + 1]
        L = math.hypot(bx - ax, by - ay)
        dx, dy = (bx - ax) / L, (by - ay) / L
        size = 1.0 - 0.2 * i / max(1, n - 1)
        for side in (-1, 1):
            a = math.radians(side * spread)
            vx, vy = dx * math.cos(a) - dy * math.sin(a), dx * math.sin(a) + dy * math.cos(a)
            vy += droop
            rot = math.degrees(math.atan2(vx, -vy))
            s += shape(tf(leaflet(ln * size, wd * size), ax, ay, rot))
    if not tip:
        return line(rib, SW) + s
    (ax, ay), (bx, by) = rib[-2], rib[-1]
    s += shape(tf(leaflet(ln * tip, wd * 0.9), bx, by, math.degrees(math.atan2(bx - ax, -(by - ay)))))
    return line(rib, SW) + s


def draw():
    s = head(NAME)
    for side in (-1, 1):
        X = lambda x: 250 + side * (x - 250)
        s += frond(((250, 410), (X(228), 310), (X(170), 226), (X(104), 258)), ts=(0.52, 0.98), ln=112, wd=28, spread=46, droop=0.8, tip=0)
    s += frond(((250, 410), (250, 320), (248, 220), (252, 112)), ts=(0.66, 0.88), ln=112, wd=28, spread=40, droop=0.3, tip=0.7)
    s += pot()
    return s + tail()
