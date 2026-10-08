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

const post = (path, body = {}) => request(path, { method: 'POST', body: JSON.stringify(body) });

export const api = {
  health: () => request('/health'),
  options: () => request('/generate/options'),
  generate: (product, options) => post('/generate', { product, options }),

  products: (params = {}) => request(`/products?${new URLSearchParams(params)}`),
  product: (id) => request(`/products/${id}`),
  importProducts: (format, data) => post('/products/import', { format, data }),
  importSample: () => post('/products/import-sample'),
  generateForProduct: (id, options) => post(`/products/${id}/generate`, { options }),
};
