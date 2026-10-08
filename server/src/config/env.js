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

const groqApiKey = process.env.GROQ_API_KEY || '';

export const config = {
  port: num(process.env.PORT, 4000),
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  supabase: {
    url: process.env.SUPABASE_URL || '',
    // Accepts the new "secret" key name as well as the legacy service role name.
    serviceRoleKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },

  llm: {
    provider: process.env.LLM_PROVIDER || (groqApiKey ? 'groq' : 'mock'),
    groqApiKey,
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    // Only sent to reasoning models (gpt-oss): low | medium | high.
    reasoningEffort: process.env.GROQ_REASONING_EFFORT || 'low',
    temperature: Number(process.env.GROQ_TEMPERATURE ?? 0.7),
    concurrency: num(process.env.GENERATION_CONCURRENCY, 3),
  },

  // OpenRouter — access to a wide catalogue of models including free-tier.
  // Used by the model router for lightweight tasks (extraction, classification).
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    defaultModel: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
  },

  // Anakin Wire (market data enrichment). Not wired into generation yet.
  anakin: {
    apiKey: process.env.ANAKIN_API_KEY || '',
  },
};

export const isSupabaseConfigured = () =>
  Boolean(config.supabase.url && config.supabase.serviceRoleKey);
