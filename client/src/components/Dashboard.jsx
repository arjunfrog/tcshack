import { useEffect, useState } from 'react';
import { api } from '../api.js';

const pct = (value) => (value === null || value === undefined ? '—' : `${Math.round(value)}%`);
const num = (value, digits = 0) => (value === null || value === undefined ? '—' : Number(value).toLocaleString('en-IN', { maximumFractionDigits: digits }));

// Metrics dashboard (phase 4): the headline % rated 4+, quality pass rates, usage and review progress.
export default function Dashboard({ refreshKey }) {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.metrics().then(setMetrics).catch((err) => setError(err.message));
  }, [refreshKey]);

  if (error) return <div className="card error">{error}</div>;
  if (!metrics) return <div className="card empty">Loading metrics…</div>;

  const { ratings, quality, usage, review } = metrics;
  return (
    <div className="dashboard">
      <Headline ratings={ratings} />

      <section className="kpis" aria-label="Quality at a glance">
        <Tile label="Avg relevance" value={num(ratings.avg_relevance, 2)} unit="/ 5" />
        <Tile label="Avg creativity" value={num(ratings.avg_creativity, 2)} unit="/ 5" />
        <Tile label="All SEO checks passed" value={pct(quality.seo_pass_pct)} note={`keyword coverage ${pct(quality.avg_keyword_coverage)}`} />
        <Tile label="Fact check clean" value={pct(quality.facts_clean_pct)} note={`${num(quality.fact_flags)} flag${quality.fact_flags === 1 ? '' : 's'} to verify`} />
        <Tile label="Style clean" value={pct(quality.style_clean_pct)} note="no clichés or stuffing" />
        <Tile label="Readability" value={num(quality.avg_readability)} note="Flesch ease, aim 60+" />
        <Tile label="Auto-fixes kept" value={`${num(quality.fixes_kept)} / ${num(quality.fixes_tried)}`} note="fix-up pass" />
      </section>

      <div className="dashboard-grid">
        <Breakdown title="Rated 4+ by category" rows={ratings.by_category} />
        <Breakdown title="Rated 4+ by tone" rows={ratings.by_tone} />
        <Breakdown title="Rated 4+ by model" rows={ratings.by_model} />

        <section className="card">
          <h2>Style issues <small>across {num(quality.descriptions)} AI descriptions</small></h2>
          <CountBars rows={quality.style_issues} empty="No style issues." />
          <h4>Most common fact flags</h4>
          {quality.top_fact_flags.length ? (
            <ul className="plain-list">{quality.top_fact_flags.map((flag) => <li key={flag.name}>“{flag.name}” <span className="muted">× {flag.count}</span></li>)}</ul>
          ) : <p className="muted">No invented figures or claims found.</p>}
        </section>

        <section className="card">
          <h2>Catalog consistency <small>latest copy of each product</small></h2>
          <Consistency consistency={quality.consistency} />
        </section>

        <section className="card">
          <h2>Usage and review</h2>
          <dl className="facts">
            <dt>Products with copy</dt><dd>{num(usage.products)}</dd>
            <dt>Descriptions generated</dt><dd>{num(usage.descriptions)}</dd>
            <dt>Tokens in / out</dt><dd>{num(usage.input_tokens)} / {num(usage.output_tokens)}</dd>
            <dt>Avg time per description</dt><dd>{usage.avg_latency_ms ? `${(usage.avg_latency_ms / 1000).toFixed(1)} s` : '—'}</dd>
            <dt>Draft · approved · rejected</dt><dd>{num(review.draft)} · {num(review.approved)} · {num(review.rejected)}</dd>
            <dt>Human edits</dt><dd>{num(review.human_edits)}{review.avg_changed_pct !== null && ` (avg ${pct(review.avg_changed_pct)} of words changed)`}</dd>
          </dl>
          {usage.by_model.length > 0 && <p className="muted">Models: {usage.by_model.map((row) => `${row.name} (${row.count})`).join(', ')}. Free tiers, so no cost.</p>}
        </section>
      </div>
    </div>
  );
}

// The one number this dashboard leads with, against the problem statement's 85% target.
function Headline({ ratings }) {
  const value = ratings.rated_4_plus_pct;
  return (
    <section className="card hero-metric">
      <div>
        <h2>Rated 4 or 5 on both relevance and creativity</h2>
        <p className="hero-figure">{value === null ? '—' : pct(value)}</p>
        {value === null ? (
          <p className="muted">No ratings yet. Rate descriptions on the Review tab.</p>
        ) : (
          <p className={`status-line ${ratings.meets_target ? 'good' : 'bad'}`}>
            <span aria-hidden="true">{ratings.meets_target ? '✓' : '!'}</span>
            {ratings.meets_target ? ` Meets the ${ratings.target_pct}% target` : ` Below the ${ratings.target_pct}% target`}
            <span className="muted"> · {num(ratings.rated)} descriptions, {num(ratings.ratings)} ratings</span>
          </p>
        )}
      </div>
      <div
        className="meter"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value ?? 0}
        aria-label={`${pct(value)} rated 4 or higher; target ${ratings.target_pct}%`}
      >
        <span className="meter-fill" style={{ width: `${value ?? 0}%` }} />
        <span className="meter-target" style={{ left: `${ratings.target_pct}%` }} title={`Target ${ratings.target_pct}%`} />
      </div>
    </section>
  );
}

function Tile({ label, value, unit, note }) {
  return (
    <div className="card tile">
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}{unit && <small> {unit}</small>}</span>
      {note && <span className="muted">{note}</span>}
    </div>
  );
}

// One row per group: the share rated 4+ as a bar, with the counts and averages as text.
function Breakdown({ title, rows }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {rows.length === 0 ? <p className="muted">No ratings yet.</p> : (
        <ul className="bars">
          {rows.map((row) => (
            <li key={row.name} title={`${row.name}: ${pct(row.rated_4_plus_pct)} rated 4+ (${row.rated} rated), relevance ${row.avg_relevance}, creativity ${row.avg_creativity}`}>
              <span className="bar-label">{row.name}</span>
              <span className="bar-track"><span className="bar-fill" style={{ width: `${row.rated_4_plus_pct ?? 0}%` }} /></span>
              <span className="bar-value">{pct(row.rated_4_plus_pct)} <small>· {row.rated} rated · {row.avg_relevance} / {row.avg_creativity}</small></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CountBars({ rows, empty }) {
  if (!rows.length) return <p className="muted">{empty}</p>;
  const max = Math.max(...rows.map((row) => row.count));
  return (
    <ul className="bars">
      {rows.map((row) => (
        <li key={row.name} title={`${row.name}: ${row.count}`}>
          <span className="bar-label">{row.name.replaceAll('_', ' ')}</span>
          <span className="bar-track"><span className="bar-fill" style={{ width: `${(row.count / max) * 100}%` }} /></span>
          <span className="bar-value">{row.count}</span>
        </li>
      ))}
    </ul>
  );
}

function Consistency({ consistency }) {
  if (!consistency) return <p className="muted">No descriptions yet.</p>;
  if (consistency.passed) return <p className="checks pass">✓ No duplicate titles, repeated openings or unusual lengths.</p>;
  return (
    <ul className="checks">
      {consistency.duplicate_titles.map((group) => <li key={group.title} className="fail">✗ Same title “{group.title}”: {group.ids.join(', ')}</li>)}
      {consistency.repeated_openings.map((group) => <li key={group.opening} className="fail">✗ Same opening “{group.opening}…”: {group.ids.join(', ')}</li>)}
      {consistency.length_outliers.map((item) => <li key={item.id} className="fail">✗ {item.id}: {item.words} words (median {item.median})</li>)}
    </ul>
  );
}
