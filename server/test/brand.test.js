import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brandProfile } from '../src/services/brand.js';
import { checkStyle } from '../src/services/quality.js';

test('the brand profile comes from the onboarding answers', () => {
  const profile = brandProfile({
    business_name: 'NewBrew', brand_personality: ['bold'], target_customer: 'students', price_positioning: 'budget',
    admired_brands: '', words_to_avoid: 'cheap, luxury;\nrevolutionary',
  });
  assert.deepEqual(profile, {
    personality: ['bold'], target_customer: 'students', price_positioning: 'budget', admired_brands: undefined,
    avoid_words: ['cheap', 'luxury', 'revolutionary'],
  });
  assert.equal(brandProfile({ brand_personality: [], words_to_avoid: '' }), undefined);
  assert.equal(brandProfile(undefined), undefined);
});

test('the style check flags words the retailer asked to avoid', () => {
  const output = {
    title: 'Kesari Cotton Kurta', short_description: 'A cheap thrill.', long_description: 'Soft cotton.',
    bullet_points: [], seo_keywords: ['cotton kurta'], meta_description: 'Shop the Kesari kurta.',
  };
  const issues = checkStyle(output, { brand: { avoid_words: ['cheap', 'luxury'] } }).issues;
  assert.deepEqual(issues, [{ type: 'avoided_word', text: 'cheap' }]);
});
