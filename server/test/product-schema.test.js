import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProductUpdate } from '../src/schemas/product.js';

test('a product edit keeps only the fields that were sent', () => {
  assert.deepEqual(parseProductUpdate({ name: ' Renamed ' }), { name: 'Renamed' });
  assert.deepEqual(parseProductUpdate({ price: '199', features: ['Grip'] }), { price: 199, features: ['Grip'] });
});

test('a product edit rejects unknown or invalid fields', () => {
  assert.throws(() => parseProductUpdate({ retailer_id: 'someone-else' }));
  assert.throws(() => parseProductUpdate({ name: '' }));
});
