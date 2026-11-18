/**
 * plant-tags — 3D-printed NFC plant tags: a round black holder (stake, short
 * stake or flat) and a 30 mm four-colour button with the plant drawn on it.
 *
 * Pure functions plus the starter drawings; no database, no accounts. Apps
 * pass in what they own: an AI provider (and a usage callback, to count cost)
 * for AI drawings, and a safe `get` for fetching photos.
 */
export { TagError } from './errors.js';
export { PALETTE, HOLDER_FILAMENT, hexToRgb } from './palette.js';
export { TAG, holderThickness, buildButton, buildHolder, buildFitTest, HOLDER_STYLES, HOLDER_ICONS } from './geometry.js';
export { threeMf, stl, zip } from './files.js';
export { cleanSvg, SAMPLES, sampleFor, sampleSvg, drawWithAi, editWithAi } from './art.js';
export { searchPhotos, searchTermFor, fetchImage, reencode, REF_EDGE } from './photos.js';
export { previewPng, printPackage, fitTestFile, IMPORT_HINT, DEFAULT_WORDING } from './print.js';
export { createProvider } from './provider.js';

import path from 'node:path';
/** Folder of the starters' PNG thumbnails (<key>.png), for an app to serve. */
export const THUMBS_DIR = path.join(import.meta.dirname, '..', 'thumbs');
