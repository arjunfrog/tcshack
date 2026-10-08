// Supabase storage for batch jobs (tables in supabase/migrations/20261009000000_batch_jobs.sql).
// Every read is scoped to the retailer that owns the job.

import { dbError, requireSupabase } from '../lib/supabase.js';

function check({ data, error }) {
  if (error) throw dbError(error);
  return data;
}

const now = () => new Date().toISOString();

export const jobStore = {
  async createJob(retailerId, productIds, options) {
    const supabase = requireSupabase();
    const job = check(
      await supabase
        .from('generation_jobs')
        .insert({ retailer_id: retailerId, options, total: productIds.length, status: 'queued' })
        .select()
        .single(),
    );
    check(await supabase.from('generation_job_items').insert(productIds.map((product_id) => ({ job_id: job.id, product_id }))));
    return job;
  },

  async listJobs(retailerId, limit = 20) {
    return check(
      await requireSupabase().from('generation_jobs').select('*').eq('retailer_id', retailerId).order('created_at', { ascending: false }).limit(limit),
    );
  },

  async getJob(retailerId, jobId) {
    return check(await requireSupabase().from('generation_jobs').select('*').eq('id', jobId).eq('retailer_id', retailerId).maybeSingle());
  },

  // Items with the product they cover and, once generated, the saved description.
  async getItems(jobId, { withDetails = false } = {}) {
    const columns = withDetails
      ? '*, product:products(id, sku, name, category), description:descriptions(*)'
      : '*';
    return check(await requireSupabase().from('generation_job_items').select(columns).eq('job_id', jobId).order('product_id'));
  },

  async getProducts(retailerId, productIds) {
    if (!productIds.length) return [];
    return check(await requireSupabase().from('products').select('*').eq('retailer_id', retailerId).in('id', productIds));
  },

  // Which products a new job should cover: explicit ids, a category, or the whole catalog,
  // optionally only those without any description yet.
  async selectProductIds(retailerId, { productIds, category, missingOnly }) {
    let query = requireSupabase().from('products').select('id, descriptions(id)').eq('retailer_id', retailerId).order('sku');
    if (productIds?.length) query = query.in('id', productIds);
    if (category) query = query.ilike('category', category);
    const rows = check(await query);
    return rows.filter((row) => !missingOnly || row.descriptions.length === 0).map((row) => row.id);
  },

  async updateJob(jobId, fields) {
    check(await requireSupabase().from('generation_jobs').update(fields).eq('id', jobId));
  },

  async updateItem(jobId, productId, fields) {
    check(await requireSupabase().from('generation_job_items').update({ ...fields, updated_at: now() }).eq('job_id', jobId).eq('product_id', productId));
  },
};
