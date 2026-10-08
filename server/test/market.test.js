import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';

process.env.ANAKIN_API_KEY = 'test-key';
const { summarize, titleTerms, marketQuery } = await import('../src/services/market.js');
const { runAction } = await import('../src/lib/anakin.js');
const { buildUserPrompt, SYSTEM_PROMPT } = await import('../src/prompts/productDescription.js');
const { checkBrand, checkMarket } = await import('../src/services/quality.js');
const { ProductInput } = await import('../src/schemas/product.js');

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const titles = [
  'Solara Air Fryer Oven 12L, 360 Rapid Air Circulation with 12 Preset Menus',
  'PHILIPS NA120/00 1500W with Rapid Air Technology Air Fryer',
  'AGARO Digital Air Fryer 4.5L with Touch Control, Rapid Air Technology',
  'Pigeon Digital Air Fryer 4.2L with Touch Control and 8 Preset Menus',
];

test('title terms keep recurring phrases, not brands or the query itself', () => {
  const terms = titleTerms(titles, 'Air Fryer');
  assert.ok(terms.includes('rapid air'));
  assert.ok(terms.includes('touch control'));
  assert.ok(!terms.includes('air fryer'));
  assert.ok(!terms.some((term) => /solara|philips|agaro|pigeon/.test(term)));
});

test('summarize builds search terms, title terms and top listings', () => {
  const insights = summarize('Air Fryer', {
    suggestions: { suggestions: [{ text: 'air fryer' }, { text: 'Air Fryer Oven' }, { text: 'air fryer oven' }] },
    flipkart: { products: titles.map((title, i) => ({ title, rating: 4.2, review_count: 100 * i })) },
  });
  assert.deepEqual(insights.search_terms, ['air fryer oven']);
  assert.equal(insights.top_listings.length, 4);
  assert.deepEqual(insights.sources, ['amazon_search_suggestions', 'flipkart_search']);
});

test('summarize copes with one source failing', () => {
  const insights = summarize('Air Fryer', { suggestions: null, flipkart: { products: [{ title: titles[0] }] } });
  assert.deepEqual(insights.sources, ['flipkart_search']);
  assert.deepEqual(insights.search_terms, []);
});

test('market query prefers the subcategory', () => {
  assert.equal(marketQuery({ category: 'Home & Kitchen', subcategory: 'Air Fryer' }), 'Air Fryer');
  assert.equal(marketQuery({ category: 'Coffee' }), 'Coffee');
});

test('runAction submits a task and polls the job until it completes', async () => {
  const calls = [];
  const responses = [
    { job_id: 'j1', status: 'pending' },
    { status: 'running' },
    { status: 'completed', data: { status: 'ok', data: { suggestions: [{ text: 'air fryer' }] } } },
  ];
  globalThis.fetch = async (url, init) => {
    calls.push(`${init.method} ${url.replace('https://api.anakin.io/v1/wire', '')}`);
    return new Response(JSON.stringify(responses.shift()));
  };
  const result = await runAction('am_search_suggestions', { query: 'air fryer' });
  assert.deepEqual(result, { suggestions: [{ text: 'air fryer' }] });
  assert.deepEqual(calls, ['POST /task', 'GET /jobs/j1', 'GET /jobs/j1']);
});

test('runAction reports a failed job', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ status: 'failed', error: { message: 'JioMart API returned HTTP 404' } }));
  await assert.rejects(runAction('jm_search_products', {}), /HTTP 404/);
});

const product = ProductInput.parse({ name: 'CrispAir 4L', category: 'Home & Kitchen', subcategory: 'Air Fryer', features: ['Rapid air technology'] });
const brand = {
  business_name: 'Voltix Home', price_positioning: 'mid', target_customer: 'young families',
  brand_personality: ['Warm', 'Trustworthy'], words_to_avoid: 'cheap, best in the world', admired_brands: 'Philips',
};
const market = { query: 'Air Fryer', search_terms: ['air fryer oven'], title_terms: ['rapid air'], top_listings: [{ title: titles[0] }], sources: ['flipkart_search'] };

test('prompt carries the brand profile and market insights when given', () => {
  const prompt = buildUserPrompt(product, { tone: 'friendly', length: 'short' }, { brand, market });
  assert.match(prompt, /Seller: Voltix Home/);
  assert.match(prompt, /Avoid these words and claims: cheap, best in the world/);
  assert.match(prompt, /Shoppers search for: air fryer oven/);
  assert.match(prompt, /Top-ranking titles often mention: rapid air/);
  assert.doesNotMatch(prompt, /Philips/, 'admired brands stay out of the prompt');
  assert.match(SYSTEM_PROMPT, /never name competitor or admired brands/);
});

test('prompt without context is unchanged', () => {
  const prompt = buildUserPrompt(product, { tone: 'friendly', length: 'short' });
  assert.doesNotMatch(prompt, /Brand profile|Market insights/);
});

const output = {
  title: 'CrispAir 4L Air Fryer Oven', short_description: 'Crisp food, less fuss.',
  long_description: 'Not the cheapest, but cheap to run.', bullet_points: ['Fast: rapid air'], seo_keywords: ['air fryer'], meta_description: 'Air fryer.',
};

test('brand check finds avoided words as whole words', () => {
  const result = checkBrand(output, brand);
  assert.deepEqual(result.avoid_words_found, ['cheap']);
  assert.equal(result.ok, false);
  assert.equal(checkBrand(output, { words_to_avoid: '' }).ok, true);
});

test('market check lists the shopper searches the copy used', () => {
  assert.deepEqual(checkMarket(output, market).search_terms_used, ['air fryer oven']);
  assert.equal(checkMarket(output, null), null);
});

test('Groq output cap shrinks so prompt + cap stays under the 8K free-tier limit', async () => {
  const { groqOutputCap } = await import('../src/lib/llm.js');
  const plain = [{ content: SYSTEM_PROMPT }, { content: buildUserPrompt(product, { tone: 'friendly', length: 'medium' }) }];
  const withContext = [plain[0], { content: buildUserPrompt(product, { tone: 'friendly', length: 'medium' }, { brand, market }) }];
  for (const messages of [plain, withContext]) {
    const cap = groqOutputCap(messages);
    const promptTokens = messages.reduce((sum, m) => sum + m.content.length, 0) / 4;
    assert.ok(cap >= 1500 && cap <= 4000);
    assert.ok(promptTokens + cap <= 8000, `prompt ${Math.round(promptTokens)} + cap ${cap}`);
  }
  assert.ok(groqOutputCap(withContext) <= groqOutputCap(plain));
  assert.equal(groqOutputCap([{ content: 'short' }]), 4000);
});
