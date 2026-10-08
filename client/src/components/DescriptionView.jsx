import Icon from '../ui/Icon.jsx';
import { Hills, LeafSprig } from '../ui/Art.jsx';

const CHECK_LABELS = {
  title_length_ok: 'Title within 70 characters',
  meta_length_ok: 'Meta description within 155 characters',
  primary_keyword_in_title: 'Main keyword in the title',
  primary_keyword_in_meta: 'Main keyword in the meta description',
  primary_keyword_early: 'Main keyword in the first 100 words',
  bullet_count_ok: '3 to 6 bullet points',
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

const SOURCE_LABELS = { amazon_search_suggestions: 'Amazon search suggestions', flipkart_search: 'Flipkart top listings' };

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

export const copyJson = (output) => navigator.clipboard?.writeText(JSON.stringify(output, null, 2));

const slug = (text = '') => text.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const wordCount = (text = '') => (text.match(/\S+/g) ?? []).length;
const copyText = (output) => `${output.title} ${output.short_description} ${output.long_description} ${output.bullet_points.join(' ')}`.toLowerCase();

// The copy itself: title, short and long description, bullets and meta description.
export function CopyPanel({ output, showTitle = true }) {
  return (
    <div className="copy-panel">
      {showTitle && <h3 className="product-title">{output.title}</h3>}
      <p className="lead">{output.short_description}</p>
      {output.long_description.split(/\n{2,}/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}
      <ul>{output.bullet_points.map((bullet, i) => <li key={i}>{bullet}</li>)}</ul>
    </div>
  );
}

// The title and meta description as a search result, with length meters and the metrics
// that decide how the page ranks and reads.
export function SearchPreview({ output, quality, product }) {
  const text = copyText(output);
  const used = new Set(output.seo_keywords.filter((keyword) => text.includes(keyword.toLowerCase())));
  const words = wordCount(output.long_description);
  const market = quality?.market;
  const metrics = [
    { label: 'Words', value: words, note: 'long description' },
    { label: 'Readability', value: Number.isFinite(quality?.seo?.readability) ? quality.seo.readability : '—', note: 'Flesch ease, aim 60+', good: quality?.seo?.readability >= 60 },
    { label: 'Keywords used', value: `${quality?.seo?.keyword_coverage ?? Math.round((used.size / Math.max(1, output.seo_keywords.length)) * 100)}%`, note: `${used.size} of ${output.seo_keywords.length} in the copy` },
    ...(market?.search_terms?.length ? [{ label: 'Shopper searches', value: `${market.search_terms_used.length}/${market.search_terms.length}`, note: 'real searches covered' }] : []),
    { label: 'Bullets', value: output.bullet_points.length, note: 'scannable points' },
  ];

  return (
    <section className="card search-preview">
      <div className="search-main">
        <h3><Icon name="globe" size={20} /> How it shows up in search</h3>
        <div className="serp-result">
          <span className="serp-path"><span className="serp-favicon"><Icon name="bag" size={12} /></span>yourstore.in › {slug(product?.category) || 'catalog'} › {slug(product?.name) || 'product'}</span>
          <span className="serp-title">{output.title}</span>
          <p className="serp-desc">{output.meta_description}</p>
        </div>
        <div className="serp-meters">
          <Meter label="Title" value={output.title.length} max={70} />
          <Meter label="Meta" value={output.meta_description.length} max={155} min={120} />
        </div>
        <div className="chips">
          {output.seo_keywords.map((keyword, i) => (
            <span key={keyword} className={`chip ${used.has(keyword) ? 'chip-on' : ''}`} title={used.has(keyword) ? 'Used in the copy' : 'Keyword only'}>
              {i === 0 && <Icon name="search" size={13} />} {keyword}
            </span>
          ))}
        </div>
      </div>
      <div className="search-metrics">
        {metrics.map((metric) => (
          <div key={metric.label} className="metric">
            <span className="metric-value">{metric.value}</span>
            <span className="metric-label">{metric.label}</span>
            <small>{metric.note}</small>
          </div>
        ))}
      </div>
      <Hills className="search-hills" />
      <LeafSprig className="search-sprig" flip />
    </section>
  );
}

function Meter({ label, value, max, min = 0 }) {
  const state = value > max ? 'over' : value < min ? 'short' : 'ok';
  return (
    <span className={`len-meter ${state}`}>
      <span>{label} <strong>{value}/{max}</strong></span>
      <span className="len-track"><span className="len-fill" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></span>
    </span>
  );
}

// Summary pills for the quality report header.
function QualityPills({ quality }) {
  const { seo, facts, style, brand } = quality;
  const pills = [
    { ok: seo.passed === seo.total, text: `SEO ${seo.passed}/${seo.total}` },
    facts && { ok: facts.passed, text: facts.passed ? 'Nothing invented' : `${facts.unsupported.length} fact${facts.unsupported.length === 1 ? '' : 's'} to verify` },
    style && { ok: style.passed, text: style.passed ? 'Reads naturally' : `${style.issues.length} style note${style.issues.length === 1 ? '' : 's'}` },
    brand && { ok: brand.ok, text: brand.ok ? 'On brand' : 'Uses an avoided word' },
  ].filter(Boolean);
  return (
    <span className="quality-pills">
      {pills.map((pill) => <span key={pill.text} className={`q-pill ${pill.ok ? 'ok' : 'warn'}`}><i />{pill.text}</span>)}
    </span>
  );
}

// Everything the checks found, folded away unless something needs attention.
export function QualityReport({ result }) {
  const { meta, quality } = result;
  if (!quality?.seo) return null;
  const { seo, facts, style, refine, input, market, brand } = quality;
  const needsAttention = seo.passed < seo.total || (facts && !facts.passed) || (style && !style.passed) || (brand && !brand.ok);
  const used = new Set(market?.search_terms_used ?? []);

  return (
    <details className="card quality-report" open={needsAttention}>
      <summary>
        <h3><Icon name="shield" size={20} /> Quality report</h3>
        <QualityPills quality={quality} />
        <Icon name="chevronDown" size={18} className="report-toggle" />
      </summary>

      <div className="report-grid">
        <div>
          <h4>Search basics</h4>
          <ul className="checks">
            {Object.entries(CHECK_LABELS).filter(([key]) => key in seo).map(([key, label]) => (
              <li key={key} className={seo[key] ? 'pass' : 'fail'}><Icon name={seo[key] ? 'check' : 'x'} size={15} /> {label}</li>
            ))}
          </ul>
        </div>
        {facts && (
          <div>
            <h4>Facts</h4>
            {facts.passed
              ? <ul className="checks"><li className="pass"><Icon name="check" size={15} /> Every number and claim is in the product data.</li></ul>
              : (
                <ul className="checks">
                  {facts.unsupported.map((item) => (
                    <li key={`${item.text}-${item.issue}`} className="fail"><Icon name="x" size={15} /> <span><strong>“{item.text}”</strong> {item.issue.toLowerCase()} <span className="muted">({item.fields.join(', ')})</span></span></li>
                  ))}
                </ul>
              )}
          </div>
        )}
        {style && (
          <div>
            <h4>Style</h4>
            {style.passed
              ? <ul className="checks"><li className="pass"><Icon name="check" size={15} /> No clichés, formula openers or keyword stuffing.</li></ul>
              : (
                <ul className="checks">
                  {style.issues.map((issue) => (
                    <li key={`${issue.type}-${issue.text}`} className="fail"><Icon name="x" size={15} /> <span>{STYLE_LABELS[issue.type] ?? issue.type}: <span className="muted">{issue.text}</span></span></li>
                  ))}
                </ul>
              )}
          </div>
        )}
        {market && (
          <div className="span-2">
            <h4>Market searches</h4>
            <p className="muted">“{market.query}”, from {market.sources.map((source) => SOURCE_LABELS[source] ?? source).join(' and ')}. Highlighted terms are in this copy.</p>
            {market.search_terms.length
              ? <div className="chips">{market.search_terms.map((term) => <span key={term} className={`chip ${used.has(term) ? 'chip-on' : ''}`}>{term}</span>)}</div>
              : <p className="muted">No search suggestions for this type; top listings shaped the emphasis.</p>}
          </div>
        )}
        {brand && (
          <div>
            <h4>Brand voice</h4>
            <ul className="checks">
              <li className={brand.ok ? 'pass' : 'fail'}>
                <Icon name={brand.ok ? 'check' : 'x'} size={15} />
                {brand.ok ? ` None of your avoided words${brand.avoid_words.length ? ` (${brand.avoid_words.join(', ')})` : ''}.` : ` Uses: ${brand.avoid_words_found.join(', ')}`}
              </li>
            </ul>
          </div>
        )}
      </div>

      {input?.sparse && (
        <p className="notice-inline">Thin product data ({input.score}/100), so the copy is kept short. Add {input.issues.join(', ').toLowerCase()} for richer copy.</p>
      )}
      <p className="report-foot">
        Product data {input?.score ?? '—'}/100{input?.issues?.length ? ` (${input.issues.join(', ').toLowerCase()})` : ''}.
        {' '}Written by {meta.model}, {meta.input_tokens.toLocaleString()} tokens in, {meta.output_tokens.toLocaleString()} out, {(meta.latency_ms / 1000).toFixed(1)} s.
        {refine && ` Auto-fix ${refine.accepted ? 'applied' : 'tried, original kept'} for ${refine.problems.length} problem${refine.problems.length === 1 ? '' : 's'}${refine.error ? ` (${refine.error})` : ''}.`}
      </p>
    </details>
  );
}

// Copy, search preview and quality report together (History, Review, Quick generate).
export default function DescriptionView({ result, product }) {
  return (
    <div className="description-view">
      <section className="card result">
        <div className="card-header">
          <h3><Icon name="pen" size={18} /> Generated copy</h3>
          <button type="button" className="ghost" onClick={() => copyJson(result.output)}><Icon name="copy" size={15} /> Copy JSON</button>
        </div>
        <CopyPanel output={result.output} />
      </section>
      <SearchPreview output={result.output} quality={result.quality} product={product} />
      <QualityReport result={result} />
    </div>
  );
}
