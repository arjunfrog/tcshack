# Product Copy Studio

A GenAI tool that turns structured product attributes (category, features, specifications, price) into engaging, consistent, SEO-friendly retail product descriptions. Built for the TCS Technology Day problem statement *Retail Product Description Generator*.

**Stack:** React (Vite) · Node.js + Express · Supabase (Postgres, Auth) · free LLMs via Groq (GPT-OSS 120B) or OpenRouter

- 📋 **Build plan and roadmap:** [`docs/PLAN.md`](docs/PLAN.md)
- 📄 **Input/output data format:** [`docs/DATA_FORMAT.md`](docs/DATA_FORMAT.md)

## Quick start

Requires Node.js 22.12 or later.

```bash
npm install
cp server/.env.example server/.env   # then fill it in (see below)
npm run dev                          # API on :4000, web app on http://localhost:5173
```

The app runs without any keys: the server falls back to a **mock** provider (template text) and database features are disabled. Fill in `server/.env` to enable the real thing.

### LLM provider

`LLM_PROVIDER` picks the model backend: `groq`, `openrouter` or `mock`. Left empty, it uses Groq if `GROQ_API_KEY` is set, then OpenRouter if `OPENROUTER_API_KEY` is set, and otherwise the mock. Both have free tiers: Groq is much faster, and OpenRouter adds daily capacity.

#### Groq (default)

Get a key at [console.groq.com](https://console.groq.com/keys) and set `GROQ_API_KEY` in `server/.env`. Optional settings:

| Variable | Default | Notes |
|---|---|---|
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Any Groq chat model; `openai/gpt-oss-20b` is faster |
| `GROQ_REASONING_EFFORT` | `low` | gpt-oss only: `low`, `medium` or `high`; higher thinks longer before writing |
| `GROQ_TEMPERATURE` | `0.7` | Lower is more consistent, higher is more creative |
| `GENERATION_CONCURRENCY` | `3` | Parallel requests during batch runs (shared by both providers); rate-limited requests are retried |

The free tier for `openai/gpt-oss-120b` allows 30 requests and 8K tokens a minute, and 200K tokens a day. With the current prompt (about 4K tokens per request) that is roughly 1-2 descriptions a minute and 40 a day; each model has its own allowance.

#### OpenRouter (free models)

Create a key at [openrouter.ai/keys](https://openrouter.ai/keys) and set `OPENROUTER_API_KEY` in `server/.env`.

| Variable | Default | Notes |
|---|---|---|
| `OPENROUTER_MODEL` | `nvidia/nemotron-3-super-120b-a12b:free` | Any model ID from [openrouter.ai/models](https://openrouter.ai/models?max_price=0); `google/gemma-4-31b-it:free` is a good alternative |
| `OPENROUTER_REASONING_EFFORT` | model default | `low` / `medium` / `high` for models that reason |

Free models allow **20 requests a minute and 50 a day** (1,000 a day once you have bought $10 of credits at least once). The server waits out the per-minute limit and reports the daily one clearly. Free providers may log prompts, so use synthetic data only. If you get "No endpoints found matching your data policy", allow free model endpoints in your OpenRouter privacy settings.

Models without schema-enforced JSON output still work: the prompt spells out the JSON shape, and the server validates the reply and retries up to 3 times.

### Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, paste and run [`supabase/migrations/20261008000000_init.sql`](supabase/migrations/20261008000000_init.sql).
3. From **Project Settings → API**, copy the project URL and the secret key (`sb_secret_...`, not the publishable key) into `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in `server/.env`.
4. Load the synthetic catalog: click **Load 60 sample products** on the Catalog tab, or run `npm run db:seed`.

### Login (Supabase Auth)

1. Also run [`supabase/migrations/20261008010000_retailers.sql`](supabase/migrations/20261008010000_retailers.sql) in the SQL editor. It adds retailer profiles and links products to them.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to `server/.env` (Vite reads its `VITE_*` variables from there).
3. For quick testing, turn off **Authentication → Sign In / Providers → Email → Confirm email**, so new accounts can log in immediately.

After signing up, onboarding asks whether you already sell online (Amazon, Flipkart, Shopify…) or are just starting, plus categories, price positioning and brand personality. Each account sees only its own catalog.

The service role key stays on the server. Row Level Security is enabled with no policies, so the browser can't query the database directly; everything goes through the Express API.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start API and web app with hot reload |
| `npm test` | Server tests (`node:test`, offline, uses the mock provider) |
| `npm run eval` | Run the 15-product eval set and write `data/eval/report.md` (see [Evaluating quality](#evaluating-quality)) |
| `npm run build` | Production build of the web app to `client/dist` |
| `npm run data:generate` | Regenerate the synthetic catalog in `data/generated/` (`--count`, `--seed`) |
| `npm run db:seed` | Upsert `data/generated/products.json` into Supabase |

## Project structure

```
client/                 React + Vite web app
  src/App.jsx           Layout and API status badge
  src/components/       Catalog (import, table, batch), ProductForm, DescriptionView
  src/api.js            Fetch wrapper (/api is proxied to Express in dev)
server/                 Express 5 API
  src/app.js            Middleware and route wiring
  src/routes/           health, generate, products (list, import, generate + save), me (account)
  src/lib/csv.js        CSV import parser (conventions in docs/DATA_FORMAT.md)
  src/lib/llm.js        Groq, OpenRouter and mock providers (JSON output validated with Zod)
  src/prompts/          System prompt (tones, categories, few-shot examples) and prompt builder
  src/schemas/          Zod schemas: product input, options, generated output
  src/services/         generator, quality checks (completeness, SEO, fact check, style)
  scripts/seed.js       Load a dataset into Supabase
  scripts/eval.js       Run the eval set, write a report and a rating sheet
  test/                 API, provider, prompt and quality tests
supabase/migrations/    Database schema
scripts/                Synthetic data generator
data/generated/         60 synthetic products (JSON + CSV)
data/eval/              15-product eval set, plus reports and rating sheets from eval runs
docs/                   Plan and data format
```

## API

| Endpoint | Description |
|---|---|
| `GET /api/health` | LLM provider/model and database status |
| `GET /api/generate/options` | Available tones and lengths |
| `POST /api/generate/check` | `{ product }` → `{ score, sparse, issues }`: completeness check before generating |
| `POST /api/generate` | `{ product, options? }` → `{ output, meta, quality }` (no login needed) |
| `GET /api/me` | Logged-in user and retailer profile (`null` until onboarding is done) |
| `PUT /api/me/retailer` | Create or update the retailer profile |
| `GET /api/products` | The retailer's catalog (`?category=&search=`), with each product's latest description |
| `GET /api/products/:id` | One product and all its description versions |
| `POST /api/products/import` | `{ format: "csv" \| "json", data }` → `{ imported, errors }` |
| `POST /api/products/import-sample` | Load the 60 synthetic products |
| `POST /api/products/:id/generate` | Generate and save a new description version |

The `/api/me` and `/api/products` routes need a Supabase access token (`Authorization: Bearer <token>`); the React app sends it automatically.

`quality` has four parts: `input` (completeness score and `sparse` flag), `seo` (length and keyword checks), `facts` (numbers, codes and claims in the copy that the product data doesn't support) and `style` (stock openers, clichés, keyword stuffing, title case). The shapes are in [`docs/DATA_FORMAT.md`](docs/DATA_FORMAT.md#quality-report).

Example:

```bash
curl -s localhost:4000/api/generate -H 'content-type: application/json' -d '{
  "product": { "name": "Pulse Buds", "category": "Electronics", "brand": "Voltix",
               "features": ["Active noise cancellation", "IPX5"], "seed_keywords": ["wireless earbuds"] },
  "options": { "tone": "friendly", "length": "short" }
}'
```

Endpoints for batch jobs, feedback and metrics are planned; see [`docs/PLAN.md`](docs/PLAN.md#4-api-surface).

## Evaluating quality

`data/eval/products.json` holds 15 products: two or more per category, four with sparse data, and several traps (seed keywords that contradict the specs, names that disagree with them). Each has an `eval_notes` field saying what a rater should check.

```bash
npm run eval -- --tones friendly,luxury          # 30 generations: fits the free daily quota
npm run eval -- --skus SKU-0011,SKU-0042         # specific products, every tone
npm run eval -- --provider openrouter --models nvidia/nemotron-3-super-120b-a12b:free,google/gemma-4-31b-it:free --tones friendly --limit 10
npm run eval -- --label v2                       # writes report-v2.md instead of report.md
```

Each run writes three files to `data/eval/`:

- `report.md`: a summary per model (SEO pass rate, fact-check flags, style issues, words on target, latency, tokens, cost), every fact-check flag and style issue, then each product's data next to its generated copy.
- `results.json`: the raw results, including the prompt version (a hash of the system prompt), so you can tell which prompt produced which report.
- `ratings.csv`: a blank rating sheet. Fill in `relevance` and `creativity` (1-5) for each row; teammates can each fill a copy.

Then summarise the ratings:

```bash
npm run eval -- ratings ratings.csv alice.csv bob.csv
```

This prints the share of outputs rated 4 or higher on both relevance and creativity (target: 80% for phase 1, 85% for the demo), broken down by tone, category and model.

When tuning the prompt in `server/src/prompts/productDescription.js`, change one thing at a time, re-run the same eval slice with a new `--label`, and compare the reports. Runs use the configured provider unless you pass `--provider groq|openrouter|mock`. On free OpenRouter models the run stops before it starts if it would need more requests than your key has left today; narrow it with `--tones`, `--skus` or `--limit`, or pass `--force`. On Groq, the token-per-minute limit makes runs slow rather than failing, so keep `--concurrency` at 1 or 2.
