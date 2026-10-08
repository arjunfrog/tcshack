// Product Intelligence Builder — synthesizes product specifications,
// multi-source evidence, customer review themes, and retailer positioning
// into a unified ProductIntelligence profile.

import { ai } from '../lib/ai/router.js';
import { TaskType } from '../lib/ai/provider.js';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

/**
 * @typedef {object} ProductIntelligence
 * @property {string[]} canonical_facts
 * @property {string[]} key_benefits
 * @property {string[]} use_cases
 * @property {string[]} target_audience
 * @property {string[]} differentiators
 * @property {string[]} buyer_questions
 * @property {number} overall_confidence
 * @property {number} evidence_count
 * @property {string} summary
 */

/**
 * Builds deterministic baseline product intelligence from product and evidence.
 * Fast, offline-ready, guarantees consistent structured data.
 * @param {object} product
 * @param {Array<object>} evidence
 * @param {Array<object>} reviewThemes
 * @param {object} [retailer]
 * @returns {ProductIntelligence}
 */
export function buildDeterministicIntelligence(product, evidence = [], reviewThemes = [], retailer = {}) {
  const canonicalFacts = evidence.map((e) => e.claim_or_fact || e).filter(Boolean);

  // If no evidence was passed, pull directly from product
  if (canonicalFacts.length === 0) {
    if (product.brand) canonicalFacts.push(`Brand: ${product.brand}`);
    if (product.price) canonicalFacts.push(`Price: ${product.currency || 'INR'} ${product.price}`);
    (product.features || []).forEach((f) => canonicalFacts.push(f));
    Object.entries(product.specifications || {}).forEach(([k, v]) => canonicalFacts.push(`${k}: ${v}`));
  }

  // Derive grounded benefits
  const keyBenefits = [];
  (product.features || []).slice(0, 4).forEach((f) => {
    keyBenefits.push(`Delivers reliable performance through ${f.toLowerCase()}`);
  });
  if (keyBenefits.length === 0) {
    keyBenefits.push('Engineered for everyday reliability and seamless user experience');
  }

  // Use cases
  const useCases = [];
  if (product.category === 'Electronics' || product.subcategory?.includes('Audio')) {
    useCases.push('Daily commute, home entertainment, and active lifestyle use');
  } else if (product.category === 'Fashion') {
    useCases.push('Versatile all-day wear from work to casual outings');
  } else {
    useCases.push(`Standard personal and household use for ${product.category || 'general'} items`);
  }

  // Target audience
  const targetAudience = [];
  if (retailer?.target_customer) {
    targetAudience.push(retailer.target_customer);
  } else {
    targetAudience.push('Value-conscious shoppers seeking quality and reliability');
  }

  // Differentiators
  const differentiators = [];
  if (product.features && product.features.length > 0) {
    differentiators.push(`Notable capability: ${product.features[0]}`);
  }
  if (product.price && product.price < 2000) {
    differentiators.push('Competitive price-to-performance ratio');
  }

  // Buyer questions answered
  const buyerQuestions = [
    'Does this product meet high durability and quality standards?',
    'How easily does this fit into everyday lifestyle routines?',
  ];

  // Calculate composite confidence
  const confidences = evidence.map((e) => Number(e.confidence || 0.9));
  const avgConf = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0.95;

  const summary = `${product.name} by ${product.brand || 'the brand'} delivers verified capability in ${product.category || 'its category'}. Grounded in ${canonicalFacts.length} verified facts.`;

  return {
    canonical_facts: canonicalFacts,
    key_benefits: keyBenefits,
    use_cases: useCases,
    target_audience: targetAudience,
    differentiators: differentiators,
    buyer_questions: buyerQuestions,
    unresolved_gaps: [],
    overall_confidence: Math.round(avgConf * 100) / 100,
    evidence_count: canonicalFacts.length,
    summary,
  };
}

/**
 * Builds synthesized ProductIntelligence using AI with fallbacks.
 * @param {object} product
 * @param {Array<object>} evidence
 * @param {Array<object>} reviewThemes
 * @param {object} [retailer]
 * @returns {Promise<ProductIntelligence>}
 */
export async function buildProductIntelligence(product, evidence = [], reviewThemes = [], retailer = {}) {
  const baseline = buildDeterministicIntelligence(product, evidence, reviewThemes, retailer);

  try {
    const prompt = `Synthesize product intelligence for "${product.name}" in category "${product.category || 'General'}".

Verified Facts:
${baseline.canonical_facts.slice(0, 15).map((f) => `- ${f}`).join('\n')}

Customer Review Themes:
${reviewThemes.slice(0, 4).map((t) => `- ${t.theme} (${t.sentiment})`).join('\n') || 'None recorded yet'}

Retailer Positioning:
- Target Customer: ${retailer?.target_customer || 'General consumer'}
- Price Positioning: ${retailer?.price_positioning || 'mid'}

Synthesize structured intelligence strictly as JSON:
{
  "key_benefits": string[],
  "use_cases": string[],
  "target_audience": string[],
  "differentiators": string[],
  "buyer_questions": string[],
  "summary": string
}`;

    const response = await ai.complete(TaskType.EXTRACTION, [
      {
        role: 'system',
        content: 'You are a Senior Product Intelligence Analyst. Ground all benefits in verified facts only. Never invent specs. Output strict JSON only.',
      },
      { role: 'user', content: prompt },
    ], { json: true });

    let parsed;
    try {
      parsed = JSON.parse(response.content);
    } catch {
      parsed = null;
    }

    if (parsed) {
      if (Array.isArray(parsed.key_benefits) && parsed.key_benefits.length) baseline.key_benefits = parsed.key_benefits;
      if (Array.isArray(parsed.use_cases) && parsed.use_cases.length) baseline.use_cases = parsed.use_cases;
      if (Array.isArray(parsed.target_audience) && parsed.target_audience.length) baseline.target_audience = parsed.target_audience;
      if (Array.isArray(parsed.differentiators) && parsed.differentiators.length) baseline.differentiators = parsed.differentiators;
      if (Array.isArray(parsed.buyer_questions) && parsed.buyer_questions.length) baseline.buyer_questions = parsed.buyer_questions;
      if (parsed.summary && typeof parsed.summary === 'string') baseline.summary = parsed.summary;
    }
  } catch {
    // Non-blocking: rely on baseline
  }

  // Persist if Supabase configured
  if (isSupabaseConfigured() && product.id) {
    try {
      await supabase.from('product_intelligence').upsert({
        product_id: product.id,
        retailer_id: product.retailer_id || null,
        canonical_facts: baseline.canonical_facts,
        key_benefits: baseline.key_benefits,
        use_cases: baseline.use_cases,
        target_audience: baseline.target_audience,
        differentiators: baseline.differentiators,
        buyer_questions: baseline.buyer_questions,
        unresolved_gaps: baseline.unresolved_gaps,
        overall_confidence: baseline.overall_confidence,
        summary: baseline.summary,
        evidence_count: baseline.evidence_count,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'product_id' });
    } catch {
      // Non-blocking
    }
  }

  return baseline;
}
