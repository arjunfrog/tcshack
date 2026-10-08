import { Router } from 'express';
import { z } from 'zod';
import { GenerationOptions, LENGTHS, ProductInput, TONES } from '../schemas/product.js';
import { generateForProduct } from '../services/generator.js';
import { gatherEvidence } from '../services/evidence.js';
import { deriveHeuristicThemes } from '../services/reviewIntelligence.js';
import { buildProductIntelligence } from '../services/productIntelligence.js';
import { getRetailerContentProfile } from '../services/retailerIntelligence.js';

export const generateRouter = Router();

generateRouter.get('/options', (req, res) => {
  res.json({ tones: TONES, lengths: LENGTHS });
});

const SingleRequest = z.object({
  product: ProductInput,
  options: GenerationOptions.prefault({}),
});

// POST /api/generate  { product, options? } -> { output, meta, quality, intelligence, evidence, retailer_profile }
generateRouter.post('/', async (req, res) => {
  const { product, options } = SingleRequest.parse(req.body);
  res.json(await generateForProduct(product, options));
});

// POST /api/generate/intelligence -> { intelligence, evidence, review_themes, retailer_profile }
// Allows client to inspect/preview gathered evidence and product intelligence before generation
generateRouter.post('/intelligence', async (req, res) => {
  const { product, options } = SingleRequest.parse(req.body);
  const retailerId = options.retailer_id || product.retailer_id;
  const retailerProfile = retailerId ? await getRetailerContentProfile(retailerId) : null;
  const evidence = await gatherEvidence(product);
  const reviewThemes = deriveHeuristicThemes(product);
  const intelligence = await buildProductIntelligence(product, evidence, reviewThemes, retailerProfile);

  res.json({
    product,
    intelligence,
    evidence,
    review_themes: reviewThemes,
    retailer_profile: retailerProfile,
  });
});
