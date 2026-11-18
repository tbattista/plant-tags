/**
 * tags/geometry.js — turns a plant drawing into a printable NFC plant tag.
 *
 * Two prints:
 *   • the holder, in black: a round cup on top of a spike, printed flat with
 *     the cup open upward. The cup has a shallow pocket for a 25 mm NFC sticker
 *     and above it a recess 0.4 mm deeper than the button, so the button's
 *     face sits just below the rim and the gap can be filled with clear epoxy.
 *   • the button, in four colours: a disc printed face-down, the drawing in
 *     the first two layers. It presses into the cup over the sticker (three
 *     small nubs grip it; a drop of glue makes it permanent).
 *
 * Drawing pipeline: SVG → fitted into the button's circle → raster at 20 px/mm
 * → each pixel snapped to the palette → specks removed → per-colour outlines
 * traced along pixel edges → partitioned so the colours never overlap →
 * extruded with manifold-3d. Millimetres throughout; heights are multiples of
 * 0.2 mm layers.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import Module from 'manifold-3d';
import { PALETTE, hexToRgb } from './palette.js';

export const TAG = {
  // 1.6 mm = eight 0.2 mm layers: the two colour layers and six of beige behind them
  button: { diameter: 30, thickness: 1.6, margin: 1.5 }, // margin: plain beige ring around the drawing
  colorDepth: 0.4, // two 0.2 mm layers of colour on the face; from 0.4 mm up it is solid beige
  holder: {
    wall: 2.4, // cup rim around the button
    // the cup above the sticker: deeper than the button, so it sits 0.4 mm below the rim
    // and the gap over its face can be filled with clear epoxy
    recess: 2.0,
    floor: 0.8, // under the sticker: four layers
    sticker: { diameter: 25.4, depth: 0.4 }, // 25 mm NFC sticker, paper-thin, snug
    // in-plane spikes, measured from the cup's edge: the tall stake (≈ 4.6″) and a short one (≈ 1.5″)
    spike: { neck: 14, width: 10, neckLen: 4, taperLen: 16, length: 100, tip: 18 },
    short: { neck: 10, width: 6, neckLen: 3, taperLen: 8, length: 30, tip: 8 },
    // the flat holder: the cup lies on the soil and a “+”-shaped pin goes down from its back
    pin: { length: 45, span: 9, arm: 1.8, core: 4, tipScale: 0.25 },
    // the "tap here" icon (icons/tap.svg): on a badge under the cup (raised),
    // on the back of the cup (recessed, so it prints on the plate), or on a tab off
    // the flat holder's rim (recessed into its face, which prints on the plate)
    // relief is black on black, so detail only needs to be one nozzle wide (not minFeature, which is for colour inlays)
    // The icon is its own part (filament 2), so it gets its own colour without painting:
    // raised on the badge, or a flush inlay in the plate-side face (back, tab) — like the button's colours.
    icon: { relief: 0.4, badge: { width: 24, height: 23, radius: 4, size: 19, raise: 0.6 }, back: { size: 27, depth: 0.6 }, tab: { width: 22, height: 20, radius: 4, size: 17, depth: 0.6 } },
    nub: { count: 3, protrude: 0.25, radius: 1.2, height: 0.8 }, // grips the button's edge
    // a round bump on the cup wall at the bottom (the spike's side) that fits a round notch
    // in the button's edge at the bottom of the picture: the button only goes in upright.
    // Round, because small square corners don't print cleanly. The bump is a cylinder of
    // this radius whose centre sits `offset` outside the bore, so it stands `radius − offset` proud.
    key: { radius: 1.4, offset: 0.35 },
  },
  clearance: 0.3, // button diameter + this = cup bore (tune with the fit test)
  layer: 0.2,
  pxPerMm: 20,
  minIsland: 0.3, // mm² — smaller specks are dropped
  // a 0.4 mm nozzle: drawn lines are widened to minLine (≈1.5 extrusion widths) before
  // rasterising, then any colour area or gap still narrower than minFeature is given
  // to the colour around it, so nothing is left that the nozzle can't lay down cleanly
  minLine: 0.6, // mm
  minFeature: 0.5, // mm
};

/**
 * The round notch in the button's edge, at the bottom of the picture: the
 * cup's bump plus a little play all round. Its depth stays inside the plain
 * margin ring, so it never cuts the drawing. `cx, cy` is the button's centre.
 */
export const NOTCH_PLAY = 0.15;
export function keyCentre(clearance = TAG.clearance) {
  return -((TAG.button.diameter + clearance) / 2 + TAG.holder.key.offset);
}
export function buttonNotch(M, keep, cx, cy, clearance = TAG.clearance) {
  const k = TAG.holder.key;
  return keep(keep(M.CrossSection.circle(k.radius + NOTCH_PLAY, 48)).translate([cx, cy + keyCentre(clearance)]));
}

/** Depth of the holder: floor + sticker pocket + the cup the button sits in. */
export const holderThickness = () => +(TAG.holder.floor + TAG.holder.sticker.depth + TAG.holder.recess).toFixed(2);
/** How far the button's face sits below the cup's rim: the room left for epoxy. */
export const epoxyGap = () => +(TAG.holder.recess - TAG.button.thickness).toFixed(2);

let wasmReady;
async function wasm() {
  if (!wasmReady) {
    wasmReady = Module().then((m) => {
      m.setup();
      return m;
    });
  }
  return wasmReady;
}

/** Collects WebAssembly objects so they can be freed together. */
function arena() {
  const all = [];
  const keep = (o) => (all.push(o), o);
  keep.free = () => {
    for (const o of all) {
      try {
        o.delete();
      } catch {
        /* already freed */
      }
    }
  };
  return keep;
}

// ------------------------------------------------------------- raster --

const COLORS = PALETTE.map((p) => hexToRgb(p.art));
function nearestLabel(r, g, b) {
  let best = 0;
  let bestD = Infinity;
  for (let k = 0; k < COLORS.length; k++) {
    const [cr, cg, cb] = COLORS[k];
    // weighted RGB distance, close enough to perception for four far-apart colours
    const d = 2 * (r - cr) ** 2 + 4 * (g - cg) ** 2 + 3 * (b - cb) ** 2;
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
}

/**
 * Rasterise without anti-aliasing: a blended edge pixel (navy + beige, say)
 * can be nearer a third colour and would leave a thin fringe of it.
 */
async function render(svg, w, h) {
  const crisp = svg.replace(/^<svg\b/, '<svg shape-rendering="crispEdges"');
  return sharp(Buffer.from(crisp), { density: 300 }).resize(w, h, { fit: 'fill' }).flatten({ background: PALETTE[0].art }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
}

/** Smallest circle containing all points (Welzl, iterative; points shuffled deterministically). */
export function enclosingCircle(points) {
  const P = points.slice();
  let seed = 7;
  for (let i = P.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [P[i], P[j]] = [P[j], P[i]];
  }
  const inC = (c, p) => Math.hypot(p[0] - c.x, p[1] - c.y) <= c.r + 1e-7;
  const two = (a, b) => ({ x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, r: Math.hypot(a[0] - b[0], a[1] - b[1]) / 2 });
  const three = (a, b, c) => {
    const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    if (Math.abs(d) < 1e-12) {
      const cands = [two(a, b), two(a, c), two(b, c)];
      return cands.reduce((m, q) => (q.r > m.r ? q : m));
    }
    const sq = (p) => p[0] * p[0] + p[1] * p[1];
    const x = (sq(a) * (b[1] - c[1]) + sq(b) * (c[1] - a[1]) + sq(c) * (a[1] - b[1])) / d;
    const y = (sq(a) * (c[0] - b[0]) + sq(b) * (a[0] - c[0]) + sq(c) * (b[0] - a[0])) / d;
    return { x, y, r: Math.hypot(a[0] - x, a[1] - y) };
  };
  let c = { x: P[0][0], y: P[0][1], r: 0 };
  for (let i = 1; i < P.length; i++) {
    if (inC(c, P[i])) continue;
    c = { x: P[i][0], y: P[i][1], r: 0 };
    for (let j = 0; j < i; j++) {
      if (inC(c, P[j])) continue;
      c = two(P[i], P[j]);
      for (let k = 0; k < j; k++) if (!inC(c, P[k])) c = three(P[i], P[j], P[k]);
    }
  }
  return c;
}

/**
 * Place a drawing (a cleaned SVG on its 500 × 600 canvas) inside the button:
 * the smallest circle around the drawn part (everything not background) is
 * centred and scaled to the inner edge of the margin.
 */
export async function fitToButton(svg) {
  const m = svg.match(/^<svg[^>]*viewBox="0 0 (\d+) (\d+)"[^>]*>([\s\S]*)<\/svg>$/);
  if (!m) throw new Error('fitToButton expects a cleaned drawing');
  const [vw, vh, inner] = [+m[1], +m[2], m[3]];
  const { data, info } = await render(svg, vw, vh);
  // the outer corners of each row's leftmost and rightmost drawn pixel
  const pts = [];
  for (let y = 0; y < vh; y++) {
    let lo = -1;
    let hi = -1;
    for (let x = 0; x < vw; x++) {
      const i = (y * vw + x) * info.channels;
      if (nearestLabel(data[i], data[i + 1], data[i + 2]) === 0) continue;
      if (lo < 0) lo = x;
      hi = x;
    }
    if (lo >= 0) pts.push([lo, y], [lo, y + 1], [hi + 1, y], [hi + 1, y + 1]);
  }
  const D = TAG.button.diameter * 10; // 0.1 mm units, like the drawings
  const R = D / 2 - TAG.button.margin * 10;
  if (!pts.length) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${D} ${D}"><rect width="${D}" height="${D}" fill="${PALETTE[0].art}"/></svg>`;
  // centre on the smallest circle around the drawing, so it fills the button
  const { x: cx, y: cy, r: far } = enclosingCircle(pts);
  const k = R / Math.max(far, 1);
  const t = (n) => +n.toFixed(3);
  // shrinking thins the lines; keep every line at least TAG.minLine wide so the nozzle can draw it
  const lines = inner.replace(/stroke-width="([\d.]+)"/g, (_, n) => `stroke-width="${t(Math.max(+n, (TAG.minLine * 10) / k))}"`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${D} ${D}"><rect width="${D}" height="${D}" fill="${PALETTE[0].art}"/><g transform="translate(${t(D / 2 - cx * k)} ${t(D / 2 - cy * k)}) scale(${t(k)})">${lines}</g></svg>`;
}

/** Render the (fitted) drawing over the button and label every pixel with a palette index. */
export async function quantize(fitted) {
  const w = Math.round(TAG.button.diameter * TAG.pxPerMm);
  const h = w;
  const { data, info } = await render(fitted, w, h);
  const labels = new Uint8Array(w * h);
  const ch = info.channels;
  for (let i = 0; i < w * h; i++) labels[i] = nearestLabel(data[i * ch], data[i * ch + 1], data[i * ch + 2]);
  // twice: the later clean-ups can leave a few new slivers behind
  for (let round = 0; round < 2; round++) {
    removeThin(labels, w, h, (TAG.minFeature / 2) * TAG.pxPerMm);
    removeSpecks(labels, w, h, Math.round(TAG.minIsland * TAG.pxPerMm * TAG.pxPerMm));
    fixCornerTouches(labels, w, h);
  }
  return { w, h, labels };
}

/** Two same-coloured pixels touching only at a corner would trace into shapes that meet at a single point; fill one of the other pair. */
function fixCornerTouches(labels, w, h) {
  for (let pass = 0, changed = true; changed && pass < 8; pass++) {
    changed = false;
    for (let y = 0; y < h - 1; y++) {
      for (let x = 0; x < w - 1; x++) {
        const a = labels[y * w + x];
        const b = labels[y * w + x + 1];
        const c = labels[(y + 1) * w + x];
        const d = labels[(y + 1) * w + x + 1];
        if (a === d && b === c && a !== b) {
          labels[y * w + x + 1] = a;
          changed = true;
        } else if (b === c && a !== b && d !== b && a !== d) {
          // b and c meet only at the corner, between two other colours
          labels[y * w + x] = b;
          changed = true;
        } else if (a === d && b !== a && c !== a && b !== c) {
          labels[y * w + x + 1] = a;
          changed = true;
        }
      }
    }
}
}

/** Squared Euclidean distance transform (Felzenszwalb–Huttenlocher): f holds 0 at sources, Infinity elsewhere. */
function edt(f, w, h) {
  const INF = 1e20;
  const n = Math.max(w, h);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  const g = new Float64Array(n);
  const pass = (len, get, set) => {
    for (let q = 0; q < len; q++) g[q] = get(q);
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < len; q++) {
      let s;
      while (true) {
        s = (g[q] + q * q - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        if (s > z[k] || k === 0) break;
        k--;
      }
      if (s <= z[k]) {
        v[0] = q;
        z[0] = -INF;
        z[1] = INF;
        k = 0;
        continue;
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) {
      while (z[k + 1] < q) k++;
      d[q] = (q - v[k]) ** 2 + g[v[k]];
    }
    for (let q = 0; q < len; q++) set(q, d[q]);
  };
  const out = Float64Array.from(f, (x) => (x === Infinity ? INF : x));
  for (let x = 0; x < w; x++) pass(h, (y) => out[y * w + x], (y, val) => (out[y * w + x] = val));
  for (let y = 0; y < h; y++) pass(w, (x) => out[y * w + x], (x, val) => (out[y * w + x] = val));
  return out;
}

/**
 * Morphological opening of every colour with a disc of radius r (pixels):
 * whatever part of a colour is narrower than 2r — a hairline, a sliver of gap
 * between two outlines — is handed to the nearest colour that is wide enough.
 */
export function removeThin(labels, w, h, r) {
  const r2 = r * r;
  const kept = new Int16Array(w * h).fill(-1);
  for (let L = 0; L < PALETTE.length; L++) {
    // distance to the nearest pixel that isn't this colour (the canvas edge counts as one)
    const f = new Float64Array(w * h);
    for (let i = 0; i < w * h; i++) f[i] = labels[i] === L ? Infinity : 0;
    const inner = edt(f, w, h);
    // the core: pixels at least r from any other colour or the edge
    const g = new Float64Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const x = i % w;
      const y = (i - x) / w;
      const edge = Math.min(x + 1, y + 1, w - x, h - y);
      g[i] = labels[i] === L && inner[i] >= r2 && edge * edge >= r2 ? 0 : Infinity;
    }
    // grow the core back by r: what's within r of it survives
    const grown = edt(g, w, h);
    for (let i = 0; i < w * h; i++) if (labels[i] === L && grown[i] <= r2) kept[i] = L;
  }
  // everything else takes the colour of the nearest kept pixel (breadth-first from all of them)
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < w * h; i++) if (kept[i] >= 0) queue[tail++] = i;
  if (!tail) return 0;
  let changed = 0;
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
      if (j < 0 || j >= w * h || kept[j] >= 0) continue;
      kept[j] = kept[i];
      queue[tail++] = j;
    }
  }
  for (let i = 0; i < w * h; i++) {
    if (labels[i] !== kept[i]) {
      labels[i] = kept[i];
      changed++;
    }
  }
  return changed;
}

/** Patches smaller than `min` pixels take the colour that surrounds them most. */
function removeSpecks(labels, w, h, min) {
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const comp = [];
  for (let start = 0; start < w * h; start++) {
    if (seen[start]) continue;
    const L = labels[start];
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    comp.length = 0;
    const around = new Map();
    while (top) {
      const i = stack[--top];
      comp.push(i);
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j < 0 || j >= w * h) continue;
        if (labels[j] === L) {
          if (!seen[j]) {
            seen[j] = 1;
            stack[top++] = j;
          }
        } else if (comp.length < min) around.set(labels[j], (around.get(labels[j]) || 0) + 1);
      }
      if (comp.length >= min) {
        // big enough: finish marking it without collecting neighbours
        while (top) {
          const k = stack[--top];
          const kx = k % w;
          for (const j of [kx > 0 ? k - 1 : -1, kx < w - 1 ? k + 1 : -1, k - w, k + w]) {
            if (j >= 0 && j < w * h && !seen[j] && labels[j] === L) {
              seen[j] = 1;
              stack[top++] = j;
            }
          }
        }
        break;
      }
    }
    if (comp.length < min && around.size) {
      let best = L;
      let n = -1;
      for (const [k, c] of around) if (c > n) [best, n] = [k, c];
      for (const i of comp) labels[i] = best;
    }
  }
}

/**
 * Outlines of one label as closed loops along pixel edges (even-odd: holes
 * come out as their own loops), already mapped into button coordinates (0…diameter mm) —
 * mirrored, because the button prints face-down.
 */
export function trace({ w, h, labels }, label) {
  const W1 = w + 1;
  const next1 = new Int32Array(W1 * (h + 1)).fill(-1);
  const next2 = new Int32Array(W1 * (h + 1)).fill(-1);
  const add = (a, b) => {
    if (next1[a] === -1) next1[a] = b;
    else next2[a] = b;
  };
  const is = (x, y) => x >= 0 && y >= 0 && x < w && y < h && labels[y * w + x] === label;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (labels[y * w + x] !== label) continue;
      if (!is(x, y - 1)) add(y * W1 + x, y * W1 + x + 1);
      if (!is(x + 1, y)) add(y * W1 + x + 1, (y + 1) * W1 + x + 1);
      if (!is(x, y + 1)) add((y + 1) * W1 + x + 1, (y + 1) * W1 + x);
      if (!is(x - 1, y)) add((y + 1) * W1 + x, y * W1 + x);
    }
  }
  const take = (a) => {
    const b = next1[a];
    if (b === -1) return -1;
    next1[a] = next2[a];
    next2[a] = -1;
    return b;
  };
  const s = 1 / TAG.pxPerMm;
  const D = TAG.button.diameter;
  const toFace = (v) => {
    const x = v % W1;
    const y = (v - x) / W1;
    return [D - x * s, D - y * s];
  };
  const loops = [];
  for (let start = 0; start < next1.length; start++) {
    while (next1[start] !== -1) {
      const pts = [];
      let prev = start;
      let cur = take(start);
      let lastDir = -1;
      pts.push(start);
      while (cur !== -1 && cur !== start) {
        const dir = cur - prev;
        if (dir === lastDir) pts[pts.length - 1] = cur; // extend a straight run
        else pts.push(cur);
        lastDir = dir;
        prev = cur;
        cur = take(cur);
      }
      if (pts.length >= 3) loops.push(pts.map(toFace));
    }
  }
  return loops;
}

// -------------------------------------------------------------- meshes --

function meshOf(manifold) {
  const m = manifold.getMesh();
  const n = m.vertProperties.length / m.numProp;
  const vertices = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    vertices[i * 3] = m.vertProperties[i * m.numProp];
    vertices[i * 3 + 1] = m.vertProperties[i * m.numProp + 1];
    vertices[i * 3 + 2] = m.vertProperties[i * m.numProp + 2];
  }
  return { vertices, triangles: Uint32Array.from(m.triVerts) };
}

function checked(manifold, what) {
  const status = manifold.status();
  if (status !== 'NoError') throw new Error(`${what}: geometry error ${status}`);
  return manifold;
}

/**
 * Build the button from a cleaned drawing: [{ key, name, slot, filament, art,
 * mesh, volume }] (colours with nothing to print are left out), centred on the
 * origin, plus an SVG preview of the button sitting in its black cup.
 */
export async function buildButton(svg) {
  const M = await wasm();
  const keep = arena();
  try {
    const { CrossSection } = M;
    const { diameter: D, thickness: T } = TAG.button;
    const depth = TAG.colorDepth;
    const q = await quantize(await fitToButton(svg));
    // the bottom of the picture is at −Y here (the face is traced mirrored), like the holder's key
    const disc = keep(keep(keep(CrossSection.circle(D / 2, 160)).translate([D / 2, D / 2])).subtract(buttonNotch(M, keep, D / 2, D / 2)));
    const art = PALETTE.map((p, i) => {
      if (i === 0) return null;
      const loops = trace(q, i);
      // a colour can vanish entirely (all of it too thin to print)
      if (!loops.length) return keep(CrossSection.compose([]));
      return keep(keep(keep(new CrossSection(loops, 'EvenOdd')).simplify(0.02)).intersect(disc));
    });
    const navy = art[1];
    const green = keep(art[2].subtract(navy));
    const brick = keep(keep(art[3].subtract(navy)).subtract(green));
    const beige = keep(disc.subtract(keep(CrossSection.union([navy, green, brick]))));
    const regions = { beige, navy, green, brick };
    // beige is the whole disc minus the coloured inlays; the margin keeps the
    // inlays off the edge, so no inlay wall coincides with the disc's wall
    const inlays = keep(keep(CrossSection.union([navy, green, brick])).extrude(depth));
    const body = keep(keep(disc.extrude(T)).subtract(inlays));
    const parts = [];
    for (const p of PALETTE) {
      const region = regions[p.key];
      if (region.isEmpty() || region.area() < TAG.minIsland) continue;
      let solid = p.key === 'beige' ? body : keep(region.extrude(depth));
      solid = checked(keep(solid.translate([-D / 2, -D / 2, 0])), p.name);
      parts.push({ key: p.key, name: p.name, slot: p.slot, filament: p.filament, art: p.art, mesh: meshOf(solid), volume: solid.volume() });
    }
    return { parts, preview: previewSvg(regions) };
  } finally {
    keep.free();
  }
}

/**
 * Holder styles: 'stake' (a tall spike), 'short' (a ≈ 1.5″ spike) and 'flat'
 * (the cup lies face-up on the soil with a pin going down from its back).
 */
export const HOLDER_STYLES = ['stake', 'short', 'flat'];
/** Where a holder can carry the "tap here" icon. */
export const HOLDER_ICONS = { stake: ['under', 'back'], short: ['under', 'back'], flat: ['tab'] };

const TAP_SVG = fs.readFileSync(path.join(import.meta.dirname, '..', 'icons', 'tap.svg'), 'utf8');

/**
 * The "tap here" icon as a cross-section `size` mm across, centred on the
 * origin, y up (mirrored left-right with `mirror`, for reading from behind).
 * Rasterised and cleaned like a button drawing, but to one nozzle width
 * (TAG.holder.icon.relief): it is a raised or recessed relief, not a colour.
 */
async function iconSection(M, keep, size, { mirror = false } = {}) {
  const w = Math.round(size * TAG.pxPerMm);
  const { data, info } = await sharp(Buffer.from(TAP_SVG.replace(/^<svg\b/, '<svg shape-rendering="crispEdges"')), { density: 600 })
    .resize(w, w, { fit: 'fill' })
    .flatten({ background: '#ffffff' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const labels = new Uint8Array(w * w);
  for (let i = 0; i < w * w; i++) labels[i] = data[i * info.channels] < 128 ? 1 : 0;
  for (let round = 0; round < 2; round++) {
    removeThin(labels, w, w, (TAG.holder.icon.relief / 2) * TAG.pxPerMm);
    removeSpecks(labels, w, w, Math.round(TAG.minIsland * TAG.pxPerMm * TAG.pxPerMm));
  }
  // trace() maps pixels onto the face-down button; undo that to plain mm, centred, y up
  const D = TAG.button.diameter;
  const loops = trace({ w, h: w, labels }, 1).map((loop) => loop.map(([fx, fy]) => [((D - fx) - size / 2) * (mirror ? -1 : 1), -((D - fy) - size / 2)]));
  return keep(keep(new M.CrossSection(loops, 'EvenOdd')).simplify(0.02));
}

const roundedRect = (M, keep, w, h, r, cx, cy) => keep(keep(keep(M.CrossSection.square([w - 2 * r, h - 2 * r], true)).offset(r, 'Round', 2, 32)).translate([cx, cy]));

/**
 * A holder as printed. Stakes lie flat (cup open upward, spike along −Y) with
 * the cup centred on the origin; `stub` replaces the spike with a short stub
 * (for the fit test). The flat holder prints upside down — cup rim on the
 * bed, pin pointing up — so nothing needs supports.
 */
export async function buildHolder({ clearance = TAG.clearance, stub = null, style = 'stake', icon = null } = {}) {
  if (!HOLDER_STYLES.includes(style)) throw new Error(`Unknown holder style ${style}`);
  if (icon && !HOLDER_ICONS[style].includes(icon)) throw new Error(`A ${style} holder can't have its icon ${icon}`);
  const M = await wasm();
  const keep = arena();
  try {
    const { Manifold, CrossSection } = M;
    const h = TAG.holder;
    const T = holderThickness();
    const bore = (TAG.button.diameter + clearance) / 2;
    const outer = bore + h.wall;
    let outline = keep(CrossSection.circle(outer, 160));
    if (style !== 'flat') {
      const sp = style === 'short' ? h.short : h.spike;
      const neckEnd = -(outer + sp.neckLen);
      const taperEnd = -(outer + sp.taperLen);
      const shaftEnd = stub ? -(outer + stub) : -(outer + sp.length);
      const pts = [
        [-sp.neck / 2, 0],
        [-sp.neck / 2, neckEnd],
        [-sp.width / 2, taperEnd],
        [-sp.width / 2, shaftEnd],
        ...(stub ? [] : [[0, shaftEnd - sp.tip]]),
        [sp.width / 2, shaftEnd],
        [sp.width / 2, taperEnd],
        [sp.neck / 2, neckEnd],
        [sp.neck / 2, 0],
      ];
      outline = keep(outline.add(keep(new CrossSection([pts], 'Positive'))));
    }
    const ic = h.icon;
    // the badge under the cup, or the flat holder's tab: part of the outline, before anything is cut
    const badgeY = -(outer + ic.badge.height / 2 - 4);
    const tabY = -(outer + ic.tab.height / 2 - 4);
    if (icon === 'under') outline = keep(outline.add(roundedRect(M, keep, ic.badge.width, ic.badge.height, ic.badge.radius, 0, badgeY)));
    if (icon === 'tab') outline = keep(outline.add(roundedRect(M, keep, ic.tab.width, ic.tab.height, ic.tab.radius, 0, tabY)));
    let solid = keep(outline.extrude(T));
    const recessBottom = T - h.recess;
    solid = keep(solid.subtract(keep(keep(Manifold.cylinder(h.recess + 1, bore, bore, 160)).translate([0, 0, recessBottom]))));
    const st = h.sticker;
    solid = keep(solid.subtract(keep(keep(Manifold.cylinder(st.depth + 0.01, st.diameter / 2, st.diameter / 2, 128)).translate([0, 0, recessBottom - st.depth]))));
    // the key: a round bump down the bore wall at the bottom (−Y, the spike's side), the full depth of the cup
    const bump = keep(keep(Manifold.cylinder(h.recess, h.key.radius, h.key.radius, 48)).translate([0, keyCentre(clearance), recessBottom]));
    solid = keep(solid.add(keep(bump.intersect(keep(keep(Manifold.cylinder(h.recess, outer, outer, 160)).translate([0, 0, recessBottom]))))));
    // nubs on the bore wall, near the top, that grip the button's edge
    const n = h.nub;
    for (let i = 0; i < n.count; i++) {
      const a = (Math.PI * 2 * i) / n.count + Math.PI / 2;
      const r = bore + n.radius - n.protrude;
      const nub = keep(keep(Manifold.cylinder(n.height, n.radius, n.radius, 32)).translate([Math.cos(a) * r, Math.sin(a) * r, T - n.height - 0.6]));
      solid = keep(solid.add(keep(nub.intersect(keep(keep(Manifold.cylinder(n.height, outer, outer, 160)).translate([0, 0, T - n.height - 0.6]))))));
    }
    // the icon: its own part, so the slicer can give it its own filament
    let iconSolid = null;
    if (icon === 'under') {
      // raised on the front of the badge below the rim (printed on top: no supports)
      const art = await iconSection(M, keep, ic.badge.size);
      iconSolid = keep(keep(art.extrude(ic.badge.raise)).translate([0, badgeY - 1, T]));
    }
    if (icon === 'back') {
      // a flush inlay in the back, which lies on the plate; mirrored to read right from behind
      const art = await iconSection(M, keep, ic.back.size, { mirror: true });
      iconSolid = keep(art.extrude(ic.back.depth));
    }
    if (icon === 'tab') {
      // a flush inlay in the tab's face, which prints on the plate once the holder is flipped
      const art = await iconSection(M, keep, ic.tab.size);
      iconSolid = keep(keep(art.extrude(ic.tab.depth)).translate([0, tabY - 0.5, T - ic.tab.depth]));
    }
    if (iconSolid && icon !== 'under') solid = keep(solid.subtract(iconSolid));
    if (style === 'flat') {
      // the pin under the cup's floor: a “+” that narrows to a point, around a round core
      const pin = h.pin;
      const plus = keep(
        CrossSection.union([
          keep(CrossSection.square([pin.span, pin.arm], true)),
          keep(CrossSection.square([pin.arm, pin.span], true)),
          keep(CrossSection.circle(pin.core / 2, 48)),
        ]),
      );
      const shaft = keep(keep(plus.extrude(pin.length, 0, 0, [pin.tipScale, pin.tipScale])).mirror([0, 0, 1]));
      solid = keep(solid.add(keep(shaft.translate([0, 0, 0.01]))));
      // print upside down: rim on the bed (z = 0), pin pointing up
      const flip = (m) => keep(keep(m.rotate([180, 0, 0])).translate([0, 0, T]));
      solid = flip(solid);
      if (iconSolid) iconSolid = flip(iconSolid);
    }
    checked(solid, 'Holder');
    if (iconSolid) checked(iconSolid, 'Holder icon');
    const bb = solid.boundingBox();
    return {
      mesh: meshOf(solid),
      iconMesh: iconSolid ? meshOf(iconSolid) : null,
      volume: solid.volume(),
      iconVolume: iconSolid ? iconSolid.volume() : 0,
      length: bb.max[1] - bb.min[1],
      height: bb.max[2] - bb.min[2],
      thickness: T,
      bore,
      style,
      icon,
    };
  } finally {
    keep.free();
  }
}

/** A plain single-colour button for the fit test. */
async function plainButton() {
  const M = await wasm();
  const keep = arena();
  try {
    const disc = keep(keep(M.CrossSection.circle(TAG.button.diameter / 2, 160)).subtract(buttonNotch(M, keep, 0, 0)));
    return meshOf(checked(keep(disc.extrude(TAG.button.thickness)), 'Fit-test button'));
  } finally {
    keep.free();
  }
}

/** Merge meshes into one, each moved by its [dx, dy]. */
function merge(pieces) {
  let nv = 0;
  let nt = 0;
  for (const p of pieces) {
    nv += p.mesh.vertices.length;
    nt += p.mesh.triangles.length;
  }
  const vertices = new Float32Array(nv);
  const triangles = new Uint32Array(nt);
  let vo = 0;
  let to = 0;
  for (const p of pieces) {
    const base = vo / 3;
    for (let i = 0; i < p.mesh.vertices.length; i += 3) {
      vertices[vo + i] = p.mesh.vertices[i] + p.dx;
      vertices[vo + i + 1] = p.mesh.vertices[i + 1] + p.dy;
      vertices[vo + i + 2] = p.mesh.vertices[i + 2];
    }
    for (let i = 0; i < p.mesh.triangles.length; i++) triangles[to + i] = p.mesh.triangles[i] + base;
    vo += p.mesh.vertices.length;
    to += p.mesh.triangles.length;
  }
  return { vertices, triangles };
}

/**
 * Fit test: three cups with stubs — short = snug (0.2 mm slack), medium = 0.3,
 * long = loose (0.4) — and a plain button. Try the button in each; keep the one
 * that clicks in and stays.
 */
export async function buildFitTest() {
  const sizes = [
    { clearance: 0.2, stub: 6 },
    { clearance: 0.3, stub: 14 },
    { clearance: 0.4, stub: 22 },
  ];
  const pieces = [];
  for (const [i, s] of sizes.entries()) {
    const cup = await buildHolder({ clearance: s.clearance, stub: s.stub });
    pieces.push({ mesh: cup.mesh, dx: i * 50, dy: 0 });
  }
  pieces.push({ mesh: await plainButton(), dx: 150, dy: 0 });
  return { mesh: merge(pieces) };
}

/** SVG of the button as the friend will see it (un-mirrored), sitting in its black cup. */
function previewSvg(regions) {
  const D = TAG.button.diameter;
  const rim = TAG.holder.wall + TAG.clearance / 2;
  const paths = PALETTE.map((p) => {
    const d = regions[p.key]
      .toPolygons()
      .map((poly) => 'M' + poly.map(([x, y]) => `${(D - x + rim).toFixed(3)} ${(D - y + rim).toFixed(3)}`).join('L') + 'Z')
      .join('');
    return d ? `<path fill="${p.art}" fill-rule="evenodd" d="${d}"/>` : '';
  }).join('');
  const S = D + 2 * rim;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S * 10}" height="${S * 10}"><circle cx="${S / 2}" cy="${S / 2}" r="${S / 2}" fill="#16191c"/>${paths}</svg>`;
}
