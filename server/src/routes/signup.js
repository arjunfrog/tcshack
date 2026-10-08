import { Router } from 'express';
import { z } from 'zod';
import { requireSupabase } from '../lib/supabase.js';

export const signupRouter = Router();

const SignupRequest = z.object({
  email: z.email('Enter a valid email address').trim().toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters').max(72),
});

// POST /api/signup  { email, password }
// Creates the account already confirmed, so sign-up never waits on a confirmation
// email (whatever the Supabase "Confirm email" setting is). The app logs in right after.
signupRouter.post('/', async (req, res) => {
  const { email, password } = SignupRequest.parse(req.body);
  const { error } = await requireSupabase().auth.admin.createUser({ email, password, email_confirm: true });

  if (error) {
    if (error.code === 'email_exists' || /already (been )?registered|already exists/i.test(error.message)) {
      return res.status(409).json({ error: 'An account with this email already exists. Log in instead.' });
    }
    return res.status(400).json({ error: error.message });
  }
  res.status(201).json({ ok: true });
});
