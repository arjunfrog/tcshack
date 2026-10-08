import { z } from 'zod';
import { config } from '../config/env.js';
import { GeneratedDescription } from '../schemas/product.js';
import { JSON_OUTPUT_INSTRUCTIONS, SYSTEM_PROMPT, buildUserPrompt } from '../prompts/productDescription.js';

// Error from the LLM provider, carrying the HTTP status the API should answer with.
export class LlmError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'LlmError';
    this.status = status;
  }
}

// Returns { output, meta } where output matches GeneratedDescription.
// `settings` overrides the configured provider, model or effort for one call (used by the eval script),
// and `settings.context` adds the retailer's brand profile and market insights to the prompt.
export async function generateDescription(product, options, settings = {}) {
  const provider = settings.provider ?? config.llm.provider;
  if (provider === 'mock') return mockGenerate(product, options);
  if (PROVIDERS[provider]) return chatGenerate(provider, product, options, settings);
  throw new Error(`Unknown LLM_PROVIDER "${provider}"`);
}

const OUTPUT_SCHEMA = (() => {
  const { $schema, ...schema } = z.toJSONSchema(GeneratedDescription);
  return schema;
})();

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
    // JSON mode guarantees valid JSON but not our shape, so the prompt spells out the fields and Zod checks them.
    body: ({ model, effort, temperature }, messages) => ({
      temperature,
      // Reasoning models spend part of this budget thinking before they answer (replies use
      // 600-2,500 tokens). Groq's free tier rejects a request (413) when prompt + this cap
      // exceeds its 8K tokens-per-minute limit, so the cap shrinks as the prompt grows
      // (retailer generations add a brand profile and market insights).
      max_completion_tokens: groqOutputCap(messages),
      response_format: { type: 'json_object' },
      ...(model.startsWith('openai/gpt-oss') && effort && { reasoning_effort: effort }),
    }),
  },
  openrouter: {
    keyName: 'OPENROUTER_API_KEY',
    settings: () => config.openrouter,
    // Not every free model supports response_format; those ignore it and follow the prompt instead.
    body: ({ effort }) => ({
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'product_description', strict: true, schema: OUTPUT_SCHEMA },
      },
      // Reasoning tokens count toward max_tokens on thinking models (often 10K+), so leave plenty of room.
      max_tokens: 32000,
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

async function chatGenerate(providerId, product, options, overrides) {
  const provider = PROVIDERS[providerId];
  const settings = { ...provider.settings() };
  if (overrides.model) settings.model = overrides.model;
  if (overrides.effort) settings.effort = overrides.effort;
  if (!settings.apiKey) {
    throw new LlmError(`${provider.keyName} is not set. Add it to server/.env or set LLM_PROVIDER=mock.`, 503);
  }

  const messages = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n${JSON_OUTPUT_INSTRUCTIONS}` },
    { role: 'user', content: buildUserPrompt(product, options, overrides.context) },
  ];
  const body = {
    model: settings.model,
    messages,
    ...provider.body(settings, messages),
  };

  const started = Date.now();
  const retries = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(`${settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${settings.apiKey}`, 'content-type': 'application/json', ...provider.headers },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));
    const detail = payload.error?.message;

    if (res.status === 429) {
      const waitMs = rateLimitWait(res.headers, attempt);
      if (waitMs > MAX_RATE_LIMIT_WAIT_MS || attempt === MAX_ATTEMPTS) {
        throw new LlmError(`LLM rate limit reached: ${detail ?? 'too many requests'}${resetNote(waitMs)}`, 429);
      }
      await sleep(waitMs);
      continue;
    }
    if (res.status === 401) throw new LlmError(`LLM authentication failed: check ${provider.keyName}.`);
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
        provider: providerId,
        model: payload.model ?? settings.model,
        input_tokens: payload.usage?.prompt_tokens ?? 0,
        output_tokens: payload.usage?.completion_tokens ?? 0,
        cost_usd: payload.usage?.cost ?? null,
        latency_ms: Date.now() - started,
        attempts: attempt,
        retry_reasons: retries,
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
        `This is placeholder text from the mock provider. Set GROQ_API_KEY or OPENROUTER_API_KEY to generate real copy.`,
      ].join('\n\n'),
      bullet_points: features.slice(0, 5),
      seo_keywords: [primary, ...product.seed_keywords].slice(0, 8),
      meta_description: `Shop the ${brand}${product.name}. ${features[0]}.`.slice(0, 155),
    },
    meta: { provider: 'mock', model: 'mock', input_tokens: 0, output_tokens: 0, cost_usd: 0, latency_ms: 0 },
  };
}
