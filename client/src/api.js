// Thin wrapper around the Express API. Paths are relative: Vite proxies /api in dev.
import { supabase } from './lib/supabase.js';

async function authHeaders() {
  const headers = { 'content-type': 'application/json' };
  // Send the logged-in user's access token so the API knows whose catalog this is.
  const session = supabase && (await supabase.auth.getSession()).data.session;
  if (session) headers.authorization = `Bearer ${session.access_token}`;
  return headers;
}

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, { ...options, headers: await authHeaders() });
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

// POST that streams live progress (NDJSON, see server/src/lib/progressStream.js): calls
// onProgress(event) for each step and resolves with the final result.
async function postStream(path, body, onProgress) {
  const res = await fetch(`/api${path}${path.includes('?') ? '&' : '?'}stream=1`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const payload = await res.json().catch(() => ({}));
    if (!payload.error && (res.status === 502 || res.status === 504)) {
      throw new Error('Cannot reach the API server on port 4000. Check the [server] lines in the npm run dev terminal.');
    }
    throw Object.assign(new Error(payload.error || `Request failed (${res.status})`), { status: res.status, details: payload.details });
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = null;
  const handle = (line) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === 'progress') onProgress?.(event);
    else if (event.type === 'error') throw Object.assign(new Error(event.error), { status: event.status });
    else if (event.type === 'result') result = event;
  };
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    lines.forEach(handle);
    if (done) break;
  }
  handle(buffer);
  if (!result) throw new Error('The server closed the connection before finishing. Check the [server] lines in the terminal.');
  return result;
}
const patch = (path, body = {}) => request(path, { method: 'PATCH', body: JSON.stringify(body) });

// Fetches a file the API serves (e.g. a job export) and hands it to the browser to save.
async function download(path, filename) {
  const res = await fetch(`/api${path}`, { headers: await authHeaders() });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Download failed (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url);
}

export const api = {
  health: () => request('/health'),
  options: () => request('/generate/options'),
  generate: (product, options) => post('/generate', { product, options }),

  signup: (email, password) => post('/signup', { email, password }),
  me: () => request('/me'),
  saveRetailer: (retailer) => request('/me/retailer', { method: 'PUT', body: JSON.stringify(retailer) }),

  products: (params = {}) => request(`/products?${new URLSearchParams(params)}`),
  product: (id) => request(`/products/${id}`),
  importProducts: (format, data) => post('/products/import', { format, data }),
  importSample: () => post('/products/import-sample'),
  generateForProduct: (id, options, onProgress) => postStream(`/products/${id}/generate`, { options }, onProgress),
  quickGenerate: (product, options, onProgress) => postStream('/products/quick', { product, options }, onProgress),
  searchPhotos: (query) => request(`/photos?${new URLSearchParams({ query })}`),
  setProductImage: (id, body) => post(`/products/${id}/image`, body),
  removeProductImage: (id) => request(`/products/${id}/image`, { method: 'DELETE' }),
  autoPhotos: () => post('/products/auto-photos'),
  history: (limit = 100) => request(`/history?limit=${limit}`),
  checkProduct: (product) => post('/generate/check', { product }),

  startJob: (selection, options) => post('/jobs', { ...selection, options }),
  jobs: () => request('/jobs'),
  job: (id) => request(`/jobs/${id}`),
  resumeJob: (id) => post(`/jobs/${id}/resume`),
  exportJob: (id, format) => download(`/jobs/${id}/export?format=${format}`, `descriptions-${id.slice(0, 8)}.${format}`),

  reviewQueue: (limit = 20) => request(`/review?limit=${limit}`),
  updateDescription: (id, changes) => patch(`/descriptions/${id}`, changes),
  rateDescription: (id, rating) => post(`/descriptions/${id}/feedback`, rating),
  metrics: () => request('/metrics'),
};
