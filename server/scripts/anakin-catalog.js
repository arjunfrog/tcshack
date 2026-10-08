// Lists the Anakin Wire actions we could use for market data, with their ids,
// parameters and credit cost. Read-only: it never submits a task or spends credits.
//   npm run anakin:catalog                 (default marketplaces and searches)
//   npm run anakin:catalog -- myntra nykaa (check specific catalog slugs)
// Full responses are saved to data/anakin/ for reference.

import { mkdirSync, writeFileSync } from 'node:fs';
import { config } from '../src/config/env.js';

const API = 'https://api.anakin.io/v1/wire';
const OUT_DIR = new URL('../../data/anakin/', import.meta.url);

const DEFAULT_SLUGS = ['flipkart', 'amazon-in', 'amazon', 'myntra', 'nykaa', 'ajio', 'meesho', 'croma', 'tatacliq', 'jiomart', 'shopify'];
const SEARCHES = ['product search', 'product details', 'search products', 'category listing', 'product reviews'];

if (!config.anakin.apiKey) {
  console.error('ANAKIN_API_KEY is not set in server/.env');
  process.exit(1);
}

async function get(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'X-API-Key': config.anakin.apiKey, authorization: `Bearer ${config.anakin.apiKey}` },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

// Responses vary between catalogs, so pull out whatever looks like a list of actions.
const actionsIn = (body) =>
  [body?.actions, body?.data?.actions, body?.data, body?.results, body].find(Array.isArray) ?? [];

function summarize(action) {
  const id = action.action_id ?? action.id ?? action.slug ?? '?';
  const name = action.name ?? action.title ?? action.description ?? '';
  const params = action.params ?? action.parameters ?? action.input_schema?.properties ?? action.schema?.properties;
  const paramNames = params ? (Array.isArray(params) ? params.map((p) => p.name ?? p) : Object.keys(params)) : [];
  const cost = action.credits ?? action.credit_cost ?? action.cost ?? '?';
  const login = action.requires_credential ?? action.requires_auth ?? action.auth_required;
  return `  ${id}\n      ${name}\n      params: ${paramNames.join(', ') || '?'} · credits: ${cost}${login ? ' · needs login' : ''}`;
}

mkdirSync(OUT_DIR, { recursive: true });
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_SLUGS;

console.log('== Catalogs ==');
for (const slug of slugs) {
  const { status, body } = await get(`/catalog/${encodeURIComponent(slug)}`);
  if (status === 401 || status === 403) {
    console.error(`Anakin rejected the API key (${status}): ${JSON.stringify(body)}`);
    process.exit(1);
  }
  if (status !== 200) {
    console.log(`\n${slug}: not available (${status})`);
    continue;
  }
  writeFileSync(new URL(`catalog-${slug}.json`, OUT_DIR), JSON.stringify(body, null, 2));
  const actions = actionsIn(body);
  console.log(`\n${slug}: ${actions.length} action(s)`);
  actions.forEach((action) => console.log(summarize(action)));
}

console.log('\n== Action search ==');
for (const q of SEARCHES) {
  const { status, body } = await get(`/resolve?q=${encodeURIComponent(q)}`);
  if (status !== 200) {
    console.log(`\n"${q}": failed (${status})`);
    continue;
  }
  writeFileSync(new URL(`resolve-${q.replaceAll(' ', '-')}.json`, OUT_DIR), JSON.stringify(body, null, 2));
  const actions = actionsIn(body);
  console.log(`\n"${q}": ${actions.length} match(es)`);
  actions.slice(0, 15).forEach((action) => console.log(summarize(action)));
}

console.log(`\nFull responses saved in data/anakin/`);
