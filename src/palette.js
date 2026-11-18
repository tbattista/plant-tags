/**
 * tags/palette.js — the four filaments a printed tag uses, in CFS slot order.
 * The art is drawn in these colours only; `art` is the colour the drawing
 * uses for each, `filament` the real spool it prints in (Overture Matte PLA,
 * all one line so they share a temperature profile).
 */
export const PALETTE = [
  { key: 'beige', slot: 1, name: 'Beige', art: '#f4f1ea', filament: 'Overture Matte PLA — Beige', role: 'background and body' },
  { key: 'navy', slot: 2, name: 'Navy', art: '#1d3446', filament: 'Overture Matte PLA — Navy Blue', role: 'outlines' },
  { key: 'green', slot: 3, name: 'Green', art: '#5a9a52', filament: 'Overture Matte PLA — Grass Green', role: 'leaves and stems' },
  { key: 'brick', slot: 4, name: 'Brick', art: '#b8472b', filament: 'Overture Matte PLA — Brick Red', role: 'pot, flowers, accents' },
];

export const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** The holder (cup + spike) prints on its own, in one colour. */
export const HOLDER_FILAMENT = { name: 'Black', filament: 'Overture Matte PLA — Black', art: '#16191c' };
