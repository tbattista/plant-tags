import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { createBudget } from '../server/budget.js';
import { allowed } from '../server/fetch.js';
import { unzip } from './helpers.js';

const LEAF = '<svg viewBox="0 0 500 600"><ellipse cx="250" cy="250" rx="120" ry="150" fill="#5a9a52" stroke="#1d3446" stroke-width="12"/><path d="M250 120 L250 380" stroke="#1d3446" stroke-width="10"/><rect x="155" y="405" width="190" height="38" fill="#b5432a"/><path d="M169 439 L331 439 L311 544 L189 544 Z" fill="#b5432a"/></svg>';

/** A scripted stand-in for the model: draws LEAF, keeps it on review, 1M tokens in and 100k out per call. */
function fakeProvider() {
  const calls = [];
  return {
    calls,
    configured: true,
    model: 'test-model',
    hold: null,
    async complete({ messages }) {
      calls.push(messages);
      if (this.hold) await this.hold;
      const reviewing = messages.some((m) => m.role === 'assistant');
      return { message: { role: 'assistant', content: reviewing ? 'KEEP' : LEAF }, usage: { prompt_tokens: 1_000_000, completion_tokens: 100_000 } };
    },
  };
}

async function serve(opts) {
  const app = createApp(opts);
  const server = await new Promise((ok) => {
    const s = app.listen(0, '127.0.0.1', () => ok(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const req = async (method, p, body) => {
    const res = await fetch(base + p, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const type = res.headers.get('content-type') || '';
    return { status: res.status, type, headers: res.headers, data: type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
  };
  const job = async (p, body) => {
    const r = await req('POST', p, body);
    if (r.status !== 202) return r;
    for (let i = 0; i < 400; i++) {
      const { data } = await req('GET', `/api/jobs/${r.data.job.id}`);
      if (data.job.done) return { status: 200, job: data.job };
      await new Promise((ok) => setTimeout(ok, 25));
    }
    throw new Error('job never finished');
  };
  return { req, job, close: () => new Promise((ok) => server.close(ok)) };
}

const noWeb = async () => ({ status: 404, contentType: 'text/plain', body: Buffer.alloc(0), truncated: false });

describe('the public tool', () => {
  let t;
  let provider;
  let budget;
  let dir;
  const forwarded = [];
  before(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plant-tags-'));
    provider = fakeProvider();
    // $1 in + $1 out per 1M tokens → each call costs $1.10; budget $2.50, $1 held per job
    budget = createBudget({ dailyUsd: 2.5, priceIn: 1, priceOut: 1, reserveUsd: 1, dataDir: dir });
    const fetchImpl = async (url, init) => {
      forwarded.push({ url, body: JSON.parse(init.body) });
      return new Response('{"ok":true}', { status: forwarded.length === 1 ? 200 : 400 });
    };
    t = await serve({ provider, budget, get: noWeb, dataDir: dir, waitlist: { url: 'https://riverpointlabs.co/api/waitlist', project: 'plant-tags' }, fetchImpl, limits: { aiPerIpPerDay: 5 } });
  });
  after(() => t?.close());

  it('serves the page, the starters, a preview and the print files', async () => {
    const page = await t.req('GET', '/');
    assert.equal(page.status, 200);
    assert.match(page.data.toString(), /Plant Tag Maker/);
    assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
    const { data } = await t.req('GET', '/api/starters');
    assert.ok(data.starters.length >= 30);
    assert.equal((await t.req('GET', '/api/starters/match?name=Golden%20pothos')).data.key, 'pothos');
    assert.equal((await t.req('GET', '/thumbs/pothos.png')).type, 'image/png');

    const png = await t.req('POST', '/api/preview', { key: 'monstera' });
    assert.equal(png.type, 'image/png');
    assert.equal((await t.req('POST', '/api/preview', { svg: '<svg><script>x()</script></svg>' })).status, 422, 'only clean drawings');

    const zip = await t.req('POST', '/api/print', { key: 'pothos', name: 'Kitchen pothos' });
    assert.equal(zip.status, 200);
    assert.match(zip.headers.get('content-disposition'), /kitchen-pothos-tag\.zip/);
    const files = unzip(zip.data);
    assert.ok(files.has('button.3mf') && files.has('holders/stake.3mf'));
    assert.match(files.get('README.txt').toString(), /Riverpoint Labs/);
    assert.match(files.get('README.txt').toString(), /any NFC writer app/);
  });

  it('draws with AI on the day’s budget, counting what each call cost', async () => {
    assert.equal((await t.req('GET', '/api/status')).data.ai.available, true);
    const r = await t.job('/api/draw', { name: 'Monstera', species: 'Monstera deliciosa' });
    assert.equal(r.status, 200);
    assert.equal(r.job.error, null);
    assert.match(r.job.svg, /^<svg xmlns/);
    assert.deepEqual(r.job.steps.map((s) => s.stage), ['searching', 'starting', 'drawing', 'checking', 'kept']);
    assert.equal(provider.calls.length, 2, 'drawn, then checked once');
    const s = (await t.req('GET', '/api/status')).data.ai;
    assert.equal(s.leftUsd, 0.3, '$2.50 − 2 × $1.10');
    assert.equal(s.available, false, 'less left than a drawing needs');
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'ai-budget.json'), 'utf8')).spentUsd.toFixed(2), '2.20', 'kept across restarts');
  });

  it('says sorry when the budget is spent, and nothing more is spent', async () => {
    const r = await t.req('POST', '/api/draw', { name: 'Fern' });
    assert.equal(r.status, 503);
    assert.equal(r.data.error.code, 'OUT_OF_BUDGET');
    assert.match(r.data.error.message, /out of money for today/);
    assert.equal(provider.calls.length, 2);
    const edit = await t.req('POST', '/api/edit', { key: 'fern', instruction: 'wider' });
    assert.equal(edit.data.error.code, 'OUT_OF_BUDGET');
  });

  it('“tell me when” goes to the Riverpoint Labs waitlist, and is kept here if that fails', async () => {
    assert.equal((await t.req('POST', '/api/notify', { email: 'nope' })).status, 400);
    assert.equal((await t.req('POST', '/api/notify', { email: 'A@Example.com' })).status, 200);
    assert.deepEqual(forwarded[0], { url: 'https://riverpointlabs.co/api/waitlist', body: { project: 'plant-tags', email: 'a@example.com', note: 'Plant tag maker: tell me when AI drawing is open' } });
    await t.req('POST', '/api/notify', { email: 'b@example.com' }); // the waitlist refuses this one
    assert.match(fs.readFileSync(path.join(dir, 'signups.jsonl'), 'utf8'), /b@example\.com/);
    assert.equal(fs.existsSync(path.join(dir, 'signups.jsonl')) && /a@example/.test(fs.readFileSync(path.join(dir, 'signups.jsonl'), 'utf8')), false);
    await t.req('POST', '/api/notify', { email: 'bot@example.com', website: 'spam' });
    assert.equal(forwarded.length, 2, 'the honeypot is never forwarded');
  });
});

describe('limits', () => {
  it('one drawing at a time each, a few a day each, and AI off without prices', async () => {
    const provider = fakeProvider();
    let release;
    provider.hold = new Promise((ok) => (release = ok));
    const budget = createBudget({ dailyUsd: 100, priceIn: 1, priceOut: 1, reserveUsd: 1 });
    const t = await serve({ provider, budget, get: noWeb, limits: { aiPerIpPerDay: 2 } });
    try {
      const first = await t.req('POST', '/api/draw', { name: 'Pothos' });
      assert.equal(first.status, 202);
      const busy = await t.req('POST', '/api/draw', { name: 'Pothos' });
      assert.equal(busy.data.error.code, 'BUSY');
      release();
      provider.hold = null;
      for (let i = 0; i < 400 && !(await t.req('GET', `/api/jobs/${first.data.job.id}`)).data.job.done; i++) await new Promise((ok) => setTimeout(ok, 25));
      assert.equal((await t.job('/api/draw', { name: 'Pothos' })).status, 200);
      const third = await t.req('POST', '/api/draw', { name: 'Pothos' });
      assert.equal(third.status, 429);
      assert.match(third.data.error.message, /come back tomorrow/);
      assert.equal((await t.req('POST', '/api/draw', {})).status, 400);
    } finally {
      await t.close();
    }

    const unpriced = await serve({ provider: fakeProvider(), budget: createBudget({ dailyUsd: 1 }), get: noWeb });
    try {
      assert.equal((await unpriced.req('GET', '/api/status')).data.ai.available, false);
      assert.equal((await unpriced.req('POST', '/api/draw', { name: 'Pothos' })).data.error.code, 'OUT_OF_BUDGET');
    } finally {
      await unpriced.close();
    }
    const off = await serve({ provider: { configured: false }, budget: createBudget({ dailyUsd: 1, priceIn: 1, priceOut: 1 }), get: noWeb });
    try {
      assert.equal((await off.req('POST', '/api/draw', { name: 'Pothos' })).data.error.code, 'AI_OFF');
    } finally {
      await off.close();
    }
  });

  it('the budget starts over each day, and the server only fetches from iNaturalist', () => {
    let day = '2026-11-18';
    const b = createBudget({ dailyUsd: 1, priceIn: 1, priceOut: 1, reserveUsd: 0.5, now: () => day });
    const ticket = b.reserve();
    ticket.spend({ inputTokens: 900_000, outputTokens: 0 });
    ticket.release();
    assert.equal(b.status().available, false);
    assert.equal(b.status().resetsAt, '2026-11-19T00:00:00.000Z');
    day = '2026-11-19';
    assert.equal(b.status().available, true);
    assert.equal(allowed('https://inaturalist-open-data.s3.amazonaws.com/photos/1/large.jpg'), true);
    assert.equal(allowed('https://example.com/x.jpg'), false);
    assert.equal(allowed('http://api.inaturalist.org/v1/taxa'), false);
    assert.equal(allowed('https://169.254.169.254/'), false);
  });
});
