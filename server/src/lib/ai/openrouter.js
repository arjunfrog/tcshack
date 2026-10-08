// OpenRouter provider — gives access to a wide catalogue of models including
// free-tier ones for extraction, classification, and evaluation tasks.
// Uses the OpenAI-compatible chat completions endpoint.

import { config } from '../../config/env.js';
import { AIProvider, AIProviderError } from './provider.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_ATTEMPTS = 3;

export class OpenRouterProvider extends AIProvider {
  constructor() {
    super('openrouter');
  }

  isAvailable() {
    return Boolean(config.openrouter?.apiKey);
  }

  async complete(messages, opts = {}) {
    if (!this.isAvailable()) throw new AIProviderError('OpenRouter API key not configured.', 503);

    const model = opts.model || config.openrouter?.defaultModel || 'google/gemini-2.5-flash';
    const started = Date.now();

    const body = {
      model,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 4096,
      ...(opts.json && { response_format: { type: 'json_object' } }),
    };

    const data = await this._request(body);
    const choice = data.choices?.[0];

    if (choice?.finish_reason === 'length') {
      throw new AIProviderError('OpenRouter: reply was cut off (max tokens)', 502, true);
    }

    return {
      content: choice?.message?.content ?? '',
      usage: {
        input: data.usage?.prompt_tokens ?? 0,
        output: data.usage?.completion_tokens ?? 0,
      },
      model: data.model || model,
      latencyMs: Date.now() - started,
    };
  }

  async _request(body) {
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.openrouter.apiKey}`,
          'content-type': 'application/json',
          'x-title': 'Product Copy Studio',
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
      if (res.status === 401) throw new AIProviderError('OpenRouter authentication failed: check OPENROUTER_API_KEY.', 401);
      if (res.status === 429) throw new AIProviderError('OpenRouter rate limit reached, try again shortly.', 429, true);
      throw new AIProviderError(`OpenRouter request failed (${res.status})${detail ? `: ${detail}` : ''}`);
    }
  }
}
