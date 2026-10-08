// Thin wrapper around the Express API. Paths are relative: Vite proxies /api in dev.

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export const api = {
  health: () => request('/health'),
  options: () => request('/generate/options'),
  generate: (product, options) =>
    request('/generate', { method: 'POST', body: JSON.stringify({ product, options }) }),
};
