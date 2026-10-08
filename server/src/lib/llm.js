import { config } from '../config/env.js';
import { GeneratedDescription } from '../schemas/product.js';
import { SYSTEM_PROMPT, buildUserPrompt } from '../prompts/productDescription.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_ATTEMPTS = 3;

// Error from the LLM provider, carrying the HTTP status the API should answer with.
export class LlmError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'LlmError';
    this.status = status;
  }
}

// Returns { output, meta } where output matches GeneratedDescription.
export async function generateDescription(product, options) {
  if (config.llm.provider === 'mock') return mockGenerate(product, options);
  if (config.llm.provider === 'groq') return groqGenerate(product, options);
  throw new Error(`Unknown LLM_PROVIDER "${config.llm.provider}"`);
}

// Groq's JSON mode guarantees valid JSON but not our shape, so the prompt spells
// out the fields and Zod checks them. A malformed reply gets one more try.
const JSON_INSTRUCTIONS = `

Respond with a single JSON object and nothing else, using exactly these keys:
{"title": string, "short_description": string, "long_description": string, "bullet_points": string[], "seo_keywords": string[], "meta_description": string}
Separate paragraphs in long_description with a blank line (\\n\\n).`;

async function groqGenerate(product, options) {
  const started = Date.now();
  const body = {
    model: config.llm.model,
    temperature: config.llm.temperature,
    max_completion_tokens: 2048,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT + JSON_INSTRUCTIONS },
      { role: 'user', content: buildUserPrompt(product, options) },
    ],
  };

  let lastProblem;
  for (let attempt = 0; attempt < 2; attempt++) {
    const data = await groqRequest(body);
    const choice = data.choices?.[0];
    if (choice?.finish_reason === 'length') {
      lastProblem = 'reply was cut off (max tokens)';
      continue;
    }

    let parsed;
    try {
      parsed = GeneratedDescription.safeParse(JSON.parse(choice?.message?.content ?? ''));
    } catch {
      lastProblem = 'reply was not valid JSON';
      continue;
    }
    if (!parsed.success) {
      lastProblem = `reply did not match the expected fields (${parsed.error.issues[0]?.path.join('.')})`;
      continue;
    }

    return {
      output: parsed.data,
      meta: {
        provider: 'groq',
        model: data.model,
        input_tokens: data.usage?.prompt_tokens ?? 0,
        output_tokens: data.usage?.completion_tokens ?? 0,
        latency_ms: Date.now() - started,
      },
    };
  }
  throw new LlmError(`Model output could not be used: ${lastProblem}.`);
}

// POST to Groq, retrying rate limits and server errors with backoff.
async function groqRequest(body) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.llm.groqApiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();

    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < MAX_ATTEMPTS) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 30_000)));
      continue;
    }

    const detail = await res.json().then((j) => j.error?.message).catch(() => undefined);
    if (res.status === 401) throw new LlmError('LLM authentication failed: check GROQ_API_KEY.');
    if (res.status === 429) throw new LlmError('LLM rate limit reached, try again shortly.', 429);
    throw new LlmError(`LLM request failed (${res.status})${detail ? `: ${detail}` : ''}`);
  }
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
        `This is placeholder text from the mock provider. Set GROQ_API_KEY to generate real copy.`,
      ].join('\n\n'),
      bullet_points: features.slice(0, 5),
      seo_keywords: [primary, ...product.seed_keywords].slice(0, 8),
      meta_description: `Shop the ${brand}${product.name}. ${features[0]}.`.slice(0, 155),
    },
    meta: { provider: 'mock', model: 'mock', input_tokens: 0, output_tokens: 0, latency_ms: 0 },
  };
}
