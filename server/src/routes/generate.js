import { Router } from 'express';
import { z } from 'zod';
import { GenerationOptions, LENGTHS, ProductInput, TONES } from '../schemas/product.js';
import { generateForProduct } from '../services/generator.js';

export const generateRouter = Router();

generateRouter.get('/options', (req, res) => {
  res.json({ tones: TONES, lengths: LENGTHS });
});

const SingleRequest = z.object({
  product: ProductInput,
  options: GenerationOptions.prefault({}),
});

// POST /api/generate  { product, options? } -> { output, meta, quality }
generateRouter.post('/', async (req, res) => {
  const { product, options } = SingleRequest.parse(req.body);
  res.json(await generateForProduct(product, options));
});
