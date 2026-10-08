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
| `GROQ_REASONING_EFFORT` | `medium` | gpt-oss only: `low`, `medium` or `high`. Medium scored best in the eval; a reply that runs out of tokens retries at low |
| `GROQ_TEMPERATURE` | `0.7` | Lower is more consistent, higher is more creative |
| `GENERATION_CONCURRENCY` | `3` | Parallel requests during batch runs (shared by both providers); rate-limited requests are retried |

The free tier for `openai/gpt-oss-120b` allows 30 requests and 8K tokens a minute, and 200K tokens a day. At medium effort a description takes about 6,500 tokens (plus ~2,000 when the fix-up pass runs), so roughly 1 a minute and 25-30 a day; each model has its own allowance.

#### Fix-up pass

After generating, the server runs every quality check. If any fail (title or meta too long, primary keyword missing, an unsupported number or claim, a cliché, a formula opener, a word the brand avoids), one short follow-up request asks the model to fix only those problems. The fix is kept only if it scores better and adds no fact flags, and `quality.refine` records what happened. Set `LLM_REFINE=false` to skip it and save the extra request.

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
2. In **SQL Editor**, paste the whole of [`supabase/setup.sql`](supabase/setup.sql) and click **Run**. It creates every table and is safe to re-run. (It combines the files in `supabase/migrations/`.)
3. From **Project Settings → API**, copy the project URL and the secret key (`sb_secret_...`, not the publishable key) into `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in `server/.env`.
4. Load the synthetic catalog: click **Load 60 sample products** on the Catalog tab, or run `npm run db:seed`.

### Login (Supabase Auth)

1. Retailer profiles and the product-to-retailer link are created by `supabase/setup.sql` too.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to `server/.env` (Vite reads its `VITE_*` variables from there).
3. No email confirmation is needed: sign-up goes through `POST /api/signup`, which creates the account already confirmed with the secret key, then the app logs straight in.

After signing up, onboarding asks whether you already sell online (Amazon, Flipkart, Shopify…) or are just starting, plus categories, price positioning and brand personality. Each account sees only its own catalog.

The service role key stays on the server. Row Level Security is enabled with no policies, so the browser can't query the database directly; everything goes through the Express API.

## Using the app

After signing up and onboarding (your brand profile: personality, target customer, price positioning, words to avoid), the app has six tabs:

| Tab | What it's for |
|---|---|
| **Catalog** | Import a CSV or JSON file (or load the sample products), browse and search, generate or regenerate one product, see its versions |
| **Quick generate** | Type in one product; warns about thin data before generating, saves the product and its copy |
| **Batch** | Generate for many products at once on the server, watch progress, export CSV/JSON, resume a partial batch |
| **Review** | Rate each AI draft for relevance and creativity (keys 1–5), then approve (A), reject (R), skip (→) or edit (E) |
| **Dashboard** | The share rated 4+ against the 85% target, quality pass rates, breakdowns, consistency, usage |
| **History** | Everything generated, newest first |

Every description shows its SEO checks, readability, fact-check flags, style issues and whether the fix-up pass changed it.

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
  src/routes/           health, generate, products (list, edit, import, generate + save), me, history, jobs, review
  src/lib/csv.js        CSV import parser (conventions in docs/DATA_FORMAT.md)
  src/lib/llm.js        Groq, OpenRouter and mock providers (JSON output validated with Zod)
  src/prompts/          System prompt (tones, categories, few-shot examples) and prompt builder
  src/schemas/          Zod schemas: product input, options, generated output
  src/services/         generator, quality checks (completeness, SEO, fact check, style), batch job runner, metrics
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
| `GET /api/products` | The retailer's catalog (`?category=&search=&limit=&offset=`), with each product's latest description, plus `total` for paging |
| `GET /api/products/:id` | One product and all its description versions |
| `PATCH /api/products/:id` | Edit a product (only the fields sent change); the completeness score is recomputed |
| `POST /api/products/import` | `{ format: "csv" \| "json", data }` → `{ imported, errors }` |
| `POST /api/products/import-sample` | Load the 60 synthetic products |
| `POST /api/products/:id/generate` | Generate and save a new description version |
| `POST /api/products/quick` | `{ product, options? }`: save the product (or reuse a match) and generate a description for it |
| `GET /api/history` | The retailer's generated descriptions, newest first (`?limit=`, max 200) |
| `POST /api/signup` | `{ email, password }`: create an already-confirmed account (no confirmation email) |
| `POST /api/jobs` | `{ product_ids? \| category?, missing_only?, options? }` → 202 `{ job }`: start a batch in the background |
| `GET /api/jobs` | The retailer's recent batch jobs |
| `GET /api/jobs/:id` | Job status, progress counts and one row per product (poll every 2 seconds) |
| `POST /api/jobs/:id/resume` | Rerun every product in the job that hasn't succeeded |
| `GET /api/jobs/:id/export?format=csv\|json` | Download the job's results |
| `GET /api/review?limit=20` | Review queue: each product's latest AI draft that you haven't rated, oldest first, with the product's attributes |
| `PATCH /api/descriptions/:id` | `{ status?, edits? }`: approve or reject; with `edits`, save the hand-edited copy as a new version |
| `POST /api/descriptions/:id/feedback` | `{ relevance, creativity, comment? }` (1-5 each): your rating; rating again replaces it |
| `GET /api/metrics` | Dashboard numbers: % rated 4+ on both scores (target 85%), averages by category, tone and model, SEO, fact and style pass rates, tokens, review counts |

The `/api/me`, `/api/products`, `/api/history`, `/api/jobs`, review, description and metrics routes need a Supabase access token (`Authorization: Bearer <token>`); the React app sends it automatically.

`quality` has four parts: `input` (completeness score and `sparse` flag), `seo` (length and keyword checks), `facts` (numbers, codes and claims in the copy that the product data doesn't support) and `style` (stock openers, clichés, keyword stuffing, title case). The shapes are in [`docs/DATA_FORMAT.md`](docs/DATA_FORMAT.md#quality-report).

Example:

```bash
curl -s localhost:4000/api/generate -H 'content-type: application/json' -d '{
  "product": { "name": "Pulse Buds", "category": "Electronics", "brand": "Voltix",
               "features": ["Active noise cancellation", "IPX5"], "seed_keywords": ["wireless earbuds"] },
  "options": { "tone": "friendly", "length": "short" }
}'
```

### Review and metrics

Ratings measure the AI's copy, so rate a description before editing it. Each reviewer rates a description once (`feedback.reviewer_id`); the headline metric averages each description's ratings across reviewers and counts it as "rated 4+" when both averages are at least 4.

Editing never overwrites: `PATCH /api/descriptions/:id` with `edits` saves a new version with `provider: "human"` and `edited_from` pointing at the AI version, re-runs the SEO, fact and style checks on it, and stores `quality.human_edit.changed_pct`, the share of words changed. The dashboard averages that to show how much humans rewrote the AI's copy.

### Batch jobs

A job covers up to 500 products. `POST /api/jobs` with no selection takes the whole catalog; `category` narrows it, and `missing_only: true` skips products that already have a description. The job runs on the server with `GENERATION_CONCURRENCY` products at a time. Each product is a row in `generation_job_items` that moves `queued` → `running` → `succeeded` or `failed`, and one product failing never stops the job. Rate-limited products wait a minute and try again, twice.

The job ends `completed`, `partial` or `failed`. If the server restarts mid-job, `GET /api/jobs/:id` shows `active: false` while the status is still `running`; `POST /api/jobs/:id/resume` picks up where it stopped. Resume is also how to finish a `partial` job after a free-tier daily quota resets.

The export has one row per product: `sku, name, category, status, error, title, short_description, long_description, bullet_points, seo_keywords, meta_description, seo_checks, fact_flags, style_issues, model, version`. Lists are joined with ` | `, as in the import format.

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
