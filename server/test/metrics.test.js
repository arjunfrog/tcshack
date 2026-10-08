import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changedPercent, computeMetrics, reviewQueue } from '../src/services/metrics.js';

const quality = (overrides = {}) => ({
  seo: { passed: 5, total: 5, keyword_coverage: 80 },
  facts: { passed: true, unsupported: [] },
  style: { passed: true, issues: [] },
  ...overrides,
});
const description = (id, fields = {}) => ({
  id,
  product_id: `p-${id}`,
  version: 1,
  tone: 'friendly',
  status: 'draft',
  provider: 'groq',
  model: 'openai/gpt-oss-120b',
  quality: quality(),
  input_tokens: 3600,
  output_tokens: 600,
  latency_ms: 4000,
  product: { category: 'Electronics' },
  ...fields,
});

test('the headline metric averages each description over its reviewers', () => {
  const descriptions = [description('a'), description('b'), description('c', { tone: 'luxury', product: { category: 'Apparel' } })];
  const feedback = [
    // a: two reviewers, means 4.5 / 4 -> counts as rated 4+
    { description_id: 'a', relevance: 5, creativity: 4 },
    { description_id: 'a', relevance: 4, creativity: 4 },
    // b: creativity mean 3 -> not 4+
    { description_id: 'b', relevance: 5, creativity: 3 },
    // c: 4+ on both
    { description_id: 'c', relevance: 4, creativity: 5 },
    // a rating for some other retailer's description is ignored
    { description_id: 'elsewhere', relevance: 1, creativity: 1 },
  ];
  const { ratings } = computeMetrics({ descriptions, feedback });

  assert.equal(ratings.rated, 3);
  assert.equal(ratings.rated_4_plus_pct, 66.7);
  assert.equal(ratings.meets_target, false);
  assert.deepEqual(ratings.by_tone.find((row) => row.name === 'luxury'), { name: 'luxury', rated: 1, rated_4_plus_pct: 100, avg_relevance: 4, avg_creativity: 5 });
  assert.equal(ratings.by_category.find((row) => row.name === 'Electronics').rated_4_plus_pct, 50);
});

test('quality, usage and review counts cover AI versions; edits are counted separately', () => {
  const descriptions = [
    description('a', { quality: quality({ facts: { passed: false, unsupported: [{ text: '40 hours' }] } }) }),
    description('b', { quality: quality({ seo: { passed: 4, total: 5, keyword_coverage: 40 }, style: { passed: false, issues: [{ type: 'cliche' }] } }), status: 'approved' }),
    description('c', { provider: 'human', model: 'human edit', status: 'approved', edited_from: 'b', product_id: 'p-b', version: 2, quality: { ...quality(), human_edit: { changed_pct: 12 } } }),
  ];
  const metrics = computeMetrics({ descriptions, feedback: [] });

  assert.equal(metrics.ratings.rated_4_plus_pct, null);
  assert.deepEqual(metrics.quality.top_fact_flags, [{ name: '40 hours', count: 1 }]);
  assert.equal(metrics.quality.seo_pass_pct, 50);
  assert.equal(metrics.quality.avg_keyword_coverage, 60);
  assert.equal(metrics.quality.facts_clean_pct, 50);
  assert.equal(metrics.quality.style_clean_pct, 50);
  assert.deepEqual(metrics.usage, {
    products: 2, descriptions: 2, input_tokens: 7200, output_tokens: 1200, avg_latency_ms: 4000,
    by_model: [{ name: 'openai/gpt-oss-120b', count: 2 }],
  });
  assert.deepEqual(metrics.review, { draft: 1, approved: 2, rejected: 0, human_edits: 1, avg_changed_pct: 12 });
});

test('changedPercent measures how much of the copy a human rewrote', () => {
  assert.equal(changedPercent('a quiet pair of earbuds', 'a quiet pair of earbuds'), 0);
  assert.equal(changedPercent('a quiet pair of earbuds', 'a quiet set of earbuds'), 20);
  assert.equal(changedPercent('one two', 'three four five six'), 100);
});

test('the review queue holds each product\'s latest AI draft the reviewer has not rated', () => {
  const rows = [
    description('old', { product_id: 'p1', version: 1, created_at: '2026-10-08T10:00:00Z' }),
    description('new', { product_id: 'p1', version: 2, created_at: '2026-10-08T11:00:00Z' }),
    description('approved', { product_id: 'p2', status: 'approved' }),
    description('edited', { product_id: 'p3', provider: 'human' }),
    description('rated', { product_id: 'p4' }),
    description('first', { product_id: 'p5', created_at: '2026-10-08T09:00:00Z' }),
  ];
  assert.deepEqual(reviewQueue(rows, new Set(['rated'])).map((d) => d.id), ['first', 'new']);
});
