import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STYLE_EXAMPLES, SYSTEM_PROMPT, TONE_GUIDE, WORD_RANGES, buildUserPrompt,
} from '../src/prompts/productDescription.js';
import { ProductInput, TONES } from '../src/schemas/product.js';
import { checkCompleteness, checkFacts, checkSeo, checkStyle } from '../src/services/quality.js';

const countWords = (text) => text.split(/\s+/).filter(Boolean).length;

test('every tone has a definition in the system prompt', () => {
  assert.deepEqual(Object.keys(TONE_GUIDE).sort(), [...TONES].sort());
  for (const tone of TONES) assert.ok(SYSTEM_PROMPT.includes(`- ${tone}: `), tone);
});

test('few-shot examples follow every rule they teach', () => {
  for (const example of STYLE_EXAMPLES) {
    const product = ProductInput.parse(example.product);
    const { output } = example;
    const name = example.product.name;

    const seo = checkSeo(output);
    assert.equal(seo.passed, seo.total, `${name}: SEO checks`);
    assert.ok(output.meta_description.length >= 120, `${name}: meta at least 120 characters`);
    assert.deepEqual(checkFacts(product, output).unsupported, [], `${name}: fact check`);
    assert.deepEqual(checkStyle(output, { tone: example.tone }).issues, [], `${name}: style check`);

    const [min, max] = WORD_RANGES[example.sparse ? 'sparse' : example.length];
    const words = countWords(output.long_description);
    assert.ok(words >= min && words <= max, `${name}: ${words} words, expected ${min}-${max}`);
    assert.equal(checkCompleteness(product).sparse, Boolean(example.sparse), `${name}: sparse flag matches the data`);

    const firstParagraph = output.long_description.split('\n\n')[0].toLowerCase();
    assert.ok(firstParagraph.includes(output.seo_keywords[0]), `${name}: primary keyword in the first paragraph`);
    for (const bullet of output.bullet_points) {
      assert.match(bullet, /^[^:]{3,40}: /, `${name}: bullet starts with a benefit phrase and a colon`);
    }
  }
});

test('sparse products get the short-copy instruction instead of the requested length', () => {
  const sparse = ProductInput.parse({ name: 'Mat', category: 'Sports & Fitness', features: ['Non-slip'] });
  const prompt = buildUserPrompt(sparse, { tone: 'friendly', length: 'long' });
  assert.match(prompt, /Data quality: sparse/);
  assert.match(prompt, /40-70 words/);
  assert.doesNotMatch(prompt, /220-300 words/);
});

test('complete products get the requested length and no sparse warning', () => {
  const [first] = JSON.parse(readFileSync(new URL('../../data/eval/products.json', import.meta.url), 'utf8'))
    .filter((record) => record.sku === 'SKU-0060');
  const { eval_notes, ...raw } = first;
  const prompt = buildUserPrompt(ProductInput.parse(raw), { tone: 'luxury', length: 'medium', brand_voice: 'calm' });
  assert.match(prompt, /120-180 words/);
  assert.match(prompt, /Brand voice notes: calm/);
  assert.doesNotMatch(prompt, /sparse/);
});

test('the prompt leaves out sku and image_url', () => {
  const product = ProductInput.parse({ sku: 'SKU-9', name: 'Mat', category: 'Sports', image_url: 'https://example.com/mat.png' });
  const prompt = buildUserPrompt(product, { tone: 'minimal', length: 'short' });
  assert.doesNotMatch(prompt, /SKU-9|example\.com/);
});

test('a retailer brand profile goes into the request, with price guidance and banned words', () => {
  const product = ProductInput.parse({ name: 'Mat', category: 'Sports', features: ['Grip', 'Cushion', 'Strap'] });
  const prompt = buildUserPrompt(product, {
    tone: 'friendly',
    length: 'short',
    brand: { personality: ['warm', 'playful'], target_customer: 'new runners', price_positioning: 'premium', admired_brands: 'Northline', avoid_words: ['cheap', 'amazing'] },
  });
  assert.match(prompt, /Brand profile/);
  assert.match(prompt, /Personality: warm, playful/);
  assert.match(prompt, /Target customer: new runners/);
  assert.match(prompt, /never say cheap, affordable or bargain/);
  assert.match(prompt, /never mention or compare with them/);
  assert.match(prompt, /Never use these words: cheap, amazing/);
  assert.doesNotMatch(buildUserPrompt(product, { tone: 'friendly', length: 'short' }), /Brand profile/);
});
