# Working on plant-tags

This repo is two things, and both are live:

1. **The generator** (`src/`, `samples/`, `icons/`, `thumbs/`, `tools/`) — the
   library the Plants app (`tbattista/plants`) installs as a dependency,
   pinned to a release tag: `"plant-tags": "github:tbattista/plant-tags#vX.Y.Z"`.
2. **The public Plant Tag Maker** (`server/`) — its own Railway service,
   linked from riverpointlabs.co/tools/.

## Shipping a change

1. `npm test` — must pass. Never ship red.
2. Commit on `main` and push (Railway redeploys the public tool).
3. If the generator changed (anything outside `server/`): bump `version` in
   `package.json`, tag it `vX.Y.Z` and push the tag. Then, in the Plants repo,
   change its `plant-tags` dependency to the new tag, run its tests, and ship
   Plants as its CLAUDE.md says. Both sites then have the change.

## Rules

- No database, accounts or app-specific code in `src/`: callers pass in what
  they own (an AI provider and `onUsage`, a safe `get` for fetching).
- The public tool fetches only from iNaturalist (`server/fetch.js`); visitors
  upload photos, never links.
- AI spend is capped by `server/budget.js` — keep every AI call going through
  a reserved budget ticket.
- Starter drawings: edit `tools/` (see `tools/lib.py`), then `npm run art`.
