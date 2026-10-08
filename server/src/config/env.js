// Central place for configuration. Everything else imports from here instead of
// reading process.env directly, so missing settings show up in one spot.

// Load server/.env when present. Variables already set in the shell win. Test runs
// (node --test sets NODE_TEST_CONTEXT) skip it, so local keys never leak into tests.
if (!process.env.NODE_TEST_CONTEXT) {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file: rely on the real environment.
  }
}

const num = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const groqApiKey = process.env.GROQ_API_KEY || '';
const openrouterApiKey = process.env.OPENROUTER_API_KEY || '';

// Explicit LLM_PROVIDER wins; otherwise use whichever key is set (Groq first), else the offline mock.
const defaultProvider = groqApiKey ? 'groq' : openrouterApiKey ? 'openrouter' : 'mock';

export const config = {
  port: num(process.env.PORT, 4000),
  // Serve client/dist from this server (production, or SERVE_CLIENT=true to try it locally).
  serveClient: process.env.NODE_ENV === 'production' || process.env.SERVE_CLIENT === 'true',
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
    provider: process.env.LLM_PROVIDER || defaultProvider,
    concurrency: num(process.env.GENERATION_CONCURRENCY, 3),
    // One follow-up request to fix what the quality checks flag (overlong title or meta,
    // unsupported claims, clichés). LLM_REFINE=false saves that request.
    refine: process.env.LLM_REFINE !== 'false',
  },

  // Both providers speak the OpenAI chat completions API; lib/llm.js handles their differences.
  groq: {
    apiKey: groqApiKey,
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    // Only sent to reasoning models (gpt-oss): low | medium | high. Medium scored best in the
    // eval (data/eval/report-v3-groq-medium.md); a reply that runs out of tokens retries at low.
    effort: process.env.GROQ_REASONING_EFFORT || 'medium',
    temperature: Number(process.env.GROQ_TEMPERATURE ?? 0.7),
    baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
  },

  openrouter: {
    apiKey: openrouterApiKey,
    model: process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free',
    // Optional reasoning effort (low | medium | high) for models that think; empty uses the model default.
    effort: process.env.OPENROUTER_REASONING_EFFORT || undefined,
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  },

  // Anakin Wire (market data enrichment). Not wired into generation yet.
  anakin: {
    apiKey: process.env.ANAKIN_API_KEY || '',
  },
};

// The model name to report for a provider (health check, eval reports).
export const modelFor = (provider) => config[provider]?.model ?? 'mock';
export const activeModel = () => modelFor(config.llm.provider);

export const isSupabaseConfigured = () =>
  Boolean(config.supabase.url && config.supabase.serviceRoleKey);
