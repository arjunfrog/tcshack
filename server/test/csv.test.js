import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseProductsCsv } from '../src/lib/csv.js';
import { ProductInput } from '../src/schemas/product.js';

const fixture = (name) => readFileSync(new URL(`../../data/generated/${name}`, import.meta.url), 'utf8');

test('parses the synthetic CSV into valid products matching the JSON file', () => {
  const fromCsv = parseProductsCsv(fixture('products.csv')).map((record) => ProductInput.parse(record));
  const fromJson = JSON.parse(fixture('products.json')).map((record) => ProductInput.parse(record));

  assert.equal(fromCsv.length, fromJson.length);
  fromCsv.forEach((product, i) => {
    assert.equal(product.sku, fromJson[i].sku);
    assert.equal(product.price, fromJson[i].price);
    assert.deepEqual(product.features, fromJson[i].features);
    assert.deepEqual(product.specifications, fromJson[i].specifications);
  });
});

test('splits lists, key/value maps and attribute values', () => {
  const [product] = parseProductsCsv(
    'name,category,features,specifications,attributes\n' +
      'Mat,Fitness,Non-slip | Lightweight,Thickness: 6 mm | Size: 183 x 61 cm,"colors: Blue, Grey | eco: true"\n',
  );
  assert.deepEqual(product.features, ['Non-slip', 'Lightweight']);
  assert.deepEqual(product.specifications, { Thickness: '6 mm', Size: '183 x 61 cm' });
  assert.deepEqual(product.attributes, { colors: ['Blue', 'Grey'], eco: true });
});
