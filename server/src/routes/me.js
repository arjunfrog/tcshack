import { Router } from 'express';
import { requireSupabase } from '../lib/supabase.js';
import { requireUser } from '../middleware/auth.js';
import { CHANNELS, PRICE_POSITIONING, RetailerInput } from '../schemas/retailer.js';
import { analyzeRetailerCatalog, getRetailerContentProfile } from '../services/retailerIntelligence.js';
import { demoStore } from '../lib/demoStore.js';

export const meRouter = Router();
meRouter.use(requireUser);

const check = ({ data, error }) => {
  if (error) throw Object.assign(new Error(`Database error: ${error.message}`), { status: 500 });
  return data;
};

// GET /api/me  -> { user, retailer | null, choices }  (retailer null = onboarding not done)
meRouter.get('/', async (req, res) => {
  if (req.user?.id === 'demo-user-123') {
    const retailer = demoStore.getRetailer();
    const profile = demoStore.getProfile();
    return res.json({
      user: { id: req.user.id, email: req.user.email },
      retailer,
      profile,
      choices: { channels: CHANNELS, price_positioning: PRICE_POSITIONING },
    });
  }

  const retailer = check(
    await requireSupabase().from('retailers').select('*').eq('owner_id', req.user.id).maybeSingle(),
  );

  let profile = null;
  if (retailer) {
    profile = await getRetailerContentProfile(retailer.id);
  }

  res.json({
    user: { id: req.user.id, email: req.user.email },
    retailer,
    profile,
    choices: { channels: CHANNELS, price_positioning: PRICE_POSITIONING },
  });
});

// PUT /api/me/retailer  -> creates or updates the user's retailer profile
meRouter.put('/retailer', async (req, res) => {
  const input = RetailerInput.parse(req.body);
  // A new seller has no existing channels, whatever the form sent.
  if (input.seller_type === 'new') input.channels = [];

  if (req.user?.id === 'demo-user-123') {
    const retailer = await demoStore.setRetailer(input);
    const profile = demoStore.getProfile();
    return res.json({ retailer, profile });
  }

  const retailer = check(
    await requireSupabase()
      .from('retailers')
      .upsert({ ...input, owner_id: req.user.id }, { onConflict: 'owner_id' })
      .select()
      .single(),
  );

  // Generate initial content profile from onboarding
  const profile = await analyzeRetailerCatalog(retailer, []);

  res.json({ retailer, profile });
});

// GET /api/me/retailer/profile -> gets retailer content writing patterns profile
meRouter.get('/retailer/profile', async (req, res) => {
  if (req.user?.id === 'demo-user-123') {
    return res.json({ profile: demoStore.getProfile() });
  }

  const retailer = check(
    await requireSupabase().from('retailers').select('*').eq('owner_id', req.user.id).maybeSingle(),
  );
  if (!retailer) {
    return res.status(404).json({ error: 'Retailer profile not found' });
  }

  const profile = await getRetailerContentProfile(retailer.id);
  res.json({ profile });
});

// POST /api/me/retailer/analyze -> analyzes uploaded catalog to update writing patterns
meRouter.post('/retailer/analyze', async (req, res) => {
  if (req.user?.id === 'demo-user-123') {
    const retailer = demoStore.getRetailer();
    if (!retailer) return res.status(404).json({ error: 'Retailer profile not found' });
    const profile = await analyzeRetailerCatalog(retailer, demoStore.listProducts().slice(0, 20));
    demoStore.setProfile(profile);
    return res.json({ profile });
  }

  const retailer = check(
    await requireSupabase().from('retailers').select('*').eq('owner_id', req.user.id).maybeSingle(),
  );
  if (!retailer) {
    return res.status(404).json({ error: 'Retailer profile not found' });
  }

  const { data: products } = await requireSupabase()
    .from('products')
    .select('id, name, features, attributes')
    .eq('retailer_id', retailer.id)
    .limit(50);

  const profile = await analyzeRetailerCatalog(retailer, products || []);
  res.json({ profile });
});
