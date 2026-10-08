// Retailer Content Intelligence Service.
// Analyzes retailer catalogs and onboarding attributes to extract empirical writing patterns
// (tone, sentence style, vocabulary, benefit emphasis, title/bullet structures).
//
// These are labeled strictly as "Retailer writing pattern" (representing how the brand
// writes/presents products) rather than claiming to be proven conversions.

import { ai } from '../lib/ai/router.js';
import { TaskType } from '../lib/ai/provider.js';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

/**
 * Builds a baseline writing pattern profile from retailer onboarding questionnaire.
 * Used when a retailer has not yet uploaded historical catalog copy.
 * @param {object} retailer
 * @returns {object}
 */
export function buildProfileFromRetailerInfo(retailer) {
  const brandPersonality = Array.isArray(retailer.brand_personality)
    ? retailer.brand_personality
    : [];
  const tone = brandPersonality.length ? brandPersonality.join(', ') : 'professional, informative';
  const positioning = retailer.price_positioning || 'mid';

  let technicalDetail = 'moderate';
  let benefitVsFeature = 0.65;
  if (positioning === 'premium') {
    benefitVsFeature = 0.8;
  } else if (positioning === 'budget') {
    benefitVsFeature = 0.5;
    technicalDetail = 'high';
  }

  return {
    retailer_id: retailer.id,
    sample_size: 0,
    preferred_tone: tone,
    avg_desc_length: 150,
    sentence_style: 'Clear, engaging, benefit-driven with scannable structure',
    vocabulary_patterns: brandPersonality.map((p) => p.toLowerCase()),
    benefit_vs_feature: benefitVsFeature,
    title_structure: '[Brand] [Product Name] - [Key Feature]',
    bullet_structure: 'Bold Benefit: Supporting specification or detail',
    cta_style: 'Subtle and value-focused',
    technical_detail: technicalDetail,
    profile_data: {
      positioning,
      target_customer: retailer.target_customer || 'General consumer',
      admired_brands: retailer.admired_brands || '',
      words_to_avoid: retailer.words_to_avoid ? retailer.words_to_avoid.split(',').map((w) => w.trim().toLowerCase()) : [],
      writing_rules: [
        'Lead with customer benefit, ground with concrete specifications',
        'Avoid hyperbolic fluff or unsupported claims',
        'Maintain concise scannability for mobile shoppers',
      ],
    },
    status: 'ready',
    last_analyzed_at: new Date().toISOString(),
  };
}

/**
 * Analyzes a collection of products (and existing descriptions if any)
 * to compute empirical writing patterns.
 * @param {object} retailer
 * @param {Array<object>} products
 * @returns {Promise<object>}
 */
export async function analyzeRetailerCatalog(retailer, products = []) {
  if (!products || products.length === 0) {
    return buildProfileFromRetailerInfo(retailer);
  }

  // Deterministic metrics calculation across available products
  let totalWords = 0;
  let descCount = 0;
  const titles = [];
  const sampleTexts = [];

  for (const prod of products) {
    if (prod.name) titles.push(prod.name);
    const desc = prod.description || prod.long_description || prod.short_description || '';
    if (desc) {
      const words = desc.trim().split(/\s+/).length;
      totalWords += words;
      descCount++;
      sampleTexts.push(desc.slice(0, 300));
    }
  }

  const avgLength = descCount > 0 ? Math.round(totalWords / descCount) : 150;

  // Title pattern detection
  let titleStructure = '[Brand] [Product Name]';
  const hasHyphen = titles.some((t) => t.includes('-'));
  const hasPipe = titles.some((t) => t.includes('|'));
  if (hasHyphen) titleStructure = '[Brand] [Product Name] - [Key Feature]';
  else if (hasPipe) titleStructure = '[Brand] [Product Name] | [Specification]';

  // Base pattern
  const baseProfile = buildProfileFromRetailerInfo(retailer);
  baseProfile.sample_size = products.length;
  baseProfile.avg_desc_length = avgLength;
  baseProfile.title_structure = titleStructure;

  // If we have AI available and sample texts, extract deeper stylistic nuances
  if (sampleTexts.length > 0) {
    try {
      const prompt = `Analyze these ${Math.min(sampleTexts.length, 5)} product descriptions from retailer "${retailer.business_name}":
${sampleTexts.slice(0, 5).map((t, i) => `[${i + 1}] ${t}`).join('\n\n')}

Identify their empirical writing patterns:
1. Sentence style (e.g. punchy and direct, descriptive narrative, technical specification)
2. Benefit vs feature orientation (0.0 = pure specs, 1.0 = pure benefits)
3. 3-6 distinct vocabulary patterns or common phrases
4. Bullet structure preference`;

      const response = await ai.complete(TaskType.EXTRACTION, [
        { role: 'system', content: 'You are an e-commerce copywriting analyst. Extract concise writing style patterns in JSON format with keys: sentence_style (string), benefit_vs_feature (number between 0 and 1), vocabulary_patterns (array of strings), bullet_structure (string).' },
        { role: 'user', content: prompt },
      ], { json: true });

      let parsed;
      try {
        parsed = JSON.parse(response.content);
      } catch {
        // fallback
      }

      if (parsed) {
        if (parsed.sentence_style) baseProfile.sentence_style = parsed.sentence_style;
        if (typeof parsed.benefit_vs_feature === 'number') {
          baseProfile.benefit_vs_feature = Math.max(0, Math.min(1, parsed.benefit_vs_feature));
        }
        if (Array.isArray(parsed.vocabulary_patterns) && parsed.vocabulary_patterns.length > 0) {
          baseProfile.vocabulary_patterns = [...new Set([...baseProfile.vocabulary_patterns, ...parsed.vocabulary_patterns])];
        }
        if (parsed.bullet_structure) baseProfile.bullet_structure = parsed.bullet_structure;
      }
    } catch {
      // Graceful fallback to deterministic baseProfile
    }
  }

  // Persist if database is configured
  if (isSupabaseConfigured() && retailer.id) {
    try {
      const { data, error } = await supabase
        .from('retailer_content_profile')
        .upsert({
          retailer_id: retailer.id,
          sample_size: baseProfile.sample_size,
          preferred_tone: baseProfile.preferred_tone,
          avg_desc_length: baseProfile.avg_desc_length,
          sentence_style: baseProfile.sentence_style,
          vocabulary_patterns: baseProfile.vocabulary_patterns,
          benefit_vs_feature: baseProfile.benefit_vs_feature,
          title_structure: baseProfile.title_structure,
          bullet_structure: baseProfile.bullet_structure,
          cta_style: baseProfile.cta_style,
          technical_detail: baseProfile.technical_detail,
          profile_data: baseProfile.profile_data,
          status: 'ready',
          last_analyzed_at: new Date().toISOString(),
        }, { onConflict: 'retailer_id' })
        .select()
        .single();

      if (!error && data) {
        return data;
      }
    } catch {
      // Continue with in-memory profile if db table not yet migrated
    }
  }

  return baseProfile;
}

/**
 * Retrieves the retailer content profile from Supabase or generates default if missing.
 * @param {string} retailerId
 * @returns {Promise<object|null>}
 */
export async function getRetailerContentProfile(retailerId) {
  if (!retailerId) return null;

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('retailer_content_profile')
        .select('*')
        .eq('retailer_id', retailerId)
        .maybeSingle();

      if (!error && data) return data;

      // If no profile exists, fetch retailer and create baseline
      const { data: retailer } = await supabase
        .from('retailers')
        .select('*')
        .eq('id', retailerId)
        .maybeSingle();

      if (retailer) {
        const { data: products } = await supabase
          .from('products')
          .select('id, name, features, attributes')
          .eq('retailer_id', retailerId)
          .limit(20);

        return analyzeRetailerCatalog(retailer, products || []);
      }
    } catch {
      return null;
    }
  }

  return null;
}
