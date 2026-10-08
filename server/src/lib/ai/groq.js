// Groq provider — refactored from the original lib/llm.js into the AIProvider
// interface. Preserves all retry/backoff logic, rate-limit handling, and the
// reasoning-model support (gpt-oss reasoning_effort).

import { config } from '../../config/env.js';
import { AIProvider, AIProviderError } from './provider.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_ATTEMPTS = 3;

const isReasoningModel = (model) => model.startsWith('openai/gpt-oss');

export class GroqProvider extends AIProvider {
  constructor() {
    super('groq');
  }

  isAvailable() {
    return Boolean(config.llm.groqApiKey);
  }

  async complete(messages, opts = {}) {
    const model = opts.model || config.llm.model;
    const started = Date.now();

    const body = {
      model,
      temperature: opts.temperature ?? config.llm.temperature,
      max_completion_tokens: opts.maxTokens ?? 8192,
      messages,
      ...(opts.json && { response_format: { type: 'json_object' } }),
      ...(isReasoningModel(model) && { reasoning_effort: opts.reasoningEffort || config.llm.reasoningEffort }),
    };

    const data = await this._request(body);
    const choice = data.choices?.[0];

    if (choice?.finish_reason === 'length') {
      throw new AIProviderError('groq: reply was cut off (max tokens)', 502, true);
    }

    return {
      content: choice?.message?.content ?? '',
      usage: {
        input: data.usage?.prompt_tokens ?? 0,
        output: data.usage?.completion_tokens ?? 0,
      },
      model: data.model,
      latencyMs: Date.now() - started,
    };
  }

  // POST to Groq with retry on 429 and 5xx (preserved from original llm.js).
  async _request(body) {
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
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 1000 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 30_000)));
        continue;
      }

      const detail = await res.json().then((j) => j.error?.message).catch(() => undefined);
      if (res.status === 401) throw new AIProviderError('Groq authentication failed: check GROQ_API_KEY.', 401);
      if (res.status === 429) throw new AIProviderError('Groq rate limit reached, try again shortly.', 429, true);
      throw new AIProviderError(`Groq request failed (${res.status})${detail ? `: ${detail}` : ''}`);
    }
  }
}
