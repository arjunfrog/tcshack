import { readFileSync } from 'node:fs';
import { Router } from 'express';
import { z } from 'zod';
import { requireSupabase } from '../lib/supabase.js';
import { parseProductsCsv } from '../lib/csv.js';
import { GenerationOptions, ProductInput } from '../schemas/product.js';
import { checkCompleteness } from '../services/quality.js';
import { generateForProduct } from '../services/generator.js';

export const productsRouter = Router();

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
  let query = requireSupabase()
    .from('products')
    .select('*, descriptions(id, version, title, status, created_at)')
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
  const supabase = requireSupabase();
  const product = check(await supabase.from('products').select('*').eq('id', req.params.id).maybeSingle());
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

  res.json(await saveProducts(records, format));
});

// POST /api/products/import-sample  -> loads the 60 synthetic products from data/generated
productsRouter.post('/import-sample', async (req, res) => {
  const records = JSON.parse(readFileSync(SAMPLE_FILE, 'utf8'));
  res.json(await saveProducts(records, 'synthetic'));
});

async function saveProducts(records, source) {
  const rows = [];
  const errors = [];
  records.forEach((record, i) => {
    const parsed = ProductInput.safeParse(record);
    if (!parsed.success) {
      errors.push({ row: i + 1, issues: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'row'}: ${issue.message}`) });
      return;
    }
    rows.push({ ...parsed.data, source, completeness_score: checkCompleteness(parsed.data).score });
  });

  // Rows with a SKU update the existing product; rows without one are always new.
  const supabase = requireSupabase();
  const withSku = rows.filter((row) => row.sku);
  const withoutSku = rows.filter((row) => !row.sku);
  if (withSku.length) check(await supabase.from('products').upsert(withSku, { onConflict: 'sku' }));
  if (withoutSku.length) check(await supabase.from('products').insert(withoutSku));

  return { imported: rows.length, errors };
}

const GenerateRequest = z.object({ options: GenerationOptions.prefault({}) });

// POST /api/products/:id/generate  { options? }  -> saved description row
productsRouter.post('/:id/generate', async (req, res) => {
  const { options } = GenerateRequest.parse(req.body ?? {});
  const supabase = requireSupabase();

  const row = check(await supabase.from('products').select('*').eq('id', req.params.id).maybeSingle());
  if (!row) return res.status(404).json({ error: 'Product not found' });

  const { output, meta, quality } = await generateForProduct(toProductInput(row), options);

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
  res.status(201).json({ description });
});
