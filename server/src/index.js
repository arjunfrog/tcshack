import { createApp } from './app.js';
import { config, isSupabaseConfigured } from './config/env.js';

createApp().listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
  console.log(`LLM provider: ${config.llm.provider}${config.llm.provider !== 'mock' ? ` (${config.llm.model})` : ''}`);
  if (!isSupabaseConfigured()) console.log('Supabase not configured: database features are disabled.');
});
