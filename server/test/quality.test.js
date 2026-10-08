import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProductInput } from '../src/schemas/product.js';
import { checkCompleteness, checkSeo } from '../src/services/quality.js';

test('complete product scores 100 with no issues', () => {
  const product = ProductInput.parse({
    name: 'Pulse Buds', category: 'Electronics', subcategory: 'Wireless Earbuds', brand: 'Voltix', price: 2999,
    features: ['ANC', 'Touch controls', 'IPX5'], specifications: { Bluetooth: '5.3', 'Battery life': '30 hours' },
    attributes: { colors: ['Black'] }, seed_keywords: ['wireless earbuds'],
  });
  assert.deepEqual(checkCompleteness(product), { score: 100, issues: [] });
});

test('sparse product is flagged', () => {
  const result = checkCompleteness(ProductInput.parse({ name: 'Mat', category: 'Sports' }));
  assert.ok(result.score < 50);
  assert.ok(result.issues.includes('Fewer than 3 features'));
});

test('SEO checks catch long titles and measure keyword coverage', () => {
  const result = checkSeo({
    title: 'x'.repeat(80),
    short_description: 'Wireless earbuds for daily use.',
    long_description: 'Great bluetooth earphones.',
    bullet_points: ['a', 'b', 'c'],
    seo_keywords: ['wireless earbuds', 'bluetooth earphones', 'gaming earbuds', 'tws'],
    meta_description: 'Shop wireless earbuds.',
  });
  assert.equal(result.title_length_ok, false);
  assert.equal(result.primary_keyword_in_meta, true);
  assert.equal(result.keyword_coverage, 50);
});
