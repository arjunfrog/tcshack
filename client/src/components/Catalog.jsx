import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import DescriptionView, { toResult } from './DescriptionView.jsx';
import { Elapsed, GeneratingCard, Spinner, ToastStack, useToasts } from './Feedback.jsx';

const BATCH_CONCURRENCY = 3;

export default function Catalog({ choices }) {
  const [products, setProducts] = useState(null); // null = first load
  const [filters, setFilters] = useState({ category: '', search: '' });
  const [options, setOptions] = useState({ tone: 'friendly', length: 'medium' });
  const [selected, setSelected] = useState(null); // { product, descriptions }
  const [versionId, setVersionId] = useState(null); // which description version is shown
  const [freshId, setFreshId] = useState(null); // just-generated description, briefly highlighted
  const [importReport, setImportReport] = useState(null); // { text, details } for rejected rows
  const [running, setRunning] = useState({}); // product id -> start time (ms)
  const [queued, setQueued] = useState(new Set());
  const [batch, setBatch] = useState(null); // { done, total, failed }
  const [importing, setImporting] = useState(''); // '' | 'file' | 'sample'
  const { toasts, push, dismiss } = useToasts();

  const load = useCallback(async () => {
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
      setProducts((await api.products(params)).products);
    } catch (err) {
      setProducts((current) => current ?? []);
      push('error', err.message);
    }
  }, [filters, push]);

  useEffect(() => { load(); }, [load]);

  const list = products ?? [];
  const categories = [...new Set(list.map((product) => product.category))].sort();
  const nameOf = (id) => list.find((product) => product.id === id)?.name ?? 'product';

  const showImportResult = ({ imported, errors, scope }) => {
    push(errors.length ? 'error' : 'success',
      `Imported ${imported} product${imported === 1 ? '' : 's'}${scope ? ` from ${scope}` : ''}${errors.length ? `, ${errors.length} row(s) rejected` : ''}.`);
    setImportReport(errors.length
      ? { text: `${errors.length} row(s) could not be imported`, details: errors.map((error) => `Row ${error.row}: ${error.issues.join('; ')}`) }
      : null);
    load();
  };

  const runImport = async (kind, action) => {
    setImporting(kind);
    try {
      showImportResult(await action());
    } catch (err) {
      push('error', err.message);
    } finally {
      setImporting('');
    }
  };

  const importFile = (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    const format = file.name.toLowerCase().endsWith('.json') ? 'json' : 'csv';
    runImport('file', async () => api.importProducts(format, await file.text()));
  };

  const open = async (id, showVersionId = null) => {
    try {
      const detail = await api.product(id);
      setSelected(detail);
      setVersionId(showVersionId ?? detail.descriptions[0]?.id ?? null);
    } catch (err) {
      push('error', err.message);
    }
  };

  // Generates one product; returns the new description or null.
  const generate = async (id) => {
    setQueued((ids) => { const next = new Set(ids); next.delete(id); return next; });
    setRunning((map) => ({ ...map, [id]: Date.now() }));
    try {
      return (await api.generateForProduct(id, options)).description;
    } catch (err) {
      push('error', `${nameOf(id)}: ${err.message}`);
      return null;
    } finally {
      setRunning((map) => { const next = { ...map }; delete next[id]; return next; });
    }
  };

  const generateOne = async (id) => {
    if (selected?.product.id !== id) open(id);
    const description = await generate(id);
    if (!description) return;
    push('success', `New description for ${nameOf(id)} (v${description.version})`);
    setFreshId(description.id);
    setTimeout(() => setFreshId(null), 2500);
    await Promise.all([load(), open(id, description.id)]);
  };

  // Client-side batch: a few requests in flight at a time, the rest shown as queued.
  const generateMissing = async () => {
    const queue = list.filter((product) => !product.latest_description).map((product) => product.id);
    if (!queue.length) return push('success', 'Every product listed already has a description.');

    const progress = { done: 0, total: queue.length, failed: 0 };
    setBatch({ ...progress });
    setQueued(new Set(queue));
    const worker = async () => {
      while (queue.length) {
        const ok = await generate(queue.shift());
        progress.done += 1;
        if (!ok) progress.failed += 1;
        setBatch({ ...progress });
        if (ok) load();
      }
    };
    await Promise.all(Array.from({ length: BATCH_CONCURRENCY }, worker));
    push(progress.failed ? 'error' : 'success',
      `Batch finished: ${progress.done - progress.failed} of ${progress.total} generated${progress.failed ? `, ${progress.failed} failed` : ''}.`);
    setBatch(null);
    load();
    if (selected) open(selected.product.id);
  };

  const selectedId = selected?.product.id;
  const shown = selected?.descriptions.find((description) => description.id === versionId) ?? selected?.descriptions[0];

  return (
    <div className="catalog">
      <section className="card toolbar">
        <div className="row-actions">
          <label className={`file-button ${importing ? 'disabled' : ''}`}>
            {importing === 'file' ? <><Spinner /> Importing…</> : 'Import CSV / JSON'}
            <input type="file" accept=".csv,.json" onChange={importFile} disabled={Boolean(importing)} hidden />
          </label>
          <button type="button" disabled={Boolean(importing)} onClick={() => runImport('sample', api.importSample)}>
            {importing === 'sample' ? <><Spinner /> Loading…</> : 'Load sample products'}
          </button>
        </div>
        <div className="row-actions">
          <label className="inline-label">Tone
            <select value={options.tone} onChange={(event) => setOptions({ ...options, tone: event.target.value })}>
              {choices.tones.map((tone) => <option key={tone}>{tone}</option>)}
            </select>
          </label>
          <label className="inline-label">Length
            <select value={options.length} onChange={(event) => setOptions({ ...options, length: event.target.value })}>
              {choices.lengths.map((length) => <option key={length}>{length}</option>)}
            </select>
          </label>
          <button type="button" className="primary inline" disabled={Boolean(batch) || !list.length} onClick={generateMissing}>
            {batch ? <><Spinner /> Generating {batch.done}/{batch.total}</> : 'Generate all missing'}
          </button>
        </div>
      </section>

      {batch && (
        <div className="card batch-card">
          <div className="batch-head">
            <span><Spinner /> Generating {batch.total} descriptions, {BATCH_CONCURRENCY} at a time</span>
            <span className="muted">{batch.done} done{batch.failed ? ` · ${batch.failed} failed` : ''} · {batch.total - batch.done} left</span>
          </div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${(batch.done / batch.total) * 100}%` }} /></div>
        </div>
      )}

      {importReport && (
        <div className="card notice error">
          <div className="card-header">
            <span>{importReport.text}</span>
            <button type="button" className="ghost" onClick={() => setImportReport(null)}>Dismiss</button>
          </div>
          <ul className="muted">{importReport.details.slice(0, 20).map((line) => <li key={line}>{line}</li>)}</ul>
        </div>
      )}

      <div className="layout">
        <section className="card">
          <div className="card-header">
            <h2>Catalog <small>{list.length} products</small></h2>
            <div className="row-actions">
              <select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}>
                <option value="">All categories</option>
                {categories.map((category) => <option key={category}>{category}</option>)}
              </select>
              <input
                type="search"
                placeholder="Search name or SKU"
                value={filters.search}
                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              />
            </div>
          </div>

          {products === null ? (
            <div className="table-skeleton">{[1, 2, 3, 4].map((n) => <span key={n} className="line w-100" />)}</div>
          ) : list.length === 0 ? (
            <div className="empty">
              <p>No products yet.</p>
              <p className="muted">Import a CSV/JSON file, load sample products for your categories, or use Quick generate.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>SKU</th><th>Product</th><th>Data</th><th>Copy</th><th /></tr>
                </thead>
                <tbody>
                  {list.map((product) => {
                    const startedAt = running[product.id];
                    const isQueued = queued.has(product.id);
                    return (
                      <tr
                        key={product.id}
                        className={[selectedId === product.id && 'selected', startedAt && 'generating'].filter(Boolean).join(' ')}
                        onClick={() => open(product.id)}
                      >
                        <td className="muted">{product.sku ?? '—'}</td>
                        <td>
                          <strong>{product.name}</strong>
                          <div className="muted">{product.category}{product.price != null && ` · ₹${Number(product.price).toLocaleString('en-IN')}`}</div>
                        </td>
                        <td>
                          <span className={`score ${product.completeness_score < 50 ? 'low' : ''}`} title="Completeness of the product data (0-100)">
                            {product.completeness_score ?? '—'}
                          </span>
                        </td>
                        <td>
                          {startedAt ? <span className="status writing">Writing… <Elapsed startedAt={startedAt} /></span>
                            : isQueued ? <span className="status queued">Queued</span>
                              : product.latest_description ? <span className="status done">v{product.latest_description.version}</span>
                                : <span className="muted">none</span>}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={product.latest_description ? 'ghost' : 'ghost accent'}
                            disabled={Boolean(startedAt) || isQueued}
                            onClick={(event) => { event.stopPropagation(); generateOne(product.id); }}
                          >
                            {startedAt ? <Spinner /> : product.latest_description ? 'Regenerate' : 'Generate'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="detail-column">
          {!selected && (
            <div className="card empty">
              <p>Select a product to see its descriptions.</p>
              <p className="muted">Click Generate on any row to write one.</p>
            </div>
          )}
          {selected && (
            <>
              <section className="card product-card">
                <h2>{selected.product.brand ? `${selected.product.brand} ` : ''}{selected.product.name}</h2>
                <p className="muted">{selected.product.sku} · {selected.product.category}{selected.product.subcategory && ` › ${selected.product.subcategory}`}</p>
                {selected.product.features.length > 0 && <ul>{selected.product.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>}
                {selected.descriptions.length > 0 && (
                  <div className="versions">
                    <span className="muted">Versions</span>
                    {selected.descriptions.map((description) => (
                      <button
                        key={description.id}
                        type="button"
                        className={`version-tab ${description.id === shown?.id ? 'active' : ''}`}
                        title={`${description.tone}, ${description.length} · ${new Date(description.created_at).toLocaleString()}`}
                        onClick={() => setVersionId(description.id)}
                      >
                        v{description.version}
                      </button>
                    ))}
                    {shown && <span className="muted">{shown.tone}, {shown.length}</span>}
                  </div>
                )}
                <button
                  type="button"
                  className="primary inline"
                  disabled={Boolean(running[selected.product.id]) || queued.has(selected.product.id)}
                  onClick={() => generateOne(selected.product.id)}
                >
                  {running[selected.product.id] ? <><Spinner /> Generating…</>
                    : selected.descriptions.length ? `Regenerate (${options.tone}, ${options.length})` : `Generate (${options.tone}, ${options.length})`}
                </button>
              </section>

              {running[selected.product.id] ? (
                <GeneratingCard startedAt={running[selected.product.id]} title={selected.descriptions.length ? 'Writing a new version' : 'Generating description'} />
              ) : shown ? (
                <div className={shown.id === freshId ? 'fresh' : ''}><DescriptionView result={toResult(shown)} /></div>
              ) : (
                <div className="card empty">No description yet. Click Generate.</div>
              )}
            </>
          )}
        </div>
      </div>

      <ToastStack toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
