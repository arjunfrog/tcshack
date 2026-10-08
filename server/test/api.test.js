import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

// Force offline mode before the app (and its config) loads.
process.env.LLM_PROVIDER = 'mock';
process.env.SUPABASE_URL = '';
const { createApp } = await import('../src/app.js');

let server;
let base;
before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://localhost:${server.address().port}/api`;
});
after(() => server.close());

test('GET /api/health reports provider and database state', async () => {
  const body = await (await fetch(`${base}/health`)).json();
  assert.equal(body.status, 'ok');
  assert.equal(body.llm.provider, 'mock');
  assert.equal(body.database, 'not_configured');
});

test('POST /api/generate returns copy, metadata and quality checks', async () => {
  const res = await fetch(`${base}/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ product: { name: 'Pulse Buds', category: 'Electronics', features: ['ANC'] } }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.output.title.includes('Pulse Buds'));
  assert.equal(body.meta.provider, 'mock');
  assert.ok(body.quality.seo.total > 0);
  assert.equal(body.quality.facts.passed, true);
  assert.ok(Array.isArray(body.quality.style.issues));
  assert.equal(body.quality.input.sparse, true);
});

test('POST /api/generate/check scores completeness without generating', async () => {
  const res = await fetch(`${base}/generate/check`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ product: { name: 'Pulse Buds', category: 'Electronics', features: ['ANC'] } }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.sparse, true);
  assert.ok(body.score < 50);
  assert.ok(body.issues.includes('No brand'));
});

test('POST /api/generate rejects a product without a name', async () => {
  const res = await fetch(`${base}/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ product: { category: 'Electronics' } }),
  });
  assert.equal(res.status, 400);
});
