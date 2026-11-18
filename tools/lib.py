"""
Shared drawing kit for the plant-tag starter drawings (samples/*.svg).

Every drawing is an SVG on a 500 × 600 canvas (units ≈ 0.1 mm before the app
scales it into the 40 mm button), in the logo's style: flat fills, bold navy
outlines, four colours only, the same terracotta pot at the bottom.

    python3 scripts/tag-art/build.py            # writes every drawing
    python3 scripts/tag-art/build.py fern aloe  # just these

Rules that keep drawings printable on the 30 mm button with a 0.4 mm nozzle.
The drawing is scaled to roughly HALF size (1 canvas unit ≈ 0.05 mm), and then
  • every stroke is widened to at least 0.6 mm (≈ 12 units here), and
  • any colour area or gap narrower than 0.5 mm (≈ 10 units) is swallowed by
    the colour around it — usually navy, which turns busy areas into blobs.
So draw bold and simple:
  • outlines SW = 12, details DW = 10 (the defaults below)
  • leaves at least ~45 units across; green between two outlines ≥ ~24 units
  • gaps between leaves/stems ≥ ~16 units, or let them overlap cleanly
  • at most 1–2 detail lines (midrib, a stripe) per leaf; none on small leaves
  • 3–8 leaves / main shapes; no tiny dots, teeth, spines or speckles
  • only the four colours below; no gradients, opacity, text
  • keep inside x 45–455, y 45–560; the pot + ground line come from pot()
Check with: node scripts/tag-art/preview.mjs out.png <keys> — the right image of
each pair is the button exactly as it prints. No navy blobs, every leaf readable.
"""
import math

NAVY = '#1d3446'
GREEN = '#5a9a52'
BRICK = '#b8472b'
BEIGE = '#f4f1ea'
SW = 12  # outline width
DW = 10  # detail width (veins, bands)

# where the stems meet the soil: top of the pot rim
SOIL = (250, 410)


def head(title):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 600"><title>{title}</title><rect width="500" height="600" fill="{BEIGE}"/>'


def tail():
    return '</svg>'


def pot(cx=250, rim_y=405, ground=548, w=190, color=BRICK):
    """The standard pot: rim, tapered body, ground line. Draw it after stems so it covers their base."""
    hw = w / 2
    s = f'<g stroke="{NAVY}" stroke-width="{SW}" stroke-linejoin="round" stroke-linecap="round">'
    s += f'<path d="M{cx-hw+14} {rim_y+34} L{cx+hw-14} {rim_y+34} L{cx+hw-34} {ground-4} L{cx-hw+34} {ground-4} Z" fill="{color}"/>'
    s += f'<rect x="{cx-hw}" y="{rim_y}" width="{w}" height="38" rx="6" fill="{color}"/>'
    s += f'<path d="M{cx-hw-12} {ground} L{cx+hw+12} {ground}" fill="none" stroke-width="{SW + 2}"/>'
    s += '</g>'
    return s


def tf(pts, x, y, rot, sc=1.0):
    """Rotate (degrees, clockwise on screen) and scale local points, then move them to (x, y)."""
    a = math.radians(rot)
    c, s = math.cos(a), math.sin(a)
    return [(x + sc * (px * c - py * s), y + sc * (px * s + py * c)) for px, py in pts]


def path_pts(pts, close=True):
    d = 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts)
    return d + (' Z' if close else '')


def bez(p0, p1, p2, p3, n=14):
    """Points along a cubic Bézier."""
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        out.append((u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
                    u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1]))
    return out


def mirror(pts):
    """Left half of a symmetric outline (from base round to tip) → full outline."""
    right = [(-x, y) for x, y in reversed(pts)][1:]
    return pts + right


def shape(pts, fill=GREEN, width=SW):
    return f'<path d="{path_pts(pts)}" fill="{fill}" stroke="{NAVY}" stroke-width="{width}" stroke-linejoin="round"/>'


def line(pts, width=DW, color=NAVY):
    return f'<path d="{path_pts(pts, False)}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"/>'


def stem(p0, p1, ctrl=None, width=DW):
    """A plain navy stem (quadratic curve) from p0 to p1."""
    c = ctrl or ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)
    return f'<path d="M{p0[0]:.1f} {p0[1]:.1f} Q{c[0]:.1f} {c[1]:.1f} {p1[0]:.1f} {p1[1]:.1f}" fill="none" stroke="{NAVY}" stroke-width="{width}" stroke-linecap="round"/>'


def fat_stem(p0, p1, ctrl=None):
    """A thick green stem with navy edges (for chunky petioles: monstera, bird of paradise…)."""
    c = ctrl or ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)
    d = f'M{p0[0]:.1f} {p0[1]:.1f} Q{c[0]:.1f} {c[1]:.1f} {p1[0]:.1f} {p1[1]:.1f}'
    return f'<path d="{d}" fill="none" stroke="{NAVY}" stroke-width="48" stroke-linecap="round"/><path d="{d}" fill="none" stroke="{GREEN}" stroke-width="24" stroke-linecap="round"/>'


def circle(cx, cy, r, fill=GREEN, width=SW):
    return f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{fill}" stroke="{NAVY}" stroke-width="{width}"/>'


def ellipse(cx, cy, rx, ry, rot=0, fill=GREEN, width=SW):
    return f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" transform="rotate({rot:.1f} {cx:.1f} {cy:.1f})" fill="{fill}" stroke="{NAVY}" stroke-width="{width}"/>'


# ---- leaf outlines, pointing up from (0, 0) at the base; place with tf() ----

def heart_leaf():
    """Pothos / philodendron heart: lobes at the base, pointed tip at (0, -74)."""
    L = bez((0, 0), (-18, 8), (-42, -2), (-40, -28)) + bez((-40, -28), (-38, -50), (-16, -62), (0, -74))[1:]
    return mirror(L), [(0, -6), (0, -58)]


def oval_leaf(length=128, width=34):
    """Pointed oval (lance) leaf from base to tip at (0, -length)."""
    w = width
    L = bez((0, -4), (-w, -length * 0.28), (-w, -length * 0.75), (0, -length))
    return mirror(L), [(0, -14), (0, -length * 0.86)]


def round_leaf(r=40):
    """Round leaf on a short base (pilea, peperomia): circle-ish, base at (0, 0)."""
    pts = []
    for i in range(41):
        a = math.pi / 2 + (i / 40) * 2 * math.pi
        pts.append((r * math.cos(a) * 1.0, -r + r * math.sin(a) * -1.0))
    return pts, [(0, -4), (0, -2 * r + 10)]


def leaf(kind, x, y, rot=0, sc=1.0, fill=GREEN, vein=True, **kw):
    """A placed leaf with its midrib. kind: 'heart' | 'oval' | 'round' (extra args go to the shape)."""
    outline, rib = {'heart': heart_leaf, 'oval': oval_leaf, 'round': round_leaf}[kind](**kw)
    s = shape(tf(outline, x, y, rot, sc), fill)
    if vein:
        s += line(tf(rib, x, y, rot, sc))
    return s
