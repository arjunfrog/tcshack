import { Router } from 'express';
import { dbError, requireSupabase } from '../lib/supabase.js';
import { requireRetailer, requireUser } from '../middleware/auth.js';

export const historyRouter = Router();
historyRouter.use(requireUser, requireRetailer);

// GET /api/history?limit=50  -> the retailer's generated descriptions, newest first,
// each with the product it was written for.
historyRouter.get('/', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const { data, error } = await requireSupabase()
    .from('descriptions')
    .select('*, product:products!inner(id, sku, name, brand, category, subcategory, retailer_id)')
    .eq('product.retailer_id', req.retailer.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw dbError(error);
  res.json({ items: data });
});
