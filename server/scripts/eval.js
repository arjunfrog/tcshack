// Runs the eval set through the generator and writes a report the team can read and rate.
//
//   npm run eval                                       every eval product in every tone
//   npm run eval -- --tones friendly,luxury            a subset of tones
//   npm run eval -- --skus SKU-0011,SKU-0042 --tones all
//   npm run eval -- --models a,b --efforts low,medium  compare settings on the same products
//   npm run eval -- --label v2                         writes report-v2.md etc. instead of report.md
//   npm run eval -- ratings ratings.csv [more.csv]     summarise filled-in rating sheets
//
// Other flags: --length short|medium|long (default medium), --limit N, --provider,
// --concurrency N, --force (skip the free-tier quota guard).
//
// Writes report[-label].md (copy plus quality checks, for reading), results[-label].json
// (raw results) and ratings[-label].csv (a blank sheet: relevance and creativity, 1-5).

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { activeModel, config, modelFor } from '../src/config/env.js';
import { mapPool } from '../src/lib/pool.js';
import { JSON_OUTPUT_INSTRUCTIONS, SYSTEM_PROMPT, WORD_RANGES } from '../src/prompts/productDescription.js';
import { LENGTHS, ProductInput, TONES } from '../src/schemas/product.js';
import { generateForProduct } from '../src/services/generator.js';

const EVAL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../data/eval');
// Free OpenRouter models allow 50 requests a day (1,000 once $10 of credits has ever been bought).
const FREE_DAILY_REQUESTS = 50;

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    flags[key] = value;
  }
  return flags;
}

const list = (value) => (typeof value === 'string' ? value.split(',').map((item) => item.trim()).filter(Boolean) : []);

async function runEval(flags) {
  const tones = !flags.tones || flags.tones === 'all' ? TONES : list(flags.tones);
  const length = flags.length ?? 'medium';
  const unknownTone = tones.find((tone) => !TONES.includes(tone));
  if (unknownTone) fail(`Unknown tone "${unknownTone}". Choose from: ${TONES.join(', ')}`);
  if (!LENGTHS.includes(length)) fail(`Unknown length "${length}". Choose from: ${LENGTHS.join(', ')}`);

  let products = JSON.parse(readFileSync(join(EVAL_DIR, 'products.json'), 'utf8'));
  if (flags.skus) products = products.filter((product) => list(flags.skus).includes(product.sku));
  if (flags.limit) products = products.slice(0, Number(flags.limit));
  if (!products.length) fail('No eval products match those filters.');

  const provider = flags.provider ?? config.llm.provider;
  const models = list(flags.models ?? flags.model);
  const efforts = list(flags.efforts ?? flags.effort);
  const defaultModel = provider === config.llm.provider ? activeModel() : modelFor(provider);
  const configs = (models.length ? models : [defaultModel]).flatMap((model) =>
    (efforts.length ? efforts : [undefined]).map((effort) => ({ provider, model, effort })),
  );

  const jobs = configs.flatMap((settings, configIndex) =>
    products.flatMap((product) => tones.map((tone) => ({ settings, configIndex, product, tone }))),
  );

  const freeTier = provider === 'openrouter' && configs.some(({ model }) => /:free$|^openrouter\/free$/.test(model));
  if (freeTier && !flags.force) {
    const remaining = await freeRequestsRemaining();
    if (jobs.length > remaining) {
      fail(
        `This run needs ${jobs.length} requests, but your OpenRouter key has ${remaining} free requests left today.\n` +
          'Narrow it with --tones, --skus or --limit (for example --tones friendly,luxury --limit 10), or pass --force.',
      );
    }
    console.log(`Free requests left today: ${remaining} (retries for invalid replies also count)`);
  }

  const concurrency = Number(flags.concurrency ?? config.llm.concurrency);
  const label = (settings) => [settings.model, settings.effort && `effort ${settings.effort}`].filter(Boolean).join(', ');
  console.log(`Eval: ${products.length} products x ${tones.length} tones x ${configs.length} config(s) = ${jobs.length} generations (${provider}, concurrency ${concurrency})`);

  let done = 0;
  const results = await mapPool(jobs, concurrency, async ({ settings, configIndex, product: record, tone }) => {
    const { eval_notes, ...raw } = record;
    const product = ProductInput.parse(raw);
    const id = [product.sku, tone, configs.length > 1 && `c${configIndex + 1}`].filter(Boolean).join('-');
    const base = { id, sku: product.sku, name: product.name, category: product.category, tone, length, config: label(settings), eval_notes, product };
    let result;
    try {
      result = { ...base, ...(await generateForProduct(product, { tone, length }, settings)) };
    } catch (error) {
      result = { ...base, error: error.message };
    }
    done++;
    console.log(`[${done}/${jobs.length}] ${id}: ${result.error ? `ERROR ${result.error}` : summaryLine(result)}`);
    return result;
  });

  const promptVersion = createHash('sha256').update(SYSTEM_PROMPT + JSON_OUTPUT_INSTRUCTIONS).digest('hex').slice(0, 8);
  const run = { date: new Date().toISOString(), provider, length, tones, configs: configs.map(label), prompt_version: promptVersion };
  const suffix = flags.label ? `-${flags.label}` : '';
  writeFileSync(join(EVAL_DIR, `results${suffix}.json`), JSON.stringify({ run, results }, null, 2) + '\n');
  writeFileSync(join(EVAL_DIR, `report${suffix}.md`), renderReport(run, results, configs.map(label)));
  writeFileSync(join(EVAL_DIR, `ratings${suffix}.csv`), renderRatingSheet(results));

  console.log(`\nWrote data/eval/report${suffix}.md, results${suffix}.json and ratings${suffix}.csv (prompt ${promptVersion})`);
  for (const row of summarise(results, configs.map(label))) {
    console.log(`  ${row.config}: ${row.ok}/${row.total} ok, SEO ${row.seo}, facts clean ${row.factsClean}, style clean ${row.styleClean}, words in range ${row.wordsInRange}`);
  }
}

// Asks OpenRouter how many free-model requests this key has left today; assumes the
// standard daily allowance if the key endpoint can't be reached.
async function freeRequestsRemaining() {
  try {
    const res = await fetch(`${config.openrouter.baseUrl}/key`, { headers: { authorization: `Bearer ${config.openrouter.apiKey}` } });
    const { data } = await res.json();
    return data?.free_model_daily_requests?.remaining ?? FREE_DAILY_REQUESTS;
  } catch {
    return FREE_DAILY_REQUESTS;
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

// --- Per-result helpers ---

const countWords = (text) => text.split(/\s+/).filter(Boolean).length;
const targetRange = (result) => WORD_RANGES[result.quality.input.sparse ? 'sparse' : result.length];
const wordsInRange = (result) => {
  const [min, max] = targetRange(result);
  const count = countWords(result.output.long_description);
  return count >= min && count <= max;
};
const percent = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : 'n/a');

function summaryLine(result) {
  const { seo, facts, style } = result.quality;
  const flags = facts.unsupported.map((item) => item.text).join(', ');
  const styleNote = style.passed ? 'clean' : style.issues.map((issue) => issue.type).join(', ');
  return `SEO ${seo.passed}/${seo.total}, facts ${facts.passed ? 'clean' : `FLAGGED (${flags})`}, style ${styleNote}, ${countWords(result.output.long_description)} words, ${(result.meta.latency_ms / 1000).toFixed(1)} s`;
}

function summarise(results, configLabels) {
  return configLabels.map((configLabel) => {
    const rows = results.filter((result) => result.config === configLabel);
    const ok = rows.filter((result) => !result.error);
    const sum = (pick) => ok.reduce((total, result) => total + pick(result), 0);
    const cost = ok.some((result) => result.meta.cost_usd === null) ? null : sum((result) => result.meta.cost_usd ?? 0);
    return {
      config: configLabel,
      total: rows.length,
      ok: ok.length,
      errors: rows.length - ok.length,
      seo: percent(sum((result) => result.quality.seo.passed), sum((result) => result.quality.seo.total)),
      coverage: ok.length ? `${Math.round(sum((result) => result.quality.seo.keyword_coverage) / ok.length)}%` : 'n/a',
      factsClean: percent(ok.filter((result) => result.quality.facts.passed).length, ok.length),
      flags: sum((result) => result.quality.facts.unsupported.length),
      styleClean: percent(ok.filter((result) => result.quality.style.passed).length, ok.length),
      wordsInRange: percent(ok.filter(wordsInRange).length, ok.length),
      latency: ok.length ? `${(sum((result) => result.meta.latency_ms) / ok.length / 1000).toFixed(1)} s` : 'n/a',
      tokens: ok.length ? `${Math.round(sum((result) => result.meta.input_tokens) / ok.length)} / ${Math.round(sum((result) => result.meta.output_tokens) / ok.length)}` : 'n/a',
      cost: cost === null ? 'unknown' : `$${cost.toFixed(4)}`,
    };
  });
}

// --- Report ---

const cell = (text) => String(text).replaceAll('|', '\\|').replaceAll('\n', ' ');
const table = (headers, rows) =>
  [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`, ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`)].join('\n');

function describeInput(product) {
  const specs = Object.entries(product.specifications).map(([key, value]) => `${key}: ${value}`);
  const attributes = Object.entries(product.attributes).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`);
  return [
    `- **Brand:** ${product.brand ?? '(none)'} · **Subcategory:** ${product.subcategory ?? '(none)'} · **Price:** ${product.price ?? '(none)'} ${product.currency}`,
    `- **Features:** ${product.features.join('; ') || '(none)'}`,
    `- **Specifications:** ${specs.join('; ') || '(none)'}`,
    `- **Attributes:** ${attributes.join('; ') || '(none)'}`,
    `- **Seed keywords:** ${product.seed_keywords.join(', ') || '(none)'}`,
  ].join('\n');
}

function renderResult(result) {
  const heading = `#### ${result.id} · ${result.tone} · ${result.config}`;
  if (result.error) return `${heading}\n\n**Error:** ${result.error}`;

  const { output, meta, quality } = result;
  const failedSeo = Object.entries(quality.seo).filter(([, value]) => value === false).map(([key]) => key);
  const [min, max] = targetRange(result);
  const facts = quality.facts.passed
    ? 'clean'
    : quality.facts.unsupported.map((item) => `**"${item.text}"** (${item.issue}; in ${item.fields.join(', ')})`).join('; ');
  const style = quality.style.passed ? 'clean' : quality.style.issues.map((issue) => `${issue.type} (${issue.text})`).join('; ');
  return `${heading}

**${output.title}** _(${output.title.length} chars)_

_${output.short_description}_

${output.long_description}

${output.bullet_points.map((bullet) => `- ${bullet}`).join('\n')}

**Meta** _(${output.meta_description.length} chars)_: ${output.meta_description}

**Keywords:** ${output.seo_keywords.join(' · ')}

> SEO ${quality.seo.passed}/${quality.seo.total}${failedSeo.length ? ` (failed: ${failedSeo.join(', ')})` : ''} · keyword coverage ${quality.seo.keyword_coverage}% · ${countWords(output.long_description)} words (target ${min}-${max}) · ${output.bullet_points.length} bullets
> Fact check: ${facts}
> Style: ${style}
> ${meta.model} · ${meta.input_tokens} in / ${meta.output_tokens} out tokens · ${(meta.latency_ms / 1000).toFixed(1)} s`;
}

function renderReport(run, results, configLabels) {
  const summary = summarise(results, configLabels);
  const flagged = results.filter((result) => !result.error && !result.quality.facts.passed);
  const styleIssues = results.filter((result) => !result.error).flatMap((result) => result.quality.style.issues.map((issue) => ({ ...issue, id: result.id })));
  const styleCounts = Object.entries(Object.groupBy(styleIssues, (issue) => issue.type)).map(([type, issues]) => [
    type,
    new Set(issues.map((issue) => issue.id)).size,
    issues.slice(0, 3).map((issue) => issue.text).join(' · '),
  ]);
  const errors = results.filter((result) => result.error);

  const sections = [...new Set(results.map((result) => result.sku))].map((sku) => {
    const rows = results.filter((result) => result.sku === sku);
    const [first] = rows;
    const completeness = rows.find((result) => result.quality)?.quality.input;
    const overview = table(
      ['Item', 'Title', 'Words', 'SEO', 'Facts', 'Style'],
      rows.map((result) =>
        result.error
          ? [result.id, 'error', '', '', '', '']
          : [
              result.id,
              result.output.title,
              countWords(result.output.long_description),
              `${result.quality.seo.passed}/${result.quality.seo.total}`,
              result.quality.facts.passed ? 'clean' : `${result.quality.facts.unsupported.length} flagged`,
              result.quality.style.passed ? 'clean' : `${result.quality.style.issues.length} issues`,
            ],
      ),
    );
    return `### ${sku} · ${first.name} (${first.category})

${first.eval_notes ? `> **What to check:** ${first.eval_notes}\n\n` : ''}${describeInput(first.product)}${completeness ? `\n- **Completeness:** ${completeness.score}/100${completeness.sparse ? ' (sparse)' : ''}` : ''}

${overview}

${rows.map(renderResult).join('\n\n')}`;
  });

  return `# Eval report

${run.date.slice(0, 16).replace('T', ' ')} UTC · provider \`${run.provider}\` · length \`${run.length}\` · tones: ${run.tones.join(', ')} · prompt version \`${run.prompt_version}\`

Read each output against its product data, then fill in \`ratings.csv\` (relevance and creativity, 1-5) and run \`npm run eval -- ratings ratings.csv\`. Phase 1 is done when 80% or more of outputs score 4 or 5 on both and the fact check flags nothing.

## Summary

${table(
  ['Config', 'OK', 'Errors', 'SEO checks passed', 'Keyword coverage', 'Fact check clean', 'Flags', 'Style clean', 'Words in range', 'Avg latency', 'Avg tokens in / out', 'Total cost'],
  summary.map((row) => [row.config, `${row.ok}/${row.total}`, row.errors, row.seo, row.coverage, row.factsClean, row.flags, row.styleClean, row.wordsInRange, row.latency, row.tokens, row.cost]),
)}

## Style issues

${styleCounts.length ? table(['Issue', 'Outputs', 'Examples'], styleCounts) : 'None.'}

## Fact-check flags

${flagged.length
  ? table(
      ['Item', 'Flagged text', 'Issue', 'Fields'],
      flagged.flatMap((result) => result.quality.facts.unsupported.map((item) => [result.id, item.text, item.issue, item.fields.join(', ')])),
    )
  : 'None.'}
${errors.length ? `\n## Errors\n\n${table(['Item', 'Error'], errors.map((result) => [result.id, result.error]))}\n` : ''}
## Outputs

${sections.join('\n\n')}
`;
}

// --- Ratings ---

const csvCell = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

function renderRatingSheet(results) {
  const header = ['id', 'sku', 'category', 'tone', 'config', 'relevance', 'creativity', 'comment'];
  const rows = results.filter((result) => !result.error).map((result) => [result.id, result.sku, result.category, result.tone, result.config, '', '', '']);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') field += text[++i];
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') (row.push(field), (field = ''));
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field || row.length) rows.push([...row, field]);
  const [header, ...body] = rows.filter((cells) => cells.some((value) => value.trim()));
  return body.map((cells) => Object.fromEntries(header.map((name, i) => [name.trim(), (cells[i] ?? '').trim()])));
}

function summariseRatings(files) {
  if (!files.length) fail('Usage: npm run eval -- ratings ratings.csv [more.csv ...]');
  const rows = files.flatMap((file) => {
    const path = isAbsolute(file) || existsSync(file) ? file : join(EVAL_DIR, file);
    return parseCsv(readFileSync(path, 'utf8'));
  });
  const rated = rows
    .map((row) => ({ ...row, relevance: Number(row.relevance), creativity: Number(row.creativity) }))
    .filter((row) => row.relevance >= 1 && row.relevance <= 5 && row.creativity >= 1 && row.creativity <= 5);
  if (!rated.length) fail(`No rows with both relevance and creativity (1-5) filled in across ${rows.length} rows.`);

  const good = (row) => row.relevance >= 4 && row.creativity >= 4;
  const average = (group, key) => (group.reduce((total, row) => total + row[key], 0) / group.length).toFixed(2);
  const breakdown = (key) =>
    Object.entries(Object.groupBy(rated, (row) => row[key] || '(blank)')).map(([name, group]) =>
      `  ${name.padEnd(28)} ${String(group.length).padStart(3)} rated   ${percent(group.filter(good).length, group.length).padStart(4)} rated 4+ on both   relevance ${average(group, 'relevance')}   creativity ${average(group, 'creativity')}`,
    );

  console.log(`${rated.length} of ${rows.length} rows rated.`);
  console.log(`Rated 4 or 5 on both relevance and creativity: ${percent(rated.filter(good).length, rated.length)} (target 80% for phase 1, 85% for the demo)`);
  console.log(`Average relevance ${average(rated, 'relevance')}, creativity ${average(rated, 'creativity')}`);
  for (const key of ['tone', 'category', 'config']) {
    console.log(`\nBy ${key}:`);
    console.log(breakdown(key).join('\n'));
  }
}

// Entry point last, so every helper above is initialised before it runs.
const [command, ...rest] = process.argv.slice(2);
if (command === 'ratings') {
  summariseRatings(rest);
} else {
  await runEval(parseFlags(process.argv.slice(2)));
}
