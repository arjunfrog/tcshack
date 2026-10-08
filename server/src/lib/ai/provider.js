// Abstract interface for AI model providers. Concrete implementations (Groq,
// OpenRouter, mock) extend this class and override the methods they support.
//
// The ModelRouter (router.js) picks the right provider for each task type,
// so callers never import a specific provider directly.

/** @enum {string} Task types used by the model router to pick a provider/model. */
export const TaskType = Object.freeze({
  GENERATION: 'generation',       // Final description generation (strongest model)
  EXTRACTION: 'extraction',       // Structured data extraction from text
  CLASSIFICATION: 'classification', // Category/sentiment/intent classification
  EVALUATION: 'evaluation',       // Quality evaluation of generated content
  EMBEDDING: 'embedding',         // Text embeddings for semantic similarity
  REVIEW_ANALYSIS: 'review_analysis', // Review theme/sentiment extraction
  IMAGE_UNDERSTANDING: 'image_understanding', // VLM tasks
});

export class AIProviderError extends Error {
  /** @param {string} message @param {number} [status] @param {boolean} [retryable] */
  constructor(message, status = 502, retryable = false) {
    super(message);
    this.name = 'AIProviderError';
    this.status = status;
    this.retryable = retryable;
  }
}

/**
 * Base class for AI providers. Subclasses must override at least `complete`.
 * @abstract
 */
export class AIProvider {
  /** @param {string} name Human-readable provider name (e.g. 'groq', 'openrouter') */
  constructor(name) {
    if (new.target === AIProvider) throw new Error('AIProvider is abstract');
    this.name = name;
  }

  /**
   * Send a chat completion request.
   * @param {Array<{role: string, content: string}>} messages
   * @param {object} [opts]
   * @param {string} [opts.model] - Override the default model for this provider
   * @param {number} [opts.temperature]
   * @param {number} [opts.maxTokens]
   * @param {boolean} [opts.json] - Request JSON output mode
   * @param {string} [opts.reasoningEffort] - For reasoning models: low|medium|high
   * @returns {Promise<{content: string, usage: {input: number, output: number}, model: string, latencyMs: number}>}
   */
  async complete(messages, opts = {}) {
    throw new Error(`${this.name}: complete() not implemented`);
  }

  /**
   * Send a completion request expecting a JSON response that matches a Zod schema.
   * Retries once on schema validation failure.
   * @param {Array<{role: string, content: string}>} messages
   * @param {import('zod').ZodType} schema - Zod schema to validate and parse the response
   * @param {object} [opts] - Same as complete() opts
   * @returns {Promise<{data: any, usage: {input: number, output: number}, model: string, latencyMs: number}>}
   */
  async extractJson(messages, schema, opts = {}) {
    let lastProblem;
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await this.complete(messages, { ...opts, json: true });
      let parsed;
      try {
        parsed = schema.safeParse(JSON.parse(result.content));
      } catch {
        lastProblem = 'response was not valid JSON';
        continue;
      }
      if (!parsed.success) {
        lastProblem = `response did not match schema (${parsed.error.issues[0]?.path.join('.') || 'root'})`;
        continue;
      }
      return { data: parsed.data, usage: result.usage, model: result.model, latencyMs: result.latencyMs };
    }
    throw new AIProviderError(`${this.name}: ${lastProblem}`);
  }

  /**
   * Generate an embedding vector for the given text.
   * @param {string} text
   * @param {object} [opts]
   * @returns {Promise<{embedding: number[], model: string}>}
   */
  async embed(text, opts = {}) {
    throw new AIProviderError(`${this.name}: embeddings not supported`);
  }

  /**
   * Whether this provider is currently available (has API keys configured, etc.).
   * @returns {boolean}
   */
  isAvailable() {
    return false;
  }
}
