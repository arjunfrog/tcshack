// Batch generation jobs (phase 3). A job covers a list of products, each tracked as an
// item that moves queued -> running -> succeeded | failed. Jobs run in this process in
// the background with a concurrency limit. Jobs and items are stored (see jobStore.js),
// so progress survives a page reload and an interrupted job can be resumed.

import { mapPool } from '../lib/pool.js';

export const MAX_JOB_PRODUCTS = 500;
// Rate-limited items wait this long and try again, up to RATE_LIMIT_RETRIES times,
// on top of the waits llm.js already does within one request.
const RATE_LIMIT_PAUSE_MS = 60_000;
const RATE_LIMIT_RETRIES = 2;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Final status from item outcomes: every product done, none done, or some of each.
export function finalStatus(succeeded, failed) {
  if (failed === 0) return 'completed';
  return succeeded === 0 ? 'failed' : 'partial';
}

// store: createJob, getJob, getItems, getProducts, updateJob, updateItem (see jobStore.js).
// generateItem(productRow, options, { jobId }) generates and saves one description row.
export function createBatchRunner({ store, generateItem, concurrency, rateLimitPauseMs = RATE_LIMIT_PAUSE_MS }) {
  const active = new Map(); // job id -> promise of the running job

  async function processItem(job, product, productId) {
    if (!product) {
      await store.updateItem(job.id, productId, { status: 'failed', error: 'Product no longer exists' });
      return 'failed';
    }
    for (let attempt = 0; ; attempt++) {
      await store.updateItem(job.id, productId, { status: 'running', error: null });
      try {
        const description = await generateItem(product, job.options, { jobId: job.id });
        await store.updateItem(job.id, productId, { status: 'succeeded', error: null, description_id: description.id });
        return 'succeeded';
      } catch (error) {
        // One product's failure never stops the job. Rate limits get a pause and another go.
        if (error.status === 429 && attempt < RATE_LIMIT_RETRIES) {
          await store.updateItem(job.id, productId, { status: 'queued', error: `Rate limited, retrying: ${error.message}` });
          await sleep(rateLimitPauseMs);
          continue;
        }
        await store.updateItem(job.id, productId, { status: 'failed', error: error.message });
        return 'failed';
      }
    }
  }

  async function run(job) {
    try {
      const items = await store.getItems(job.id);
      const pending = items.filter((item) => item.status !== 'succeeded');
      const products = new Map((await store.getProducts(job.retailer_id, pending.map((item) => item.product_id))).map((row) => [row.id, row]));

      await store.updateJob(job.id, { status: 'running', started_at: new Date().toISOString(), finished_at: null });
      await mapPool(pending, concurrency, (item) => processItem(job, products.get(item.product_id), item.product_id));

      const final = await store.getItems(job.id);
      const succeeded = final.filter((item) => item.status === 'succeeded').length;
      const failed = final.length - succeeded;
      await store.updateJob(job.id, { status: finalStatus(succeeded, failed), total: final.length, succeeded, failed, finished_at: new Date().toISOString() });
    } catch (error) {
      console.error(`Batch job ${job.id} stopped:`, error);
      await store.updateJob(job.id, { status: 'failed', finished_at: new Date().toISOString() }).catch(() => {});
    } finally {
      active.delete(job.id);
    }
  }

  function launch(job) {
    const promise = run(job);
    active.set(job.id, promise);
    return promise;
  }

  return {
    isActive: (jobId) => active.has(jobId),
    // Resolves when the job has finished (for tests and scripts); undefined if it isn't running.
    whenDone: (jobId) => active.get(jobId),

    // Creates the job and its items, starts it in the background and returns the job row at once.
    async start(retailerId, productIds, options) {
      const job = await store.createJob(retailerId, [...new Set(productIds)], options);
      launch(job);
      return job;
    },

    // Reruns every item that hasn't succeeded, e.g. after a server restart or a quota reset.
    async resume(job) {
      if (active.has(job.id)) {
        throw Object.assign(new Error('This job is still running.'), { status: 409 });
      }
      await store.updateJob(job.id, { status: 'queued' });
      launch(job);
      return { ...job, status: 'queued' };
    },
  };
}

// --- Export ---

const list = (values) => (values ?? []).join(' | ');

// One flat row per job item, for the CSV and JSON downloads.
export function exportRows(items) {
  return items.map(({ product, description, status, error }) => ({
    sku: product?.sku ?? '',
    name: product?.name ?? '',
    category: product?.category ?? '',
    status,
    error: error ?? '',
    title: description?.title ?? '',
    short_description: description?.short_description ?? '',
    long_description: description?.long_description ?? '',
    bullet_points: list(description?.bullet_points),
    seo_keywords: list(description?.seo_keywords),
    meta_description: description?.meta_description ?? '',
    seo_checks: description?.quality?.seo ? `${description.quality.seo.passed}/${description.quality.seo.total}` : '',
    fact_flags: list(description?.quality?.facts?.unsupported?.map((item) => item.text)),
    style_issues: list(description?.quality?.style?.issues?.map((issue) => issue.type)),
    model: description?.model ?? '',
    version: description?.version ?? '',
  }));
}
