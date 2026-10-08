// Context Builder — merges Product Intelligence, Retailer Writing Patterns,
// and Generation Options into a grounded context prompt for LLM generation.
//
// Ensures:
// 1. Evidence Grounding: LLM is strictly constrained to verified facts.
// 2. Retailer Brand Alignment: Uses the retailer's tone, sentence style, vocabulary patterns.
// 3. Negative Constraints: Enforces words to avoid and eliminates generic marketing tropes.

const LENGTH_GUIDE = {
  short: 'Short: long_description of about 60-90 words, three bullets.',
  medium: 'Medium: long_description of about 120-180 words, four or five bullets.',
  long: 'Long: long_description of about 220-300 words, five or six bullets.',
};

export function buildEnrichedPrompts(product, intelligence, retailerProfile, options) {
  // System prompt emphasizing grounding & brand alignment
  const systemPrompt = `You are a Senior E-Commerce Copywriting & Content Intelligence Specialist.
Your mission is to generate high-converting, accurate, and search-optimized product page copy.

CRITICAL ACCURACY & EVIDENCE RULES:
1. GROUNDED IN EVIDENCE ONLY: Use only facts, specifications, and verified features provided in the Product Intelligence. NEVER invent or assume specifications, certifications, battery life, materials, dimensions, or unverified claims.
2. If an attribute or spec is not provided, do not guess it. Focus on known strengths.
3. Keep all prices, numbers, model names, and units exact.
4. Avoid banned buzzwords and empty marketing tropes ("Introducing", "Look no further", "Elevate your", "Revolutionary", "Game changer").

OUTPUT REQUIREMENTS:
- title: At most 70 characters. Follow retailer structure if specified.
- short_description: 1-2 punchy sentences highlighting primary benefit.
- long_description: 2-4 scannable paragraphs converting verified features into benefits.
- bullet_points: 3-6 bullets. Each bullet starts with a bold benefit backed by an exact fact.
- seo_keywords: 5-8 relevant search keywords.
- meta_description: At most 155 characters including primary keyword.
- plain text only (no emojis, no HTML). Separate paragraphs in long_description with '\\n\\n'.`;

  // Build user prompt lines
  const sections = [];

  // 1. Product Summary
  sections.push(`Product: ${product.name} (Brand: ${product.brand || 'N/A'}, Category: ${product.category})`);

  // 2. Copy Options
  const tone = options.tone || retailerProfile?.preferred_tone || 'professional, engaging';
  const length = LENGTH_GUIDE[options.length] || LENGTH_GUIDE.medium;
  sections.push(`Requested Tone: ${tone}`);
  sections.push(`Requested Length: ${length}`);

  // 3. Retailer Content Profile & Writing Patterns (if available)
  if (retailerProfile) {
    const profileLines = ['RETAILER WRITING PATTERNS:'];
    if (retailerProfile.sentence_style) profileLines.push(`- Sentence Style: ${retailerProfile.sentence_style}`);
    if (retailerProfile.title_structure) profileLines.push(`- Preferred Title Structure: ${retailerProfile.title_structure}`);
    if (retailerProfile.bullet_structure) profileLines.push(`- Bullet Structure: ${retailerProfile.bullet_structure}`);
    if (retailerProfile.vocabulary_patterns?.length) {
      profileLines.push(`- Preferred Vocabulary / Phrases: ${retailerProfile.vocabulary_patterns.slice(0, 8).join(', ')}`);
    }
    const wordsToAvoid = retailerProfile.profile_data?.words_to_avoid;
    if (Array.isArray(wordsToAvoid) && wordsToAvoid.length) {
      profileLines.push(`- WORDS/PHRASES TO AVOID: ${wordsToAvoid.join(', ')}`);
    }
    sections.push(profileLines.join('\n'));
  }

  // 4. Canonical Product Facts (The Evidence Core)
  const facts = intelligence?.canonical_facts || [];
  if (facts.length > 0) {
    sections.push(`VERIFIED CANONICAL FACTS (Use as foundation):\n${facts.slice(0, 15).map((f) => `- ${f}`).join('\n')}`);
  }

  // 5. Key Grounded Benefits & Use Cases
  if (intelligence?.key_benefits?.length) {
    sections.push(`KEY BENEFITS TO COMMUNICATE:\n${intelligence.key_benefits.map((b) => `- ${b}`).join('\n')}`);
  }
  if (intelligence?.use_cases?.length) {
    sections.push(`USE CASES & TARGET AUDIENCE:\n${intelligence.use_cases.map((u) => `- ${u}`).join('\n')}`);
  }

  // 6. Raw Product Attributes JSON for exact spec references
  sections.push(`RAW PRODUCT DATA:\n${JSON.stringify({
    price: product.price,
    currency: product.currency,
    features: product.features,
    specifications: product.specifications,
    attributes: product.attributes,
    seed_keywords: product.seed_keywords,
  }, null, 2)}`);

  return {
    systemPrompt,
    userPrompt: sections.join('\n\n'),
  };
}
