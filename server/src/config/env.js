// Central place for configuration. Everything else imports from here instead of
// reading process.env directly, so missing settings show up in one spot.

// Load server/.env when present. Variables already set in the shell win.
try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the real environment.
}

const num = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';
const openrouterApiKey = process.env.OPENROUTER_API_KEY || '';

// Explicit LLM_PROVIDER wins; otherwise use whichever key is set, else the offline mock.
const defaultProvider = anthropicApiKey ? 'anthropic' : openrouterApiKey ? 'openrouter' : 'mock';

export const config = {
  port: num(process.env.PORT, 4000),
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },

  llm: {
    provider: process.env.LLM_PROVIDER || defaultProvider,
    model: process.env.ANTHROPIC_MODEL || 'claude-opus-5-5',
    effort: process.env.ANTHROPIC_EFFORT || 'medium',
    concurrency: num(process.env.GENERATION_CONCURRENCY, 5),
  },

  openrouter: {
    apiKey: openrouterApiKey,
    model: process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free',
    // Optional reasoning effort (low | medium | high) for models that think; empty uses the model default.
    effort: process.env.OPENROUTER_REASONING_EFFORT || undefined,
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  },
};

// The model name to report for the active provider (health check, eval reports).
export const activeModel = () =>
  ({ anthropic: config.llm.model, openrouter: config.openrouter.model })[config.llm.provider] ?? 'mock';

export const isSupabaseConfigured = () =>
  Boolean(config.supabase.url && config.supabase.serviceRoleKey);
