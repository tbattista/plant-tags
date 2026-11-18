/**
 * fetch.js — the public tool's only way out to the web: iNaturalist's API and
 * its photo hosts, nothing else (visitors upload their own photo instead of
 * pasting links, so the server never fetches an address someone typed).
 * Redirects are followed only to the same hosts; size and time are capped.
 */
const HOSTS = new Set(['api.inaturalist.org', 'www.inaturalist.org', 'static.inaturalist.org', 'inaturalist-open-data.s3.amazonaws.com']);
const TIMEOUT_MS = 10_000;

export const allowed = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && HOSTS.has(u.hostname);
  } catch {
    return false;
  }
};

export function createGet({ fetchImpl = fetch } = {}) {
  return async function get(url, { accept = '*/*', maxBytes = 5_000_000 } = {}) {
    let target = url;
    for (let hop = 0; hop < 4; hop++) {
      if (!allowed(target)) throw Object.assign(new Error('That address is not allowed.'), { code: 'NOT_ALLOWED' });
      const res = await fetchImpl(target, { headers: { accept, 'user-agent': 'plant-tags (riverpointlabs.co)' }, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        target = new URL(res.headers.get('location'), target).href;
        continue;
      }
      const chunks = [];
      let size = 0;
      let truncated = false;
      if (res.body) {
        for await (const chunk of res.body) {
          size += chunk.length;
          if (size > maxBytes) {
            truncated = true;
            break;
          }
          chunks.push(chunk);
        }
      }
      return { status: res.status, contentType: res.headers.get('content-type') || '', body: Buffer.concat(chunks), truncated };
    }
    throw Object.assign(new Error('Too many redirects.'), { code: 'NOT_ALLOWED' });
  };
}
