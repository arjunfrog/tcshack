import { createClient } from '@supabase/supabase-js';
import { config, isSupabaseConfigured } from '../config/env.js';

export { isSupabaseConfigured };

// Server-side client using the secret (service role) key. It bypasses Row Level Security,
// so it must only ever run here, never in the React app.
export const supabase = isSupabaseConfigured()
  ? createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    const error = new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY in server/.env.',
    );
    error.status = 503;
    throw error;
  }
  return supabase;
}

// Cheap connectivity check used by /api/health. Selects a row rather than a HEAD
// count, because HEAD requests come back without an error message (e.g. missing tables).
export async function pingDatabase() {
  if (!supabase) return 'not_configured';
  const { error } = await supabase.from('products').select('id').limit(1);
  if (!error) return 'connected';
  if (error.code === 'PGRST205' || /schema cache|does not exist/.test(error.message)) {
    return 'error: tables missing, run the SQL migration';
  }
  return `error: ${error.message || 'unknown'}`;
}
