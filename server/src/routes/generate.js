import { Router } from 'express';
import { z } from 'zod';
import { GenerationOptions, LENGTHS, ProductInput, TONES } from '../schemas/product.js';
import { generateForProduct } from '../services/generator.js';
import { checkCompleteness } from '../services/quality.js';

export const generateRouter = Router();

generateRouter.get('/options', (req, res) => {
  res.json({ tones: TONES, lengths: LENGTHS });
});

const SingleRequest = z.object({
  product: ProductInput,
  options: GenerationOptions.prefault({}),
});

// POST /api/generate/check  { product } -> { score, sparse, issues }
// Lets the UI warn about thin product data before spending a generation on it.
generateRouter.post('/check', (req, res) => {
  const { product } = z.object({ product: ProductInput }).parse(req.body);
  res.json(checkCompleteness(product));
});

// POST /api/generate  { product, options? } -> { output, meta, quality }
generateRouter.post('/', async (req, res) => {
  const { product, options } = SingleRequest.parse(req.body);
  res.json(await generateForProduct(product, options));
});
