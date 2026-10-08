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

## Generated output

Every generation returns this shape (`GeneratedDescription` in the same schema file):

| Field | Rule (enforced by the prompt, checked by `checkSeo`) |
|---|---|
| `title` | 70 characters or fewer, brand and product type first |
| `short_description` | 1–2 sentences |
| `long_description` | 2–4 paragraphs; length follows the `short` / `medium` / `long` option |
| `bullet_points` | 3–6 benefit-led bullets |
| `seo_keywords` | 5–8 keywords, most important first |
| `meta_description` | 155 characters or fewer, includes the primary keyword |

## Data quality checks

`checkCompleteness` in `server/src/services/quality.js` scores each product from 0 to 100 and lists what is missing (brand, price, fewer than 3 features, fewer than 2 specifications, and so on). Low scores are shown before generation, so users know the copy will be thin.

## Synthetic data

```bash
npm run data:generate                      # 60 products, seed 42 -> data/generated/
node scripts/generate-synthetic.js --count 200 --seed 7 --out data/generated
```

The script covers 7 categories and 17 product types with fictional brands, and is reproducible for a given seed. About 10% of records are deliberately incomplete so the quality checks have something to flag. Load the output into Supabase with `npm run db:seed`.
