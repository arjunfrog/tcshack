import { generateDescription } from '../lib/llm.js';
import { checkCompleteness, checkSeo } from './quality.js';

// Generate copy for one already-validated product and attach quality reports.
export async function generateForProduct(product, options) {
  const { output, meta } = await generateDescription(product, options);
  return {
    output,
    meta,
    quality: {
      input: checkCompleteness(product),
      seo: checkSeo(output),
    },
  };
}
