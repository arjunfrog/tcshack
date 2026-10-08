import { dbError, requireSupabase } from '../lib/supabase.js';
import { ProductInput } from '../schemas/product.js';
import { generateForProduct } from './generator.js';

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
// `jobId` links the description to a batch job.
export async function generateAndSave(row, options, { jobId = null } = {}) {
  const supabase = requireSupabase();
  const { output, meta, quality } = await generateForProduct(toProductInput(row), options);

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
    return check({ data, error });
  }
}
