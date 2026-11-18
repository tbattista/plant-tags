/**
 * photos.js — pictures for the AI to draw from: photos of a plant's kind on
 * iNaturalist (research-grade naturalist photos with their photographers'
 * credits), and re-encoding any picture before the model or a page sees it.
 *
 * Nothing here opens a connection itself: the caller passes `get(url,
 * { accept, maxBytes })` → { status, contentType, body: Buffer, truncated },
 * and is responsible for making it safe (public addresses only, size and
 * time limits). What comes back from the web is data, never instructions.
 */

import sharp from 'sharp';
import { TagError } from './errors.js';

const INAT = 'https://api.inaturalist.org/v1';
const MAX_RESULTS = 12;
export const REF_EDGE = 1024;
const THUMB_EDGE = 200;
const JSON_MAX = 2_000_000;
const IMAGE_MAX = 10 * 1024 * 1024;

const clean = (v, max = 2000) => {
  if (v == null) return null;
  const t = String(v).replace(/\r\n?/g, '\n').trim();
  return t ? t.slice(0, max) : null;
};

/** The bytes of the image at `url`, or null if it isn't one (never throws). */
export async function fetchImage(url, { get }) {
  try {
    const r = await get(url, { accept: 'image/webp,image/png,image/jpeg;q=0.9,image/*;q=0.5', maxBytes: IMAGE_MAX });
    if (r.status >= 400 || r.truncated || !/^image\//i.test(r.contentType) || !r.body.length) return null;
    return r.body;
  } catch {
    return null;
  }
}

// iNaturalist photo URLs end in /square.jpg, /small.jpg, /medium.jpg, /large.jpg
const sized = (url, size) => String(url || '').replace(/\/(square|thumb|small|medium|large|original)\.(jpe?g|png)(\?.*)?$/i, `/${size}.$2`);

async function getJson(get, url) {
  const r = await get(url, { accept: 'application/json', maxBytes: JSON_MAX });
  if (r.status >= 400 || r.truncated) throw new TagError('SEARCH_FAILED', 'The plant photo search didn’t answer. Try again, or paste an image link.', 502);
  try {
    return JSON.parse(r.body.toString('utf8'));
  } catch {
    throw new TagError('SEARCH_FAILED', 'The plant photo search sent something unreadable. Try again, or paste an image link.', 502);
  }
}

const taxonLabel = (t) => (t.preferred_common_name ? `${t.name} (${t.preferred_common_name})` : t.name);
const photoOf = (p, label) => (p?.url ? { url: sized(p.url, 'large'), thumbUrl: sized(p.url, 'small'), label, credit: clean(p.attribution, 300) } : null);

/** What to search for a plant: its botanical name, else its common name. */
export function searchTermFor(plant) {
  return (plant.species || plant.commonName || plant.nickname || '').replace(/['‘’"“”]/g, '').trim();
}

/**
 * Photos of a plant from iNaturalist: the best-matching kind's own photos
 * first, then one each for other close matches. Each with a small thumbnail
 * (as a data URL, so the page needs no outside images).
 */
export async function searchPhotos(query, { get }) {
  const q = clean(query, 120);
  if (!q) throw new TagError('INVALID_INPUT', 'Type a plant name to search for.');
  const found = await getJson(get, `${INAT}/taxa?${new URLSearchParams({ q, per_page: '6', is_active: 'true' })}`);
  const taxa = (found.results || []).filter((t) => t && t.id);
  if (!taxa.length) return [];
  const top = (await getJson(get, `${INAT}/taxa/${encodeURIComponent(taxa[0].id)}`)).results?.[0] || taxa[0];
  const own = (top.taxon_photos || []).map((tp) => photoOf(tp.photo, taxonLabel(top)));
  const others = taxa.slice(1).map((t) => photoOf(t.default_photo, taxonLabel(t)));
  const list = [...(own.length ? own : [photoOf(top.default_photo, taxonLabel(top))]), ...others].filter(Boolean);
  const unique = list.filter((p, i) => list.findIndex((x) => x.url === p.url) === i).slice(0, MAX_RESULTS);
  const withThumbs = await Promise.all(
    unique.map(async (p) => {
      const bytes = await fetchImage(p.thumbUrl, { get });
      const thumb = bytes && (await reencode(bytes, THUMB_EDGE, 70).catch(() => null));
      return thumb ? { url: p.url, label: p.label, credit: p.credit, thumb: `data:image/jpeg;base64,${thumb.toString('base64')}` } : null;
    }),
  );
  return withThumbs.filter(Boolean);
}

/** Any image as a plain JPEG no bigger than `edge`, metadata stripped. Throws if it isn't an image. */
export async function reencode(bytes, edge = REF_EDGE, quality = 82) {
  return sharp(bytes, { limitInputPixels: 100_000_000, failOn: 'error' })
    .rotate()
    .resize(edge, edge, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality })
    .toBuffer();
}
