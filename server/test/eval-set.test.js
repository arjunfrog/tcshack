import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ProductInput } from '../src/schemas/product.js';
import { checkCompleteness } from '../src/services/quality.js';

const records = JSON.parse(readFileSync(new URL('../../data/eval/products.json', import.meta.url), 'utf8'));

test('eval set has 15 valid products, each with rater notes', () => {
  assert.equal(records.length, 15);
  assert.equal(new Set(records.map((record) => record.sku)).size, 15);
  for (const { eval_notes, ...raw } of records) {
    assert.ok(eval_notes, `${raw.sku} has eval_notes`);
    assert.equal(ProductInput.safeParse(raw).success, true, raw.sku);
  }
});

test('eval set covers every category at least twice and includes sparse products', () => {
  const byCategory = Object.groupBy(records, (record) => record.category);
  assert.equal(Object.keys(byCategory).length, 7);
  for (const [category, group] of Object.entries(byCategory)) assert.ok(group.length >= 2, category);

  const sparse = records.filter(({ eval_notes, ...raw }) => checkCompleteness(ProductInput.parse(raw)).sparse);
  assert.ok(sparse.length >= 3, `${sparse.length} sparse products`);
});
