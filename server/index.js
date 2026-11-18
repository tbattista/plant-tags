/**
 * server/index.js — start the public tool. Settings (all optional):
 *
 *   PORT                    default 3000 (Railway sets it)
 *   OPENAI_API_KEY          AI drawing is off without it
 *   OPENAI_MODEL            default gpt-6.1-sol
 *   OPENAI_BASE_URL         default https://api.openai.com/v1
 *   AI_REASONING_EFFORT     default low (keeps each drawing cheap)
 *   AI_REASONING_TOKENS     default 8000
 *   AI_PRICE_IN/AI_PRICE_OUT  USD per 1M tokens — REQUIRED for AI: without
 *                           them the spend can't be counted, so AI stays off
 *   DAILY_AI_BUDGET_USD     default 0.25
 *   AI_JOB_RESERVE_USD      held per drawing while it runs, default 0.08
 *   AI_PER_IP_PER_DAY       default 3
 *   DATA_DIR                a Railway volume: keeps today's spend across restarts,
 *                           and sign-ups the waitlist couldn't take
 *   WAITLIST_URL            default https://riverpointlabs.co/api/waitlist
 *   WAITLIST_PROJECT        default plant-tags
 */
import { createApp } from './app.js';
import { createBudget } from './budget.js';
import { createGet } from './fetch.js';
import { createProvider } from '../src/provider.js';

const env = (k, d = '') => (process.env[k] ?? '').trim() || d;
const num = (k, d) => (Number.isFinite(Number(process.env[k])) && process.env[k] !== '' && process.env[k] != null ? Number(process.env[k]) : d);

const provider = createProvider({
  apiKey: env('OPENAI_API_KEY'),
  model: env('OPENAI_MODEL', 'gpt-6.1-sol'),
  baseUrl: env('OPENAI_BASE_URL', 'https://api.openai.com/v1').replace(/\/+$/, ''),
  reasoningEffort: env('AI_REASONING_EFFORT', 'low'),
  reasoningTokens: num('AI_REASONING_TOKENS', 8000),
  timeoutMs: num('AI_TIMEOUT_MS', 120000),
});
const dataDir = env('DATA_DIR') || null;
const budget = createBudget({
  dailyUsd: num('DAILY_AI_BUDGET_USD', 0.25),
  priceIn: num('AI_PRICE_IN', 0),
  priceOut: num('AI_PRICE_OUT', 0),
  reserveUsd: num('AI_JOB_RESERVE_USD', 0.08),
  dataDir,
});

const app = createApp({
  provider,
  budget,
  get: createGet(),
  dataDir,
  waitlist: { url: env('WAITLIST_URL', 'https://riverpointlabs.co/api/waitlist'), project: env('WAITLIST_PROJECT', 'plant-tags') },
  limits: { aiPerIpPerDay: num('AI_PER_IP_PER_DAY', 3) },
});

const port = num('PORT', 3000);
app.listen(port, () => {
  console.log(`plant tag maker on :${port} — AI ${provider.configured ? (budget.priced ? `on, $${budget.status().dailyUsd}/day` : 'OFF: set AI_PRICE_IN and AI_PRICE_OUT') : 'off (no OPENAI_API_KEY)'}`);
  if (!dataDir) console.log('DATA_DIR not set: today’s AI spend resets if the service restarts.');
});
