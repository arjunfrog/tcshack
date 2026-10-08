// Product Content Intelligence Generator.
// Coordinates multi-source evidence, customer review themes, retailer writing patterns,
// grounded LLM generation, composite quality validation, and claim-to-evidence explainability.

import { ai } from '../lib/ai/router.js';
import { TaskType } from '../lib/ai/provider.js';
import { GeneratedDescription } from '../schemas/product.js';
import { generateDescription } from '../lib/llm.js';
import { checkCompleteness, checkSeo, computeCompositeQuality } from './quality.js';
import { gatherEvidence } from './evidence.js';
import { deriveHeuristicThemes } from './reviewIntelligence.js';
import { buildProductIntelligence } from './productIntelligence.js';
import { buildEnrichedPrompts } from './contextBuilder.js';
import { traceClaimsToEvidence } from './explainability.js';
import { getRetailerContentProfile, buildProfileFromRetailerInfo } from './retailerIntelligence.js';

/**
 * Generate copy for one product with full intelligence backing, quality checks, and evidence explainability.
 * @param {object} product - Validated ProductInput
 * @param {object} options - Generation options (tone, length, brand_voice)
 * @param {object} [context] - Optional precomputed intelligence/evidence/profile context
 */
export async function generateForProduct(product, options, context = {}) {
  // 1. Retailer Writing Patterns
  const retailerId = context.retailer_id || options.retailer_id || product.retailer_id;
  let retailerProfile = context.retailerProfile || (retailerId ? await getRetailerContentProfile(retailerId) : null);
  if (!retailerProfile) {
    retailerProfile = buildProfileFromRetailerInfo({
      business_name: product.brand || 'Catalog Brand',
      brand_personality: options.brand_voice ? [options.brand_voice] : ['reliable', 'customer-focused'],
      price_positioning: product.price && product.price > 5000 ? 'premium' : 'mid',
    });
  }

  // 2. Multi-Source Evidence Gathering (with strict source hierarchy & conflict resolution)
  const evidence = context.evidence || await gatherEvidence(product);

  // 3. Customer Review Themes (multi-dimensional: battery, comfort, controls, etc.)
  const reviewThemes = context.reviewThemes || deriveHeuristicThemes(product);

  // 4. Product Intelligence Synthesis (canonical facts, benefits, use cases)
  const intelligence = context.productIntelligence || await buildProductIntelligence(product, evidence, reviewThemes, retailerProfile);

  // 5. Grounded Context & Negative Constraints Assembly
  const customPrompts = buildEnrichedPrompts(product, intelligence, retailerProfile, options);

  // 6. Grounded Generation via ModelRouter (with fallback to generateDescription)
  let output;
  let meta;
  try {
    const messages = [
      { role: 'system', content: customPrompts.systemPrompt + '\nRespond with JSON matching GeneratedDescription schema.' },
      { role: 'user', content: customPrompts.userPrompt },
    ];
    const gen = await ai.extractJson(TaskType.GENERATION, messages, GeneratedDescription);
    output = gen.data;
    meta = {
      provider: ai.resolveProvider(TaskType.GENERATION).name,
      model: gen.model,
      input_tokens: gen.usage?.input || 0,
      output_tokens: gen.usage?.output || 0,
      latency_ms: gen.latencyMs || 0,
    };
  } catch {
    const fallbackGen = await generateDescription(product, options, customPrompts);
    output = fallbackGen.output;
    meta = fallbackGen.meta;
  }

  // 7. Claim-to-Evidence Explainability (Requirement 4: strict audit; unsupported claims flagged)
  const claimEvidence = traceClaimsToEvidence(output, evidence, retailerProfile);

  // 8. Composite Quality Validation (4 Pillars: Content Quality, Brand Fit, Evidence Confidence, SEO Readiness)
  const compositeQuality = computeCompositeQuality(output, product, intelligence, retailerProfile, evidence, claimEvidence);

  return {
    output,
    meta,
    quality: {
      ...compositeQuality,
      // Backward compatibility guarantees for existing tests and UI
      input: checkCompleteness(product),
      seo: checkSeo(output),
    },
    intelligence: {
      canonical_facts: intelligence.canonical_facts,
      key_benefits: intelligence.key_benefits,
      use_cases: intelligence.use_cases,
      overall_confidence: intelligence.overall_confidence,
      evidence_count: intelligence.evidence_count,
      summary: intelligence.summary,
    },
    evidence: claimEvidence,
    retailer_profile: retailerProfile
      ? {
          preferred_tone: retailerProfile.preferred_tone,
          sentence_style: retailerProfile.sentence_style,
          title_structure: retailerProfile.title_structure,
          sample_size: retailerProfile.sample_size,
        }
      : null,
  };
}
