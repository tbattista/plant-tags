# plant-tags

3D-printed NFC plant tags: a black holder that goes in the pot (a tall stake,
a short stake, or flat on the soil) and a 30 mm four-colour button with the
plant drawn on it, which presses in over a 25 mm NFC sticker.

This repo is both:

- **the generator**, used by [Plants](https://github.com/tbattista/plants)
  (the integrated tag page), and
- **the public Plant Tag Maker**, a small web tool on Riverpoint Labs.

Change it here once and both get it (see *Shipping* below).

## The generator (`src/`)

| File | What it does |
| --- | --- |
| `palette.js` | The four filaments (beige, navy, green, brick red) and the black holder |
| `art.js` | The 33 starter drawings, the SVG cleaner (an allow-list; snaps colours to the four filaments), and AI drawing/editing prompts |
| `geometry.js` | Builds the button (face-down, colour in the first two layers) and every holder with `manifold-3d` (WebAssembly) |
| `files.js` | 3MF (parts on their filaments for Creality Print), STL and ZIP writers |
| `print.js` | The print ZIP (button, all holders, STLs, preview, README), the preview PNG, the fit test |
| `photos.js` | iNaturalist photo search and picture re-encoding (with a `get` you pass in) |
| `provider.js` | An OpenAI Responses API client the AI functions can use |

No database and no accounts. The caller passes in what it owns:

```js
import { cleanSvg, sampleSvg, printPackage, drawWithAi, previewPng } from 'plant-tags';

const svg = cleanSvg(sampleSvg('pothos'));
const { filename, data } = await printPackage(svg, { name: 'Kitchen pothos' });

// AI: a provider with complete({ messages, maxTokens }), and a callback per call
const ai = { provider, onUsage: ({ inputTokens, outputTokens, ok }) => count(inputTokens, outputTokens) };
const drawn = await drawWithAi(ai, { commonName: 'Monstera', species: 'Monstera deliciosa' }, { picture: { jpeg, kind: 'web' }, render: previewPng });
```

Errors are `TagError` (`code`, a message fit to show, `status`).

Starter drawings are drawn in code: `tools/lib.py` holds the style rules,
one module per plant in `tools/plants/`. `npm run art` rebuilds `samples/`
and the `thumbs/`; `node tools/preview.mjs out.png <keys>` shows drawings next
to their printed buttons.

## The public tool (`server/`)

Pick a starter (the closest match to the name comes first), see it exactly as
it prints, download the ZIP. AI drawing, from the visitor's own photo or one
from iNaturalist, plus “Change it”, runs on a **daily budget ($0.25 by
default)**. When the budget's spent or AI isn't switched on, the page says so
and offers **“Get an email when AI drawing is open”**. Sign-ups are sent to the
Riverpoint Labs waitlist (`/api/waitlist`, project `plant-tags`, so they
show in the site's `/admin`), or kept in `DATA_DIR/signups.jsonl` if that
fails.

Guards: one AI drawing at a time per visitor and 3 a day each; previews,
downloads, searches and sign-ups are rate-limited per IP; mesh builds run one
at a time; the server fetches only from iNaturalist hosts; a strict CSP.

### Settings

| Variable | Default | |
| --- | --- | --- |
| `OPENAI_API_KEY` | — | AI drawing is off without it |
| `OPENAI_MODEL` | `gpt-6.1-sol` | |
| `AI_PRICE_IN` / `AI_PRICE_OUT` | — | USD per 1M tokens. **Required for AI**: without prices the spend can't be counted, so AI stays off |
| `DAILY_AI_BUDGET_USD` | `0.25` | resets at midnight UTC |
| `AI_JOB_RESERVE_USD` | `0.08` | held per drawing while it runs, so drawings at once can't overshoot |
| `AI_PER_IP_PER_DAY` | `3` | |
| `AI_REASONING_EFFORT` | `low` | keeps each drawing cheap |
| `DATA_DIR` | — | a Railway volume: keeps the day's spend across restarts, and fallback sign-ups |
| `WAITLIST_URL` | `https://riverpointlabs.co/api/waitlist` | |
| `WAITLIST_PROJECT` | `plant-tags` | needs a visible `plant-tags` entry with `"waitlist": true` in the site's `content/projects.json` |

### Deploy (Railway)

New service from this repo (`railway.json` is set up; health check
`/api/status`). Add a volume mounted at `/data` and set `DATA_DIR=/data`,
set the AI variables, and give it a domain such as `tags.riverpointlabs.co`.

## Shipping

`npm test` (generator + server; no database needed), commit, push `main`
(redeploys the tool). If anything outside `server/` changed, bump the version,
tag `vX.Y.Z`, push the tag, and move Plants' `plant-tags` dependency to it.

## Credits

“Tap here” icon: “NFC Phone” by Andrew Forrester, the Noun Project (CC BY 3.0).
Reference photos from iNaturalist, credited to their photographers.
