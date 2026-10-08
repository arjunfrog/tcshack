// Metrics for the dashboard (phase 4), computed from stored descriptions and ratings.
// Pure functions: the route loads the rows, these do the arithmetic.

export const TARGET_RATED_4_PLUS = 85;

const round = (value, places = 1) => (Number.isFinite(value) ? Number(value.toFixed(places)) : null);
const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
const percent = (part, whole) => (whole ? round((part / whole) * 100) : null);
const groupBy = (rows, key) => Object.groupBy(rows, (row) => key(row) ?? '(none)');

const words = (text) => text.toLowerCase().split(/\s+/).filter(Boolean);
export const copyText = (d) => [d.title, d.short_description, d.long_description, ...(d.bullet_points ?? []), d.meta_description].join('\n');

// Share of words changed between two versions of the copy (word-level edit distance over
// the longer text): 0 = identical, 100 = rewritten.
export function changedPercent(before, after) {
  const a = words(before);
  const b = words(after);
  if (!a.length && !b.length) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return round((previous[b.length] / Math.max(a.length, b.length)) * 100);
}

// Per description: its mean relevance and creativity across reviewers. "Rated 4+" means
// both means are at least 4, the measure the problem statement's 85% target uses.
function ratingSummary(rated) {
  return {
    rated: rated.length,
    rated_4_plus_pct: percent(rated.filter((item) => item.relevance >= 4 && item.creativity >= 4).length, rated.length),
    avg_relevance: round(mean(rated.map((item) => item.relevance)), 2),
    avg_creativity: round(mean(rated.map((item) => item.creativity)), 2),
  };
}

const breakdown = (rated, key) =>
  Object.entries(groupBy(rated, key))
    .map(([name, group]) => ({ name, ...ratingSummary(group) }))
    .sort((a, b) => b.rated - a.rated);

// descriptions: rows with product { category }; feedback: rows with description_id, relevance, creativity.
export function computeMetrics({ descriptions, feedback }) {
  const byId = new Map(descriptions.map((d) => [d.id, d]));
  const generated = descriptions.filter((d) => d.provider !== 'human');
  const edits = descriptions.filter((d) => d.provider === 'human');

  const rated = Object.entries(groupBy(feedback.filter((f) => byId.has(f.description_id)), (f) => f.description_id)).map(([id, rows]) => {
    const description = byId.get(id);
    return {
      relevance: mean(rows.map((row) => row.relevance)),
      creativity: mean(rows.map((row) => row.creativity)),
      category: description.product?.category,
      tone: description.tone,
      model: description.model,
    };
  });

  const withQuality = generated.filter((d) => d.quality?.seo);
  const factFlags = withQuality.flatMap((d) => d.quality.facts?.unsupported ?? []);
  const styleIssues = withQuality.flatMap((d) => d.quality.style?.issues ?? []);
  const count = (items, key) =>
    Object.entries(groupBy(items, key))
      .map(([name, group]) => ({ name, count: group.length }))
      .sort((a, b) => b.count - a.count);

  const ratings = ratingSummary(rated);
  return {
    ratings: {
      ...ratings,
      ratings: feedback.length,
      target_pct: TARGET_RATED_4_PLUS,
      meets_target: ratings.rated_4_plus_pct !== null && ratings.rated_4_plus_pct >= TARGET_RATED_4_PLUS,
      by_category: breakdown(rated, (item) => item.category),
      by_tone: breakdown(rated, (item) => item.tone),
      by_model: breakdown(rated, (item) => item.model),
    },
    quality: {
      descriptions: withQuality.length,
      seo_pass_pct: percent(withQuality.filter((d) => d.quality.seo.passed === d.quality.seo.total).length, withQuality.length),
      avg_keyword_coverage: round(mean(withQuality.map((d) => d.quality.seo.keyword_coverage))),
      facts_clean_pct: percent(withQuality.filter((d) => d.quality.facts?.passed).length, withQuality.filter((d) => d.quality.facts).length),
      fact_flags: factFlags.length,
      top_fact_flags: count(factFlags, (flag) => flag.text).slice(0, 5),
      style_clean_pct: percent(withQuality.filter((d) => d.quality.style?.passed).length, withQuality.filter((d) => d.quality.style).length),
      style_issues: count(styleIssues, (issue) => issue.type),
    },
    usage: {
      products: new Set(generated.map((d) => d.product_id)).size,
      descriptions: generated.length,
      input_tokens: generated.reduce((sum, d) => sum + (d.input_tokens ?? 0), 0),
      output_tokens: generated.reduce((sum, d) => sum + (d.output_tokens ?? 0), 0),
      avg_latency_ms: round(mean(generated.filter((d) => d.latency_ms).map((d) => d.latency_ms)), 0),
      by_model: count(generated, (d) => d.model),
    },
    review: {
      draft: descriptions.filter((d) => d.status === 'draft').length,
      approved: descriptions.filter((d) => d.status === 'approved').length,
      rejected: descriptions.filter((d) => d.status === 'rejected').length,
      human_edits: edits.length,
      avg_changed_pct: round(mean(edits.map((d) => d.quality?.human_edit?.changed_pct).filter(Number.isFinite))),
    },
  };
}

// The review queue: for each product, its latest version if that is an AI draft this
// reviewer hasn't rated yet. Oldest first, so a batch is reviewed in the order it was made.
export function reviewQueue(descriptions, ratedIds) {
  const latest = new Map();
  for (const d of descriptions) {
    if (!latest.has(d.product_id) || d.version > latest.get(d.product_id).version) latest.set(d.product_id, d);
  }
  return [...latest.values()]
    .filter((d) => d.status === 'draft' && d.provider !== 'human' && !ratedIds.has(d.id))
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}
