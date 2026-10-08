# Product Copy Studio

A GenAI tool that turns structured product attributes (category, features, specifications, price) into engaging, consistent, SEO-friendly retail product descriptions. Built for the TCS Technology Day problem statement *Retail Product Description Generator*.

**Stack:** React (Vite) · Node.js + Express · Supabase (Postgres) · Claude API

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

### Claude API

Set `ANTHROPIC_API_KEY` in `server/.env`. Optional settings:

| Variable | Default | Notes |
|---|---|---|
| `ANTHROPIC_MODEL` | `claude-opus-5-5` | `claude-sonnet-5-5` or `claude-haiku-5-5` are cheaper for bulk runs |
| `ANTHROPIC_EFFORT` | `medium` | `low` is faster and cheaper, `high` is more polished |
| `GENERATION_CONCURRENCY` | `5` | Parallel requests during batch runs |
| `LLM_PROVIDER` | auto | `anthropic` or `mock`; auto picks `anthropic` when a key is set |

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
  src/lib/llm.js        Claude call (structured output) and mock provider
  src/prompts/          System prompt and per-request prompt builder
  src/schemas/          Zod schemas: product input, options, generated output
  src/services/         generator, quality checks (completeness, SEO)
  scripts/seed.js       Load a dataset into Supabase
  test/                 API and quality tests
supabase/migrations/    Database schema
scripts/                Synthetic data generator
data/generated/         60 synthetic products (JSON + CSV)
docs/                   Plan and data format
```

## API

| Endpoint | Description |
|---|---|
| `GET /api/health` | LLM provider/model and database status |
| `GET /api/generate/options` | Available tones and lengths |
| `POST /api/generate` | `{ product, options? }` → `{ output, meta, quality }` |

Example:

```bash
curl -s localhost:4000/api/generate -H 'content-type: application/json' -d '{
  "product": { "name": "Pulse Buds", "category": "Electronics", "brand": "Voltix",
               "features": ["Active noise cancellation", "IPX5"], "seed_keywords": ["wireless earbuds"] },
  "options": { "tone": "friendly", "length": "short" }
}'
```

Endpoints for the catalog, CSV import, batch jobs, feedback and metrics are planned; see [`docs/PLAN.md`](docs/PLAN.md#4-api-surface).
