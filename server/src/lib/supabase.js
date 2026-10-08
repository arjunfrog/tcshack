import { createClient } from '@supabase/supabase-js';
import { config, isSupabaseConfigured } from '../config/env.js';

// Server-side client using the service role key. It bypasses Row Level Security,
// so it must only ever run here, never in the React app.
export const supabase = isSupabaseConfigured()
  ? createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    const error = new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env.',
    );
    error.status = 503;
    throw error;
  }
  return supabase;
}

// Cheap connectivity check used by /api/health.
export async function pingDatabase() {
  if (!supabase) return 'not_configured';
  const { error } = await supabase.from('products').select('id', { head: true, count: 'exact' });
  return error ? `error: ${error.message}` : 'connected';
}
