import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { config } from '../config/env.js';
import { GeneratedDescription } from '../schemas/product.js';
import { SYSTEM_PROMPT, buildUserPrompt } from '../prompts/productDescription.js';

let anthropic;
const getClient = () => (anthropic ??= new Anthropic());

// Returns { output, meta } where output matches GeneratedDescription.
export async function generateDescription(product, options) {
  if (config.llm.provider === 'mock') return mockGenerate(product, options);
  if (config.llm.provider === 'anthropic') return claudeGenerate(product, options);
  throw new Error(`Unknown LLM_PROVIDER "${config.llm.provider}"`);
}

async function claudeGenerate(product, options) {
  const started = Date.now();
  const response = await getClient().beta.messages.parse({
    model: config.llm.model,
    max_tokens: 16000,
    // If a safety classifier declines, the API retries on Anthropic's recommended fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: config.llm.effort,
      format: betaZodOutputFormat(GeneratedDescription),
    },
    // Cached once the system prompt grows past the model's minimum (e.g. with few-shot style examples).
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: buildUserPrompt(product, options) }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('The model declined to describe this product.');
  }
  if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
    throw new Error(`Model output could not be parsed (stop_reason: ${response.stop_reason}).`);
  }

  return {
    output: response.parsed_output,
    meta: {
      provider: 'anthropic',
      model: response.model,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      latency_ms: Date.now() - started,
    },
  };
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
        `This is placeholder text from the mock provider. Set ANTHROPIC_API_KEY to generate real copy.`,
      ].join('\n\n'),
      bullet_points: features.slice(0, 5),
      seo_keywords: [primary, ...product.seed_keywords].slice(0, 8),
      meta_description: `Shop the ${brand}${product.name}. ${features[0]}.`.slice(0, 155),
    },
    meta: { provider: 'mock', model: 'mock', input_tokens: 0, output_tokens: 0, latency_ms: 0 },
  };
}
