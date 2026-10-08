// Rule-based checks that run without an LLM: one on the input data (is there
// enough to write good copy?) and one on the generated copy (does it meet SEO rules?).

// 0-100 score plus the reasons points were lost. Shown to users before generating.
export function checkCompleteness(product) {
  const checks = [
    { ok: Boolean(product.brand), weight: 10, issue: 'No brand' },
    { ok: product.price !== undefined, weight: 10, issue: 'No price' },
    { ok: product.features.length >= 3, weight: 30, issue: 'Fewer than 3 features' },
    { ok: Object.keys(product.specifications).length >= 2, weight: 20, issue: 'Fewer than 2 specifications' },
    { ok: Boolean(product.subcategory), weight: 10, issue: 'No subcategory' },
    { ok: product.seed_keywords.length > 0, weight: 10, issue: 'No seed keywords' },
    { ok: Object.keys(product.attributes).length > 0, weight: 10, issue: 'No extra attributes (color, material, audience...)' },
  ];
  return {
    score: checks.reduce((sum, check) => sum + (check.ok ? check.weight : 0), 0),
    issues: checks.filter((check) => !check.ok).map((check) => check.issue),
  };
}

const LIMITS = { title: 70, meta_description: 155 };

export function checkSeo(output) {
  const body = `${output.title} ${output.short_description} ${output.long_description} ${output.bullet_points.join(' ')}`.toLowerCase();
  const keywords = output.seo_keywords.map((keyword) => keyword.toLowerCase());
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
