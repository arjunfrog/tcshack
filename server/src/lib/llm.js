import { z } from 'zod';
import { config } from '../config/env.js';
import { GeneratedDescription } from '../schemas/product.js';
import {
  JSON_OUTPUT_INSTRUCTIONS, REFINE_SYSTEM_PROMPT, SYSTEM_PROMPT, buildRefinePrompt, buildUserPrompt,
} from '../prompts/productDescription.js';

// Error from the LLM provider, carrying the HTTP status the API should answer with.
export class LlmError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'LlmError';
    this.status = status;
  }
}

const providerFor = (settings) => settings.provider ?? config.llm.provider;

// Returns { output, meta } where output matches GeneratedDescription.
// `settings` overrides the configured provider, model or effort for one call (used by the eval script),
// and `settings.context` adds market insights (and a retailer row) to the prompt.
export async function generateDescription(product, options, settings = {}) {
  const provider = providerFor(settings);
  if (provider === 'mock') return mockGenerate(product, options);
  if (!PROVIDERS[provider]) throw new Error(`Unknown LLM_PROVIDER "${provider}"`);
  return chatJson(provider, settings, {
    messages: [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\n${JSON_OUTPUT_INSTRUCTIONS}` },
      { role: 'user', content: buildUserPrompt(product, options, settings.context) },
    ],
    schema: GeneratedDescription,
    jsonSchema: OUTPUT_SCHEMA,
  });
}

// Asks the model to fix specific problems in generated copy with minimal changes (one short,
// low-effort request). Returns { changes, meta } with only the fields it changed, or null
// for the mock provider.
export async function refineDescription(product, output, problems, settings = {}) {
  const provider = providerFor(settings);
  if (provider === 'mock' || !PROVIDERS[provider]) return null;
  return chatJson(provider, { ...settings, effort: 'low' }, {
    messages: [
      { role: 'system', content: REFINE_SYSTEM_PROMPT },
      { role: 'user', content: buildRefinePrompt(product, output, problems) },
    ],
    schema: GeneratedDescription.partial(),
  }).then(({ output: changes, meta }) => ({ changes, meta }));
}

const OUTPUT_SCHEMA = (() => {
  const { $schema, ...schema } = z.toJSONSchema(GeneratedDescription);
  return schema;
})();

// JSON schema output where the request has one, plain JSON mode otherwise.
const responseFormat = (jsonSchema) =>
  jsonSchema ? { type: 'json_schema', json_schema: { name: 'product_description', strict: true, schema: jsonSchema } } : { type: 'json_object' };

// Output cap for Groq: at most 4,000 tokens, and never more than the free tier's 8K
// tokens-per-minute budget minus the prompt. Prompt tokens are estimated generously
// (4 characters per token, which matches the 4,000 cap that already fits a plain prompt)
// plus a safety margin, so the total stays under the limit.
const GROQ_TPM_LIMIT = 8000;
export function groqOutputCap(messages) {
  const promptTokens = Math.ceil(messages.reduce((sum, message) => sum + message.content.length, 0) / 4);
  return Math.max(1500, Math.min(4000, GROQ_TPM_LIMIT - promptTokens - 200));
}

// Groq and OpenRouter both speak the OpenAI chat completions API. These are the parts that differ.
const PROVIDERS = {
  groq: {
    keyName: 'GROQ_API_KEY',
    settings: () => config.groq,
    // Groq's free tier rejects a request (413) when prompt + this cap exceeds its 8K
    // tokens-per-minute limit, so the cap shrinks as the prompt grows (a brand profile and
    // market insights add to it). A 413 or a cut-off reply still retries smaller and at low effort.
    maxTokens: (messages) => groqOutputCap(messages),
    // JSON mode guarantees valid JSON but not our shape, so the prompt spells out the fields and Zod checks them.
    body: ({ model, effort, temperature, maxTokens }) => ({
      temperature,
      max_completion_tokens: maxTokens,
      response_format: { type: 'json_object' },
      ...(model.startsWith('openai/gpt-oss') && effort && { reasoning_effort: effort }),
    }),
  },
  openrouter: {
    keyName: 'OPENROUTER_API_KEY',
    settings: () => config.openrouter,
    // Reasoning tokens count toward max_tokens on thinking models (often 10K+), so leave plenty of room.
    maxTokens: () => 32000,
    // Not every free model supports response_format; those ignore it and follow the prompt instead.
    body: ({ effort, maxTokens }, jsonSchema) => ({
      response_format: responseFormat(jsonSchema),
      max_tokens: maxTokens,
      reasoning: { ...(effort && { effort }), exclude: true },
    }),
    headers: { 'x-title': 'Product Copy Studio' },
  },
};

const MAX_ATTEMPTS = 3;
// Free tiers allow a fixed number of requests (or tokens) per minute. Wait for the window
// to reset when it is close; a reset further away means a daily quota is used up, so fail fast.
const MAX_RATE_LIMIT_WAIT_MS = 65_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// One JSON-returning chat request with retries: rate limits are waited out, upstream errors
// and invalid replies are retried, and a reply cut off at the token cap (or a request too
// large for the tier) is retried at low reasoning effort, which thinks for fewer tokens.
async function chatJson(providerId, overrides, { messages, schema, jsonSchema }) {
  const provider = PROVIDERS[providerId];
  const settings = { ...provider.settings(), maxTokens: provider.maxTokens(messages) };
  if (overrides.model) settings.model = overrides.model;
  if (overrides.effort) settings.effort = overrides.effort;
  if (!settings.apiKey) {
    throw new LlmError(`${provider.keyName} is not set. Add it to server/.env or set LLM_PROVIDER=mock.`, 503);
  }

  const started = Date.now();
  const retries = [];
  const usage = { input: 0, output: 0, cost: 0, costKnown: true };
  const thinkLess = () => {
    if (settings.effort && settings.effort !== 'low') settings.effort = 'low';
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(`${settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${settings.apiKey}`, 'content-type': 'application/json', ...provider.headers },
      body: JSON.stringify({ model: settings.model, messages, ...provider.body(settings, jsonSchema) }),
    });
    const payload = await res.json().catch(() => ({}));
    const detail = payload.error?.message;
    if (payload.usage) {
      usage.input += payload.usage.prompt_tokens ?? 0;
      usage.output += payload.usage.completion_tokens ?? 0;
      if (payload.usage.cost === undefined) usage.costKnown = false;
      else usage.cost += payload.usage.cost;
    }

    if (res.status === 429) {
      const waitMs = rateLimitWait(res.headers, attempt);
      if (waitMs > MAX_RATE_LIMIT_WAIT_MS || attempt === MAX_ATTEMPTS) {
        throw new LlmError(`LLM rate limit reached: ${detail ?? 'too many requests'}${resetNote(waitMs)}`, 429);
      }
      await sleep(waitMs);
      continue;
    }
    if (res.status === 401) throw new LlmError(`LLM authentication failed: check ${provider.keyName}.`);
    if (res.status === 413 && attempt < MAX_ATTEMPTS) {
      // Prompt + token cap is over the tier's per-minute limit: ask for fewer tokens.
      retries.push(`request too large (${detail ?? '413'})`);
      settings.maxTokens = Math.round(settings.maxTokens * 0.75);
      thinkLess();
      continue;
    }
    if (!res.ok || payload.error) {
      const message = `LLM request failed (${res.status})${detail ? `: ${detail}` : ''}`;
      // Retry upstream hiccups (provider down or overloaded); report everything else straight away.
      if (res.status >= 500 && attempt < MAX_ATTEMPTS) {
        retries.push(message);
        await sleep(2000 * attempt);
        continue;
      }
      throw new LlmError(message, res.status >= 500 || res.ok ? 502 : res.status);
    }

    const choice = payload.choices?.[0];
    if (choice?.finish_reason === 'length') {
      retries.push('reply was cut off at the token limit');
      thinkLess();
      continue;
    }
    const parsed = parseJsonOutput(choice?.message?.content ?? '', schema);
    if (!parsed.success) {
      retries.push(parsed.error);
      continue;
    }

    return {
      output: parsed.data,
      meta: {
        provider: providerId,
        model: payload.model ?? settings.model,
        // Every attempt's tokens: retries cost quota too.
        input_tokens: usage.input,
        output_tokens: usage.output,
        cost_usd: usage.costKnown ? usage.cost : null,
        latency_ms: Date.now() - started,
        attempts: attempt,
        retry_reasons: retries,
        ...(settings.effort && { effort: settings.effort }),
      },
    };
  }
  throw new LlmError(`${settings.model} did not return valid output after ${MAX_ATTEMPTS} attempts: ${retries.at(-1)}`);
}

// Groq sends Retry-After (seconds); OpenRouter sends X-RateLimit-Reset (epoch milliseconds).
function rateLimitWait(headers, attempt) {
  const retryAfter = Number(headers.get('retry-after'));
  if (retryAfter > 0) return retryAfter * 1000;
  const reset = Number(headers.get('x-ratelimit-reset'));
  if (reset > 0) return Math.max(0, reset - Date.now()) + 250;
  return 10_000 * attempt;
}

const resetNote = (waitMs) => (waitMs > MAX_RATE_LIMIT_WAIT_MS ? ` (resets ${new Date(Date.now() + waitMs).toLocaleString()})` : '');

// Pulls the JSON object out of a model reply (tolerating code fences or stray text around it)
// and validates it. Returns a Zod-style { success, data } or { success: false, error }.
export function parseJsonOutput(text, schema = GeneratedDescription) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end < start) return { success: false, error: 'no JSON object in the reply' };
  let json;
  try {
    json = JSON.parse(text.slice(start, end + 1));
  } catch (error) {
    return { success: false, error: `invalid JSON (${error.message})` };
  }
  const result = schema.safeParse(json);
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
        `This is placeholder text from the mock provider. Set GROQ_API_KEY or OPENROUTER_API_KEY to generate real copy.`,
      ].join('\n\n'),
      bullet_points: features.slice(0, 5),
      seo_keywords: [primary, ...product.seed_keywords].slice(0, 8),
      meta_description: `Shop the ${brand}${product.name}. ${features[0]}.`.slice(0, 155),
    },
    meta: { provider: 'mock', model: 'mock', input_tokens: 0, output_tokens: 0, cost_usd: 0, latency_ms: 0 },
  };
}
