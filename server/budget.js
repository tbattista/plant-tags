/**
 * budget.js — the public tool's daily AI allowance (DAILY_AI_BUDGET_USD,
 * $0.25 by default), counted in dollars from the model's own token counts and
 * the prices you set (AI_PRICE_IN / AI_PRICE_OUT, USD per 1M tokens).
 *
 * A job reserves a worst-case amount before it starts (AI_JOB_RESERVE_USD),
 * so two drawings at once can't both squeeze under the line; what it really
 * cost is added call by call, and the reservation is let go when it ends.
 * The day turns over at midnight UTC. With DATA_DIR set, the day's spend is
 * kept in a file, so a restart doesn't hand out the budget a second time.
 */
import fs from 'node:fs';
import path from 'node:path';

const today = () => new Date().toISOString().slice(0, 10);

export function createBudget({ dailyUsd = 0.25, priceIn = 0, priceOut = 0, reserveUsd = 0.08, dataDir = null, now = today } = {}) {
  const file = dataDir ? path.join(dataDir, 'ai-budget.json') : null;
  let state = { day: now(), spentUsd: 0, jobs: 0 };
  if (file) {
    try {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (saved?.day && Number.isFinite(saved.spentUsd)) state = saved;
    } catch {
      // first run, or an unreadable file: start the day at zero
    }
  }
  let reserved = 0;
  const priced = priceIn > 0 && priceOut > 0;
  const costOf = ({ inputTokens = 0, outputTokens = 0 }) => (inputTokens * priceIn + outputTokens * priceOut) / 1e6;

  const roll = () => {
    if (state.day !== now()) state = { day: now(), spentUsd: 0, jobs: 0 };
  };
  const save = () => {
    if (!file) return;
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(`${file}.tmp`, JSON.stringify(state));
      fs.renameSync(`${file}.tmp`, file);
    } catch (err) {
      console.warn('[budget] could not save:', err.message);
    }
  };
  const left = () => {
    roll();
    return Math.max(0, dailyUsd - state.spentUsd - reserved);
  };
  const nextMidnight = () => {
    const d = new Date(`${now()}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString();
  };

  return {
    /** Prices are required: without them the spend can't be counted, so AI stays off. */
    priced,
    costOf,
    status() {
      const l = left();
      return { available: priced && l >= reserveUsd, leftUsd: Math.round(l * 1000) / 1000, dailyUsd, resetsAt: nextMidnight(), jobsToday: state.jobs };
    },
    /** Hold room for one job; returns a ticket, or null when there isn't enough left today. */
    reserve() {
      if (!priced || left() < reserveUsd) return null;
      reserved += reserveUsd;
      state.jobs += 1;
      save();
      let open = true;
      return {
        spend: (usage) => {
          roll();
          state.spentUsd += costOf(usage);
          save();
        },
        release: () => {
          if (open) reserved -= reserveUsd;
          open = false;
        },
      };
    },
  };
}
