/**
 * Contact sheet of starter drawings: for each key, the drawing and the button
 * as it will print (after fitting, snapping to the four filaments and tracing).
 *
 *   node tools/preview.mjs out.png pothos monstera …   (no keys = all)
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { cleanSvg } from '../src/art.js';
import { buildButton } from '../src/geometry.js';

const dir = path.join(import.meta.dirname, '..', 'samples');
const [out, ...keys] = process.argv.slice(2);
const list = keys.length ? keys : fs.readdirSync(dir).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)).sort();
const W = 300;
const tiles = [];
for (const key of list) {
  const raw = fs.readFileSync(path.join(dir, `${key}.svg`), 'utf8');
  const svg = cleanSvg(raw);
  const art = await sharp(Buffer.from(svg)).resize(W, Math.round(W * 1.2)).png().toBuffer();
  const button = await buildButton(svg);
  const btn = await sharp(Buffer.from(button.preview)).resize(W, W).png().toBuffer();
  const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${2 * W + 10}" height="30"><text x="4" y="22" font-family="sans-serif" font-size="20">${key}</text></svg>`);
  tiles.push({ art, btn, label });
  console.log(key, button.parts.map((p) => `${p.key}:${p.mesh.triangles.length / 3}`).join(' '));
}
const cols = Math.min(3, tiles.length);
const cellW = 2 * W + 30;
const cellH = Math.round(W * 1.2) + 40;
const rows = Math.ceil(tiles.length / cols);
const composite = [];
tiles.forEach((t, i) => {
  const x = (i % cols) * cellW;
  const y = Math.floor(i / cols) * cellH;
  composite.push({ input: t.label, left: x, top: y }, { input: t.art, left: x, top: y + 32 }, { input: t.btn, left: x + W + 10, top: y + 32 });
});
await sharp({ create: { width: cols * cellW, height: rows * cellH, channels: 3, background: '#ffffff' } }).composite(composite).png().toFile(out);
console.log('wrote', out);
