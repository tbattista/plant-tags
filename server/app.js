/**
 * app.js — the public plant tag maker (served on its own Railway service,
 * linked from riverpointlabs.co/tools/). Anyone can pick a starter drawing,
 * see it as it prints and download the print files. AI drawing — from their
 * own photo or a photo of the kind on iNaturalist — runs on a small daily
 * budget; when it's spent (or AI isn't switched on), the page says sorry and
 * offers an email sign-up for when there's more.
 *
 * No accounts and nothing saved about visitors: a drawing lives in their
 * browser, and AI jobs are kept in memory for a few minutes, found by an
 * unguessable id.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import * as gen from '../src/index.js';
import { allowed } from './fetch.js';

const PUBLIC_DIR = path.join(import.meta.dirname, 'public');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const JOB_KEEP_MS = 15 * 60_000;

const STEP_LABELS = {
  searching: 'Finding a photo of this plant on iNaturalist',
  photo: 'Looking at the photo',
  starting: 'Getting the style references',
  drawing: 'Drawing it in the tag style',
  checking: 'Checking how it prints',
  fixed: 'Fixed what didn’t read well',
  kept: 'It looked right — kept it',
  reading: 'Looking at the drawing and how it prints',
  changing: 'Making your change',
};

/** Requests per IP in a sliding window. */
function limiter(max, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) return false;
    list.push(now);
    hits.set(key, list);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    return true;
  };
}

/** One mesh build at a time: they're CPU-heavy, and the box is small. */
function serial() {
  let tail = Promise.resolve();
  return (fn) => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => {});
    return run;
  };
}

const fail = (code, message, status = 400) => new gen.TagError(code, message, status);
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function createApp({ provider, budget, get, waitlist = {}, dataDir = null, limits = {}, fetchImpl = fetch } = {}) {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  const lim = {
    aiPerIpPerDay: limits.aiPerIpPerDay ?? 3,
    previewPerMin: limits.previewPerMin ?? 30,
    printPer10Min: limits.printPer10Min ?? 8,
    searchPerMin: limits.searchPerMin ?? 10,
    notifyPer10Min: limits.notifyPer10Min ?? 5,
  };
  const rl = {
    ai: limiter(lim.aiPerIpPerDay, 24 * 3600_000),
    preview: limiter(lim.previewPerMin, 60_000),
    print: limiter(lim.printPer10Min, 600_000),
    search: limiter(lim.searchPerMin, 60_000),
    notify: limiter(lim.notifyPer10Min, 600_000),
  };
  const limit = (name, message) => (req, _res, next) => (rl[name](req.ip) ? next() : next(fail('SLOW_DOWN', message, 429)));
  const mesh = serial();
  const previews = new Map(); // svg hash → png, the most recent few hundred
  const jobs = new Map();

  app.use((_req, res, next) => {
    res.set({
      'Content-Security-Policy':
        "default-src 'self'; img-src 'self' data: blob: https://riverpointlabs.co; style-src 'self' https://riverpointlabs.co https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com https://riverpointlabs.co; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    });
    next();
  });
  app.use(express.json({ limit: '3mb' }));
  app.use(express.static(PUBLIC_DIR, { index: 'index.html', maxAge: '1h' }));
  app.use('/thumbs', express.static(gen.THUMBS_DIR, { maxAge: '7d' }));

  const aiStatus = () => ({ configured: !!provider?.configured, ...budget.status(), perIpPerDay: lim.aiPerIpPerDay });

  app.get('/api/status', (_req, res) => res.set('Cache-Control', 'no-store').json({ ai: aiStatus() }));
  app.get('/api/starters', (_req, res) => res.json({ starters: gen.SAMPLES.map((s) => ({ key: s.key, name: s.name })) }));
  app.get('/api/starters/:key.svg', (req, res, next) => {
    try {
      res.type('image/svg+xml').set('Cache-Control', 'public, max-age=86400').send(gen.cleanSvg(gen.sampleSvg(req.params.key)));
    } catch (err) {
      next(err);
    }
  });
  app.get('/api/starters/match', (req, res) => {
    const name = str(req.query.name, 120);
    res.json({ key: gen.sampleFor({ commonName: name }).key });
  });

  /** The drawing a request is about: a starter by key, or an SVG the visitor has (cleaned, always). */
  const drawingOf = (body) => (body?.key ? gen.cleanSvg(gen.sampleSvg(String(body.key))) : gen.cleanSvg(str(body?.svg, 100_000)));

  app.post('/api/preview', limit('preview', 'That’s a lot of previews — wait a minute.'), async (req, res, next) => {
    try {
      const svg = drawingOf(req.body);
      const hash = crypto.createHash('sha256').update(svg).digest('hex');
      let png = previews.get(hash);
      if (!png) {
        png = await mesh(() => gen.previewPng(svg));
        previews.set(hash, png);
        if (previews.size > 300) previews.delete(previews.keys().next().value);
      }
      res.type('image/png').set('Cache-Control', 'private, max-age=3600').send(png);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/print', limit('print', 'That’s a lot of downloads — wait a few minutes.'), async (req, res, next) => {
    try {
      const svg = drawingOf(req.body);
      const name = str(req.body?.name, 60) || 'Plant';
      const out = await mesh(() => gen.printPackage(svg, { name }));
      res.set({ 'Cache-Control': 'no-store', 'Content-Disposition': `attachment; filename="${out.filename}"` }).type('application/zip').send(out.data);
    } catch (err) {
      next(err);
    }
  });

  app.get('/fit-test.3mf', async (_req, res, next) => {
    try {
      const file = await mesh(() => gen.fitTestFile());
      res.set({ 'Cache-Control': 'public, max-age=86400', 'Content-Disposition': 'attachment; filename="tag-fit-test.3mf"' }).type('model/3mf').send(file);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/photos', limit('search', 'Too many searches — wait a minute.'), async (req, res, next) => {
    try {
      res.json({ photos: await gen.searchPhotos(str(req.query.q, 120), { get }) });
    } catch (err) {
      next(err);
    }
  });

  // ------------------------------------------------------------ AI jobs --

  /** The picture to draw from: their upload, a photo they picked from the search, or the first iNaturalist photo for the name. */
  async function pictureFor(body, onStep) {
    const upload = str(body.photo, 3_000_000);
    if (upload) {
      const m = upload.match(/^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
      if (!m) throw fail('NOT_AN_IMAGE', 'That photo couldn’t be read. Try a JPEG or PNG.');
      const jpeg = await gen.reencode(Buffer.from(m[1], 'base64')).catch(() => null);
      if (!jpeg) throw fail('NOT_AN_IMAGE', 'That photo couldn’t be read. Try a JPEG or PNG.');
      return { jpeg, kind: 'own' };
    }
    const picked = str(body.photoUrl, 2000);
    if (picked) {
      if (!allowed(picked)) throw fail('INVALID_INPUT', 'Pick a photo from the search, or upload your own.');
      const bytes = await gen.fetchImage(picked, { get });
      const jpeg = bytes && (await gen.reencode(bytes).catch(() => null));
      if (jpeg) return { jpeg, kind: 'web' };
    }
    const term = str(body.species, 120) || str(body.name, 120);
    if (!term) return null;
    onStep('searching');
    const found = await gen.searchPhotos(term, { get }).catch(() => []);
    for (const p of found.slice(0, 3)) {
      const bytes = await gen.fetchImage(p.url, { get });
      const jpeg = bytes && (await gen.reencode(bytes).catch(() => null));
      if (jpeg) return { jpeg, kind: 'web' };
    }
    return null;
  }

  const sweep = () => {
    const now = Date.now();
    for (const [id, j] of jobs) if (j.finishedAt && now - j.finishedAt > JOB_KEEP_MS) jobs.delete(id);
  };

  function startJob(req, kind, work) {
    sweep();
    if (!provider?.configured) throw fail('AI_OFF', 'AI drawing isn’t switched on yet.', 503);
    for (const j of jobs.values()) if (j.ip === req.ip && !j.finishedAt) throw fail('BUSY', 'The AI is already drawing for you — wait for it to finish.', 409);
    if (!budget.status().available) throw fail('OUT_OF_BUDGET', 'Sorry — the AI is out of money for today.', 503);
    if (!rl.ai(req.ip)) throw fail('SLOW_DOWN', `That’s ${lim.aiPerIpPerDay} AI drawings today — come back tomorrow, or pick a starter.`, 429);
    const ticket = budget.reserve();
    if (!ticket) throw fail('OUT_OF_BUDGET', 'Sorry — the AI is out of money for today.', 503);
    const job = { id: crypto.randomUUID(), ip: req.ip, kind, startedAt: Date.now(), steps: [], preview: null, finishedAt: null, error: null, svg: null };
    jobs.set(job.id, job);
    const onStep = (stage, extra = {}) => {
      job.steps.push({ stage, at: Date.now() });
      if (extra.preview) job.preview = extra.preview;
    };
    const ai = { provider, onUsage: (u) => ticket.spend(u) };
    const render = (svg) => mesh(() => gen.previewPng(svg));
    Promise.resolve()
      .then(() => work({ ai, render, onStep }))
      .then((svg) => (job.svg = svg))
      .catch((err) => {
        job.error = err?.isTagError || (err?.code && typeof err.status === 'number') ? { code: err.code, message: err.message } : { code: 'AI_ERROR', message: 'The AI drawing failed. Try again.' };
        if (!err?.isTagError) console.error('[job]', err);
      })
      .finally(() => {
        ticket.release();
        job.finishedAt = Date.now();
      });
    return job;
  }

  const view = (j) => ({
    id: j.id,
    kind: j.kind,
    elapsedMs: (j.finishedAt || Date.now()) - j.startedAt,
    steps: j.steps.map((s) => ({ stage: s.stage, label: STEP_LABELS[s.stage] || s.stage, afterMs: s.at - j.startedAt })),
    preview: j.preview ? `/api/jobs/${j.id}/preview.png` : null,
    done: !!j.finishedAt,
    error: j.error,
    svg: j.svg,
  });

  const plantOf = (body) => ({ commonName: str(body.name, 80) || null, species: str(body.species, 120) || null, nickname: null });

  app.post('/api/draw', (req, res, next) => {
    try {
      const body = req.body || {};
      const plant = plantOf(body);
      if (!plant.commonName && !plant.species) throw fail('INVALID_INPUT', 'Say what the plant is — e.g. “Monstera”.');
      const job = startJob(req, 'draw', async ({ ai, render, onStep }) => {
        const picture = await pictureFor(body, onStep);
        onStep(picture ? 'photo' : 'starting');
        return gen.drawWithAi(ai, plant, { picture, render, onStep });
      });
      res.status(202).json({ job: view(job) });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/edit', (req, res, next) => {
    try {
      const body = req.body || {};
      const instruction = str(body.instruction, 400);
      if (!instruction) throw fail('INVALID_INPUT', 'Say what to change — e.g. “make the leaves wider”.');
      const current = drawingOf(body);
      const plant = plantOf(body);
      const job = startJob(req, 'edit', async ({ ai, render, onStep }) => {
        onStep('reading');
        const picture = body.photo || body.photoUrl ? await pictureFor(body, onStep) : null;
        return gen.editWithAi(ai, plant, current, instruction, { picture, render, onStep });
      });
      res.status(202).json({ job: view(job) });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/jobs/:id', (req, res, next) => {
    const j = jobs.get(req.params.id);
    if (!j) return next(fail('NOT_FOUND', 'That drawing was interrupted (the tool restarted). Try again.', 404));
    res.set('Cache-Control', 'no-store').json({ job: view(j) });
  });
  app.get('/api/jobs/:id/preview.png', (req, res, next) => {
    const j = jobs.get(req.params.id);
    if (!j?.preview) return next(fail('NOT_FOUND', 'No first try yet.', 404));
    res.set('Cache-Control', 'private, no-store').type('image/png').send(j.preview);
  });

  // ------------------------------------------------- "tell me when" --

  /** Sign-ups go to the Riverpoint Labs waitlist (one list, in its /admin); kept here too if that fails. */
  app.post('/api/notify', limit('notify', 'Too many sign-ups — try again later.'), async (req, res, next) => {
    try {
      const body = req.body || {};
      if (body.website) return res.json({ ok: true }); // honeypot: people never fill it in
      const email = str(body.email, 254).toLowerCase();
      if (!EMAIL_RE.test(email)) throw fail('INVALID_INPUT', 'Please enter a valid email address.');
      const note = 'Plant tag maker: tell me when AI drawing is open';
      let forwarded = false;
      if (waitlist.url) {
        try {
          const r = await fetchImpl(waitlist.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project: waitlist.project || 'plant-tags', email, note }),
            signal: AbortSignal.timeout(8000),
          });
          forwarded = r.ok;
          if (!r.ok) console.warn(`[notify] waitlist answered ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
        } catch (err) {
          console.warn('[notify] waitlist unreachable:', err.message);
        }
      }
      if (!forwarded) {
        const dir = dataDir || path.join(import.meta.dirname, '..', 'data');
        fs.mkdirSync(dir, { recursive: true });
        fs.appendFileSync(path.join(dir, 'signups.jsonl'), `${JSON.stringify({ email, note, at: new Date().toISOString() })}\n`);
      }
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  app.use('/api', (_req, _res, next) => next(fail('NOT_FOUND', 'Not found.', 404)));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const known = err?.isTagError || (err?.code && typeof err.status === 'number');
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: { code: 'TOO_LARGE', message: 'That photo is too big — try a smaller one.' } });
    if (!known) console.error('[error]', err);
    res.status(known ? err.status : 500).json({ error: { code: known ? err.code : 'ERROR', message: known ? err.message : 'Something went wrong. Try again.' } });
  });
  return app;
}
