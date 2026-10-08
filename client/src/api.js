// Thin wrapper around the Express API. Paths are relative: Vite proxies /api in dev.
import { supabase } from './lib/supabase.js';

async function request(path, options = {}) {
  const headers = { 'content-type': 'application/json' };
  // Send the logged-in user's access token so the API knows whose catalog this is.
  let token = null;
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      token = data?.session?.access_token;
    } catch {
      // ignore
    }
  }
  if (!token) {
    token = localStorage.getItem('demo_token');
  }
  if (token) headers.authorization = `Bearer ${token}`;

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
  getIntelligence: (product, options) => post('/generate/intelligence', { product, options }),

  me: () => request('/me'),
  saveRetailer: (retailer) => request('/me/retailer', { method: 'PUT', body: JSON.stringify(retailer) }),
  getRetailerProfile: () => request('/me/retailer/profile'),
  analyzeCatalog: () => post('/me/retailer/analyze'),

  products: (params = {}) => request(`/products?${new URLSearchParams(params)}`),
  product: (id) => request(`/products/${id}`),
  importProducts: (format, data) => post('/products/import', { format, data }),
  importSample: () => post('/products/import-sample'),
  generateForProduct: (id, options) => post(`/products/${id}/generate`, { options }),
  updateDescription: (productId, descId, patch) => request(`/products/${productId}/descriptions/${descId}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  getProductIntelligence: (id) => request(`/products/${id}/intelligence`),
  getDescriptionEvidence: (productId, descId) => request(`/products/${productId}/descriptions/${descId}/evidence`),
  submitFeedback: (productId, descId, feedback) => post(`/products/${productId}/descriptions/${descId}/feedback`, feedback),
};
