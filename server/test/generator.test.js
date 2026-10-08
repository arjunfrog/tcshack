import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanOutput } from '../src/services/generator.js';

test('cleanOutput replaces typographic hyphens and spaces in every field', () => {
  const output = cleanOutput({
    title: 'Non‑slip Mat ',
    bullet_points: ['Grip: non‐slip', '8 mm'],
  });
  assert.deepEqual(output, { title: 'Non-slip Mat', bullet_points: ['Grip: non-slip', '8 mm'] });
});
