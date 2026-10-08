import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { config } from '../config/env.js';
import { GeneratedDescription } from '../schemas/product.js';
import { JSON_OUTPUT_INSTRUCTIONS, SYSTEM_PROMPT, buildUserPrompt } from '../prompts/productDescription.js';

let anthropic;
const getClient = () => (anthropic ??= new Anthropic());

// Returns { output, meta } where output matches GeneratedDescription.
// `settings` overrides the configured provider, model or effort for one call (used by the eval script).
export async function generateDescription(product, options, settings = {}) {
  const provider = settings.provider ?? config.llm.provider;
  if (provider === 'mock') return mockGenerate(product, options);
  if (provider === 'anthropic') return claudeGenerate(product, options, settings);
  if (provider === 'openrouter') return openrouterGenerate(product, options, settings);
  throw new Error(`Unknown LLM_PROVIDER "${provider}"`);
}

// USD per million tokens, used for cost estimates in meta and eval reports.
const CLAUDE_PRICES = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2 },
};

async function claudeGenerate(product, options, settings) {
  const model = settings.model ?? config.llm.model;
  const started = Date.now();
  const response = await getClient().beta.messages.parse({
    model,
    max_tokens: 16000,
    // If a safety classifier declines, the API retries on Anthropic's recommended fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: settings.effort ?? config.llm.effort,
      format: betaZodOutputFormat(GeneratedDescription),
    },
    // Identical for every product, so a batch reads it from the prompt cache after the first call.
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: buildUserPrompt(product, options) }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('The model declined to describe this product.');
  }
  if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
    throw new Error(`Model output could not be parsed (stop_reason: ${response.stop_reason}).`);
  }

  const { usage } = response;
  const price = CLAUDE_PRICES[model];
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  return {
    output: response.parsed_output,
    meta: {
      provider: 'anthropic',
      model: response.model,
      input_tokens: usage.input_tokens + cacheWrite + cacheRead,
      output_tokens: usage.output_tokens,
      cache_read_input_tokens: cacheRead,
      cost_usd: price
        ? (usage.input_tokens * price.input + cacheWrite * price.input * 1.25 + cacheRead * price.cacheRead + usage.output_tokens * price.output) / 1e6
        : null,
      latency_ms: Date.now() - started,
    },
  };
}

// --- OpenRouter (OpenAI-compatible chat completions; used for the free models) ---

const OUTPUT_SCHEMA = (() => {
  const { $schema, ...schema } = z.toJSONSchema(GeneratedDescription);
  return schema;
})();

const MAX_ATTEMPTS = 3;
// Free models allow a fixed number of requests per minute. Wait for the window to reset when
// it is close; a reset further away means the daily quota is used up, so fail fast instead.
const MAX_RATE_LIMIT_WAIT_MS = 65_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function llmError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function openrouterGenerate(product, options, settings) {
  if (!config.openrouter.apiKey) {
    throw llmError(503, 'OPENROUTER_API_KEY is not set. Add it to server/.env or set LLM_PROVIDER=mock.');
  }
  const model = settings.model ?? config.openrouter.model;
  const effort = settings.effort ?? config.openrouter.effort;
  const body = {
    model,
    messages: [
      // Not every free model supports response_format, so the prompt also spells out the JSON shape.
      { role: 'system', content: `${SYSTEM_PROMPT}\n\n${JSON_OUTPUT_INSTRUCTIONS}` },
      { role: 'user', content: buildUserPrompt(product, options) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'product_description', strict: true, schema: OUTPUT_SCHEMA },
    },
    // Reasoning tokens count toward max_tokens on thinking models (often 10K+), so leave plenty of room.
    max_tokens: 32000,
    reasoning: { ...(effort && { effort }), exclude: true },
  };

  const started = Date.now();
  const retries = [];
  const lastProblem = () => retries.at(-1) ?? '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(`${config.openrouter.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.openrouter.apiKey}`,
        'content-type': 'application/json',
        'x-title': 'Product Copy Studio',
      },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));

    if (res.status === 429) {
      const waitMs = rateLimitWait(res.headers, attempt);
      if (waitMs > MAX_RATE_LIMIT_WAIT_MS || attempt === MAX_ATTEMPTS) {
        throw llmError(429, `OpenRouter rate limit: ${payload.error?.message ?? 'too many requests'}${resetNote(res.headers)}`);
      }
      await sleep(waitMs);
      continue;
    }
    if (!res.ok || payload.error) {
      const message = `OpenRouter request failed (${res.status}): ${payload.error?.message ?? res.statusText}`;
      // Retry upstream hiccups (provider down or overloaded); report everything else straight away.
      if ([502, 503].includes(res.status) && attempt < MAX_ATTEMPTS) {
        retries.push(message);
        await sleep(2000 * attempt);
        continue;
      }
      throw llmError(res.status === 401 ? 502 : res.status >= 500 ? 502 : res.status, message);
    }

    const choice = payload.choices?.[0];
    if (choice?.finish_reason === 'length') {
      retries.push('output was cut off at max_tokens');
      continue;
    }
    const parsed = parseJsonOutput(choice?.message?.content ?? '');
    if (!parsed.success) {
      retries.push(parsed.error);
      continue;
    }

    return {
      output: parsed.data,
      meta: {
        provider: 'openrouter',
        model: payload.model ?? model,
        input_tokens: payload.usage?.prompt_tokens ?? 0,
        output_tokens: payload.usage?.completion_tokens ?? 0,
        cost_usd: payload.usage?.cost ?? null,
        latency_ms: Date.now() - started,
        attempts: attempt,
        retry_reasons: retries,
      },
    };
  }
  throw llmError(502, `${model} did not return valid output after ${MAX_ATTEMPTS} attempts: ${lastProblem()}`);
}

function rateLimitWait(headers, attempt) {
  const reset = Number(headers.get('x-ratelimit-reset'));
  if (reset > 0) return Math.max(0, reset - Date.now()) + 250;
  return 10_000 * attempt;
}

function resetNote(headers) {
  const reset = Number(headers.get('x-ratelimit-reset'));
  return reset > 0 ? ` (resets ${new Date(reset).toLocaleString()})` : '';
}

// Pulls the JSON object out of a model reply (tolerating code fences or stray text around it)
// and validates it. Returns a Zod-style { success, data } or { success: false, error }.
export function parseJsonOutput(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end < start) return { success: false, error: 'no JSON object in the reply' };
  let json;
  try {
    json = JSON.parse(text.slice(start, end + 1));
  } catch (error) {
    return { success: false, error: `invalid JSON (${error.message})` };
  }
  const result = GeneratedDescription.safeParse(json);
  return result.success
    ? result
    : { success: false, error: `JSON did not match the schema (${result.error.issues.map((issue) => issue.path.join('.') || issue.message).join(', ')})` };
}

// Template-based stand-in so the whole app works offline or without an API key.
function mockGenerate(product, options) {
  const brand = product.brand ? `${product.brand} ` : '';
  const features = product.features.length ? product.features : ['thoughtful design'];
  const primary = `${product.name} ${product.category}`.toLowerCase();

  return {
    output: {
      title: `${brand}${product.name}`.slice(0, 70),
      short_description: `${brand}${product.name}: ${features[0]}. [mock ${options.tone} copy]`,
      long_description: [
        `The ${product.name} brings ${features.slice(0, 2).join(' and ')} to your everyday ${product.category.toLowerCase()} needs.`,
        `This is placeholder text from the mock provider. Set OPENROUTER_API_KEY or ANTHROPIC_API_KEY to generate real copy.`,
      ].join('\n\n'),
      bullet_points: features.slice(0, 5),
      seo_keywords: [primary, ...product.seed_keywords].slice(0, 8),
      meta_description: `Shop the ${brand}${product.name}. ${features[0]}.`.slice(0, 155),
    },
    meta: { provider: 'mock', model: 'mock', input_tokens: 0, output_tokens: 0, cost_usd: 0, latency_ms: 0 },
  };
}
