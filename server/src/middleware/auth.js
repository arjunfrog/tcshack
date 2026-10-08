import { requireSupabase } from '../lib/supabase.js';

const httpError = (status, message) => Object.assign(new Error(message), { status });

// Verifies the Supabase access token the React app sends as "Authorization: Bearer <token>".
export async function requireUser(req, res, next) {
  const supabase = requireSupabase();
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw httpError(401, 'Please log in.');

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw httpError(401, 'Your session has expired. Please log in again.');
  req.user = data.user;
  next();
}

// Loads the logged-in user's retailer profile; routes behind this need onboarding done.
export async function requireRetailer(req, res, next) {
  const { data, error } = await requireSupabase()
    .from('retailers')
    .select('*')
    .eq('owner_id', req.user.id)
    .maybeSingle();
  if (error) throw httpError(500, `Database error: ${error.message}`);
  if (!data) throw httpError(403, 'Finish onboarding first.');
  req.retailer = data;
  next();
}
