// Makes ONE real call to each Anakin Wire action we might use and shows exactly what
// comes back: a field-by-field outline plus the raw JSON in data/anakin/probe-<action>.json.
// This spends credits (roughly 1-3 per call), so it lists the plan and asks first.
//   npm run anakin:probe
//   npm run anakin:probe -- --query "air fryer" --only am_search_products,am_product_details
//   npm run anakin:probe -- --yes          (skip the confirmation)
//   npm run anakin:probe -- --only am_product_details,am_product_reviews --asin B0BN729YJ8

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { config } from '../src/config/env.js';

const API = 'https://api.anakin.io/v1/wire';
const OUT_DIR = new URL('../../data/anakin/', import.meta.url);
const POLL_MS = 2000;
const TIMEOUT_MS = 120_000;

const { values: args } = parseArgs({
  options: {
    query: { type: 'string', default: 'wireless earbuds' },
    pincode: { type: 'string', default: '560001' },
    store: { type: 'string', default: 'https://www.boat-lifestyle.com' },
    only: { type: 'string' },
    // Starting ASIN for Amazon details/reviews when search returns nothing.
    asin: { type: 'string' },
    yes: { type: 'boolean', default: false },
  },
});

// Each step can use earlier results (ctx) to fill its params, e.g. an ASIN from search.
const STEPS = [
  { id: 'am_search_suggestions', params: () => ({ query: args.query, limit: 10 }) },
  { id: 'am_search_products', params: () => ({ query: args.query, limit: 5 }) },
  { id: 'am_product_details', params: (ctx) => ctx.asin && { asin: ctx.asin } },
  { id: 'am_product_reviews', params: (ctx) => ctx.asin && { asin: ctx.asin } },
  { id: 'fk_search_products', params: () => ({ query: args.query, pincode: args.pincode, limit: 5 }) },
  { id: 'fk_product_details', params: (ctx) => ctx.flipkartUrl && { product_url: ctx.flipkartUrl, pincode: args.pincode } },
  { id: 'cr_search_products', params: () => ({ query: args.query, pincode: args.pincode }) },
  { id: 'jm_search_products', params: () => ({ query: args.query, page_size: 5 }) },
  { id: 'me_search_products', params: () => ({ query: args.query, limit: 5 }) },
  { id: 'sh_products', params: () => ({ store_url: args.store, limit: 3 }) },
  { id: 'sh_product', params: (ctx) => ctx.shopifyHandle && { store_url: args.store, handle: ctx.shopifyHandle } },
].filter((step) => !args.only || args.only.split(',').includes(step.id));

if (!config.anakin.apiKey) {
  console.error('ANAKIN_API_KEY is not set in server/.env');
  process.exit(1);
}

const headers = {
  'X-API-Key': config.anakin.apiKey,
  authorization: `Bearer ${config.anakin.apiKey}`,
  'content-type': 'application/json',
};

async function call(method, path, body) {
  const res = await fetch(`${API}${path}`, { method, headers, body: body && JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const DONE = ['completed', 'complete', 'succeeded', 'success', 'done', 'finished'];
const FAILED = ['failed', 'error', 'cancelled', 'canceled'];

// Submit a task and wait for its result. Handles both sync replies and job polling.
async function runAction(actionId, params) {
  const submitted = await call('POST', '/task', { action_id: actionId, params });
  if (submitted.status >= 400) return { error: `submit failed (${submitted.status}): ${JSON.stringify(submitted.json)}` };

  const job = submitted.json ?? {};
  const jobId = job.job_id ?? job.id ?? job.data?.job_id ?? job.data?.id;
  const status = String(job.status ?? job.data?.status ?? '').toLowerCase();
  if (!jobId || DONE.includes(status)) return { raw: job };

  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    await sleep(POLL_MS);
    const polled = await call('GET', `/jobs/${jobId}`);
    const state = String(polled.json?.status ?? polled.json?.data?.status ?? '').toLowerCase();
    if (DONE.includes(state)) return { raw: polled.json };
    if (FAILED.includes(state) || polled.status >= 400) return { raw: polled.json, error: `job ${state || polled.status}` };
    process.stdout.write('.');
  }
  return { error: `timed out after ${TIMEOUT_MS / 1000}s (job ${jobId})` };
}

// Depth-first search for the first value whose key/value matches.
function find(value, test, key = '') {
  if (test(key, value)) return value;
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const hit = find(v, test, k);
      if (hit !== undefined) return hit;
    }
  }
  return undefined;
}

// Outline of a JSON value: keys, types, array sizes and a short example of each leaf.
function outline(value, indent = '  ', depth = 0, lines = []) {
  if (depth > 6) return lines;
  if (Array.isArray(value)) {
    lines.push(`${indent}[${value.length} items]${value.length ? ' first item:' : ''}`);
    if (value.length) outline(value[0], indent + '  ', depth + 1, lines);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (child && typeof child === 'object') {
        lines.push(`${indent}${key}:${Array.isArray(child) ? ` [${child.length}]` : ''}`);
        outline(Array.isArray(child) ? child[0] : child, indent + '  ', depth + 1, lines);
      } else {
        // Copy-like fields are what we care about most, so show more of them.
        const limit = /description|details|highlight|body|bullet|feature|about|review|text/i.test(key) ? 600 : 90;
        const example = JSON.stringify(child) ?? 'null';
        lines.push(`${indent}${key}: ${example.length > limit ? `${example.slice(0, limit)}…` : example}`);
      }
    }
  } else {
    lines.push(`${indent}${JSON.stringify(value)}`);
  }
  return lines;
}

// Parameter details from the catalog files saved by anakin:catalog, when present.
function catalogParams(actionId) {
  try {
    for (const file of readdirSync(OUT_DIR).filter((name) => name.startsWith('catalog-'))) {
      const action = find(JSON.parse(readFileSync(new URL(file, OUT_DIR), 'utf8')), (k, v) => v && typeof v === 'object' && (v.action_id === actionId || v.id === actionId));
      if (action) return action.params ?? action.parameters ?? action.input_schema ?? action.schema;
    }
  } catch {
    // No saved catalog: skip the parameter details.
  }
  return undefined;
}

mkdirSync(OUT_DIR, { recursive: true });
console.log(`Query: "${args.query}" · pincode ${args.pincode} · Shopify store ${args.store}`);
console.log(`Will call ${STEPS.length} action(s), about 1-3 credits each:\n  ${STEPS.map((step) => step.id).join('\n  ')}`);
if (!args.yes) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('\nProceed? (y/n) ');
  rl.close();
  if (answer.trim().toLowerCase() !== 'y') process.exit(0);
}

const ctx = { asin: args.asin };
const report = [`# Anakin probe: "${args.query}"`, ''];

for (const step of STEPS) {
  const params = step.params(ctx);
  console.log(`\n=== ${step.id} ===`);
  const schema = catalogParams(step.id);
  if (schema) console.log(`catalog params: ${JSON.stringify(schema).slice(0, 400)}`);
  if (!params) {
    console.log('skipped: no input found in earlier results');
    continue;
  }
  console.log(`params: ${JSON.stringify(params)}`);

  const started = Date.now();
  const { raw, error } = await runAction(step.id, params);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (raw) writeFileSync(new URL(`probe-${step.id}.json`, OUT_DIR), JSON.stringify(raw, null, 2));
  if (error) console.log(`\nERROR: ${error}`);
  if (!raw) continue;

  const lines = outline(raw);
  console.log(`\n(${seconds}s) response outline:`);
  console.log(lines.slice(0, 80).join('\n') + (lines.length > 80 ? `\n  … ${lines.length - 80} more lines in the JSON file` : ''));
  report.push(`## ${step.id}`, '', `params: \`${JSON.stringify(params)}\` · ${seconds}s${error ? ` · ERROR: ${error}` : ''}`, '', '```', ...lines, '```', '');

  // Inputs for the detail/review steps.
  ctx.asin ??= find(raw, (k, v) => /^asin$/i.test(k) && typeof v === 'string' && /^[A-Z0-9]{10}$/.test(v));
  ctx.flipkartUrl ??= find(raw, (k, v) => typeof v === 'string' && /flipkart\.com\/.+\/p\//.test(v));
  if (ctx.flipkartUrl && !ctx.flipkartUrl.startsWith('http')) ctx.flipkartUrl = `https://www.flipkart.com${ctx.flipkartUrl}`;
  ctx.shopifyHandle ??= find(raw, (k, v) => k === 'handle' && typeof v === 'string');
  // Print every suggestion, since the outline only shows the first list item.
  const suggestions = find(raw, (k, v) => k === 'suggestions' && Array.isArray(v));
  if (suggestions) console.log(`all suggestions: ${suggestions.map((item) => item.text ?? item).join(' | ')}`);
}

writeFileSync(new URL('probe-report.md', OUT_DIR), report.join('\n'));
console.log('\nSaved: data/anakin/probe-<action>.json (raw) and data/anakin/probe-report.md (all outlines)');
