/**
 * Thumbnails for the tag page's drawing picker: each starter drawing as the
 * button will print, written to thumbs/<key>.png.
 *
 *   node scripts/tag-art/thumbs.mjs        (run by `npm run tag-art`)
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { cleanSvg, SAMPLES, sampleSvg } from '../src/art.js';
import { buildButton } from '../src/geometry.js';

const out = path.join(import.meta.dirname, '..', 'thumbs');
fs.mkdirSync(out, { recursive: true });
const keep = new Set();
for (const s of SAMPLES) {
  const button = await buildButton(cleanSvg(sampleSvg(s.key)));
  await sharp(Buffer.from(button.preview)).resize(192, 192).png({ compressionLevel: 9, palette: true, colours: 64 }).toFile(path.join(out, `${s.key}.png`));
  keep.add(`${s.key}.png`);
  console.log(s.key);
}
for (const f of fs.readdirSync(out)) if (!keep.has(f)) fs.rmSync(path.join(out, f));
