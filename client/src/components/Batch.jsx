import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { Icon, ProductThumb, StatusDot } from './ui.jsx';

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
    <div className="workspace">
      <aside className="sidebar sidebar-stack">
        <form className="panel form-panel" onSubmit={start}>
          <div className="sidebar-head"><h2>New batch</h2></div>
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
          <div className="grid-2">
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
          <label>Extra voice notes <span className="counter">optional</span>
            <input
              placeholder="e.g. mention festive gifting where it fits"
              value={options.brand_voice}
              onChange={(event) => setOptions({ ...options, brand_voice: event.target.value })}
            />
          </label>
          <p className="hint">
            {matching.length} product{matching.length === 1 ? '' : 's'} selected. Free models write about one a minute. If the daily
            limit runs out, the batch stops part way and Resume finishes it later.
          </p>
          <button type="submit" className="button-primary" disabled={starting || matching.length === 0}>
            <Icon name="sparkle" size={18} />
            {starting ? 'Starting…' : `Write ${matching.length} description${matching.length === 1 ? '' : 's'}`}
          </button>
        </form>

        <section className="panel">
          <div className="sidebar-head"><h2>Recent batches</h2></div>
          {jobs.length === 0 ? <p className="hint">No batches yet.</p> : (
            <ul className="job-list">
              {jobs.map((job) => (
                <li key={job.id}>
                  <button type="button" className={job.id === jobId ? 'selected' : ''} onClick={() => setJobId(job.id)}>
                    <strong>{job.total} products, {job.options?.tone}</strong>
                    <span>{STATUS_LABELS[job.status] ?? job.status}{job.active ? ', working now' : ''}</span>
                    <span>{when(job.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>

      <main className="workspace-main">
        {error && <div className="inline-alert">{error}</div>}
        {!jobId && (
          <div className="panel placeholder">
            <Icon name="layers" size={40} />
            <h2>Write a whole catalog at once</h2>
            <p>Choose products and a voice on the left. The batch runs on the server, so you can watch it here or come back later.</p>
          </div>
        )}
        {jobId && !detail && <div className="panel placeholder"><p>Loading batch…</p></div>}
        {detail && <JobDetail detail={detail} onResume={resume} onExport={exportAs} />}
      </main>
    </div>
  );
}

function JobDetail({ detail, onResume, onExport }) {
  const { job, progress, items, consistency } = detail;
  const done = progress.succeeded + progress.failed;
  const interrupted = !job.active && ['queued', 'running'].includes(job.status);
  const canResume = !job.active && progress.succeeded < progress.total;

  return (
    <section className="panel job-panel">
      <div className="job-head">
        <div>
          <h1 className="pd-title">Batch of {progress.total}</h1>
          <p className="pd-meta"><span>{when(job.created_at)}</span><span>{job.options?.tone}, {job.options?.length}</span></p>
        </div>
        <div className="job-actions">
          {canResume && <button type="button" className="button-primary" onClick={onResume}><Icon name="refresh" size={18} />Resume</button>}
          <button type="button" className="button-secondary" onClick={() => onExport('csv')} disabled={!progress.succeeded}><Icon name="download" size={18} />CSV</button>
          <button type="button" className="button-secondary" onClick={() => onExport('json')} disabled={!progress.succeeded}><Icon name="download" size={18} />JSON</button>
        </div>
      </div>

      <div className="pills">
        <StatusDot kind={job.status === 'completed' ? 'good' : job.status === 'failed' ? 'bad' : 'warn'}>
          {STATUS_LABELS[job.status] ?? job.status}{job.active ? ', working now' : ''}
        </StatusDot>
        <span className="pill">{progress.succeeded} done</span>
        {progress.failed > 0 && <span className="pill">{progress.failed} failed</span>}
        {progress.running + progress.queued > 0 && <span className="pill">{progress.running + progress.queued} to go</span>}
      </div>
      <div className="progress-track big progress-split" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={done}
        aria-label={`${progress.succeeded} written and ${progress.failed} failed of ${progress.total} products`}>
        <div className="progress-fill" style={{ width: `${(progress.succeeded / Math.max(1, progress.total)) * 100}%` }} />
        {progress.failed > 0 && <div className="progress-fill progress-failed" style={{ width: `${(progress.failed / Math.max(1, progress.total)) * 100}%` }} />}
      </div>
      {interrupted && <p className="inline-alert warn">This batch was interrupted when the server restarted. Resume picks up where it stopped.</p>}

      {consistency && !consistency.passed && (
        <div className="consistency">
          <h3>Across this batch</h3>
          <ul className="checklist">
            {consistency.duplicate_titles.map((group) => <li key={group.title} className="fail"><Icon name="alert" size={16} />Same title “{group.title}” on {group.ids.join(', ')}</li>)}
            {consistency.repeated_openings.map((group) => <li key={group.opening} className="fail"><Icon name="alert" size={16} />Same opening “{group.opening}…” on {group.ids.join(', ')}</li>)}
            {consistency.length_outliers.map((item) => <li key={item.id} className="fail"><Icon name="alert" size={16} />{item.id} is {item.words} words, against a typical {item.median}</li>)}
          </ul>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Product</th><th>Status</th><th>Title</th><th>SEO</th><th>Facts</th><th>Style</th></tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const quality = item.description?.quality;
              return (
                <tr key={item.product_id}>
                  <td>
                    <span className="table-product">
                      <ProductThumb product={item.product} />
                      <span><strong>{item.product?.name ?? 'Deleted product'}</strong><span>{item.product?.sku ?? ''}</span></span>
                    </span>
                  </td>
                  <td>
                    <span className={`tag tag-${item.status}`}>{STATUS_LABELS[item.status] ?? item.status}</span>
                    {item.error && <div className="cell-note">{item.error}</div>}
                  </td>
                  <td className="cell-title">{item.description?.title ?? ''}</td>
                  <td>{quality?.seo ? `${quality.seo.passed}/${quality.seo.total}` : ''}</td>
                  <td>{quality?.facts ? (quality.facts.passed ? <Icon name="check" size={18} title="Nothing invented" />
                    : <span className="cell-issues" title={`${quality.facts.unsupported.length} to verify`}><Icon name="alert" size={16} />{quality.facts.unsupported.length}</span>) : ''}</td>
                  <td>{quality?.style ? (quality.style.passed ? <Icon name="check" size={18} title="Reads naturally" />
                    : <span className="cell-issues" title={`${quality.style.issues.length} to polish`}><Icon name="alert" size={16} />{quality.style.issues.length}</span>) : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
