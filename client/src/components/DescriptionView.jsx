const CHECK_LABELS = {
  title_length_ok: 'Title ≤ 70 characters',
  meta_length_ok: 'Meta description ≤ 155 characters',
  primary_keyword_in_title: 'Primary keyword in title',
  primary_keyword_in_meta: 'Primary keyword in meta description',
  bullet_count_ok: '3–6 bullet points',
};

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

      <h4>Quality checks <small>{quality.seo.passed}/{quality.seo.total} passed</small></h4>
      <ul className="checks">
        {Object.entries(CHECK_LABELS).map(([key, label]) => (
          <li key={key} className={quality.seo[key] ? 'pass' : 'fail'}>{quality.seo[key] ? '✓' : '✗'} {label}</li>
        ))}
      </ul>
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
