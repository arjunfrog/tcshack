import { Router } from 'express';
import { z } from 'zod';
import { requireRetailer, requireUser } from '../middleware/auth.js';
import { GeneratedDescription } from '../schemas/product.js';
import { toProductInput } from '../services/descriptions.js';
import { cleanOutput, qualityReport } from '../services/generator.js';
import { changedPercent, computeMetrics, copyText, reviewQueue } from '../services/metrics.js';
import { reviewStore } from '../services/reviewStore.js';

// Phase 4: the review queue, approve/reject/edit, ratings and the metrics dashboard.
// Mounted at /api, so the login checks go on each route rather than router.use(): unknown
// /api paths must still fall through to the 404 handler.
export const reviewRouter = Router();
const signedIn = [requireUser, requireRetailer];

const notFound = () => Object.assign(new Error('Description not found'), { status: 404 });

// GET /api/review?limit=20  -> { items: [{ description, product }], remaining }
// The latest AI draft of each product that the logged-in reviewer hasn't rated yet.
reviewRouter.get('/review', signedIn, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const [descriptions, mine] = await Promise.all([
    reviewStore.listDescriptions(req.retailer.id, 'id, product_id, version, status, provider, created_at'),
    reviewStore.listFeedback(req.retailer.id, req.user.id),
  ]);
  const queue = reviewQueue(descriptions, new Set(mine.map((row) => row.description_id)));
  const order = new Map(queue.map((d, i) => [d.id, i]));
  const rows = await reviewStore.getDescriptionsWithProducts(queue.slice(0, limit).map((d) => d.id));
  res.json({
    items: rows.sort((a, b) => order.get(a.id) - order.get(b.id)).map(({ product, ...description }) => ({ description, product })),
    remaining: queue.length,
  });
});

const ReviewUpdate = z
  .object({
    status: z.enum(['draft', 'approved', 'rejected']).optional(),
    // Hand edits to any of the copy fields. Saved as a new version; the original stays as it was.
    edits: GeneratedDescription.partial().strict().optional(),
  })
  .refine((body) => body.status || (body.edits && Object.keys(body.edits).length), { message: 'Send a status, edits or both' });

// PATCH /api/descriptions/:id  { status?, edits? }  -> { description }
// Status only: approves or rejects this version. With edits: saves the edited copy as the
// product's next version (provider "human", edited_from this one) with the given status,
// re-runs the quality checks on it and records how much of the copy changed.
reviewRouter.patch('/descriptions/:id', signedIn, async (req, res) => {
  const { status, edits } = ReviewUpdate.parse(req.body ?? {});
  const original = await reviewStore.getDescription(req.retailer.id, req.params.id);
  if (!original) throw notFound();
  const reviewed = { reviewed_by: req.user.id, reviewed_at: new Date().toISOString() };

  if (!edits || !Object.keys(edits).length) {
    const description = await reviewStore.updateDescription(original.id, { status, ...reviewed });
    return res.json({ description });
  }

  const { product, ...before } = original;
  const output = cleanOutput(GeneratedDescription.parse({ ...pickCopy(before), ...edits }));
  const options = { tone: before.tone, length: before.length };
  const description = await reviewStore.insertDescription({
    product_id: before.product_id,
    job_id: before.job_id,
    version: (await reviewStore.latestVersion(before.product_id)) + 1,
    tone: before.tone,
    length: before.length,
    ...output,
    quality: { ...qualityReport(toProductInput(product), output, options), human_edit: { changed_pct: changedPercent(copyText(before), copyText(output)) } },
    provider: 'human',
    model: 'human edit',
    edited_from: before.id,
    status: status ?? 'draft',
    ...reviewed,
  });
  res.status(201).json({ description });
});

const COPY_FIELDS = ['title', 'short_description', 'long_description', 'bullet_points', 'seo_keywords', 'meta_description'];
const pickCopy = (row) => Object.fromEntries(COPY_FIELDS.map((field) => [field, row[field]]));

const Rating = z.object({
  relevance: z.number().int().min(1).max(5),
  creativity: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

// POST /api/descriptions/:id/feedback  { relevance, creativity, comment? }  -> { feedback }
// One rating per reviewer per description; rating again replaces the earlier one.
reviewRouter.post('/descriptions/:id/feedback', signedIn, async (req, res) => {
  const rating = Rating.parse(req.body ?? {});
  const description = await reviewStore.getDescription(req.retailer.id, req.params.id);
  if (!description) throw notFound();
  const feedback = await reviewStore.saveFeedback({
    description_id: description.id,
    reviewer_id: req.user.id,
    relevance: rating.relevance,
    creativity: rating.creativity,
    comment: rating.comment || null,
  });
  res.status(201).json({ feedback });
});

// GET /api/metrics  -> ratings (incl. the headline % rated 4+), quality checks, usage, review counts
reviewRouter.get('/metrics', signedIn, async (req, res) => {
  const [descriptions, feedback] = await Promise.all([
    reviewStore.listDescriptions(req.retailer.id, 'id, product_id, version, tone, status, provider, model, quality, input_tokens, output_tokens, latency_ms, edited_from'),
    reviewStore.listFeedback(req.retailer.id),
  ]);
  res.json(computeMetrics({ descriptions, feedback }));
});
