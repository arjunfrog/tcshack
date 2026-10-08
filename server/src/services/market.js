import { isAnakinConfigured, runAction } from '../lib/anakin.js';
import { requireSupabase, supabase } from '../lib/supabase.js';

// Market insights for a product type, from Anakin: what shoppers type into Amazon's search
// box, and what the top-ranking Flipkart listings for that query look like. Fetched once
// per product type (about 3 credits) and cached in the market_insights table for a week,
// so a 60-product batch spends credits only on the types it hasn't seen.

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const inflight = new Map(); // query key -> promise, so a batch fetches each type only once

const STOPWORDS = new Set(
  ('a an and are as at be by for from in into is it of on or the to with without your you this that ' +
    'new pack set combo free size buy online best price india men women unisex kids').split(' '),
);

// The product type to research: "Air Fryer" beats "Home & Kitchen".
export const marketQuery = (product) => (product.subcategory || product.category).trim();
const keyFor = (query) => query.toLowerCase().replace(/\s+/g, ' ');

// Words and two-word phrases that recur across top listing titles, most common first.
export function titleTerms(titles, query) {
  const queryWords = new Set(keyFor(query).split(' '));
  const counts = new Map();
  for (const title of titles) {
    const words = title.toLowerCase().replace(/[^a-z0-9.%\s-]/g, ' ').split(/\s+/).filter(Boolean);
    const seen = new Set();
    // Skip the first word: in marketplace titles it is almost always the brand.
    for (let i = 1; i < words.length; i++) {
      const unigram = words[i];
      const bigram = i + 1 < words.length ? `${words[i]} ${words[i + 1]}` : null;
      for (const term of [unigram, bigram]) {
        if (!term || seen.has(term)) continue;
        const parts = term.split(' ');
        if (parts.some((part) => STOPWORDS.has(part) || part.length < 2) || parts.every((part) => queryWords.has(part))) continue;
        seen.add(term);
        counts.set(term, (counts.get(term) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || b[0].split(' ').length - a[0].split(' ').length)
    .map(([term]) => term)
    .filter((term, i, all) => !all.slice(0, i).some((earlier) => earlier.includes(term))) // drop "rapid" when "rapid air" is kept
    .slice(0, 10);
}

// Turns raw Anakin results into the compact insights the prompt and UI use.
export function summarize(query, { suggestions, flipkart }) {
  const searchTerms = [...new Set((suggestions?.suggestions ?? []).map((item) => item.text?.trim().toLowerCase()).filter(Boolean))]
    .filter((term) => term !== keyFor(query))
    .slice(0, 10);
  const listings = (flipkart?.products ?? [])
    .filter((item) => item.title)
    .map((item) => ({ title: item.title.slice(0, 140), rating: item.rating ?? null, reviews: item.review_count ?? null }));

  return {
    query,
    search_terms: searchTerms,
    title_terms: titleTerms(listings.map((item) => item.title), query),
    top_listings: listings.slice(0, 5),
    sources: [suggestions && 'amazon_search_suggestions', flipkart && 'flipkart_search'].filter(Boolean),
  };
}

// `progress(stage, status, detail)` reports each source as it starts and finishes (see
// services/descriptions.js); it's a no-op unless a caller is streaming progress.
async function fetchInsights(query, progress) {
  const track = (source, promise, count) => {
    progress('market_source', 'start', { source });
    return promise.then(
      (value) => { progress('market_source', 'done', { source, count: count(value) }); return value; },
      (error) => { progress('market_source', 'failed', { source, message: error.message }); throw error; },
    );
  };
  const [suggestions, flipkart] = await Promise.allSettled([
    track('amazon_search_suggestions', runAction('am_search_suggestions', { query, limit: 12 }, { timeoutMs: 30_000 }),
      (value) => value?.suggestions?.length ?? 0),
    track('flipkart_search', runAction('fk_search_products', { query, limit: 10 }, { timeoutMs: 75_000 }),
      (value) => value?.products?.length ?? 0),
  ]);
  for (const result of [suggestions, flipkart]) {
    if (result.status === 'rejected') console.warn(`Market insights for "${query}": ${result.reason.message}`);
  }
  const insights = summarize(query, {
    suggestions: suggestions.status === 'fulfilled' ? suggestions.value : null,
    flipkart: flipkart.status === 'fulfilled' ? flipkart.value : null,
  });
  return insights.sources.length ? insights : null;
}

// Cached insights for the product's type, fetching them when missing or stale.
// Returns null when Anakin isn't configured or has nothing; generation then goes ahead without.
export async function getMarketInsights(product, progress = () => {}) {
  const query = marketQuery(product);
  if (!isAnakinConfigured() || !supabase) {
    progress('market', 'skipped', { query, reason: 'Anakin is not configured' });
    return null;
  }
  const key = keyFor(query);
  progress('market', 'start', { query });

  const { data: cached } = await supabase.from('market_insights').select('insights, fetched_at').eq('query_key', key).maybeSingle();
  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < MAX_AGE_MS) {
    progress('market', 'done', { query, cached: true, fetched_at: cached.fetched_at, insights: cached.insights });
    return cached.insights;
  }

  if (inflight.has(key)) {
    progress('market', 'waiting', { query });
  } else {
    inflight.set(key, (async () => {
      try {
        const insights = await fetchInsights(query, progress);
        if (insights) {
          await requireSupabase().from('market_insights').upsert(
            { query_key: key, query, insights, fetched_at: new Date().toISOString() },
            { onConflict: 'query_key' },
          );
        }
        // A failed refresh still beats nothing: fall back to the stale copy.
        return insights ?? cached?.insights ?? null;
      } catch (err) {
        console.warn(`Market insights for "${query}" unavailable: ${err.message}`);
        return cached?.insights ?? null;
      } finally {
        inflight.delete(key);
      }
    })());
  }
  const insights = await inflight.get(key);
  progress('market', insights ? 'done' : 'failed', { query, cached: false, insights });
  return insights;
}
