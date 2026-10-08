import { Router } from 'express';
import { dbError, requireSupabase } from '../lib/supabase.js';
import { requireUser } from '../middleware/auth.js';
import { CHANNELS, PRICE_POSITIONING, RetailerInput } from '../schemas/retailer.js';

export const meRouter = Router();
meRouter.use(requireUser);

const check = ({ data, error }) => {
  if (error) throw dbError(error);
  return data;
};

// GET /api/me  -> { user, retailer | null, choices }  (retailer null = onboarding not done)
meRouter.get('/', async (req, res) => {
  const retailer = check(
    await requireSupabase().from('retailers').select('*').eq('owner_id', req.user.id).maybeSingle(),
  );
  res.json({
    user: { id: req.user.id, email: req.user.email },
    retailer,
    choices: { channels: CHANNELS, price_positioning: PRICE_POSITIONING },
  });
});

// PUT /api/me/retailer  -> creates or updates the user's retailer profile
meRouter.put('/retailer', async (req, res) => {
  const input = RetailerInput.parse(req.body);
  // A new seller has no existing channels, whatever the form sent.
  if (input.seller_type === 'new') input.channels = [];

  const retailer = check(
    await requireSupabase()
      .from('retailers')
      .upsert({ ...input, owner_id: req.user.id }, { onConflict: 'owner_id' })
      .select()
      .single(),
  );
  res.json({ retailer });
});
