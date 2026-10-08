import { dbError, requireSupabase } from '../lib/supabase.js';
import { ProductInput } from '../schemas/product.js';
import { generateForProduct } from './generator.js';
import { getMarketInsights } from './market.js';

// Returns a Supabase response's data, or throws it as an API error.
function check({ data, error }) {
  if (error) throw dbError(error);
  return data;
}

// Product columns as stored, minus bookkeeping, so rows can go straight back into ProductInput.
export const toProductInput = (row) =>
  ProductInput.parse({
    ...row,
    price: row.price ?? undefined,
    sku: row.sku ?? undefined,
    subcategory: row.subcategory ?? undefined,
    brand: row.brand ?? undefined,
    image_url: row.image_url ?? undefined,
  });

// Generates copy for a stored product and saves it as the product's next version.
// `jobId` links the description to a batch job. `onProgress(stage, status, detail)` receives
// each step as it happens (brand, market, write, checks, refine, save) for live progress.
export async function generateAndSave(row, options, { jobId = null, onProgress = () => {} } = {}) {
  const supabase = requireSupabase();
  const product = toProductInput(row);

  // Context for the prompt: when Anakin is set up, what's ranking for this product type
  // (cached per type, see services/market.js). The routes pass the retailer's brand profile in
  // options.brand; if a caller didn't, the retailer's row stands in for it.
  // Market research runs while the brand profile is loaded, so the progress shows brand first.
  const marketPromise = getMarketInsights(product, onProgress);
  const retailer = options.brand
    ? null
    : await supabase.from('retailers').select('*').eq('id', row.retailer_id).maybeSingle().then(({ data }) => data);
  onProgress('brand', 'done', {
    business_name: options.brand?.seller ?? retailer?.business_name ?? null,
    personality: options.brand?.personality ?? retailer?.brand_personality ?? [],
  });
  const market = await marketPromise;
  const { output, meta, quality } = await generateForProduct(product, options, {
    context: { brand: retailer, market },
    onProgress,
  });

  // Two generations for the same product can race for the next version number; the loser
  // of the unique (product_id, version) check simply takes the one after.
  for (let attempt = 1; ; attempt++) {
    const latest = check(
      await supabase.from('descriptions').select('version').eq('product_id', row.id).order('version', { ascending: false }).limit(1),
    );
    const { data, error } = await supabase
      .from('descriptions')
      .insert({
        product_id: row.id,
        job_id: jobId,
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
      .single();
    if (error?.code === '23505' && attempt < 3) continue;
    const saved = check({ data, error });
    onProgress('save', 'done', { version: saved.version });
    return saved;
  }
}
