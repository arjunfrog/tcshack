# Data format

The generator takes **structured product attributes** in JSON or CSV. The same shape is used by the web form, file imports, the synthetic data script and the `products` table in Supabase. The Zod schema in `server/src/schemas/product.js` (`ProductInput`) defines it.

## Product fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `sku` | string | no (needed for import/upsert) | Unique product code, e.g. `SKU-0001` |
| `name` | string | **yes** | Product name without the brand |
| `category` | string | **yes** | Top-level category, e.g. `Electronics` |
| `subcategory` | string | no | e.g. `Wireless Earbuds` |
| `brand` | string | no | |
| `price` | number | no | Must be 0 or more |
| `currency` | string | no | Defaults to `INR` |
| `features` | string[] | no | Short feature statements. 3 or more gives much better copy |
| `specifications` | object | no | `{ "Battery life": "32 hours", "Bluetooth": "5.3" }` |
| `attributes` | object | no | Anything else: colors, sizes, materials, gender, occasion, diet... |
| `image_url` | string | no | Image URL or placeholder |
| `seed_keywords` | string[] | no | Keywords the copy should target for SEO |

### JSON example

```json
{
  "sku": "SKU-0042",
  "name": "Pulse Buds",
  "category": "Electronics",
  "subcategory": "Wireless Earbuds",
  "brand": "Voltix",
  "price": 2999,
  "currency": "INR",
  "features": ["Active noise cancellation", "IPX5 sweat resistance", "Dual-device pairing"],
  "specifications": { "Battery life": "32 hours with case", "Bluetooth": "5.3" },
  "attributes": { "colors": ["Midnight Black", "Pearl White"] },
  "image_url": "https://placehold.co/600x600?text=Wireless%20Earbuds",
  "seed_keywords": ["wireless earbuds", "noise cancelling earbuds"]
}
```

A JSON file is an array of these objects.

### CSV conventions

One product per row, with the same column names as the JSON fields. Nested values are flattened like this:

- **Lists** (`features`, `seed_keywords`) are joined with ` | `
- **Key/value maps** (`specifications`, `attributes`) are written as `key: value | key: value`. List values inside a map are comma-separated.

```csv
sku,name,category,subcategory,brand,price,currency,features,specifications,attributes,image_url,seed_keywords
SKU-0042,Pulse Buds,Electronics,Wireless Earbuds,Voltix,2999,INR,Active noise cancellation | IPX5 sweat resistance,Battery life: 32 hours with case | Bluetooth: 5.3,"colors: Midnight Black, Pearl White",https://placehold.co/600x600,wireless earbuds | noise cancelling earbuds
```

## Importing

In the app, use **Import CSV / JSON** on the Catalog tab. The API behind it:

```
POST /api/products/import   { "format": "csv" | "json", "data": "<file contents>" }
→ { "imported": 58, "errors": [{ "row": 7, "issues": ["name: name is required"] }] }
```

Rows with a `sku` update the existing product with that SKU; rows without one are added as new products. Invalid rows are skipped and reported, the rest are saved.

## Exporting

A batch job's results download from the Batch tab, or from `GET /api/jobs/:id/export?format=csv|json`. One row per product, with these columns:

`sku, name, category, status, error, title, short_description, long_description, bullet_points, seo_keywords, meta_description, seo_checks, fact_flags, style_issues, model, version`

Lists (`bullet_points`, `seo_keywords`, `fact_flags`, `style_issues`) are joined with ` | `, as in the import format; `seo_checks` reads like `6/6`.

## Generated output

Every generation returns this shape (`GeneratedDescription` in the same schema file):

| Field | Rule (enforced by the prompt, checked by `checkSeo`) |
|---|---|
| `title` | 70 characters or fewer, brand and product type first |
| `short_description` | 1–2 sentences |
| `long_description` | Paragraphs separated by a blank line; length follows the `short` / `medium` / `long` option, or 40–70 words for sparse products |
| `bullet_points` | 3–6 benefit-led bullets |
| `seo_keywords` | 5–8 keywords, most important first |
| `meta_description` | 155 characters or fewer, includes the primary keyword |

## Quality report

Every generation also returns `quality`, built by the rule-based checks in `server/src/services/quality.js`:

```json
{
  "input": { "score": 40, "sparse": true, "issues": ["No brand", "Fewer than 3 features", "Fewer than 2 specifications"] },
  "seo": {
    "title_length_ok": true, "meta_length_ok": true, "primary_keyword_in_title": true,
    "primary_keyword_in_meta": true, "bullet_count_ok": true,
    "keyword_coverage": 80, "passed": 5, "total": 5
  },
  "facts": {
    "passed": false,
    "checked": 7,
    "unsupported": [
      { "text": "spf 50", "issue": "Unit differs from the product data (50 g)", "fields": ["title", "meta_description"] },
      { "text": "organic", "issue": "Claim not supported by the product data", "fields": ["long_description"] }
    ]
  },
  "style": {
    "passed": false,
    "issues": [
      { "type": "stock_opener", "text": "For those who want a wholesome start to the day" },
      { "type": "keyword_stuffing", "text": "\"green tea\" 6 times" }
    ]
  }
}
```

### Input completeness (`input`)

`checkCompleteness` scores each product from 0 to 100 and lists what is missing (brand, price, fewer than 3 features, fewer than 2 specifications, and so on). A score below 50 sets `sparse: true`. For sparse products the prompt asks for shorter copy (a 40-70 word description and 3 bullets) instead of padding. Call `POST /api/generate/check` with `{ product }` to get this report before generating, so the UI can warn the user first.

### SEO checks (`seo`)

Title of 70 characters or fewer, meta description of 155 or fewer, the primary keyword (the first SEO keyword) in both, and 3 to 6 bullets. `keyword_coverage` is the share of SEO keywords that appear in the copy.

### Fact check (`facts`)

Invented specs are the most damaging failure in retail copy, so `checkFacts` traces the copy back to the product data. It looks at the title, short and long descriptions, bullets and meta description, and flags:

- **Numbers** that don't appear anywhere in the data (`40 hours` when the data says 32).
- **Units** that differ from the data for that number (`SPF 50` when the only 50 in the data is `50 g`). A number written bare in the data (`hot for 12`) may take any unit in the copy.
- **Codes and model numbers** not in the data (`IPX7` when the data says `IPX5`).
- **Claim words** the data doesn't support: organic, certified, clinically proven, dermatologist, hypoallergenic, waterproof, vegan, gluten-free, BPA-free, warranty, guarantee, bestseller, eco-friendly, handmade and similar.

Seed keywords are search terms, not facts, so they don't count as evidence. Number words in the data count as digits (`two pillow covers` supports `2 pillow covers`, `dual-device` supports `2 devices`). Thousands separators are ignored (`₹2,999` matches a price of 2999). It is a rule-based screen, so treat a flag as "check this", not proof of an error, and it can't catch invented facts that contain no figures or claim words.

### Style check (`style`)

`checkStyle` flags the tells that make copy read as machine-written rather than written by someone who knows the product. Issue types:

- `meta_reference`: the copy narrates its source ("as noted in the product features").
- `stock_opener`: the long description opens with a formula ("For those who", "If you", "Designed for", "Discover").
- `cliche`: filler and hype ("elevate", "seamless", "perfect for", "whether you're").
- `keyword_stuffing`: an SEO keyword used more than twice (four times for the primary keyword, which is required in several places).
- `exclamation`: exclamation marks outside the playful tone (one is allowed there).
- `title_repeat` and `title_case`: a word repeated in the title, or a title not in Title Case.

## Synthetic data

```bash
npm run data:generate                      # 60 products, seed 42 -> data/generated/
node scripts/generate-synthetic.js --count 200 --seed 7 --out data/generated
```

The script covers 7 categories and 17 product types with fictional brands, and is reproducible for a given seed. About 10% of records are deliberately incomplete so the quality checks have something to flag. Load the output into Supabase with `npm run db:seed`.

## Eval set

`data/eval/products.json` uses the product format above, plus an `eval_notes` field telling raters what to check for that product. The eval script (`npm run eval`, see the README) ignores the notes when generating and prints them in the report.
