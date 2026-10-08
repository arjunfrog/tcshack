import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

// The live-progress stream end to end: Express route -> generateAndSave -> market insights
// (Anakin) -> Groq -> checks -> save, with Supabase, Anakin and Groq faked at the fetch level.
process.env.SUPABASE_URL = 'https://fakeproj.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
process.env.ANAKIN_API_KEY = 'ak_test';
process.env.GROQ_API_KEY = 'gk_test';
process.env.LLM_PROVIDER = 'groq';
process.env.LLM_REFINE = 'false';

const realFetch = globalThis.fetch;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const retailer = { id: 'r1', owner_id: 'u1', business_name: 'Voltix Audio', brand_personality: ['Bold'], words_to_avoid: 'cheap' };
const product = { id: 'p1', retailer_id: 'r1', name: 'CrispAir 4L', category: 'Home & Kitchen', subcategory: 'Air Fryer', features: ['Rapid air'], specifications: {}, attributes: {}, seed_keywords: [], currency: 'INR' };
const copy = { title: 'Voltix CrispAir 4L Air Fryer', short_description: 'Crisp.', long_description: 'Air fryer with rapid air.\n\nTwo.', bullet_points: ['Fast: rapid air', 'b: c', 'd: e'], seo_keywords: ['air fryer'], meta_description: 'Voltix CrispAir 4L air fryer.' };
let marketRows = [];

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  const method = init.method ?? input.method ?? 'GET';
  if (url.includes('fakeproj.supabase.co')) {
    if (url.includes('/auth/v1/user')) return json({ id: 'u1', email: 'v@x.com', aud: 'authenticated' });
    if (url.includes('/retailers')) return json(retailer);
    if (url.includes('/products')) return json(product);
    if (url.includes('/market_insights')) {
      if (method === 'POST') { marketRows.push(JSON.parse(init.body)); return json([]); }
      return json(marketRows.length ? { insights: marketRows[0].insights, fetched_at: new Date().toISOString() } : null);
    }
    if (url.includes('/descriptions') && method === 'GET') return json([]);
    if (url.includes('/descriptions') && method === 'POST') return json({ id: 'd1', version: 1, ...JSON.parse(init.body) });
  }
  if (url.includes('anakin.io')) {
    const body = init.body ? JSON.parse(init.body) : {};
    const data = body.action_id === 'am_search_suggestions'
      ? { suggestions: [{ text: 'air fryer oven' }] }
      : { products: [{ title: 'A Digital Air Fryer Touch Control' }, { title: 'B Air Fryer Touch Control' }] };
    return json({ status: 'completed', data: { status: 'ok', data } });
  }
  if (url.includes('api.groq.com')) {
    return json({ model: 'openai/gpt-oss-120b', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(copy) } }], usage: { prompt_tokens: 10, completion_tokens: 20 } });
  }
  return realFetch(input, init);
};

const { createApp } = await import('../src/app.js');
let server;
let base;
before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://localhost:${server.address().port}/api`;
});
after(() => server.close());

async function stream(path) {
  const res = await realFetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
    body: JSON.stringify({ options: { tone: 'friendly', length: 'short' } }),
  });
  assert.match(res.headers.get('content-type'), /ndjson/);
  return (await res.text()).trim().split('\n').map((line) => JSON.parse(line));
}

test('streams each generation step, then the saved description', async () => {
  const lines = await stream('/products/p1/generate?stream=1');
  const steps = lines.filter((line) => line.type === 'progress').map((line) => `${line.stage}:${line.status}`);
  for (const step of ['market:start', 'market_source:start', 'market_source:done', 'brand:done', 'market:done', 'write:start', 'write:done', 'checks:done', 'save:done']) {
    assert.ok(steps.includes(step), `missing ${step} in ${steps.join(', ')}`);
  }
  assert.ok(steps.indexOf('market:done') < steps.indexOf('write:start'), 'research finishes before writing');
  assert.ok(steps.indexOf('write:done') < steps.indexOf('save:done'));
  const marketDone = lines.find((line) => line.stage === 'market' && line.status === 'done');
  assert.equal(marketDone.detail.cached, false);
  assert.deepEqual(marketDone.detail.insights.search_terms, ['air fryer oven']);
  const result = lines.at(-1);
  assert.equal(result.type, 'result');
  assert.equal(result.description.version, 1);
  assert.equal(result.description.quality.market.query, 'Air Fryer');
});

test('a second generation of the same type uses the cached insights', async () => {
  const lines = await stream('/products/p1/generate?stream=1');
  const marketDone = lines.find((line) => line.stage === 'market' && line.status === 'done');
  assert.equal(marketDone.detail.cached, true);
  assert.ok(!lines.some((line) => line.stage === 'market_source'), 'no Anakin calls when cached');
});

test('without ?stream=1 the route answers plain JSON', async () => {
  const res = await realFetch(`${base}/products/p1/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
    body: '{}',
  });
  assert.equal(res.status, 201);
  assert.equal((await res.json()).description.version, 1);
});

test('errors arrive as a final error line', async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = async (input, init) => (String(input.url ?? input).includes('api.groq.com') ? json({ error: { message: 'bad key' } }, 401) : saved(input, init));
  try {
    const lines = await stream('/products/p1/generate?stream=1');
    const last = lines.at(-1);
    assert.equal(last.type, 'error');
    assert.match(last.error, /GROQ_API_KEY|authentication/i);
  } finally {
    globalThis.fetch = saved;
  }
});
