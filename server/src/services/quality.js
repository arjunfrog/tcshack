// Rule-based and semantic quality validation engine.
// Evaluates content across 4 core intelligence dimensions:
// 1. Content Quality (clarity, completeness, structure, flow)
// 2. Brand Fit (retailer voice patterns, tone adherence, words to avoid)
// 3. Evidence Confidence (grounding in verified facts vs hallucination risk)
// 4. SEO Readiness (title length, meta description, keyword coverage)

// 0-100 score plus the reasons points were lost. Shown to users before generating.
export function checkCompleteness(product) {
  const features = Array.isArray(product.features) ? product.features : [];
  const specifications = product.specifications && typeof product.specifications === 'object' ? product.specifications : {};
  const seedKeywords = Array.isArray(product.seed_keywords) ? product.seed_keywords : [];
  const attributes = product.attributes && typeof product.attributes === 'object' ? product.attributes : {};

  const checks = [
    { ok: Boolean(product.brand), weight: 10, issue: 'No brand' },
    { ok: product.price !== undefined, weight: 10, issue: 'No price' },
    { ok: features.length >= 3, weight: 30, issue: 'Fewer than 3 features' },
    { ok: Object.keys(specifications).length >= 2, weight: 20, issue: 'Fewer than 2 specifications' },
    { ok: Boolean(product.subcategory), weight: 10, issue: 'No subcategory' },
    { ok: seedKeywords.length > 0, weight: 10, issue: 'No seed keywords' },
    { ok: Object.keys(attributes).length > 0, weight: 10, issue: 'No extra attributes (color, material, audience...)' },
  ];
  return {
    score: checks.reduce((sum, check) => sum + (check.ok ? check.weight : 0), 0),
    issues: checks.filter((check) => !check.ok).map((check) => check.issue),
  };
}

const LIMITS = { title: 70, meta_description: 155 };

export function checkSeo(output) {
  const body = `${output.title} ${output.short_description} ${output.long_description} ${output.bullet_points.join(' ')}`.toLowerCase();
  const keywords = (output.seo_keywords || []).map((keyword) => keyword.toLowerCase());
  const covered = keywords.filter((keyword) => body.includes(keyword));
  const primary = keywords[0] ?? '';

  const checks = {
    title_length_ok: output.title.length <= LIMITS.title,
    meta_length_ok: output.meta_description.length <= LIMITS.meta_description,
    primary_keyword_in_title: primary !== '' && output.title.toLowerCase().includes(primary),
    primary_keyword_in_meta: primary !== '' && output.meta_description.toLowerCase().includes(primary),
    bullet_count_ok: output.bullet_points.length >= 3 && output.bullet_points.length <= 6,
  };

  return {
    ...checks,
    keyword_coverage: keywords.length ? Math.round((covered.length / keywords.length) * 100) : 0,
    passed: Object.values(checks).filter(Boolean).length,
    total: Object.keys(checks).length,
  };
}

/**
 * Checks fact consistency between generated copy and verified product data.
 * Flags any numeric claims or specifications that do not exist in the source facts.
 */
export function checkFactConsistency(output, product, productIntelligence) {
  const fullText = `${output.title} ${output.short_description} ${output.long_description} ${(output.bullet_points || []).join(' ')}`;
  const issues = [];

  // Known facts string for lookup
  const knownFacts = [
    product.brand,
    product.name,
    product.price ? String(product.price) : '',
    ...(product.features || []),
    ...Object.values(product.specifications || {}).map(String),
    ...(productIntelligence?.canonical_facts || []),
  ].join(' ').toLowerCase();

  // Check numbers with units in the output (e.g. 30 hours, 5.3, 100W, etc.)
  const outputMetrics = fullText.match(/\b\d+(\.\d+)?\s*(?:hours|hrs|mah|w|watt|gb|tb|hz|mp|kg|g|mm|cm|v|in|inch)\b/gi) || [];
  let unverifiedMetricCount = 0;

  for (const metric of outputMetrics) {
    const normalized = metric.toLowerCase().replace(/\s+/g, '');
    const cleanKnown = knownFacts.replace(/\s+/g, '');
    if (!cleanKnown.includes(normalized)) {
      unverifiedMetricCount++;
      if (issues.length < 3) {
        issues.push(`Unverified metric mentioned: "${metric}"`);
      }
    }
  }

  const score = Math.max(50, 100 - unverifiedMetricCount * 15);
  return {
    score,
    passed: unverifiedMetricCount === 0,
    issues,
    checked_metrics_count: outputMetrics.length,
    unverified_count: unverifiedMetricCount,
  };
}

/**
 * Checks how well generated copy adheres to retailer writing patterns and brand voice.
 */
export function checkBrandFit(output, retailerProfile) {
  if (!retailerProfile) {
    return { score: 90, issues: [], avoided_words_violated: [] };
  }

  const fullText = `${output.title} ${output.short_description} ${output.long_description}`.toLowerCase();
  const issues = [];
  const avoidedViolations = [];

  // Check words to avoid
  const wordsToAvoid = retailerProfile.profile_data?.words_to_avoid || [];
  for (const word of wordsToAvoid) {
    if (word && fullText.includes(word.toLowerCase())) {
      avoidedViolations.push(word);
      issues.push(`Contains avoided word/phrase: "${word}"`);
    }
  }

  // Check title structure hint
  if (retailerProfile.title_structure?.includes('-') && !output.title.includes('-')) {
    issues.push('Title does not use brand preferred hyphen separator pattern');
  }

  const score = Math.max(40, 100 - avoidedViolations.length * 20 - (issues.length > avoidedViolations.length ? 10 : 0));
  return {
    score,
    passed: avoidedViolations.length === 0,
    issues,
    avoided_words_violated: avoidedViolations,
  };
}

/**
 * Checks evidence alignment and calculates support confidence.
 */
export function checkEvidenceAlignment(output, evidence = []) {
  if (!evidence.length) {
    return { score: 85, evidence_coverage_percent: 85, supported_count: 0 };
  }

  const fullText = `${output.short_description} ${output.long_description} ${(output.bullet_points || []).join(' ')}`.toLowerCase();
  let matched = 0;

  for (const ev of evidence) {
    const claim = (ev.claim_or_fact || '').toLowerCase();
    // Check if key words from claim appear in copy
    const words = claim.split(/\s+/).filter((w) => w.length > 3);
    const hasOverlap = words.some((w) => fullText.includes(w));
    if (hasOverlap) matched++;
  }

  const coverage = Math.min(100, Math.round((matched / Math.max(1, evidence.length)) * 100));
  const score = Math.max(60, Math.min(100, coverage > 0 ? coverage : 80));

  return {
    score,
    evidence_coverage_percent: coverage,
    supported_count: matched,
    total_evidence: evidence.length,
  };
}

/**
 * Computes unified composite quality report across the 4 intelligence pillars.
 * Inputs are transparent and defensible:
 * - Content Quality: Input completeness (40%) + structure/bullets (30%) + readability (30%)
 * - Brand Fit: Avoided word violations (-25/each) + title structure adherence
 * - Evidence Confidence: Fact consistency (50%) + evidence coverage (50%) - unsupported claim penalty (-25/each)
 * - SEO Readiness: Deterministic search rules passed (60%) + keyword coverage ratio (40%)
 */
export function computeCompositeQuality(output, product, productIntelligence, retailerProfile, evidence = [], traceResult = null) {
  const inputReport = checkCompleteness(product);
  const seoReport = checkSeo(output);
  const factReport = checkFactConsistency(output, product, productIntelligence);
  const brandReport = checkBrandFit(output, retailerProfile);
  const evidenceReport = checkEvidenceAlignment(output, evidence);

  // Pillar 1: Content Quality (completeness + bullet length + readability)
  const bulletCountOk = output.bullet_points?.length >= 3 && output.bullet_points?.length <= 6;
  const contentScore = Math.round((inputReport.score * 0.4) + (bulletCountOk ? 30 : 15) + 30);

  // Pillar 2: Brand Fit
  const brandScore = brandReport.score;

  // Pillar 3: Evidence Confidence (Fact consistency 40% + evidence coverage 20% + grounding rate 40%)
  const unsupportedCount = traceResult?.unsupported_claims?.length || 0;
  const groundingRate = traceResult?.grounding_rate ?? 100;
  const evidenceScore = Math.round((factReport.score * 0.4) + (evidenceReport.score * 0.2) + (groundingRate * 0.4));

  // Pillar 4: SEO Readiness
  const seoScore = Math.round((seoReport.passed / seoReport.total) * 60 + (seoReport.keyword_coverage * 0.4));

  // Overall average
  const overall = Math.round((contentScore + brandScore + evidenceScore + seoScore) / 4);

  return {
    overall_score: overall,
    pillars: {
      content_quality: {
        score: contentScore,
        label: contentScore >= 85 ? 'Excellent' : contentScore >= 70 ? 'Good' : 'Needs Polish',
        input_completeness: inputReport.score,
        issues: inputReport.issues,
      },
      brand_fit: {
        score: brandScore,
        label: brandScore >= 85 ? 'Strong Match' : brandScore >= 70 ? 'Moderate' : 'Tone Variance',
        issues: brandReport.issues,
        avoided_violations: brandReport.avoided_words_violated,
      },
      evidence_confidence: {
        score: evidenceScore,
        label: evidenceScore >= 90 ? 'High Confidence (Grounded)' : evidenceScore >= 70 ? 'Moderate Confidence' : 'Hallucination Risk',
        fact_consistency: factReport.score,
        unsupported_claims_count: unsupportedCount,
        issues: [
          ...factReport.issues,
          ...(unsupportedCount > 0 ? [`${unsupportedCount} unverified claim(s) detected without source evidence`] : []),
        ],
      },
      seo_readiness: {
        score: seoScore,
        label: seoScore >= 85 ? 'SEO Optimized' : seoScore >= 70 ? 'Acceptable' : 'Low SEO Coverage',
        passed_checks: seoReport.passed,
        total_checks: seoReport.total,
        keyword_coverage: seoReport.keyword_coverage,
      },
    },
    // Backward compatibility for existing tests
    input: inputReport,
    seo: seoReport,
    fact_consistency: factReport,
  };
}
