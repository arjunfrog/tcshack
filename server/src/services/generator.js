import { generateDescription } from '../lib/llm.js';
import { checkBrand, checkCompleteness, checkFacts, checkMarket, checkSeo, checkStyle } from './quality.js';

// Models often emit typographic hyphens and spaces (non-breaking hyphen U+2011, narrow
// no-break space). They look identical but break keyword matching for search engines and
// for our SEO checks, so normalise them to plain ASCII.
const cleanText = (text) => text.replace(/[\u2010\u2011]/g, '-').replace(/[\u00a0\u202f]/g, ' ').trim();

export function cleanOutput(output) {
  return Object.fromEntries(
    Object.entries(output).map(([key, value]) => [key, Array.isArray(value) ? value.map(cleanText) : cleanText(value)]),
  );
}

// Every rule-based check on one product's copy. Also used to score human edits.
export function qualityReport(product, output, options) {
  return {
    input: checkCompleteness(product),
    seo: checkSeo(output),
    facts: checkFacts(product, output),
    style: checkStyle(output, options),
  };
}

// Generate copy for one already-validated product and attach quality reports.
// `settings` optionally overrides provider, model or effort, and settings.context adds the
// retailer's brand profile and market insights (see lib/llm.js).
export async function generateForProduct(product, options, settings) {
  const generated = await generateDescription(product, options, settings);
  const output = cleanOutput(generated.output);
  const quality = qualityReport(product, output, options);
  // Only for retailer generations, which carry a brand profile and market insights.
  if (settings?.context) {
    quality.brand = checkBrand(output, settings.context.brand);
    quality.market = checkMarket(output, settings.context.market);
  }
  return { output, meta: generated.meta, quality };
}
