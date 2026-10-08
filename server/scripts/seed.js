// Loads a product dataset into one retailer's catalog in Supabase.
//   npm run db:seed -- --email you@example.com --demo --photos
//       the 240-product demo catalog (data/catalog) into that account, plus a stock
//       photo per product type (needs PEXELS_API_KEY)
//   npm run db:seed -- --email you@example.com                (the 60-product sample)
//   npm run db:seed -- --retailer <retailer id> --file path/to/products.json  (path relative to server/)
// Products whose SKU the account already has are left as they are (and keep their
// descriptions); add --update to overwrite them with the file's data instead.
// The app's "Sample products" and "Demo catalog" buttons do the same for the logged-in account.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { requireSupabase } from '../src/lib/supabase.js';
import { ProductInput } from '../src/schemas/product.js';
import { checkCompleteness } from '../src/services/quality.js';
import { autoPhotos } from '../src/services/photos.js';

const { values: args } = parseArgs({
  options: {
    email: { type: 'string' },
    retailer: { type: 'string' },
    demo: { type: 'boolean', default: false },
    file: { type: 'string' },
    update: { type: 'boolean', default: false },
    photos: { type: 'boolean', default: false },
  },
});
const supabase = requireSupabase();
const fail = (message) => {
  console.error(message);
  process.exit(1);
};

// Which account: by login email, by retailer id, or the only retailer there is.
async function findRetailer() {
  if (args.email) {
    const email = args.email.trim().toLowerCase();
    for (let page = 1; page < 50; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (error) fail(`Could not list accounts: ${error.message}`);
      const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
      if (user) {
        const { data: retailer } = await supabase.from('retailers').select('id, business_name').eq('owner_id', user.id).maybeSingle();
        if (!retailer) fail(`${email} has an account but hasn't finished onboarding. Log in once and complete it first.`);
        return retailer;
      }
      if (data.users.length < 200) break;
    }
    fail(`No account with the email ${email}. Sign up in the app first.`);
  }
  const { data: retailers, error } = await supabase.from('retailers').select('id, business_name');
  if (error) fail(`Could not read retailers: ${error.message}`);
  const retailer = args.retailer ? retailers.find((r) => r.id === args.retailer) : retailers.length === 1 ? retailers[0] : null;
  if (!retailer) {
    fail(retailers.length
      ? `Choose an account with --email <login email> or --retailer <id>:\n${retailers.map((r) => `  ${r.id}  ${r.business_name}`).join('\n')}`
      : 'No retailers yet. Sign up in the app and finish onboarding first.');
  }
  return retailer;
}

const retailer = await findRetailer();
const file = resolve(args.file ?? (args.demo ? '../data/catalog/products.json' : '../data/generated/products.json'));
const raw = JSON.parse(readFileSync(file, 'utf8'));

const rows = [];
raw.forEach((record, i) => {
  const parsed = ProductInput.safeParse(record);
  if (!parsed.success) {
    console.warn(`Skipping record ${i}: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`);
    return;
  }
  rows.push({ ...parsed.data, retailer_id: retailer.id, source: 'synthetic', completeness_score: checkCompleteness(parsed.data).score });
});

const { count: before } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('retailer_id', retailer.id);

// In chunks, so a large catalog stays well inside request size limits.
for (let i = 0; i < rows.length; i += 100) {
  const { error } = await supabase
    .from('products')
    .upsert(rows.slice(i, i + 100), { onConflict: 'retailer_id,sku', ignoreDuplicates: !args.update });
  if (error) fail(`Seed failed: ${error.message}`);
}

const { count: after } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('retailer_id', retailer.id);
console.log(`"${retailer.business_name}": ${before ?? 0} products before, ${after ?? '?'} now (${(after ?? 0) - (before ?? 0)} added from ${file}).`);

if (args.photos) {
  const result = await autoPhotos(retailer.id, {
    onType: (type, products, photos) => console.log(`  photos: ${type.padEnd(24)} ${products} product(s), ${photos} photo(s) found`),
  });
  console.log(result.configured
    ? `Added stock photos to ${result.updated} product(s) across ${result.types} product type(s).`
    : 'Skipped photos: set PEXELS_API_KEY in server/.env (free at pexels.com/api) and run again with --photos.');
}
