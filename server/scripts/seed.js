// Loads a product dataset into one retailer's catalog in Supabase, upserting on sku.
//   npm run db:seed                                        (data/generated/products.json; only works with one retailer)
//   npm run db:seed -- --retailer <retailer id>            (pick the retailer when there are several)
//   npm run db:seed -- --file path/to/products.json        (path relative to server/)
// The app's "Load 60 sample products" button does the same for the logged-in retailer.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { requireSupabase } from '../src/lib/supabase.js';
import { ProductInput } from '../src/schemas/product.js';
import { checkCompleteness } from '../src/services/quality.js';

const { values: args } = parseArgs({
  options: {
    retailer: { type: 'string' },
    file: { type: 'string', default: '../data/generated/products.json' },
  },
});
const supabase = requireSupabase();

const { data: retailers, error: retailerError } = await supabase.from('retailers').select('id, business_name');
if (retailerError) {
  console.error('Could not read retailers:', retailerError.message);
  process.exit(1);
}
const retailer = args.retailer ? retailers.find((r) => r.id === args.retailer) : retailers.length === 1 ? retailers[0] : null;
if (!retailer) {
  console.error(retailers.length
    ? `Choose a retailer with --retailer <id>:\n${retailers.map((r) => `  ${r.id}  ${r.business_name}`).join('\n')}`
    : 'No retailers yet. Sign up in the app and finish onboarding first.');
  process.exit(1);
}

const file = resolve(args.file);
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
    retailer_id: retailer.id,
    source: 'synthetic',
    completeness_score: checkCompleteness(parsed.data).score,
  });
});

const { error, count } = await supabase
  .from('products')
  .upsert(rows, { onConflict: 'retailer_id,sku', count: 'exact' });

if (error) {
  console.error('Seed failed:', error.message);
  process.exit(1);
}
console.log(`Upserted ${count ?? rows.length} products from ${file} into "${retailer.business_name}"`);
