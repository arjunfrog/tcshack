import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

const POLL_MS = 2000;
const STATUS_LABELS = { queued: 'Queued', running: 'Running', succeeded: 'Done', failed: 'Failed', completed: 'Completed', partial: 'Partly done' };

const when = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '');

// Batch generation (phase 3): start a server-side job over many products, watch it, export it.
export default function Batch({ choices }) {
  const [products, setProducts] = useState([]);
  const [selection, setSelection] = useState({ category: '', missing_only: true });
  const [options, setOptions] = useState({ tone: 'friendly', length: 'medium', brand_voice: '' });
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState(null);
  const [detail, setDetail] = useState(null); // { job, progress, items, consistency }
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [pollKey, setPollKey] = useState(0); // bump to restart polling (after Resume)

  const loadJobs = useCallback(async () => {
    const { jobs } = await api.jobs();
    setJobs(jobs);
    setJobId((current) => current ?? jobs[0]?.id ?? null);
  }, []);

  useEffect(() => {
    api.products({ limit: 500 }).then(({ products }) => setProducts(products)).catch((err) => setError(err.message));
    loadJobs().catch((err) => setError(err.message));
  }, [loadJobs]);

  // Poll the selected job while it is working.
  useEffect(() => {
    if (!jobId) return undefined;
    let timer;
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await api.job(jobId);
        if (cancelled) return;
        setDetail(next);
        if (next.job.active) timer = setTimeout(tick, POLL_MS);
        else loadJobs().catch(() => {});
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId, pollKey, loadJobs]);

  const categories = [...new Set(products.map((product) => product.category))].sort();
  const matching = products.filter(
    (product) =>
      (!selection.category || product.category.toLowerCase() === selection.category.toLowerCase()) &&
      (!selection.missing_only || !product.latest_description),
  );

  const start = async (event) => {
    event.preventDefault();
    setError('');
    setStarting(true);
    try {
      const { job } = await api.startJob(
        { category: selection.category || undefined, missing_only: selection.missing_only },
        { ...options, brand_voice: options.brand_voice || undefined },
      );
      setDetail(null);
      setJobId(job.id);
      await loadJobs();
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  };

  const resume = async () => {
    setError('');
    try {
      await api.resumeJob(jobId);
      setPollKey((key) => key + 1);
    } catch (err) {
      setError(err.message);
    }
  };

  const exportAs = (format) => api.exportJob(jobId, format).catch((err) => setError(err.message));

  return (
    <div className="layout">
      <div className="stack">
        <form className="card form" onSubmit={start}>
          <div className="card-header"><h2>New batch</h2></div>
          <div className="grid-2">
            <label>Products
              <select value={selection.category} onChange={(event) => setSelection({ ...selection, category: event.target.value })}>
                <option value="">All categories</option>
                {categories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={selection.missing_only}
                onChange={(event) => setSelection({ ...selection, missing_only: event.target.checked })}
              />
              Only products without a description
            </label>
            <label>Tone
              <select value={options.tone} onChange={(event) => setOptions({ ...options, tone: event.target.value })}>
                {choices.tones.map((tone) => <option key={tone}>{tone}</option>)}
              </select>
            </label>
            <label>Length
              <select value={options.length} onChange={(event) => setOptions({ ...options, length: event.target.value })}>
                {choices.lengths.map((length) => <option key={length}>{length}</option>)}
              </select>
            </label>
          </div>
          <label>Extra voice notes <small>optional; your brand profile is always applied</small>
            <input
              placeholder="e.g. mention festive gifting where it fits"
              value={options.brand_voice}
              onChange={(event) => setOptions({ ...options, brand_voice: event.target.value })}
            />
          </label>
          <p className="muted">
            {matching.length} product{matching.length === 1 ? '' : 's'} selected. Free-tier models write about 1–2 a minute;
            if the daily quota runs out, the job stops as partly done and Resume finishes it later.
          </p>
          <button type="submit" className="primary" disabled={starting || matching.length === 0}>
            {starting ? 'Starting…' : `Generate ${matching.length} description${matching.length === 1 ? '' : 's'}`}
          </button>
        </form>

        <section className="card">
          <div className="card-header"><h2>Recent batches</h2></div>
          {jobs.length === 0 ? <p className="muted">No batches yet.</p> : (
            <ul className="history-list">
              {jobs.map((job) => (
                <li key={job.id}>
                  <button type="button" className={job.id === jobId ? 'selected' : ''} onClick={() => setJobId(job.id)}>
                    <strong>{job.total} products · {job.options?.tone}, {job.options?.length}</strong>
                    <span className="muted">{STATUS_LABELS[job.status] ?? job.status}{job.active ? ' (working)' : ''} · {when(job.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div>
        {error && <div className="card error">{error}</div>}
        {!jobId && <div className="card empty">Start a batch to generate descriptions for many products at once.</div>}
        {jobId && !detail && <div className="card empty">Loading batch…</div>}
        {detail && <JobDetail detail={detail} onResume={resume} onExport={exportAs} />}
      </div>
    </div>
  );
}

function JobDetail({ detail, onResume, onExport }) {
  const { job, progress, items, consistency } = detail;
  const done = progress.succeeded + progress.failed;
  const interrupted = !job.active && ['queued', 'running'].includes(job.status);
  const canResume = !job.active && progress.succeeded < progress.total;

  return (
    <section className="card">
      <div className="card-header">
        <h2>
          Batch <small>{when(job.created_at)} · {job.options?.tone}, {job.options?.length}</small>
        </h2>
        <div className="row-actions">
          {canResume && <button type="button" onClick={onResume}>Resume</button>}
          <button type="button" className="ghost" onClick={() => onExport('csv')} disabled={!progress.succeeded}>Export CSV</button>
          <button type="button" className="ghost" onClick={() => onExport('json')} disabled={!progress.succeeded}>Export JSON</button>
        </div>
      </div>

      <p>
        <strong>{STATUS_LABELS[job.status] ?? job.status}</strong>
        {job.active && ' · working'}
        {' · '}{progress.succeeded} done, {progress.failed} failed, {progress.running} writing, {progress.queued} waiting
      </p>
      <progress className="batch-progress" value={done} max={progress.total} aria-label={`${done} of ${progress.total} products processed`} />
      {interrupted && <p className="notice-inline">This batch was interrupted (the server restarted). Resume picks up where it stopped.</p>}

      {consistency && !consistency.passed && (
        <div className="consistency">
          <h4>Consistency across the batch</h4>
          <ul className="checks">
            {consistency.duplicate_titles.map((group) => <li key={group.title} className="fail">✗ Same title “{group.title}”: {group.ids.join(', ')}</li>)}
            {consistency.repeated_openings.map((group) => <li key={group.opening} className="fail">✗ Same opening “{group.opening}…”: {group.ids.join(', ')}</li>)}
            {consistency.length_outliers.map((item) => <li key={item.id} className="fail">✗ {item.id}: {item.words} words (batch median {item.median})</li>)}
          </ul>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>SKU</th><th>Product</th><th>Status</th><th>Title</th><th>SEO</th><th>Facts</th><th>Style</th></tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const quality = item.description?.quality;
              return (
                <tr key={item.product_id}>
                  <td className="muted">{item.product?.sku ?? '—'}</td>
                  <td>{item.product?.name ?? 'Deleted product'}</td>
                  <td>
                    <span className={`status ${item.status}`}>{STATUS_LABELS[item.status] ?? item.status}</span>
                    {item.error && <div className="muted">{item.error}</div>}
                  </td>
                  <td>{item.description?.title ?? ''}</td>
                  <td>{quality?.seo ? `${quality.seo.passed}/${quality.seo.total}` : ''}</td>
                  <td>{quality?.facts ? (quality.facts.passed ? '✓' : `${quality.facts.unsupported.length} to check`) : ''}</td>
                  <td>{quality?.style ? (quality.style.passed ? '✓' : `${quality.style.issues.length} to polish`) : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
