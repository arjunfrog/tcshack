import { generateDescription } from '../lib/llm.js';
import { checkCompleteness, checkFacts, checkSeo, checkStyle } from './quality.js';

// Models often emit typographic hyphens and spaces (non-breaking hyphen U+2011, narrow
// no-break space). They look identical but break keyword matching for search engines and
// for our SEO checks, so normalise them to plain ASCII.
const cleanText = (text) => text.replace(/[\u2010\u2011]/g, '-').replace(/[\u00a0\u202f]/g, ' ').trim();

export function cleanOutput(output) {
  return Object.fromEntries(
    Object.entries(output).map(([key, value]) => [key, Array.isArray(value) ? value.map(cleanText) : cleanText(value)]),
  );
}

// Generate copy for one already-validated product and attach quality reports.
// `settings` optionally overrides provider, model or effort (see lib/llm.js).
export async function generateForProduct(product, options, settings) {
  const generated = await generateDescription(product, options, settings);
  const output = cleanOutput(generated.output);
  const { meta } = generated;
  return {
    output,
    meta,
    quality: {
      input: checkCompleteness(product),
      seo: checkSeo(output),
      facts: checkFacts(product, output),
      style: checkStyle(output, options),
    },
  };
}
