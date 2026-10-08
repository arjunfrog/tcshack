import { readFileSync } from 'node:fs';
import { Router } from 'express';
import { z } from 'zod';
import { requireSupabase } from '../lib/supabase.js';
import { requireRetailer, requireUser } from '../middleware/auth.js';
import { parseProductsCsv } from '../lib/csv.js';
import { GenerationOptions, ProductInput } from '../schemas/product.js';
import { checkCompleteness } from '../services/quality.js';
import { generateForProduct } from '../services/generator.js';
import { persistGenerationEvidence, getGenerationEvidence } from '../services/explainability.js';
import { getProductEvidence } from '../services/evidence.js';
import { getReviewThemes } from '../services/reviewIntelligence.js';
import { recordFeedbackAndLearn, detectEditDivergence } from '../services/feedbackLearning.js';
import { demoStore } from '../lib/demoStore.js';

export const productsRouter = Router();
// Every route works on the logged-in retailer's own catalog.
productsRouter.use(requireUser, requireRetailer);

const SAMPLE_FILE = new URL('../../../data/generated/products.json', import.meta.url);

// Throws a 4xx/5xx-shaped error from a Supabase response.
function check({ data, error }, status = 500) {
  if (error) {
    const err = new Error(`Database error: ${error.message}`);
    err.status = status;
    throw err;
  }
  return data;
}

// Product columns as stored, minus bookkeeping, so rows can go straight back into ProductInput.
const toProductInput = (row) =>
  ProductInput.parse({
    ...row,
    price: row.price ?? undefined,
    sku: row.sku ?? undefined,
    subcategory: row.subcategory ?? undefined,
    brand: row.brand ?? undefined,
    image_url: row.image_url ?? undefined,
  });

// GET /api/products?category=&search=  -> products with their latest description
productsRouter.get('/', async (req, res) => {
  if (req.user?.id === 'demo-user-123') {
    return res.json({
      products: demoStore.listProducts({
        category: req.query.category,
        search: req.query.search,
      }),
    });
  }

  let query = requireSupabase()
    .from('products')
    .select('*, descriptions(id, version, title, status, created_at)')
    .eq('retailer_id', req.retailer.id)
    .order('sku', { ascending: true, nullsFirst: false })
    .limit(500);
  if (req.query.category) query = query.eq('category', req.query.category);
  // Commas and parentheses would break PostgREST's or() syntax, so strip them.
  const search = String(req.query.search ?? '').replace(/[,()]/g, ' ').trim();
  if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);

  const products = check(await query).map(({ descriptions, ...product }) => ({
    ...product,
    latest_description: descriptions.sort((a, b) => b.version - a.version)[0] ?? null,
    description_count: descriptions.length,
  }));
  res.json({ products });
});

// GET /api/products/:id  -> product and all description versions, newest first
productsRouter.get('/:id', async (req, res) => {
  if (req.user?.id === 'demo-user-123') {
    const found = demoStore.getProduct(req.params.id);
    if (!found) return res.status(404).json({ error: 'Product not found' });
    return res.json(found);
  }

  const supabase = requireSupabase();
  const product = check(
    await supabase.from('products').select('*').eq('id', req.params.id).eq('retailer_id', req.retailer.id).maybeSingle(),
  );
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const descriptions = check(
    await supabase.from('descriptions').select('*').eq('product_id', req.params.id).order('version', { ascending: false }),
  );
  res.json({ product, descriptions });
});

const ImportRequest = z.object({
  format: z.enum(['csv', 'json']),
  data: z.string().min(1, 'file is empty'),
});

// POST /api/products/import  { format, data }  -> { imported, errors: [{ row, issues }] }
productsRouter.post('/import', async (req, res) => {
  const { format, data } = ImportRequest.parse(req.body);
  let records;
  try {
    records = format === 'csv' ? parseProductsCsv(data) : JSON.parse(data);
  } catch (err) {
    return res.status(400).json({ error: `Could not read ${format.toUpperCase()}: ${err.message}` });
  }
  if (!Array.isArray(records)) return res.status(400).json({ error: 'JSON must be an array of products' });

  res.json(await saveProducts(req.retailer.id, records, format));
});

// POST /api/products/import-sample  -> loads the 60 synthetic products from data/generated
productsRouter.post('/import-sample', async (req, res) => {
  if (req.user?.id === 'demo-user-123') {
    demoStore.loadSampleProducts();
    return res.json({ imported: demoStore.products.length, errors: [] });
  }

  const records = JSON.parse(readFileSync(SAMPLE_FILE, 'utf8'));
  res.json(await saveProducts(req.retailer.id, records, 'synthetic'));
});

async function saveProducts(retailerId, records, source) {
  const rows = [];
  const errors = [];
  records.forEach((record, i) => {
    const parsed = ProductInput.safeParse(record);
    if (!parsed.success) {
      errors.push({ row: i + 1, issues: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'row'}: ${issue.message}`) });
      return;
    }
    rows.push({ ...parsed.data, retailer_id: retailerId, source, completeness_score: checkCompleteness(parsed.data).score });
  });

  // Rows with a SKU update this retailer's product with that SKU; rows without one are always new.
  const supabase = requireSupabase();
  const withSku = rows.filter((row) => row.sku);
  const withoutSku = rows.filter((row) => !row.sku);
  if (withSku.length) check(await supabase.from('products').upsert(withSku, { onConflict: 'retailer_id,sku' }));
  if (withoutSku.length) check(await supabase.from('products').insert(withoutSku));

  return { imported: rows.length, errors };
}
const GenerateRequest = z.object({ options: GenerationOptions.prefault({}) });

// GET /api/products/:id/intelligence -> aggregated intelligence, evidence, and review themes
productsRouter.get('/:id/intelligence', async (req, res) => {
  if (req.user?.id === 'demo-user-123') {
    const found = demoStore.getProduct(req.params.id);
    if (!found) return res.status(404).json({ error: 'Product not found' });
    const evidence = await getProductEvidence(req.params.id);
    const reviewThemes = await getReviewThemes(req.params.id);
    return res.json({
      product_id: req.params.id,
      intelligence: null,
      evidence,
      review_themes: reviewThemes,
    });
  }

  const supabase = requireSupabase();
  const product = check(
    await supabase.from('products').select('*').eq('id', req.params.id).eq('retailer_id', req.retailer.id).maybeSingle(),
  );
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const { data: intelligence } = await supabase
    .from('product_intelligence')
    .select('*')
    .eq('product_id', req.params.id)
    .maybeSingle();

  const evidence = await getProductEvidence(req.params.id);
  const reviewThemes = await getReviewThemes(req.params.id);

  res.json({
    product_id: req.params.id,
    intelligence,
    evidence,
    review_themes: reviewThemes,
  });
});

// POST /api/products/:id/generate  { options? }  -> saved description row
productsRouter.post('/:id/generate', async (req, res) => {
  const { options } = GenerateRequest.parse(req.body ?? {});

  if (req.user?.id === 'demo-user-123') {
    const found = demoStore.getProduct(req.params.id);
    if (!found) return res.status(404).json({ error: 'Product not found' });

    const generated = await generateForProduct(toProductInput(found.product), {
      ...options,
      retailer_id: req.retailer.id,
    });
    const { output, meta, quality, intelligence, evidence } = generated;

    const description = demoStore.addDescription(
      found.product.id,
      {
        tone: options.tone,
        length: options.length,
        ...output,
        quality,
        provider: meta.provider,
        model: meta.model,
        input_tokens: meta.input_tokens,
        output_tokens: meta.output_tokens,
        latency_ms: meta.latency_ms,
      },
      evidence?.traced_claims,
    );

    return res.status(201).json({ description, intelligence, evidence });
  }

  const supabase = requireSupabase();

  const row = check(
    await supabase.from('products').select('*').eq('id', req.params.id).eq('retailer_id', req.retailer.id).maybeSingle(),
  );
  if (!row) return res.status(404).json({ error: 'Product not found' });

  const generated = await generateForProduct(toProductInput(row), {
    ...options,
    retailer_id: req.retailer.id,
  });
  const { output, meta, quality, intelligence, evidence } = generated;

  const latest = check(
    await supabase.from('descriptions').select('version').eq('product_id', row.id).order('version', { ascending: false }).limit(1),
  );
  const description = check(
    await supabase
      .from('descriptions')
      .insert({
        product_id: row.id,
        version: (latest[0]?.version ?? 0) + 1,
        tone: options.tone,
        length: options.length,
        ...output,
        quality,
        provider: meta.provider,
        model: meta.model,
        input_tokens: meta.input_tokens,
        output_tokens: meta.output_tokens,
        latency_ms: meta.latency_ms,
      })
      .select()
      .single(),
  );

  // Persist claim evidence if traced
  if (evidence?.traced_claims?.length && description?.id) {
    await persistGenerationEvidence(description.id, row.id, evidence.traced_claims);
  }

  res.status(201).json({ description, intelligence, evidence });
});

// GET /api/products/:id/descriptions/:descId/evidence -> claim-to-evidence links for this description
productsRouter.get('/:id/descriptions/:descId/evidence', async (req, res) => {
  if (req.user?.id === 'demo-user-123') {
    return res.json({ evidence_traces: demoStore.getEvidence(req.params.descId) });
  }

  const traces = await getGenerationEvidence(req.params.descId);
  res.json({ evidence_traces: traces });
});

const FeedbackRequest = z.object({
  relevance: z.number().int().min(1).max(5).optional(),
  creativity: z.number().int().min(1).max(5).optional(),
  comment: z.string().optional(),
  edited_output: z.any().optional(),
});

// POST /api/products/:id/descriptions/:descId/feedback -> saves rating and applies feedback learning
productsRouter.post('/:id/descriptions/:descId/feedback', async (req, res) => {
  const feedbackData = FeedbackRequest.parse(req.body ?? {});

  if (req.user?.id === 'demo-user-123') {
    demoStore.saveFeedback(req.params.descId, feedbackData);
    return res.json({ status: 'ok', detected_patterns: [] });
  }

  const supabase = requireSupabase();

  const desc = check(
    await supabase.from('descriptions').select('*').eq('id', req.params.descId).maybeSingle(),
  );
  if (!desc) return res.status(404).json({ error: 'Description not found' });

  let divergence = [];
  if (feedbackData.edited_output) {
    divergence = detectEditDivergence(desc, feedbackData.edited_output);
  }

  await recordFeedbackAndLearn(req.retailer.id, req.params.descId, feedbackData, divergence);
  res.json({ status: 'ok', detected_patterns: divergence });
});

// PATCH /api/products/:id/descriptions/:descId -> updates description (status, edited copy)
productsRouter.patch('/:id/descriptions/:descId', async (req, res) => {
  if (req.user?.id === 'demo-user-123') {
    const updated = demoStore.updateDescription(req.params.descId, req.body);
    if (!updated) return res.status(404).json({ error: 'Description not found' });
    return res.json({ description: updated });
  }

  const supabase = requireSupabase();
  const updated = check(
    await supabase
      .from('descriptions')
      .update(req.body)
      .eq('id', req.params.descId)
      .select()
      .single(),
  );
  res.json({ description: updated });
});

