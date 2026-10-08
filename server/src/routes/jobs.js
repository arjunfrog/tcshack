import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config/env.js';
import { toCsv } from '../lib/csv.js';
import { requireRetailer, requireUser } from '../middleware/auth.js';
import { GenerationOptions } from '../schemas/product.js';
import { MAX_JOB_PRODUCTS, createBatchRunner, exportRows } from '../services/batch.js';
import { brandProfile } from '../services/brand.js';
import { generateAndSave } from '../services/descriptions.js';
import { jobStore } from '../services/jobStore.js';
import { checkConsistency } from '../services/quality.js';

export const jobsRouter = Router();
jobsRouter.use(requireUser, requireRetailer);

export const batchRunner = createBatchRunner({ store: jobStore, generateItem: generateAndSave, concurrency: config.llm.concurrency });

const StartRequest = z.object({
  // Which products: explicit ids, or everything (optionally one category, optionally only
  // products with no description yet).
  product_ids: z.array(z.uuid()).max(MAX_JOB_PRODUCTS).optional(),
  category: z.string().trim().min(1).optional(),
  missing_only: z.boolean().default(false),
  options: GenerationOptions.prefault({}),
});

async function findJob(req) {
  const job = await jobStore.getJob(req.retailer.id, req.params.id);
  if (!job) throw Object.assign(new Error('Job not found'), { status: 404 });
  return job;
}

// POST /api/jobs  { product_ids? | category?, missing_only?, options? }  -> 202 { job }
// Responds at once; the job runs in the background. Poll GET /api/jobs/:id for progress.
jobsRouter.post('/', async (req, res) => {
  const { product_ids: productIds, category, missing_only: missingOnly, options } = StartRequest.parse(req.body ?? {});
  const ids = await jobStore.selectProductIds(req.retailer.id, { productIds, category, missingOnly });
  if (!ids.length) return res.status(400).json({ error: 'No products match that selection.' });
  if (ids.length > MAX_JOB_PRODUCTS) {
    return res.status(400).json({ error: `A job can cover at most ${MAX_JOB_PRODUCTS} products; narrow the selection.` });
  }
  // The brand profile is stored with the job, so a resumed job writes in the same voice.
  res.status(202).json({ job: await batchRunner.start(req.retailer.id, ids, { ...options, brand: brandProfile(req.retailer) }) });
});

// GET /api/jobs  -> { jobs }  (newest first)
jobsRouter.get('/', async (req, res) => {
  const jobs = await jobStore.listJobs(req.retailer.id);
  res.json({ jobs: jobs.map((job) => ({ ...job, active: batchRunner.isActive(job.id) })) });
});

// GET /api/jobs/:id  -> { job, progress, items }
// `active: false` on a queued or running job means it was interrupted (e.g. a server
// restart); POST /api/jobs/:id/resume picks it up again.
jobsRouter.get('/:id', async (req, res) => {
  const job = await findJob(req);
  const items = await jobStore.getItems(job.id, { withDetails: true });
  const count = (status) => items.filter((item) => item.status === status).length;
  const generated = items.filter((item) => item.description);
  res.json({
    job: { ...job, active: batchRunner.isActive(job.id) },
    progress: { total: items.length, succeeded: count('succeeded'), failed: count('failed'), running: count('running'), queued: count('queued') },
    // Across the batch: duplicate titles, repeated openings, unusual lengths (ids are SKUs).
    consistency: checkConsistency(generated.map(({ product, description }) => ({
      id: product?.sku ?? product?.id,
      title: description.title,
      long_description: description.long_description,
      sparse: description.quality?.input?.sparse,
    }))),
    items: items
      .sort((a, b) => String(a.product?.sku ?? '').localeCompare(String(b.product?.sku ?? '')))
      .map(({ description, ...item }) => ({
        ...item,
        // A short summary; the export has the full copy.
        description: description && { id: description.id, version: description.version, title: description.title, quality: description.quality },
      })),
  });
});

// POST /api/jobs/:id/resume  -> 202 { job }  reruns every product that hasn't succeeded
jobsRouter.post('/:id/resume', async (req, res) => {
  const job = await findJob(req);
  res.status(202).json({ job: await batchRunner.resume(job) });
});

const EXPORT_COLUMNS = [
  'sku', 'name', 'category', 'status', 'error', 'title', 'short_description', 'long_description',
  'bullet_points', 'seo_keywords', 'meta_description', 'seo_checks', 'fact_flags', 'style_issues', 'model', 'version',
];

// GET /api/jobs/:id/export?format=csv|json  -> file download of the job's results
jobsRouter.get('/:id/export', async (req, res) => {
  const format = req.query.format === 'json' ? 'json' : 'csv';
  const job = await findJob(req);
  const rows = exportRows(await jobStore.getItems(job.id, { withDetails: true })).sort((a, b) => a.sku.localeCompare(b.sku));

  res.attachment(`descriptions-${job.id.slice(0, 8)}.${format}`);
  if (format === 'json') return res.json(rows);
  res.type('text/csv').send(toCsv(rows, EXPORT_COLUMNS));
});
