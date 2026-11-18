/**
 * print.js — what gets printed: a preview of the button in its cup, and the
 * print package (the 4-colour button and every black holder as 3MFs for
 * Creality Print, STLs as a fallback, a preview and the instructions).
 */
import sharp from 'sharp';
import { TagError } from './errors.js';
import { PALETTE, HOLDER_FILAMENT } from './palette.js';
import { TAG, buildButton, buildHolder, buildClip, buildFitTest, HOLDER_STYLES, HOLDER_ICONS } from './geometry.js';
import { threeMf, stl, zip } from './files.js';

/** PNG of the button exactly as it will print, in its black cup. */
export async function previewPng(svg) {
  const button = await buildButton(svg);
  return sharp(Buffer.from(button.preview)).resize(400).png().toBuffer();
}

/** Move a mesh so its bounding box is centred on the origin (or move it by `by`, to keep parts together). */
function centred(mesh, by = null) {
  const v = Float32Array.from(mesh.vertices);
  const min = [Infinity, Infinity];
  const max = [-Infinity, -Infinity];
  for (let i = 0; i < v.length; i += 3) {
    for (const k of [0, 1]) {
      min[k] = Math.min(min[k], v[i + k]);
      max[k] = Math.max(max[k], v[i + k]);
    }
  }
  const c = by || [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2];
  for (let i = 0; i < v.length; i += 3) {
    v[i] -= c[0];
    v[i + 1] -= c[1];
  }
  return { vertices: v, triangles: mesh.triangles, offset: c };
}

const slug = (s) => String(s || 'plant').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'plant';
// the middle of a 220 mm plate; Creality Print re-centres if the bed is bigger
const PLATE_CENTRE = [110, 110];

export const IMPORT_HINT = 'In Creality Print use File → Import → Import 3MF/STL… (Ctrl+I), not Open Project — importing keeps each colour on its own filament.';

const HOLDER_TITLES = { stake: 'stake', short: 'short stake', flat: 'flat, pin down', clip: 'clip-on, for a branch' };
const ICON_TITLES = { under: 'under the cup', back: 'on the back', tab: 'on a tab' };

/**
 * How the README names its maker and says to write the NFC sticker; an app
 * that writes the tag itself (like Plants) says where.
 */
export const DEFAULT_WORDING = {
  madeBy: 'Made with the plant tag maker from Riverpoint Labs (riverpointlabs.co).',
  writeStep: `Write the NFC sticker with any NFC writer app (NFC Tools, or Chrome
     on Android) — a link to a care page, a note, anything — it writes
     through the button. Then tap it with a phone to test.`,
};

function instructions(plantName, parts, wording) {
  const used = new Set(parts.map((x) => x.slot));
  return `Plant tag — ${plantName}
${wording.madeBy} Two prints: a black holder (a round cup —
four styles to choose from) and a 4-colour button with the plant on it. The
25 mm NFC sticker sits in the bottom of the cup and the button presses in over
it, 0.4 mm below the rim — fill that gap with clear epoxy to seal it.

IN CREALITY PRINT: IMPORT, DON'T OPEN
  File → Import → Import 3MF/STL… (Ctrl+I). Importing keeps each part of the
  button on its own filament (1–4) and adds filaments if you have fewer.
  Opening the file as a project puts every part on filament 1.

BUTTON — button.3mf, four colours
${PALETTE.map((c) => `  Filament ${c.slot}: ${c.filament}${used.has(c.slot) ? '' : '   (not used by this drawing)'}`).join('\n')}
  Prints face-down (the picture is on the plate side), 0.2 mm layers, 1.6 mm
  thick (eight layers). Colour changes happen only in the first two layers;
  the rest is solid beige. No supports.
  In the object list the parts are named with their filament ("Navy (filament 2)");
  if one shows the wrong filament, set it there.

HOLDER — pick one from holders/, black (${HOLDER_FILAMENT.filament})
  Set the holder part to whichever slot holds black. 0.2 mm layers, no
  supports. Every holder fits every button.
  The icon holders have a second part, "Icon (filament 2)": give it any colour
  (beige or white reads best on black). No painting needed — on the stakes'
  badge it is the raised icon on top; on the back and the flat holder's tab it
  is a flush inlay in the first three layers, printed on the plate, so it comes
  out as sharp as the button's colours.
  stake            the cup on a tall spike (about 4.6" below the cup). Prints
                   flat, cup facing up.
  short            a thinner spike, about 1.5" below the cup, for small pots.
                   Prints flat, cup facing up.
  flat             the cup lies face-up on the soil and a pin about 1.8" long
                   goes straight down from its back. Prints UPSIDE DOWN — cup
                   rim on the plate, pin pointing up — so it needs no supports;
                   the floor of the cup is a short bridge, which the sticker
                   covers. Push it into the soil until the cup sits flat.
  clip             no spike: an ear with a slot each side of the cup, for a
                   U clip from clips/ that holds it on a branch or stem.
                   Prints flat, cup facing up.
  With the "tap here" icon (a hand holding a phone), so people know to tap it:
  …-icon-under     a badge under the cup with the icon raised on the front
                   (stakes and the clip holder)
  …-icon-back      the icon inlaid in the back of the cup, reading right from
                   behind (stakes)
  …-icon-tab       a small tab off the rim with the icon inlaid in its face
                   (flat holder; that face prints on the plate)
  The icon is "NFC Phone" by Andrew Forrester from the Noun Project (CC BY 3.0,
  https://thenounproject.com/icon/58069/).

ASSEMBLE
  1. Press the NFC sticker into the shallow round pocket at the bottom of the cup.
  2. Line the round notch at the bottom of the button up with the small round
     bump inside the cup (on the spike's side — on the flat holder, the tab's side): the
     button only fits upright. Press it in, picture up, until it clicks past the
     three small nubs and sits 0.4 mm below the rim. For good, put a few dots of
     glue on the cup floor first, or fill the gap over the button with clear
     epoxy (it also seals the picture).
  3. Clip holder only: put the branch in the U of the clip, squeeze the arms in
     a little, push both hooks up through the ears' slots from behind and let
     go — the arms spring out and the hooks catch over the front of the ears.
     Squeeze again to take it off.
  4. ${wording.writeStep}

CLIP — clips/, one colour (PETG springs best; PLA works but can crack)
  A springy U that goes round the branch behind the clip holder. It prints flat,
  ${TAG.clip.height} mm tall, 0.2 mm layers, no supports. Pick the size for the branch:
${Object.entries(TAG.clip.sizes).map(([k, d]) => `  clip-${k}.3mf     a branch about ${d} mm across (a mm or two either way is fine)`).join('\n')}

FIT
  If the button is too tight or falls out, print the fit test from the tag page
  (three cups, short = snug … long = loose) and say which one fits.

FILES
  button.3mf   the button, colours assigned
  holders/     every holder: stake, short, flat and clip, plain and with the icon
  clips/       the U clips for the clip holder, S, M and L
  stl/         the same as STLs: import all button-*.stl together as ONE object
               with parts, then set each part's filament (likewise a holder
               with its -icon.stl)
  preview.png  how it will look
`;
}

/**
 * The whole print package for one drawing, as a ZIP: { filename, data }.
 * `name` titles the files ("Mom's pothos"); `wording` overrides DEFAULT_WORDING.
 */
export async function printPackage(svg, { name = 'Plant', wording = {} } = {}) {
  if (!svg) throw new TagError('NO_ART', 'Choose a drawing first.', 409);
  const button = await buildButton(svg);
  // every holder style, plain and with the "tap here" icon in each place it fits
  const holders = [];
  for (const style of HOLDER_STYLES) {
    for (const icon of [null, ...HOLDER_ICONS[style]]) {
      const built = await buildHolder({ style, icon });
      const mesh = centred(built.mesh);
      // the icon is moved exactly as the holder is, so it stays in its place
      holders.push({ file: `${style}${icon ? `-icon-${icon}` : ''}`, title: HOLDER_TITLES[style] + (icon ? ` — icon ${ICON_TITLES[icon]}` : ''), mesh, iconMesh: built.iconMesh ? centred(built.iconMesh, mesh.offset) : null });
    }
  }
  const buttonParts = button.parts.map((p) => ({ name: `${p.name} (filament ${p.slot})`, extruder: p.slot, mesh: p.mesh }));
  // one object; the icon is a second part on filament 2, so it takes its own colour in the slicer
  const holderFile = (h) =>
    threeMf([{ name: `Tag holder — ${h.title}`, parts: [{ name: 'Holder (filament 1, black)', extruder: 1, mesh: h.mesh }, ...(h.iconMesh ? [{ name: 'Icon (filament 2)', extruder: 2, mesh: h.iconMesh }] : [])], at: PLATE_CENTRE }]);
  const preview = await sharp(Buffer.from(button.preview)).resize(400).png().toBuffer();
  const files = [
    { name: 'button.3mf', data: threeMf([{ name: `${name} — button`, parts: buttonParts, at: PLATE_CENTRE }]) },
    ...holders.map((h) => ({ name: `holders/${h.file}.3mf`, data: holderFile(h) })),
    ...button.parts.map((p) => ({ name: `stl/button-${p.slot}-${p.key}.stl`, data: stl(p.mesh, `button ${p.name}`) })),
    ...holders.map((h) => ({ name: `stl/holders/${h.file}.stl`, data: stl(h.mesh, `holder ${h.file}`) })),
    ...holders.filter((h) => h.iconMesh).map((h) => ({ name: `stl/holders/${h.file}-icon.stl`, data: stl(h.iconMesh, `holder ${h.file} icon`) })),
    { name: 'preview.png', data: preview },
    { name: 'README.txt', data: instructions(name, button.parts, { ...DEFAULT_WORDING, ...wording }) },
  ];
  const clips = await Promise.all(Object.keys(TAG.clip.sizes).map((size) => buildClip(size)));
  for (const c of clips) {
    files.push(
      { name: `clips/clip-${c.size}.3mf`, data: threeMf([{ name: `Tag clip ${c.size} (${c.branch} mm branch)`, parts: [{ name: 'Clip (filament 1)', extruder: 1, mesh: c.mesh }], at: PLATE_CENTRE }]) },
      { name: `stl/clips/clip-${c.size}.stl`, data: stl(c.mesh, `clip ${c.size}`) },
    );
  }
  return { filename: `${slug(name)}-tag.zip`, data: zip(files) };
}

/** The one-time fit test: three cups and a plain button. */
export async function fitTestFile() {
  const fit = await buildFitTest();
  return threeMf([{ name: 'Tag fit test', parts: [{ name: 'Fit test', extruder: 1, mesh: centred(fit.mesh) }], at: PLATE_CENTRE }]);
}
