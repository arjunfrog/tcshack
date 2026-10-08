import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBatchRunner, exportRows, finalStatus } from '../src/services/batch.js';
import { toCsv } from '../src/lib/csv.js';

// The same interface as services/jobStore.js, kept in memory.
function memoryStore(products) {
  const jobs = new Map();
  const items = new Map(); // job id -> Map(product id -> item)
  let nextId = 1;
  return {
    jobs,
    items,
    async createJob(retailerId, productIds, options) {
      const job = { id: `job-${nextId++}`, retailer_id: retailerId, options, status: 'queued', total: productIds.length };
      jobs.set(job.id, job);
      items.set(job.id, new Map(productIds.map((id) => [id, { job_id: job.id, product_id: id, status: 'queued', error: null }])));
      return { ...job };
    },
    async getItems(jobId) {
      return [...items.get(jobId).values()].map((item) => ({ ...item }));
    },
    async getProducts(retailerId, ids) {
      return products.filter((product) => product.retailer_id === retailerId && ids.includes(product.id));
    },
    async updateJob(jobId, fields) {
      Object.assign(jobs.get(jobId), fields);
    },
    async updateItem(jobId, productId, fields) {
      Object.assign(items.get(jobId).get(productId), fields);
    },
  };
}

const products = Array.from({ length: 8 }, (_, i) => ({ id: `p${i + 1}`, retailer_id: 'r1', name: `Product ${i + 1}` }));
const options = { tone: 'friendly', length: 'short' };
const statuses = (store, jobId) => Object.fromEntries([...store.items.get(jobId).values()].map((item) => [item.product_id, item.status]));

test('runs every product with at most `concurrency` in flight, then completes', async () => {
  const store = memoryStore(products);
  let inFlight = 0;
  let peak = 0;
  const generateItem = async (product, opts, { jobId }) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight--;
    assert.deepEqual(opts, options);
    return { id: `d-${product.id}`, jobId };
  };
  const runner = createBatchRunner({ store, generateItem, concurrency: 3 });

  const job = await runner.start('r1', products.map((p) => p.id), options);
  assert.equal(runner.isActive(job.id), true);
  await runner.whenDone(job.id);

  assert.equal(peak, 3);
  assert.equal(runner.isActive(job.id), false);
  assert.deepEqual(
    { status: store.jobs.get(job.id).status, succeeded: store.jobs.get(job.id).succeeded, failed: store.jobs.get(job.id).failed },
    { status: 'completed', succeeded: 8, failed: 0 },
  );
  assert.equal(store.items.get(job.id).get('p1').description_id, 'd-p1');
});

test('a failing product is recorded and the rest of the job carries on', async () => {
  const store = memoryStore(products);
  const generateItem = async (product) => {
    if (product.id === 'p3') throw new Error('model returned nonsense');
    return { id: `d-${product.id}` };
  };
  const runner = createBatchRunner({ store, generateItem, concurrency: 2 });
  const job = await runner.start('r1', ['p1', 'p2', 'p3', 'p4', 'missing'], options);
  await runner.whenDone(job.id);

  const saved = store.jobs.get(job.id);
  assert.deepEqual([saved.status, saved.succeeded, saved.failed], ['partial', 3, 2]);
  assert.equal(store.items.get(job.id).get('p3').error, 'model returned nonsense');
  assert.equal(store.items.get(job.id).get('missing').error, 'Product no longer exists');
});

test('rate-limited products pause and try again', async () => {
  const store = memoryStore(products);
  let calls = 0;
  const generateItem = async (product) => {
    calls++;
    if (calls === 1) throw Object.assign(new Error('LLM rate limit reached'), { status: 429 });
    return { id: `d-${product.id}` };
  };
  const runner = createBatchRunner({ store, generateItem, concurrency: 1, rateLimitPauseMs: 1 });
  const job = await runner.start('r1', ['p1'], options);
  await runner.whenDone(job.id);

  assert.equal(calls, 2);
  assert.equal(store.jobs.get(job.id).status, 'completed');
});

test('resume reruns only the products that have not succeeded', async () => {
  const store = memoryStore(products);
  let quotaLeft = 2;
  const generated = [];
  const generateItem = async (product) => {
    if (quotaLeft-- <= 0) throw new Error('daily quota used up');
    generated.push(product.id);
    return { id: `d-${product.id}` };
  };
  const runner = createBatchRunner({ store, generateItem, concurrency: 1 });
  const job = await runner.start('r1', ['p1', 'p2', 'p3', 'p4'], options);
  await runner.whenDone(job.id);
  assert.equal(store.jobs.get(job.id).status, 'partial');

  quotaLeft = 10; // the quota resets
  await runner.resume(job);
  await runner.whenDone(job.id);

  assert.deepEqual(generated, ['p1', 'p2', 'p3', 'p4']);
  assert.equal(store.jobs.get(job.id).status, 'completed');
  assert.deepEqual(statuses(store, job.id), { p1: 'succeeded', p2: 'succeeded', p3: 'succeeded', p4: 'succeeded' });
});

test('resume refuses a job that is still running', async () => {
  const store = memoryStore(products);
  let release;
  const runner = createBatchRunner({ store, generateItem: () => new Promise((resolve) => { release = resolve; }), concurrency: 1 });
  const job = await runner.start('r1', ['p1'], options);
  await assert.rejects(runner.resume(job), (error) => error.status === 409);
  await new Promise((resolve) => setImmediate(resolve));
  release({ id: 'd-p1' });
  await runner.whenDone(job.id);
});

test('final status reflects how many products succeeded', () => {
  assert.equal(finalStatus(5, 0), 'completed');
  assert.equal(finalStatus(3, 2), 'partial');
  assert.equal(finalStatus(0, 5), 'failed');
});

test('export flattens items into one row per product', () => {
  const [row] = exportRows([{
    status: 'succeeded',
    error: null,
    product: { sku: 'SKU-1', name: 'Mat', category: 'Sports' },
    description: {
      title: 'IronPeak Yoga Mat, 8 mm', short_description: 'Grippy.', long_description: 'One.\n\nTwo.',
      bullet_points: ['Grip: textured', 'Light: 0.9 kg'], seo_keywords: ['yoga mat', 'cork mat'], meta_description: 'Shop it.',
      quality: { seo: { passed: 5, total: 5 }, facts: { unsupported: [{ text: '40 hours' }] }, style: { issues: [{ type: 'cliche' }] } },
      model: 'openai/gpt-oss-120b', version: 2,
    },
  }]);
  assert.equal(row.bullet_points, 'Grip: textured | Light: 0.9 kg');
  assert.equal(row.seo_checks, '5/5');
  assert.equal(row.fact_flags, '40 hours');
  assert.equal(row.style_issues, 'cliche');

  const csv = toCsv([row], ['sku', 'title', 'long_description']);
  assert.equal(csv, 'sku,title,long_description\nSKU-1,"IronPeak Yoga Mat, 8 mm","One.\n\nTwo."\n');
});
