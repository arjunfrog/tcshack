// Supabase reads and writes for review, feedback and metrics (phase 4). Every query is
// scoped to one retailer through the product a description belongs to.

import { dbError, requireSupabase } from '../lib/supabase.js';

function check({ data, error }) {
  if (error) throw dbError(error);
  return data;
}

// Supabase returns at most 1,000 rows per request, so page through bigger results.
const PAGE = 1000;
async function fetchAll(build) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const page = check(await build().range(from, from + PAGE - 1));
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

export const reviewStore = {
  // One description with its product, if it belongs to this retailer.
  async getDescription(retailerId, id) {
    return check(
      await requireSupabase()
        .from('descriptions')
        .select('*, product:products!inner(*)')
        .eq('id', id)
        .eq('product.retailer_id', retailerId)
        .maybeSingle(),
    );
  },

  // Every description of the retailer's products. `columns` keeps the queue query light.
  async listDescriptions(retailerId, columns = '*') {
    return fetchAll(() =>
      requireSupabase()
        .from('descriptions')
        .select(`${columns}, product:products!inner(sku, category, retailer_id)`)
        .eq('product.retailer_id', retailerId)
        .order('id'),
    );
  },

  async getDescriptionsWithProducts(ids) {
    if (!ids.length) return [];
    return check(await requireSupabase().from('descriptions').select('*, product:products(*)').in('id', ids));
  },

  // Ratings on the retailer's descriptions; pass reviewerId for one reviewer's only.
  async listFeedback(retailerId, reviewerId) {
    return fetchAll(() => {
      let query = requireSupabase()
        .from('feedback')
        .select('description_id, relevance, creativity, reviewer_id, description:descriptions!inner(product:products!inner(retailer_id))')
        .eq('description.product.retailer_id', retailerId)
        .order('id');
      if (reviewerId) query = query.eq('reviewer_id', reviewerId);
      return query;
    });
  },

  async updateDescription(id, fields) {
    return check(await requireSupabase().from('descriptions').update(fields).eq('id', id).select().single());
  },

  async insertDescription(row) {
    return check(await requireSupabase().from('descriptions').insert(row).select().single());
  },

  async latestVersion(productId) {
    const rows = check(
      await requireSupabase().from('descriptions').select('version').eq('product_id', productId).order('version', { ascending: false }).limit(1),
    );
    return rows[0]?.version ?? 0;
  },

  // One rating per reviewer per description; rating again replaces it.
  async saveFeedback(row) {
    return check(await requireSupabase().from('feedback').upsert(row, { onConflict: 'description_id,reviewer_id' }).select().single());
  },
};
