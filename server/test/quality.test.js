import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProductInput } from '../src/schemas/product.js';
import { checkCompleteness, checkFacts, checkSeo, checkStyle } from '../src/services/quality.js';

test('complete product scores 100 with no issues', () => {
  const product = ProductInput.parse({
    name: 'Pulse Buds', category: 'Electronics', subcategory: 'Wireless Earbuds', brand: 'Voltix', price: 2999,
    features: ['ANC', 'Touch controls', 'IPX5'], specifications: { Bluetooth: '5.3', 'Battery life': '30 hours' },
    attributes: { colors: ['Black'] }, seed_keywords: ['wireless earbuds'],
  });
  assert.deepEqual(checkCompleteness(product), { score: 100, sparse: false, issues: [] });
});

test('sparse product is flagged', () => {
  const result = checkCompleteness(ProductInput.parse({ name: 'Mat', category: 'Sports' }));
  assert.ok(result.score < 50);
  assert.equal(result.sparse, true);
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

// --- Fact check ---

const earbuds = ProductInput.parse({
  name: 'Pulse Buds', category: 'Electronics', subcategory: 'Wireless Earbuds', brand: 'Voltix', price: 2999,
  features: ['Active noise cancellation', 'IPX5 sweat resistance', 'Dual-device pairing', 'Keeps playing for 32 hours'],
  specifications: { Bluetooth: '5.3', 'Driver size': '12 mm', 'Battery life': '32 hours with case' },
  attributes: { colors: ['Black'], gift_ready: false },
  seed_keywords: ['waterproof earbuds', 'organic earbuds 40 hours'],
});

const copy = (text) => ({
  title: 'Voltix Pulse Buds Wireless Earbuds',
  short_description: text,
  long_description: '',
  bullet_points: [],
  seo_keywords: [],
  meta_description: '',
});
const flagged = (text) => checkFacts(earbuds, copy(text)).unsupported.map((item) => item.text);

test('fact check passes figures, codes and units taken from the data', () => {
  const result = checkFacts(earbuds, copy(
    'IPX5 sweat resistance, Bluetooth 5.3 (v5.3), 12mm drivers, 32 hours of battery with the case, pairs with 2 devices. Rs. 2,999.',
  ));
  assert.deepEqual(result.unsupported, []);
  assert.equal(result.passed, true);
  assert.ok(result.checked >= 6);
});

test('fact check flags invented numbers and codes', () => {
  assert.deepEqual(flagged('Up to 40 hours of playback'), ['40 hours']);
  assert.deepEqual(flagged('IPX7 rated'), ['ipx7']);
  assert.deepEqual(flagged('Bluetooth 5.4'), ['5.4']);
});

test('fact check flags a known number with the wrong unit', () => {
  const [item] = checkFacts(earbuds, copy('A 12 g bud')).unsupported;
  assert.equal(item.text, '12 g');
  assert.match(item.issue, /Unit differs/);
});

test('fact check flags claims the data does not support, but not ones it does', () => {
  assert.deepEqual(flagged('Waterproof, organic and gift-ready? Only the noise cancellation is real.'), ['organic', 'waterproof']);
  const speaker = ProductInput.parse({ name: 'Boom', category: 'Electronics', features: ['IP67 waterproof and dustproof'] });
  assert.equal(checkFacts(speaker, copy('Fully waterproof to IP67.')).passed, true);
});

test('seed keywords are not evidence for the fact check', () => {
  // "40 hours", "waterproof" and "organic" appear only in the seed keywords.
  assert.deepEqual(flagged('40 hours, waterproof, organic'), ['40 hours', 'organic', 'waterproof']);
});

test('fact check catches an upgraded SPF even when the number appears elsewhere', () => {
  const sunscreen = ProductInput.parse({
    name: 'Matte Shield', category: 'Beauty & Personal Care',
    specifications: { SPF: 'SPF 30', Volume: '50 g' },
  });
  const result = checkFacts(sunscreen, copy('SPF 50 protection in a 50 g tube with SPF 30 inside.'));
  assert.deepEqual(result.unsupported.map((item) => item.text), ['spf 50']);
});

test('fact check lets dimensions take the unit written after them', () => {
  const mat = ProductInput.parse({ name: 'Mat', category: 'Sports', specifications: { Dimensions: '183 x 61 cm' } });
  assert.equal(checkFacts(mat, copy('183 cm long and 61 cm wide, or 183 x 61 cm')).passed, true);
});

// --- Style check ---

const styled = (overrides) => ({
  title: 'Voltix Pulse Buds Wireless Earbuds with ANC',
  short_description: 'Quiet commutes, clear calls.',
  long_description: 'The noise drops away the moment you press them in.\n\nTwelve-millimetre drivers do the rest.',
  bullet_points: ['Quiet: active noise cancellation'],
  seo_keywords: ['wireless earbuds', 'anc earbuds'],
  meta_description: 'Voltix wireless earbuds with active noise cancellation.',
  ...overrides,
});
const styleTypes = (overrides, options) => checkStyle(styled(overrides), options).issues.map((issue) => issue.type);

test('style check passes plain, specific copy', () => {
  assert.deepEqual(checkStyle(styled({})), { passed: true, issues: [] });
  assert.deepEqual(styleTypes({ title: 'Kesari Pre-knocked Cricket Bat for Tennis Ball, 8 mm Edges' }), []);
});

test('style check flags the usual machine-written tells', () => {
  assert.deepEqual(styleTypes({ long_description: 'For those who love music, these earbuds are perfect for travel.' }), ['stock_opener', 'cliche']);
  assert.deepEqual(styleTypes({ short_description: 'Rich in antioxidants, as noted in the product features.' }), ['meta_reference']);
  assert.deepEqual(styleTypes({ title: 'Voltix Orbit Watch with Calling, Bluetooth Calling' }), ['title_repeat']);
  assert.deepEqual(styleTypes({ title: 'PureLeaf Hydra Serum face serum', seo_keywords: ['face serum'] }), ['title_case']);
  assert.deepEqual(styleTypes({ title: 'PureLeaf Hydra Serum Face Serum', seo_keywords: ['face serum'] }), []);
  assert.deepEqual(styleTypes({ long_description: 'When you open the case, the buds wake up.' }), ['stock_opener']);
  assert.deepEqual(styleTypes({ bullet_points: ['Wow!'] }), ['exclamation']);
  assert.deepEqual(styleTypes({ bullet_points: ['Wow!'] }, { tone: 'playful' }), []);
});

test('style check flags a keyword repeated too often', () => {
  const stuffed = 'anc earbuds. '.repeat(3);
  assert.deepEqual(checkStyle(styled({ long_description: stuffed })).issues, [{ type: 'keyword_stuffing', text: '"anc earbuds" 3 times' }]);
});
