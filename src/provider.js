/**
 * ai/provider.js — an OpenAI Responses API (/v1/responses) client with tool
 * calling and image input (OPENAI_API_KEY, OPENAI_MODEL, OPENAI_BASE_URL).
 * Keys stay server-side.
 *
 * Callers speak the chat format (system/user/assistant/tool messages,
 * image_url parts) and get a chat-shaped message back; this file translates
 * both ways, so a model change never reaches the rest of the app. Current
 * reasoning models (GPT-6.1) only call tools through /v1/responses.
 *
 * Nothing is stored at OpenAI (store: false): the app sends the history each
 * time. Within a turn the model's encrypted reasoning rides along on the
 * assistant message and is handed back with the tool results.
 *
 * Failures are classified, never papered over: the caller decides what to
 * tell the owner. One bounded retry on 429/5xx/network errors.
 */

import { TagError } from './errors.js';

/** One chat-format content part → a Responses input part. */
function inputPart(p) {
  if (p.type === 'text') return { type: 'input_text', text: p.text };
  if (p.type === 'image_url') return { type: 'input_image', image_url: p.image_url.url, detail: p.image_url.detail || 'auto' };
  return p;
}

/** Chat-format messages → Responses `input` items. */
export function toInput(messages) {
  const items = [];
  for (const m of messages) {
    if (m.role === 'tool') {
      items.push({ type: 'function_call_output', call_id: m.tool_call_id, output: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) });
    } else if (m.role === 'assistant') {
      for (const r of m.reasoning || []) items.push(r);
      if (m.content) items.push({ role: 'assistant', content: m.content });
      for (const c of m.tool_calls || []) items.push({ type: 'function_call', call_id: c.id, name: c.function.name, arguments: c.function.arguments || '{}' });
    } else {
      const role = m.role === 'system' ? 'developer' : m.role;
      items.push({ role, content: Array.isArray(m.content) ? m.content.map(inputPart) : m.content || '' });
    }
  }
  return items;
}

/** A Responses result → { message, finishReason, usage } in chat shape. */
export function fromOutput(data) {
  const text = [];
  const toolCalls = [];
  const reasoning = [];
  for (const item of data.output || []) {
    if (item.type === 'message') {
      for (const c of item.content || []) {
        if (c.type === 'output_text') text.push(c.text);
        else if (c.type === 'refusal') text.push(c.refusal);
      }
    } else if (item.type === 'function_call') {
      toolCalls.push({ id: item.call_id, type: 'function', function: { name: item.name, arguments: item.arguments || '{}' } });
    } else if (item.type === 'reasoning') {
      reasoning.push({ type: 'reasoning', id: item.id, summary: item.summary || [], ...(item.encrypted_content ? { encrypted_content: item.encrypted_content } : {}) });
    }
  }
  const message = { role: 'assistant', content: text.join('') || null, ...(toolCalls.length ? { tool_calls: toolCalls } : {}), ...(reasoning.length ? { reasoning } : {}) };
  const cutOff = data.status === 'incomplete';
  const finishReason = toolCalls.length ? 'tool_calls' : cutOff ? (data.incomplete_details?.reason === 'max_output_tokens' ? 'length' : 'content_filter') : 'stop';
  const u = data.usage;
  const usage = u ? { prompt_tokens: u.input_tokens || 0, completion_tokens: u.output_tokens || 0, reasoning_tokens: u.output_tokens_details?.reasoning_tokens || 0 } : null;
  return { message, finishReason, usage };
}

export function createProvider(cfg, { fetchImpl = fetch } = {}) {
  const configured = !!cfg.apiKey;
  // Encrypted reasoning is requested so it can be handed back between tool rounds.
  // A model that has no reasoning refuses the request; that is learned once and kept.
  let keepReasoning = true;

  async function once(body, signal) {
    let res;
    try {
      res = await fetchImpl(`${cfg.baseUrl}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.any([AbortSignal.timeout(cfg.timeoutMs), ...(signal ? [signal] : [])]),
      });
    } catch (err) {
      const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      throw new TagError(timedOut ? 'AI_TIMEOUT' : 'AI_NETWORK', timedOut ? 'The AI service took too long to answer.' : 'The AI service could not be reached.', 503, { retryable: true });
    }
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      // The provider's own reason (e.g. a model that does not take a parameter) is what
      // tells the owner what to change, so it is logged and shown rather than dropped.
      let reason = '';
      try {
        reason = String(JSON.parse(detail)?.error?.message || '').slice(0, 240);
      } catch {}
      console.warn(`[ai] ${cfg.model} returned ${res.status}:`, detail || '(no body)');
      if (res.status === 401 || res.status === 403) throw new TagError('AI_AUTH', 'The AI service rejected the configured API key.', 503, { detail });
      if (res.status === 404) throw new TagError('AI_MODEL', `The configured model (${cfg.model}) is not available to this API key.`, 503, { detail });
      if (res.status === 400) throw new TagError('AI_REQUEST', `The AI service refused the request${reason ? `: ${reason.replace(/\.$/, '')}` : ''}.`, 502, { detail });
      throw new TagError(res.status === 429 ? 'AI_BUSY' : 'AI_UNAVAILABLE', res.status === 429 ? 'The AI service is rate-limiting requests right now.' : `The AI service had an error (${res.status}).`, 503, {
        retryable: true,
        detail,
      });
    }
    const data = await res.json().catch(() => null);
    if (!data || !Array.isArray(data.output)) throw new TagError('AI_BAD_RESPONSE', 'The AI service returned an empty answer.', 502, { retryable: true });
    if (data.status === 'failed') throw new TagError('AI_UNAVAILABLE', `The AI service failed to answer${data.error?.message ? `: ${data.error.message}` : ''}.`, 503, { retryable: true });
    const out = fromOutput(data);
    if (out.finishReason === 'length' && !out.message.content && !out.message.tool_calls) {
      throw new TagError('AI_BAD_RESPONSE', 'The model used its whole output allowance (most of it thinking) before answering. Raise AI_REASONING_TOKENS or lower AI_REASONING_EFFORT.', 502);
    }
    return { ...out, model: data.model || cfg.model };
  }

  return {
    configured,
    model: cfg.model,
    /** messages: chat format. tools: [{ name, description, parameters }]. maxTokens: the visible answer's budget. */
    async complete({ messages, tools, maxTokens = 1800, signal }) {
      if (!configured) throw new TagError('AI_NOT_CONFIGURED', 'AI chat is not configured (OPENAI_API_KEY is not set).', 503);
      const build = () => ({
        model: cfg.model,
        input: toInput(keepReasoning ? messages : messages.map(({ reasoning, ...m }) => m)),
        store: false,
        // Reasoning tokens count against max_output_tokens, so thinking gets its own allowance.
        max_output_tokens: maxTokens + (cfg.reasoningTokens ?? 16000),
        ...(cfg.reasoningEffort ? { reasoning: { effort: cfg.reasoningEffort } } : {}),
        ...(keepReasoning ? { include: ['reasoning.encrypted_content'] } : {}),
        ...(tools?.length
          ? { tools: tools.map((t) => ({ type: 'function', name: t.name, description: t.description, parameters: t.parameters, strict: false })), tool_choice: 'auto' }
          : {}),
      });
      const attempt = async () => {
        try {
          return await once(build(), signal);
        } catch (err) {
          if (keepReasoning && err.code === 'AI_REQUEST' && /encrypted/i.test(err.detail || '')) {
            keepReasoning = false;
            console.warn(`[ai] ${cfg.model} does not return encrypted reasoning; continuing without it.`);
            return once(build(), signal);
          }
          throw err;
        }
      };
      try {
        return await attempt();
      } catch (err) {
        if (!err.retryable || signal?.aborted) throw err;
        await new Promise((r) => setTimeout(r, 1500));
        return attempt();
      }
    },
  };
}
