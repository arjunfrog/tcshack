# Product Copy Studio

A GenAI tool that turns structured product attributes (category, features, specifications, price) into engaging, consistent, SEO-friendly retail product descriptions. Built for the TCS Technology Day problem statement *Retail Product Description Generator*.

**Stack:** React (Vite) · Node.js + Express · Supabase (Postgres) · Claude API or free models via OpenRouter

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

`LLM_PROVIDER` picks the model backend: `openrouter`, `anthropic` or `mock`. Left empty, it uses Anthropic if `ANTHROPIC_API_KEY` is set, then OpenRouter if `OPENROUTER_API_KEY` is set, and otherwise the mock.

#### OpenRouter (free models, no cost)

Create a key at [openrouter.ai/keys](https://openrouter.ai/keys) and set `OPENROUTER_API_KEY` in `server/.env`.

| Variable | Default | Notes |
|---|---|---|
| `OPENROUTER_MODEL` | `nvidia/nemotron-3-super-120b-a12b:free` | Any model ID from [openrouter.ai/models](https://openrouter.ai/models?max_price=0); `google/gemma-4-31b-it:free` is a good alternative |
| `OPENROUTER_REASONING_EFFORT` | model default | `low` / `medium` / `high` for models that reason |
| `GENERATION_CONCURRENCY` | `5` | Keep it at 2 on free models |

Free models allow **20 requests a minute and 50 a day** (1,000 a day once you have bought $10 of credits at least once). The server waits out the per-minute limit and reports the daily one clearly. Free providers may log prompts, so use synthetic data only. If you get "No endpoints found matching your data policy", allow free model endpoints in your OpenRouter privacy settings.

Models without schema-enforced JSON output still work: the prompt spells out the JSON shape, and the server validates the reply and retries up to 3 times.

#### Claude API (paid)

Set `ANTHROPIC_API_KEY` in `server/.env`. Optional settings:

| Variable | Default | Notes |
|---|---|---|
| `ANTHROPIC_MODEL` | `claude-opus-5-5` | `claude-sonnet-5-5` is cheaper for bulk runs |
| `ANTHROPIC_EFFORT` | `medium` | `low` is faster and cheaper, `high` is more polished |
| `GENERATION_CONCURRENCY` | `5` | Parallel requests during batch runs |

### Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, paste and run [`supabase/migrations/20261008000000_init.sql`](supabase/migrations/20261008000000_init.sql).
3. From **Project Settings → API**, copy the project URL and the service role (secret) key into `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `server/.env`.
4. Load the synthetic catalog: `npm run db:seed`.

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
  src/components/       ProductForm, DescriptionView
  src/api.js            Fetch wrapper (/api is proxied to Express in dev)
server/                 Express 5 API
  src/app.js            Middleware and route wiring
  src/routes/           health, generate
  src/lib/llm.js        Claude, OpenRouter and mock providers
  src/prompts/          System prompt (tones, categories, few-shot examples) and prompt builder
  src/schemas/          Zod schemas: product input, options, generated output
  src/services/         generator, quality checks (completeness, SEO, fact check)
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
| `POST /api/generate` | `{ product, options? }` → `{ output, meta, quality }` |

`quality` has three parts: `input` (completeness score and `sparse` flag), `seo` (length and keyword checks) and `facts` (numbers, codes and claims in the copy that the product data doesn't support). The shapes are in [`docs/DATA_FORMAT.md`](docs/DATA_FORMAT.md#quality-report).

Example:

```bash
curl -s localhost:4000/api/generate -H 'content-type: application/json' -d '{
  "product": { "name": "Pulse Buds", "category": "Electronics", "brand": "Voltix",
               "features": ["Active noise cancellation", "IPX5"], "seed_keywords": ["wireless earbuds"] },
  "options": { "tone": "friendly", "length": "short" }
}'
```

Endpoints for the catalog, CSV import, batch jobs, feedback and metrics are planned; see [`docs/PLAN.md`](docs/PLAN.md#4-api-surface).

## Evaluating quality

`data/eval/products.json` holds 15 products: two or more per category, four with sparse data, and several traps (seed keywords that contradict the specs, names that disagree with them). Each has an `eval_notes` field saying what a rater should check.

```bash
npm run eval -- --tones friendly,luxury          # 30 generations: fits the free daily quota
npm run eval -- --skus SKU-0011,SKU-0042         # specific products, every tone
npm run eval -- --models nvidia/nemotron-3-super-120b-a12b:free,google/gemma-4-31b-it:free --tones friendly --limit 10
npm run eval -- --label v2                       # writes report-v2.md instead of report.md
```

Each run writes three files to `data/eval/`:

- `report.md`: a summary per model (SEO pass rate, fact-check flags, words on target, latency, tokens, cost), every fact-check flag, then each product's data next to its generated copy.
- `results.json`: the raw results, including the prompt version (a hash of the system prompt), so you can tell which prompt produced which report.
- `ratings.csv`: a blank rating sheet. Fill in `relevance` and `creativity` (1-5) for each row; teammates can each fill a copy.

Then summarise the ratings:

```bash
npm run eval -- ratings ratings.csv alice.csv bob.csv
```

This prints the share of outputs rated 4 or higher on both relevance and creativity (target: 80% for phase 1, 85% for the demo), broken down by tone, category and model.

When tuning the prompt in `server/src/prompts/productDescription.js`, change one thing at a time, re-run the same eval slice with a new `--label`, and compare the reports. On free OpenRouter models the run stops before it starts if it would need more than 50 requests; narrow it with `--tones`, `--skus` or `--limit`, or pass `--force`.
