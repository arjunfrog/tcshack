import { Icon, StatusDot } from './ui.jsx';

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
  status: row.status,
});

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
  avoided_word: 'A word your brand avoids',
};

const SOURCE_LABELS = { amazon_search_suggestions: 'Amazon search suggestions', flipkart_search: 'Flipkart top listings' };

// The three headline checks, as pills under the product name.
export function QualityPills({ quality }) {
  if (!quality?.seo) return null;
  const { seo, facts, style } = quality;
  return (
    <div className="pills">
      <StatusDot kind={seo.passed === seo.total ? 'good' : 'warn'}>SEO {seo.passed}/{seo.total}</StatusDot>
      {facts && <StatusDot kind={facts.passed ? 'good' : 'warn'}>{facts.passed ? 'Nothing invented' : `${facts.unsupported.length} to verify`}</StatusDot>}
      {style && <StatusDot kind={style.passed ? 'good' : 'warn'}>{style.passed ? 'Reads naturally' : `${style.issues.length} to polish`}</StatusDot>}
    </div>
  );
}

// The copy itself: paragraphs, then the bullets.
export function CopyPanel({ output }) {
  return (
    <section className="panel copy-panel">
      <h2>Description</h2>
      <div className="prose">
        {output.long_description.split(/\n{2,}/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}
      </div>
      <ul className="bullets">
        {output.bullet_points.map((bullet, i) => {
          const [lead, ...rest] = bullet.split(/:\s/);
          return (
            <li key={i}>
              <Icon name="check" size={16} />
              <span>{rest.length ? <><strong>{lead}:</strong> {rest.join(': ')}</> : bullet}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// How the listing would read as a search result: the generated title and meta, at real lengths.
export function SearchPreview({ output, product, quality }) {
  const slug = (text) => String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const used = new Set(
    output.seo_keywords.filter((keyword) =>
      `${output.title} ${output.short_description} ${output.long_description} ${output.bullet_points.join(' ')}`.toLowerCase().includes(keyword.toLowerCase())),
  );
  return (
    <section className="serp" aria-label="Search preview">
      <div className="serp-body">
        <h2><Icon name="globe" size={20} /> How it shows up in search</h2>
        <div className="serp-result">
          <span className="serp-path">yourstore.in › {slug(product?.category)} › {slug(product?.name)}</span>
          <span className="serp-title">{output.title}</span>
          <p className="serp-desc">{output.meta_description}</p>
        </div>
        <div className="serp-meters">
          <Meter label="Title" value={output.title.length} max={70} />
          <Meter label="Meta" value={output.meta_description.length} max={155} />
          {Number.isFinite(quality?.seo?.readability) && <span className="serp-note">Readability {quality.seo.readability}</span>}
        </div>
        <div className="chips">
          {output.seo_keywords.map((keyword, i) => (
            <span key={keyword} className={`chip ${used.has(keyword) ? 'chip-on' : ''}`} title={used.has(keyword) ? 'Used in the copy' : 'Keyword only'}>
              {i === 0 && <Icon name="search" size={13} />}{keyword}
            </span>
          ))}
        </div>
      </div>
      <LeafArt className="serp-art" />
    </section>
  );
}

function Meter({ label, value, max }) {
  const over = value > max;
  return (
    <span className={`len-meter ${over ? 'over' : ''}`}>
      {label} {value}/{max}
      <span className="len-track"><span className="len-fill" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></span>
    </span>
  );
}

// Decorative hills and leaves (search banner, login page), in the page's own greens.
export function LeafArt({ className }) {
  return (
    <svg className={className} viewBox="0 0 320 160" aria-hidden="true" preserveAspectRatio="xMaxYMax slice">
      <path d="M0 160 C60 92 120 104 170 120 C215 134 250 96 320 70 V160 Z" className="hill-far" />
      <path d="M60 160 C120 120 190 132 240 140 C270 145 300 128 320 120 V160 Z" className="hill-near" />
      <g className="leaves">
        <path d="M262 150 C250 108 268 72 300 52 C306 92 292 126 262 150 Z" />
        <path d="M284 152 C296 120 320 104 330 100 C330 128 312 146 284 152 Z" />
        <path d="M238 152 C226 130 230 108 246 92 C258 116 254 138 238 152 Z" />
      </g>
      <path d="M262 150 C276 114 288 84 300 52 M284 152 C300 134 316 114 330 100 M238 152 C242 130 244 112 246 92" className="leaf-veins" />
    </svg>
  );
}

// Everything the checks found, folded away unless something needs attention.
export function QualityReport({ quality, meta }) {
  if (!quality?.seo) return null;
  const { seo, facts, style, refine, input, market, brand } = quality;
  const needsAttention = seo.passed < seo.total || (facts && !facts.passed) || (style && !style.passed);
  return (
    <details className="panel report" open={needsAttention}>
      <summary>
        <h2>Quality report</h2>
        <QualityPills quality={quality} />
        <Icon name="chevronDown" size={18} className="report-toggle" />
      </summary>
      <div className="report-grid">
        <div>
          <h3>Search basics</h3>
          <ul className="checklist">
            {Object.entries(CHECK_LABELS).filter(([key]) => key in seo).map(([key, label]) => (
              <li key={key} className={seo[key] ? 'pass' : 'fail'}><Icon name={seo[key] ? 'check' : 'alert'} size={16} />{label}</li>
            ))}
          </ul>
        </div>
        {facts && (
          <div>
            <h3>Facts</h3>
            {facts.passed
              ? <p className="checklist-note pass"><Icon name="check" size={16} />Every number and claim is in the product data.</p>
              : (
                <ul className="checklist">
                  {facts.unsupported.map((item) => (
                    <li key={`${item.text}-${item.issue}`} className="fail"><Icon name="alert" size={16} /><span><strong>“{item.text}”</strong>: {item.issue.toLowerCase()}</span></li>
                  ))}
                </ul>
              )}
          </div>
        )}
        {style && (
          <div>
            <h3>Style</h3>
            {style.passed
              ? <p className="checklist-note pass"><Icon name="check" size={16} />No clichés, formula openers or keyword stuffing.</p>
              : (
                <ul className="checklist">
                  {style.issues.map((issue) => (
                    <li key={`${issue.type}-${issue.text}`} className="fail"><Icon name="alert" size={16} /><span>{STYLE_LABELS[issue.type] ?? issue.type}: {issue.text}</span></li>
                  ))}
                </ul>
              )}
          </div>
        )}
        {market && (
          <div>
            <h3>Market searches</h3>
            <p className="report-note">“{market.query}”, from {market.sources.map((source) => SOURCE_LABELS[source] ?? source).join(' and ')}. Highlighted terms are in this copy.</p>
            {market.search_terms.length > 0 ? (
              <div className="chips">
                {market.search_terms.map((term) => (
                  <span key={term} className={`chip ${market.search_terms_used.includes(term) ? 'chip-on' : ''}`}>{term}</span>
                ))}
              </div>
            ) : <p className="report-note">No search suggestions for this type; top listings shaped what to lead with.</p>}
          </div>
        )}
        {brand && (
          <div>
            <h3>Brand voice</h3>
            <p className={`checklist-note ${brand.ok ? 'pass' : 'fail'}`}>
              <Icon name={brand.ok ? 'check' : 'alert'} size={16} />
              {brand.ok
                ? `None of your avoided words${brand.avoid_words.length ? ` (${brand.avoid_words.join(', ')})` : ''}.`
                : `Uses words you avoid: ${brand.avoid_words_found.join(', ')}.`}
            </p>
          </div>
        )}
      </div>
      <p className="report-foot">
        {refine && <>Auto-fix {refine.accepted ? 'applied' : 'tried, first draft kept'} for {refine.problems.length} problem{refine.problems.length === 1 ? '' : 's'}{refine.error ? ` (${refine.error})` : ''}. </>}
        Product data {input.score}/100{input.issues.length > 0 && ` (${input.issues.join(', ').toLowerCase()})`}.
        {meta && <> Written by {meta.model}, {meta.input_tokens.toLocaleString('en-IN')} tokens in, {meta.output_tokens.toLocaleString('en-IN')} out, {(meta.latency_ms / 1000).toFixed(1)} s.</>}
      </p>
    </details>
  );
}
