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
    provider: process.env.LLM_PROVIDER || (anthropicApiKey ? 'anthropic' : 'mock'),
    model: process.env.ANTHROPIC_MODEL || 'claude-opus-5-5',
    effort: process.env.ANTHROPIC_EFFORT || 'medium',
    concurrency: num(process.env.GENERATION_CONCURRENCY, 5),
  },
};

export const isSupabaseConfigured = () =>
  Boolean(config.supabase.url && config.supabase.serviceRoleKey);
