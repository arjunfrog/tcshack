const CHECK_LABELS = {
  title_length_ok: 'Title ≤ 70 characters',
  meta_length_ok: 'Meta description ≤ 155 characters',
  primary_keyword_in_title: 'Primary keyword in title',
  primary_keyword_in_meta: 'Primary keyword in meta description',
  primary_keyword_early: 'Primary keyword in the first 100 words',
  bullet_count_ok: '3–6 bullet points',
};

const STYLE_LABELS = {
  meta_reference: 'Mentions its source',
  stock_opener: 'Formula opener',
  cliche: 'Cliché',
  keyword_stuffing: 'Keyword overused',
  exclamation: 'Exclamation marks',
  title_repeat: 'Title repeats a word',
  title_case: 'Title not in Title Case',
  avoided_word: 'Brand word to avoid',
};

// Shape a saved description row like a fresh /api/generate result so it can be shown here.
export const toResult = (row) => ({
  output: {
    title: row.title,
    short_description: row.short_description,
    long_description: row.long_description,
    bullet_points: row.bullet_points,
    seo_keywords: row.seo_keywords,
    meta_description: row.meta_description,
  },
  meta: {
    provider: row.provider,
    model: row.model,
    input_tokens: row.input_tokens ?? 0,
    output_tokens: row.output_tokens ?? 0,
    latency_ms: row.latency_ms ?? 0,
  },
  quality: row.quality,
});

export default function DescriptionView({ result }) {
  const { output, meta, quality } = result;

  return (
    <section className="card result">
      <div className="card-header">
        <h2>Generated copy</h2>
        <button
          type="button"
          className="ghost"
          onClick={() => navigator.clipboard?.writeText(JSON.stringify(output, null, 2))}
        >
          Copy JSON
        </button>
      </div>

      <h3 className="product-title">{output.title}</h3>
      <p className="lead">{output.short_description}</p>
      {output.long_description.split(/\n{2,}/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}
      <ul>{output.bullet_points.map((bullet, i) => <li key={i}>{bullet}</li>)}</ul>

      <h4>Meta description <small>{output.meta_description.length} chars</small></h4>
      <p className="meta">{output.meta_description}</p>

      <h4>SEO keywords <small>{quality.seo.keyword_coverage}% used in the copy</small></h4>
      <div className="chips">{output.seo_keywords.map((keyword) => <span key={keyword} className="chip">{keyword}</span>)}</div>

      <h4>SEO checks <small>{quality.seo.passed}/{quality.seo.total} passed{Number.isFinite(quality.seo.readability) && ` · readability ${quality.seo.readability}`}</small></h4>
      <ul className="checks">
        {Object.entries(CHECK_LABELS).filter(([key]) => key in quality.seo).map(([key, label]) => (
          <li key={key} className={quality.seo[key] ? 'pass' : 'fail'}>{quality.seo[key] ? '✓' : '✗'} {label}</li>
        ))}
      </ul>

      {quality.facts && (
        <>
          <h4>Fact check <small>{quality.facts.passed ? 'every figure and claim is in the product data' : `${quality.facts.unsupported.length} to verify`}</small></h4>
          {quality.facts.passed
            ? <p className="checks pass">✓ Nothing invented</p>
            : (
              <ul className="checks">
                {quality.facts.unsupported.map((item) => (
                  <li key={`${item.text}-${item.issue}`} className="fail">✗ <strong>“{item.text}”</strong> {item.issue.toLowerCase()} <span className="muted">({item.fields.join(', ')})</span></li>
                ))}
              </ul>
            )}
        </>
      )}

      {quality.style && (
        <>
          <h4>Style <small>{quality.style.passed ? 'reads naturally' : `${quality.style.issues.length} to polish`}</small></h4>
          {quality.style.passed
            ? <p className="checks pass">✓ No clichés, formula openers or keyword stuffing</p>
            : (
              <ul className="checks">
                {quality.style.issues.map((issue) => (
                  <li key={`${issue.type}-${issue.text}`} className="fail">✗ {STYLE_LABELS[issue.type] ?? issue.type}: <span className="muted">{issue.text}</span></li>
                ))}
              </ul>
            )}
        </>
      )}

      {quality.refine && (
        <p className="muted">
          Auto-fix: {quality.refine.accepted ? 'applied' : 'tried, original kept'} for {quality.refine.problems.length} problem{quality.refine.problems.length === 1 ? '' : 's'}
          {quality.refine.error && ` (${quality.refine.error})`}
        </p>
      )}
      {quality.input.sparse && (
        <p className="notice-inline">Thin product data ({quality.input.score}/100), so the copy is kept short. Add {quality.input.issues.join(', ').toLowerCase()} for richer copy.</p>
      )}
      {quality.market && <MarketPanel market={quality.market} />}
      {quality.brand && (
        <>
          <h4>Brand voice <small>{quality.brand.brand}</small></h4>
          <ul className="checks">
            <li className={quality.brand.ok ? 'pass' : 'fail'}>
              {quality.brand.ok
                ? `✓ None of your avoided words${quality.brand.avoid_words.length ? ` (${quality.brand.avoid_words.join(', ')})` : ''}`
                : `✗ Uses avoided words: ${quality.brand.avoid_words_found.join(', ')}`}
            </li>
          </ul>
        </>
      )}
      <p className="muted">
        Input completeness: {quality.input.score}/100
        {quality.input.issues.length > 0 && ` (${quality.input.issues.join(', ')})`}
      </p>
      <p className="muted">
        {meta.provider} · {meta.model} · {meta.input_tokens} in / {meta.output_tokens} out tokens · {(meta.latency_ms / 1000).toFixed(1)} s
      </p>
    </section>
  );
}

const SOURCE_LABELS = { amazon_search_suggestions: 'Amazon search suggestions', flipkart_search: 'Flipkart top listings' };

// What Anakin found for this product type, and which real searches the copy picked up.
function MarketPanel({ market }) {
  const used = new Set(market.search_terms_used);
  return (
    <>
      <h4>
        Market insights <small>"{market.query}" · {market.sources.map((source) => SOURCE_LABELS[source] ?? source).join(' + ')}</small>
      </h4>
      {market.search_terms.length > 0 ? (
        <>
          <p className="muted">Real shopper searches. Highlighted ones are used in this copy ({used.size}/{market.search_terms.length}):</p>
          <div className="chips">
            {market.search_terms.map((term) => (
              <span key={term} className={`chip ${used.has(term) ? 'chip-used' : 'chip-unused'}`}>{term}</span>
            ))}
          </div>
        </>
      ) : <p className="muted">No search suggestions for this type; top listings shaped the emphasis.</p>}
    </>
  );
}
