import { readFileSync } from 'node:fs';
import { Router } from 'express';
import { z } from 'zod';
import { dbError, requireSupabase } from '../lib/supabase.js';
import { requireRetailer, requireUser } from '../middleware/auth.js';
import { parseProductsCsv } from '../lib/csv.js';
import { GenerationOptions, ProductInput, parseProductUpdate } from '../schemas/product.js';
import { checkCompleteness } from '../services/quality.js';
import { brandProfile } from '../services/brand.js';
import { generateAndSave, toProductInput } from '../services/descriptions.js';
import { respond } from '../lib/progressStream.js';
import { isPexelsUrl } from '../lib/photos.js';
import { autoPhotos } from '../services/photos.js';
import { config } from '../config/env.js';

export const productsRouter = Router();
// Every route works on the logged-in retailer's own catalog.
productsRouter.use(requireUser, requireRetailer);

const SAMPLE_FILE = new URL('../../../data/generated/products.json', import.meta.url);
const DEMO_FILE = new URL('../../../data/catalog/products.json', import.meta.url);

// Returns a Supabase response's data, or throws it as an API error.
function check({ data, error }) {
  if (error) throw dbError(error);
  return data;
}

const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(500),
  offset: z.coerce.number().int().min(0).default(0),
});

// GET /api/products?category=&search=&limit=&offset=  -> { products, total }
// Products come with their latest description; `total` counts every match, for paging.
productsRouter.get('/', async (req, res) => {
  const { limit, offset } = ListQuery.parse(req.query);
  let query = requireSupabase()
    .from('products')
    .select('*, descriptions(id, version, title, status, created_at)', { count: 'exact' })
    .eq('retailer_id', req.retailer.id)
    .order('sku', { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1);
  if (req.query.category) query = query.eq('category', req.query.category);
  // Commas and parentheses would break PostgREST's or() syntax, so strip them.
  const search = String(req.query.search ?? '').replace(/[,()]/g, ' ').trim();
  if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);

  const { data, error, count } = await query;
  const products = check({ data, error }).map(({ descriptions, ...product }) => ({
    ...product,
    latest_description: descriptions.sort((a, b) => b.version - a.version)[0] ?? null,
    description_count: descriptions.length,
  }));
  res.json({ products, total: count ?? products.length });
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

// PATCH /api/products/:id  { ...fields }  -> { product }
// Edits a product; the completeness score is recomputed from the result.
productsRouter.patch('/:id', async (req, res) => {
  const changes = parseProductUpdate(req.body);
  const supabase = requireSupabase();
  const row = check(
    await supabase.from('products').select('*').eq('id', req.params.id).eq('retailer_id', req.retailer.id).maybeSingle(),
  );
  if (!row) return res.status(404).json({ error: 'Product not found' });

  const updated = toProductInput({ ...row, ...changes });
  const product = check(
    await supabase
      .from('products')
      .update({ ...changes, completeness_score: checkCompleteness(updated).score })
      .eq('id', row.id)
      .select()
      .single(),
  );
  res.json({ product });
});

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const ImageRequest = z.union([
  // An uploaded photo, as a data URL (the app resizes it to about 1200 px first).
  z.object({ upload: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/, 'Upload a JPEG, PNG or WebP image') }),
  // A free stock photo picked from /api/photos.
  z.object({ photo: z.object({ url: z.string().url(), credit: z.string().max(120), credit_url: z.string().url().optional() }) }),
]);

async function ownedProduct(req) {
  return check(
    await requireSupabase().from('products').select('*').eq('id', req.params.id).eq('retailer_id', req.retailer.id).maybeSingle(),
  );
}

// POST /api/products/:id/image  { upload } | { photo }  -> { product }
// Uploads go to the public Supabase Storage bucket; picked photos keep their Pexels URL and credit.
productsRouter.post('/:id/image', async (req, res) => {
  const body = ImageRequest.parse(req.body);
  const row = await ownedProduct(req);
  if (!row) return res.status(404).json({ error: 'Product not found' });
  const supabase = requireSupabase();

  let fields;
  if (body.upload) {
    const [, mime, base64] = body.upload.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > MAX_IMAGE_BYTES) return res.status(413).json({ error: 'That image is over 5 MB. Choose a smaller one.' });
    const path = `${req.retailer.id}/${row.id}-${Date.now()}.${IMAGE_TYPES[mime]}`;
    const bucket = supabase.storage.from(config.photos.bucket);
    const { error } = await bucket.upload(path, buffer, { contentType: mime, upsert: true });
    if (error) {
      const missing = /bucket not found/i.test(error.message);
      return res.status(missing ? 503 : 502).json({
        error: missing ? 'The product-images storage bucket is missing. Run supabase/setup.sql again.' : `Upload failed: ${error.message}`,
      });
    }
    fields = { image_url: bucket.getPublicUrl(path).data.publicUrl, image_credit: null, image_credit_url: null };
  } else {
    if (!isPexelsUrl(body.photo.url)) return res.status(400).json({ error: 'Only photos from the photo search can be picked.' });
    fields = { image_url: body.photo.url, image_credit: body.photo.credit, image_credit_url: body.photo.credit_url ?? null };
  }

  const product = check(await supabase.from('products').update(fields).eq('id', row.id).select().single());
  res.json({ product });
});

// DELETE /api/products/:id/image  -> { product }  (the category tile shows again)
productsRouter.delete('/:id/image', async (req, res) => {
  const row = await ownedProduct(req);
  if (!row) return res.status(404).json({ error: 'Product not found' });
  const product = check(
    await requireSupabase().from('products').update({ image_url: null, image_credit: null, image_credit_url: null }).eq('id', row.id).select().single(),
  );
  res.json({ product });
});

// POST /api/products/auto-photos  -> { updated, types, configured }
// Gives every product without a real photo a free stock photo for its product type.
productsRouter.post('/auto-photos', async (req, res) => {
  res.json(await autoPhotos(req.retailer.id));
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
  // { set: 'demo' } loads the 240-product demo catalog (every category), to show scale.
  if (req.body?.set === 'demo') {
    const records = JSON.parse(readFileSync(DEMO_FILE, 'utf8'));
    const result = await saveProducts(req.retailer.id, records, 'synthetic');
    return res.json({ ...result, scope: 'the 240-product demo catalog' });
  }
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

// POST /api/products/:id/generate[?stream=1]  { options? }  -> { description }
// With ?stream=1 the steps arrive live as NDJSON (see lib/progressStream.js).
productsRouter.post('/:id/generate', async (req, res) => {
  const { options } = GenerateRequest.parse(req.body ?? {});
  const row = check(
    await requireSupabase().from('products').select('*').eq('id', req.params.id).eq('retailer_id', req.retailer.id).maybeSingle(),
  );
  if (!row) return res.status(404).json({ error: 'Product not found' });

  await respond(req, res, 201, async (onProgress) => ({
    description: await generateAndSave(row, { ...options, brand: brandProfile(req.retailer) }, { onProgress }),
  }));
});

const QuickRequest = z.object({ product: ProductInput, options: GenerationOptions.prefault({}) });

// POST /api/products/quick[?stream=1]  { product, options? }  -> { product, description }
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

  await respond(req, res, 201, async (onProgress) => ({
    product: row,
    description: await generateAndSave(row, { ...options, brand: brandProfile(req.retailer) }, { onProgress }),
  }));
});
