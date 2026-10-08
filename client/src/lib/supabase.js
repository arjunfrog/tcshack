import { createClient } from '@supabase/supabase-js';

// Browser client for Supabase Auth only, using the publishable key. All data access
// goes through the Express API, which checks the user's access token.
// Vite reads VITE_* variables from server/.env (see envDir in vite.config.js).
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isAuthConfigured = Boolean(url && key);
export const supabase = isAuthConfigured ? createClient(url, key) : null;
