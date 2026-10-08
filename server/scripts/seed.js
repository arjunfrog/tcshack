// Loads a product dataset into Supabase, upserting on sku.
//   npm run db:seed                                  (uses data/generated/products.json)
//   npm run seed -w server -- path/to/products.json    (path relative to server/)

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { requireSupabase } from '../src/lib/supabase.js';
import { ProductInput } from '../src/schemas/product.js';
import { checkCompleteness } from '../src/services/quality.js';

const file = resolve(process.argv[2] ?? '../data/generated/products.json');
const raw = JSON.parse(readFileSync(file, 'utf8'));

const rows = [];
raw.forEach((record, i) => {
  const parsed = ProductInput.safeParse(record);
  if (!parsed.success) {
    console.warn(`Skipping record ${i}: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`);
    return;
  }
  rows.push({
    ...parsed.data,
    source: 'synthetic',
    completeness_score: checkCompleteness(parsed.data).score,
  });
});

const { error, count } = await requireSupabase()
  .from('products')
  .upsert(rows, { onConflict: 'sku', count: 'exact' });

if (error) {
  console.error('Seed failed:', error.message);
  process.exit(1);
}
console.log(`Upserted ${count ?? rows.length} products from ${file}`);
