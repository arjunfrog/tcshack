// Thin wrapper around the Express API. Paths are relative: Vite proxies /api in dev.
import { supabase } from './lib/supabase.js';

async function request(path, options = {}) {
  const headers = { 'content-type': 'application/json' };
  // Send the logged-in user's access token so the API knows whose catalog this is.
  const session = supabase && (await supabase.auth.getSession()).data.session;
  if (session) headers.authorization = `Bearer ${session.access_token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // The Vite proxy answers 502/504 with no JSON when the Express server isn't running.
    if (!body.error && (res.status === 502 || res.status === 504)) {
      throw new Error('Cannot reach the API server on port 4000. Check the [server] lines in the npm run dev terminal.');
    }
    const error = new Error(body.error || `Request failed (${res.status})`);
    error.status = res.status;
    error.details = body.details;
    throw error;
  }
  return body;
}

const post = (path, body = {}) => request(path, { method: 'POST', body: JSON.stringify(body) });

export const api = {
  health: () => request('/health'),
  options: () => request('/generate/options'),
  generate: (product, options) => post('/generate', { product, options }),

  me: () => request('/me'),
  saveRetailer: (retailer) => request('/me/retailer', { method: 'PUT', body: JSON.stringify(retailer) }),

  products: (params = {}) => request(`/products?${new URLSearchParams(params)}`),
  product: (id) => request(`/products/${id}`),
  importProducts: (format, data) => post('/products/import', { format, data }),
  importSample: () => post('/products/import-sample'),
  generateForProduct: (id, options) => post(`/products/${id}/generate`, { options }),
  quickGenerate: (product, options) => post('/products/quick', { product, options }),
  history: (limit = 100) => request(`/history?limit=${limit}`),
};
