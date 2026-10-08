// Model Router — maps task types to the best available AI provider/model.
//
// Optimized for task complexity and token economy:
// - Extraction & Classification: Fast, lightweight models (Groq llama-3.1-8b / OpenRouter llama-3.2-3b)
// - Review & Theme Analysis: Specialized summarization models (Groq llama-3.3-70b / OpenRouter gemini-2.5-flash)
// - Generation: Strong reasoning & copywriting models (Groq gpt-oss-120b / llama-3.3-70b)
// - Image Understanding: Vision-language models (OpenRouter llama-3.2-11b-vision / gemini-2.5-flash)
// - Embeddings: Vector embedding models (OpenRouter bge-small / mock)

import { config } from '../../config/env.js';
import { TaskType, AIProviderError } from './provider.js';
import { GroqProvider } from './groq.js';
import { OpenRouterProvider } from './openrouter.js';
import { MockProvider } from './mock.js';

// Singleton provider instances.
const groq = new GroqProvider();
const openrouter = new OpenRouterProvider();
const mock = new MockProvider();

// Task-specific model overrides for OpenRouter
const OPENROUTER_TASK_MODELS = {
  [TaskType.GENERATION]: 'google/gemini-2.5-flash',
  [TaskType.EXTRACTION]: 'meta-llama/llama-3.2-3b-instruct',
  [TaskType.CLASSIFICATION]: 'meta-llama/llama-3.2-1b-instruct',
  [TaskType.REVIEW_ANALYSIS]: 'google/gemini-2.5-flash',
  [TaskType.EVALUATION]: 'meta-llama/llama-3.1-8b-instruct',
  [TaskType.IMAGE_UNDERSTANDING]: 'meta-llama/llama-3.2-11b-vision-instruct',
  [TaskType.EMBEDDING]: 'baai/bge-small-en-v1.5',
};

// Task-specific model overrides for Groq (avoids wasting gpt-oss-120b on simple classification)
const GROQ_TASK_MODELS = {
  [TaskType.GENERATION]: config.llm?.model || 'openai/gpt-oss-120b',
  [TaskType.EXTRACTION]: 'llama-3.1-8b-instant',
  [TaskType.CLASSIFICATION]: 'llama-3.1-8b-instant',
  [TaskType.REVIEW_ANALYSIS]: 'llama-3.3-70b-versatile',
  [TaskType.EVALUATION]: 'llama-3.1-8b-instant',
};

/**
 * Resolve provider and model for a given task type, returning active selection and fallback chain.
 * @param {string} taskType
 * @returns {{ provider: import('./provider.js').AIProvider, model?: string, fallback: string }}
 */
function resolveProvider(taskType) {
  // If explicitly configured to mock mode, always use mock provider.
  if (config.llm?.provider === 'mock') {
    return { provider: mock, model: 'mock', fallback: 'none' };
  }

  // Generation: prioritize Groq (strongest copy), then OpenRouter, then mock.
  if (taskType === TaskType.GENERATION) {
    if (groq.isAvailable()) return { provider: groq, model: GROQ_TASK_MODELS[taskType], fallback: openrouter.isAvailable() ? 'openrouter' : 'mock' };
    if (openrouter.isAvailable()) return { provider: openrouter, model: OPENROUTER_TASK_MODELS[taskType], fallback: 'mock' };
    return { provider: mock, model: 'mock', fallback: 'none' };
  }

  // Image understanding: requires VLM (OpenRouter has vision models, Groq currently text only in this config).
  if (taskType === TaskType.IMAGE_UNDERSTANDING) {
    if (openrouter.isAvailable()) return { provider: openrouter, model: OPENROUTER_TASK_MODELS[taskType], fallback: 'mock' };
    return { provider: mock, model: 'mock', fallback: 'none' };
  }

  // Lightweight tasks (Extraction, Classification, Evaluation):
  // Prefer cheap/fast models: Groq llama-3.1-8b-instant if available, else OpenRouter, else mock.
  if (groq.isAvailable()) {
    return { provider: groq, model: GROQ_TASK_MODELS[taskType] || 'llama-3.1-8b-instant', fallback: openrouter.isAvailable() ? 'openrouter' : 'mock' };
  }
  if (openrouter.isAvailable()) {
    return { provider: openrouter, model: OPENROUTER_TASK_MODELS[taskType], fallback: 'mock' };
  }
  return { provider: mock, model: 'mock', fallback: 'none' };
}

/**
 * The central AI interface. All services use this instead of importing providers directly.
 */
export const ai = {
  /**
   * Send a chat completion for a specific task type.
   * @param {string} taskType - One of TaskType values
   * @param {Array<{role: string, content: string}>} messages
   * @param {object} [opts] - Provider options (temperature, maxTokens, json, model override)
   */
  async complete(taskType, messages, opts = {}) {
    const { provider, model } = resolveProvider(taskType);
    return provider.complete(messages, { model, ...opts });
  },

  /**
   * Send a completion expecting JSON output validated against a Zod schema.
   * @param {string} taskType
   * @param {Array<{role: string, content: string}>} messages
   * @param {import('zod').ZodType} schema
   * @param {object} [opts]
   */
  async extractJson(taskType, messages, schema, opts = {}) {
    const { provider, model } = resolveProvider(taskType);
    return provider.extractJson(messages, schema, { model, ...opts });
  },

  /**
   * Generate an embedding for semantic similarity.
   * @param {string} text
   * @param {object} [opts]
   */
  async embed(text, opts = {}) {
    if (openrouter.isAvailable()) return openrouter.embed(text, opts);
    return mock.embed(text, opts);
  },

  /** Get the provider and model that would handle a given task type. */
  resolveProvider(taskType) {
    const { provider, model, fallback } = resolveProvider(taskType);
    return { name: provider.name, model: model || 'default', available: provider.isAvailable(), fallback };
  },

  /** Returns the full routing matrix across all task types. */
  getRoutingTable() {
    return Object.values(TaskType).map((task) => {
      const resolved = resolveProvider(task);
      return {
        task,
        provider: resolved.provider.name,
        model: resolved.model || 'default',
        fallback: resolved.fallback,
      };
    });
  },

  /** Summary of provider availability for health check. */
  status() {
    return {
      groq: { available: groq.isAvailable(), model: config.llm.model },
      openrouter: { available: openrouter.isAvailable(), defaultModel: config.openrouter?.defaultModel || 'google/gemini-2.5-flash' },
      mock: { available: true },
      routing: {
        generation: ai.resolveProvider(TaskType.GENERATION),
        extraction: ai.resolveProvider(TaskType.EXTRACTION),
        classification: ai.resolveProvider(TaskType.CLASSIFICATION),
        review_analysis: ai.resolveProvider(TaskType.REVIEW_ANALYSIS),
        evaluation: ai.resolveProvider(TaskType.EVALUATION),
        image_understanding: ai.resolveProvider(TaskType.IMAGE_UNDERSTANDING),
        embedding: { name: openrouter.isAvailable() ? 'openrouter' : 'mock', model: 'baai/bge-small-en-v1.5' },
      },
    };
  },
};
