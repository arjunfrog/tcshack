import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

// A configured (but unreachable) Supabase, so the auth middleware runs.
process.env.LLM_PROVIDER = 'mock';
process.env.SUPABASE_URL = 'http://127.0.0.1:9';
process.env.SUPABASE_SECRET_KEY = 'test-secret';
const { createApp } = await import('../src/app.js');
const { RetailerInput } = await import('../src/schemas/retailer.js');

let server;
let base;
before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://localhost:${server.address().port}/api`;
});
after(() => server.close());

test('account and product routes need a login', async () => {
  for (const path of ['/me', '/products']) {
    const res = await fetch(`${base}${path}`);
    assert.equal(res.status, 401, path);
    assert.match((await res.json()).error, /log in/i);
  }
});

test('quick generate stays open without a login', async () => {
  const res = await fetch(`${base}/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ product: { name: 'Pulse Buds', category: 'Electronics' } }),
  });
  assert.equal(res.status, 200);
});

const base_retailer = { business_name: 'NewBrew', categories: ['Coffee'], price_positioning: 'premium' };

test('a new seller does not need sales channels', () => {
  const parsed = RetailerInput.parse({ ...base_retailer, seller_type: 'new', store_url: '' });
  assert.equal(parsed.store_url, null);
  assert.deepEqual(parsed.channels, []);
});

test('an existing seller must say where they sell', () => {
  assert.throws(() => RetailerInput.parse({ ...base_retailer, seller_type: 'existing' }), /place you sell/);
  assert.ok(RetailerInput.parse({ ...base_retailer, seller_type: 'existing', channels: ['flipkart'] }));
});

test('store URL must be a full link', () => {
  assert.throws(() => RetailerInput.parse({ ...base_retailer, seller_type: 'new', store_url: 'mystore' }), /full link/);
});
