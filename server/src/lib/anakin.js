import { config } from '../config/env.js';

// Minimal client for Anakin Wire: submit an action, then poll its job until it finishes.
// Response shape (seen in scripts/anakin-probe.js runs):
//   { status: 'completed', credits_used, data: { status: 'ok', data: <action result>, error } }

const API = 'https://api.anakin.io/v1/wire';
const POLL_MS = 1500;
const DONE = ['completed', 'succeeded', 'success'];
const FAILED = ['failed', 'error', 'cancelled', 'canceled'];

export const isAnakinConfigured = () => Boolean(config.anakin.apiKey);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function call(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'X-API-Key': config.anakin.apiKey, 'content-type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Anakin ${method} ${path} failed (${res.status}): ${json?.error?.message ?? json?.message ?? 'no details'}`);
  return json;
}

// Returns the action's own result (the inner `data`), or throws.
export async function runAction(actionId, params, { timeoutMs = 60_000 } = {}) {
  let job = await call('POST', '/task', { action_id: actionId, params });
  const jobId = job.job_id ?? job.id;
  const started = Date.now();

  while (!DONE.includes(String(job.status).toLowerCase())) {
    if (FAILED.includes(String(job.status).toLowerCase())) {
      throw new Error(`Anakin ${actionId} failed: ${job.error?.message ?? job.data?.error ?? 'unknown error'}`);
    }
    if (!jobId) throw new Error(`Anakin ${actionId}: no job id in response`);
    if (Date.now() - started > timeoutMs) throw new Error(`Anakin ${actionId} timed out after ${timeoutMs / 1000}s`);
    await sleep(POLL_MS);
    job = await call('GET', `/jobs/${jobId}`);
  }

  const result = job.data;
  if (result?.status && result.status !== 'ok') throw new Error(`Anakin ${actionId}: ${result.error ?? result.status}`);
  return result?.data ?? result;
}
