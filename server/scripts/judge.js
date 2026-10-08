// LLM-as-judge: rates generated descriptions for relevance and creativity (1-5) with a strict
// rubric, as a second opinion before the team rates them. It never replaces human ratings.
//
//   npm run judge -- results-v4-groq-refine.json                 (a file from data/eval/)
//   npm run judge -- results-v4-groq-refine.json --model openai/gpt-oss-120b --provider groq
//
// Defaults to Groq's openai/gpt-oss-20b: a different model from the writer, with its own
// free-tier quota. Writes ratings-<label>-judge.csv next to the results (the same format as
// the team's rating sheets) and prints the share rated 4+ on both scores.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { config } from '../src/config/env.js';
import { toCsv } from '../src/lib/csv.js';
import { completeJson } from '../src/lib/llm.js';
import { mapPool } from '../src/lib/pool.js';
import { JUDGE_SYSTEM_PROMPT, buildJudgePrompt } from '../src/prompts/judge.js';

const EVAL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../data/eval');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const file = args.find((arg) => !arg.startsWith('--') && !args[args.indexOf(arg) - 1]?.startsWith('--'));
if (!file) {
  console.error('Usage: npm run judge -- <results file from data/eval/> [--provider groq] [--model openai/gpt-oss-20b] [--concurrency 1]');
  process.exit(1);
}
const path = isAbsolute(file) || existsSync(file) ? file : join(EVAL_DIR, file);
const { results } = JSON.parse(readFileSync(path, 'utf8'));

const provider = flag('provider', config.llm.provider === 'mock' ? 'mock' : 'groq');
const model = flag('model', provider === 'groq' ? 'openai/gpt-oss-20b' : undefined);
if (provider === 'mock') {
  console.error('The judge needs a real model: set GROQ_API_KEY or OPENROUTER_API_KEY, or pass --provider.');
  process.exit(1);
}

const Verdict = z.object({
  relevance: z.coerce.number().int().min(1).max(5),
  creativity: z.coerce.number().int().min(1).max(5),
  reason: z.string(),
});

const rated = results.filter((result) => !result.error);
console.log(`Judging ${rated.length} descriptions with ${provider} ${model ?? ''}…`);
let done = 0;
const verdicts = await mapPool(rated, Number(flag('concurrency', 1)), async (result) => {
  try {
    const { output } = await completeJson(
      {
        messages: [
          { role: 'system', content: JUDGE_SYSTEM_PROMPT },
          { role: 'user', content: buildJudgePrompt(result.product, result.output, result.tone) },
        ],
        schema: Verdict,
      },
      { provider, model, effort: 'low', refine: false },
    );
    console.log(`[${++done}/${rated.length}] ${result.id}: relevance ${output.relevance}, creativity ${output.creativity} (${output.reason})`);
    return { ...result, verdict: output };
  } catch (error) {
    console.log(`[${++done}/${rated.length}] ${result.id}: ERROR ${error.message}`);
    return { ...result, verdict: null };
  }
});

const judged = verdicts.filter((result) => result.verdict);
const rows = judged.map((result) => ({
  id: result.id, sku: result.sku, category: result.category, tone: result.tone, config: result.config,
  relevance: result.verdict.relevance, creativity: result.verdict.creativity, comment: `judge (${model}): ${result.verdict.reason}`,
}));
const out = join(dirname(path), basename(path).replace(/^results/, 'ratings').replace(/\.json$/, '-judge.csv'));
writeFileSync(out, toCsv(rows, ['id', 'sku', 'category', 'tone', 'config', 'relevance', 'creativity', 'comment']));

const good = judged.filter((result) => result.verdict.relevance >= 4 && result.verdict.creativity >= 4).length;
const average = (key) => (judged.reduce((sum, result) => sum + result.verdict[key], 0) / (judged.length || 1)).toFixed(2);
console.log(`\nJudge: ${judged.length ? Math.round((good / judged.length) * 100) : 0}% rated 4+ on both (${good}/${judged.length}); avg relevance ${average('relevance')}, creativity ${average('creativity')}`);
console.log(`Wrote ${out}. A second opinion only: the 85% target needs the team's own ratings.`);
