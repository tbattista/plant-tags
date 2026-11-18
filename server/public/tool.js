/* tool.js — the Plant Tag Maker page. The drawing (a starter's key, or an
 * AI drawing's SVG) and the plant's name stay in this browser; the server
 * renders previews, builds the print files and runs AI drawings as jobs this
 * page follows step by step. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const KEY = 'plant-tag-maker';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  const state = Object.assign({ name: '', species: '', drawing: { key: 'plant' }, picked: false, job: null }, load());
  let starters = [];
  let photo = null; // { dataUrl } (their upload) or { url, label } (from the search)
  let busy = false;

  async function api(method, path, body, as = 'json') {
    const res = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) {
      let message = 'Something went wrong. Try again.';
      let code = 'ERROR';
      try { ({ message, code } = (await res.json()).error); } catch { /* not JSON */ }
      throw Object.assign(new Error(message), { code, status: res.status });
    }
    return as === 'blob' ? res.blob() : res.json();
  }

  // ---------------------------------------------------------- preview --
  const img = $('pt-preview');
  let previewUrl = null;
  let previewSeq = 0;
  async function showPreview() {
    const seq = ++previewSeq;
    img.classList.add('pt-loading');
    $('pt-error').textContent = '';
    try {
      const blob = await api('POST', '/api/preview', state.drawing, 'blob');
      if (seq !== previewSeq) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(blob);
      img.src = previewUrl;
    } catch (e) {
      if (seq === previewSeq) $('pt-error').textContent = e.message;
    } finally {
      if (seq === previewSeq) img.classList.remove('pt-loading');
    }
    $('pt-edit').hidden = !aiOn;
    $('pt-preview-note').textContent = state.drawing.svg ? 'Drawn by the AI · shown as it prints, in its black cup.' : 'Shown as it prints: four filament colours, in its black cup.';
  }

  function choose(drawing, { picked = true } = {}) {
    state.drawing = drawing;
    state.picked = picked;
    save();
    renderStarters();
    showPreview();
  }

  // --------------------------------------------------------- starters --
  async function renderStarters() {
    let first = null;
    if (state.name || state.species) {
      try { first = (await api('GET', `/api/starters/match?name=${encodeURIComponent(`${state.name} ${state.species}`)}`)).key; } catch { /* keep order */ }
    }
    const list = first ? [...starters.filter((s) => s.key === first), ...starters.filter((s) => s.key !== first)] : starters;
    // until they pick one, the button follows the best match for the name
    if (first && !state.picked && state.drawing.key !== first) {
      state.drawing = { key: first };
      save();
      showPreview();
    }
    $('pt-starters').replaceChildren(
      ...list.map((s) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pt-tile';
        b.setAttribute('role', 'listitem');
        b.setAttribute('aria-pressed', String(state.drawing.key === s.key));
        b.innerHTML = '<img alt="" width="72" height="72" loading="lazy"><span></span>';
        b.querySelector('img').src = `/thumbs/${encodeURIComponent(s.key)}.png`;
        b.querySelector('span').textContent = s.name;
        b.addEventListener('click', () => choose({ key: s.key }));
        return b;
      }),
    );
  }

  let nameTimer;
  for (const id of ['pt-name', 'pt-species']) {
    const input = $(id);
    input.value = state[id === 'pt-name' ? 'name' : 'species'] || '';
    input.addEventListener('input', () => {
      state.name = $('pt-name').value.trim();
      state.species = $('pt-species').value.trim();
      save();
      clearTimeout(nameTimer);
      nameTimer = setTimeout(renderStarters, 300);
    });
  }

  // ---------------------------------------------------------- download --
  $('pt-download').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const before = btn.textContent;
    btn.textContent = 'Building the files…';
    $('pt-error').textContent = '';
    try {
      const blob = await api('POST', '/api/print', { ...state.drawing, name: state.name || 'Plant' }, 'blob');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${(state.name || 'plant').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'plant'}-tag.zip`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } catch (err) {
      $('pt-error').textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = before;
    }
  });

  // ---------------------------------------------------------------- AI --
  let aiOn = false;
  function showAi(ai, reason = null) {
    aiOn = !!(ai && ai.configured && ai.available);
    $('pt-ai-on').hidden = !aiOn;
    $('pt-ai-off').hidden = aiOn;
    $('pt-edit').hidden = !aiOn;
    if (aiOn) {
      $('pt-ai-left').textContent = `Up to ${ai.perIpPerDay} a day each.`;
      return;
    }
    const notYet = !ai || !ai.configured || reason === 'AI_OFF';
    $('pt-sorry-title').textContent = notYet ? 'AI drawing isn’t open yet.' : 'Sorry — the AI is out of money for today.';
    $('pt-sorry-text').textContent = notYet
      ? 'It’s in a small beta. The starter drawings work any time.'
      : `AI drawing runs on a small daily budget while it’s in beta, and today’s is spent. It comes back ${ai?.resetsAt ? `at ${new Date(ai.resetsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'tomorrow'}; the starter drawings work any time.`;
  }

  function setPhoto(p) {
    photo = p;
    const now = $('pt-pic-now');
    $('pt-pic-clear').hidden = !p;
    if (!p) {
      now.textContent = 'No photo chosen: it uses the first iNaturalist photo for the name.';
      return;
    }
    now.replaceChildren();
    const i = document.createElement('img');
    i.src = p.dataUrl || p.thumb;
    i.alt = '';
    const t = document.createElement('span');
    t.textContent = p.dataUrl ? 'Your photo' : p.label;
    now.append(i, t);
  }
  $('pt-pic-clear').addEventListener('click', () => setPhoto(null));

  // their own photo, shrunk in the browser before it's sent
  $('pt-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * scale);
      c.height = Math.round(bmp.height * scale);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      setPhoto({ dataUrl: c.toDataURL('image/jpeg', 0.85) });
      $('pt-results').hidden = true;
    } catch {
      $('pt-ai-error').textContent = 'That photo couldn’t be opened here. Try a JPEG or PNG.';
    }
  });

  $('pt-search-btn').addEventListener('click', async (e) => {
    const q = state.species || state.name;
    if (!q) return ($('pt-ai-error').textContent = 'Type the plant’s name first.');
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Searching…';
    $('pt-ai-error').textContent = '';
    try {
      const { photos } = await api('GET', `/api/photos?q=${encodeURIComponent(q)}`);
      const box = $('pt-results');
      box.replaceChildren(
        ...photos.map((p) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'pt-tile';
          b.setAttribute('role', 'listitem');
          b.title = `${p.label}${p.credit ? ` — ${p.credit}` : ''}`;
          b.innerHTML = '<img alt="" width="72" height="72"><span></span>';
          b.querySelector('img').src = p.thumb;
          b.querySelector('span').textContent = p.label;
          b.addEventListener('click', () => {
            setPhoto({ url: p.url, label: p.label, thumb: p.thumb });
            box.hidden = true;
          });
          return b;
        }),
      );
      box.hidden = !photos.length;
      if (!photos.length) $('pt-ai-error').textContent = 'No photos found — try the botanical name, or use your own photo.';
    } catch (err) {
      $('pt-ai-error').textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Search plant photos';
    }
  });

  const picture = () => (photo?.dataUrl ? { photo: photo.dataUrl } : photo?.url ? { photoUrl: photo.url } : {});
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const mmss = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
  const lock = (on) => {
    busy = on;
    for (const b of document.querySelectorAll('#pt-draw, #pt-edit button, .pt-tile, #pt-download')) b.disabled = on;
  };

  async function follow(id) {
    state.job = id;
    save();
    lock(true);
    $('pt-ai-error').textContent = '';
    $('pt-progress').hidden = false;
    const t = { offset: 0, at: Date.now() };
    const timer = setInterval(() => ($('pt-time').textContent = mmss(t.offset + Date.now() - t.at)), 500);
    try {
      for (;;) {
        const { job } = await api('GET', `/api/jobs/${id}`);
        $('pt-progress-title').textContent = job.kind === 'edit' ? 'The AI is changing the drawing' : 'The AI is drawing';
        $('pt-steps').replaceChildren(
          ...job.steps.map((s, i) => {
            const li = document.createElement('li');
            const current = i === job.steps.length - 1 && !job.done;
            li.className = current ? 'now' : '';
            li.textContent = `${current ? '' : '✓ '}${s.label}${current ? '…' : ''}`;
            return li;
          }),
        );
        if (job.preview && !state.drawing.svg) img.src = `${job.preview}?t=${Date.now()}`;
        t.offset = job.elapsedMs;
        t.at = Date.now();
        if (job.done) {
          if (job.error) throw Object.assign(new Error(job.error.message), { code: job.error.code });
          lock(false);
          choose({ svg: job.svg });
          break;
        }
        await sleep(1500);
      }
    } catch (err) {
      $('pt-ai-error').textContent = err.message;
      if (err.code === 'OUT_OF_BUDGET' || err.code === 'AI_OFF') refreshStatus(err.code);
      showPreview();
    } finally {
      clearInterval(timer);
      $('pt-progress').hidden = true;
      state.job = null;
      save();
      lock(false);
    }
  }

  async function start(path, body) {
    if (busy) return;
    $('pt-ai-error').textContent = '';
    try {
      const { job } = await api('POST', path, body);
      follow(job.id);
    } catch (err) {
      $('pt-ai-error').textContent = err.message;
      if (err.code === 'OUT_OF_BUDGET' || err.code === 'AI_OFF') refreshStatus(err.code);
    }
  }

  $('pt-draw').addEventListener('click', () => {
    if (!state.name && !state.species) {
      $('pt-ai-error').textContent = 'Type the plant’s name first.';
      return $('pt-name').focus();
    }
    start('/api/draw', { name: state.name, species: state.species, ...picture() });
  });
  $('pt-edit').addEventListener('submit', (e) => {
    e.preventDefault();
    const instruction = $('pt-instruction').value.trim();
    if (!instruction) return $('pt-instruction').focus();
    $('pt-ai').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    start('/api/edit', { ...state.drawing, instruction, name: state.name, species: state.species, ...picture() });
  });

  async function refreshStatus(reason) {
    try {
      showAi((await api('GET', '/api/status')).ai, reason);
    } catch {
      showAi(null);
    }
  }

  // ------------------------------------------------------ tell me when --
  $('pt-notify').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const msg = $('pt-notify-msg');
    const btn = f.querySelector('button');
    btn.disabled = true;
    try {
      await api('POST', '/api/notify', { email: f.email.value.trim(), website: f.website.value });
      msg.textContent = 'Thanks — you’ll get one email when it’s open.';
      f.email.value = '';
    } catch (err) {
      msg.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  // ------------------------------------------------------------ start --
  (async () => {
    try {
      starters = (await api('GET', '/api/starters')).starters;
    } catch {
      starters = [];
    }
    await refreshStatus();
    renderStarters();
    showPreview();
    if (state.job) follow(state.job);
  })();
})();
