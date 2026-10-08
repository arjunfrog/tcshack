import { readFileSync } from 'node:fs';
import { Router } from 'express';
import { z } from 'zod';
import { dbError, requireSupabase } from '../lib/supabase.js';
import { requireRetailer, requireUser } from '../middleware/auth.js';
import { parseProductsCsv } from '../lib/csv.js';
import { GenerationOptions, ProductInput } from '../schemas/product.js';
import { checkCompleteness } from '../services/quality.js';
import { generateForProduct } from '../services/generator.js';

export const productsRouter = Router();
// Every route works on the logged-in retailer's own catalog.
productsRouter.use(requireUser, requireRetailer);

const SAMPLE_FILE = new URL('../../../data/generated/products.json', import.meta.url);

// Returns a Supabase response's data, or throws it as an API error.
function check({ data, error }) {
  if (error) throw dbError(error);
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

// POST /api/products/import-sample  -> loads synthetic products from data/generated in the retailer's categories
productsRouter.post('/import-sample', async (req, res) => {
  const all = JSON.parse(readFileSync(SAMPLE_FILE, 'utf8'));
  // Only the categories this retailer sells, so the demo catalog matches their business.
  const wanted = new Set(req.retailer.categories.map((category) => category.toLowerCase()));
  const matching = all.filter((record) => wanted.has(record.category.toLowerCase()));
  const records = matching.length ? matching : all;

  const result = await saveProducts(req.retailer.id, records, 'synthetic');
  res.json({ ...result, scope: matching.length ? 'your categories' : 'all categories (none matched yours)' });
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

// Generates copy for a stored product and saves it as the product's next version.
async function generateAndSave(row, options) {
  const supabase = requireSupabase();
  const { output, meta, quality } = await generateForProduct(toProductInput(row), options);

  const latest = check(
    await supabase.from('descriptions').select('version').eq('product_id', row.id).order('version', { ascending: false }).limit(1),
  );
  return check(
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
}

// POST /api/products/:id/generate  { options? }  -> saved description row
productsRouter.post('/:id/generate', async (req, res) => {
  const { options } = GenerateRequest.parse(req.body ?? {});
  const row = check(
    await requireSupabase().from('products').select('*').eq('id', req.params.id).eq('retailer_id', req.retailer.id).maybeSingle(),
  );
  if (!row) return res.status(404).json({ error: 'Product not found' });

  res.status(201).json({ description: await generateAndSave(row, options) });
});

const QuickRequest = z.object({ product: ProductInput, options: GenerationOptions.prefault({}) });

// POST /api/products/quick  { product, options? }  -> { product, description }
// The Quick generate form: saves the product to the catalog (reusing it when the same
// SKU, or the same name and category, was entered before) and its new description.
productsRouter.post('/quick', async (req, res) => {
  const { product, options } = QuickRequest.parse(req.body);
  const supabase = requireSupabase();

  let existing = supabase.from('products').select('*').eq('retailer_id', req.retailer.id).limit(1);
  existing = product.sku
    ? existing.eq('sku', product.sku)
    : existing.is('sku', null).ilike('name', product.name).ilike('category', product.category);
  const [match] = check(await existing);

  const fields = { ...product, retailer_id: req.retailer.id, source: 'manual', completeness_score: checkCompleteness(product).score };
  const row = match
    ? check(await supabase.from('products').update(fields).eq('id', match.id).select().single())
    : check(await supabase.from('products').insert(fields).select().single());

  res.status(201).json({ product: row, description: await generateAndSave(row, options) });
});
