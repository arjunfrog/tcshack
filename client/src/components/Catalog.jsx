import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import DescriptionView from './DescriptionView.jsx';

const BATCH_CONCURRENCY = 3;

// Shape a saved description row like a fresh /api/generate result so DescriptionView can show it.
const toResult = (row) => ({
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

export default function Catalog({ choices }) {
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({ category: '', search: '' });
  const [options, setOptions] = useState({ tone: 'friendly', length: 'medium' });
  const [selected, setSelected] = useState(null); // { product, descriptions }
  const [notice, setNotice] = useState(null); // { kind: 'error' | 'info', text, details? }
  const [busyIds, setBusyIds] = useState(new Set());
  const [batch, setBatch] = useState(null); // { done, total, failed }

  const load = useCallback(async () => {
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
      setProducts((await api.products(params)).products);
    } catch (err) {
      setNotice({ kind: 'error', text: err.message });
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const categories = [...new Set(products.map((product) => product.category))].sort();

  const showImportResult = ({ imported, errors }) => {
    setNotice({
      kind: errors.length ? 'error' : 'info',
      text: `Imported ${imported} product${imported === 1 ? '' : 's'}${errors.length ? `, ${errors.length} row(s) rejected` : ''}.`,
      details: errors.map((error) => `Row ${error.row}: ${error.issues.join('; ')}`),
    });
    load();
  };

  const importFile = async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    const format = file.name.toLowerCase().endsWith('.json') ? 'json' : 'csv';
    try {
      showImportResult(await api.importProducts(format, await file.text()));
    } catch (err) {
      setNotice({ kind: 'error', text: err.message });
    }
  };

  const importSample = async () => {
    try {
      showImportResult(await api.importSample());
    } catch (err) {
      setNotice({ kind: 'error', text: err.message });
    }
  };

  const open = async (id) => {
    try {
      setSelected(await api.product(id));
    } catch (err) {
      setNotice({ kind: 'error', text: err.message });
    }
  };

  const generate = async (id) => {
    setBusyIds((ids) => new Set(ids).add(id));
    try {
      await api.generateForProduct(id, options);
      return true;
    } catch (err) {
      setNotice({ kind: 'error', text: err.message });
      return false;
    } finally {
      setBusyIds((ids) => { const next = new Set(ids); next.delete(id); return next; });
    }
  };

  const generateOne = async (id) => {
    if (await generate(id)) {
      await Promise.all([load(), open(id)]);
    }
  };

  // Simple client-side batch: a few requests in flight at a time.
  const generateMissing = async () => {
    const queue = products.filter((product) => !product.latest_description).map((product) => product.id);
    if (!queue.length) return setNotice({ kind: 'info', text: 'Every product listed already has a description.' });

    const progress = { done: 0, total: queue.length, failed: 0 };
    setBatch({ ...progress });
    const worker = async () => {
      while (queue.length) {
        const ok = await generate(queue.shift());
        progress.done += 1;
        if (!ok) progress.failed += 1;
        setBatch({ ...progress });
      }
    };
    await Promise.all(Array.from({ length: BATCH_CONCURRENCY }, worker));
    setNotice({ kind: progress.failed ? 'error' : 'info', text: `Batch finished: ${progress.done - progress.failed}/${progress.total} generated.` });
    setBatch(null);
    load();
  };

  return (
    <div className="catalog">
      <section className="card toolbar">
        <div className="row-actions">
          <label className="file-button">
            Import CSV / JSON
            <input type="file" accept=".csv,.json" onChange={importFile} hidden />
          </label>
          <button type="button" onClick={importSample}>Load 60 sample products</button>
        </div>
        <div className="row-actions">
          <select value={options.tone} onChange={(event) => setOptions({ ...options, tone: event.target.value })}>
            {choices.tones.map((tone) => <option key={tone}>{tone}</option>)}
          </select>
          <select value={options.length} onChange={(event) => setOptions({ ...options, length: event.target.value })}>
            {choices.lengths.map((length) => <option key={length}>{length}</option>)}
          </select>
          <button type="button" className="primary inline" disabled={Boolean(batch)} onClick={generateMissing}>
            {batch ? `Generating ${batch.done}/${batch.total}…` : 'Generate all missing'}
          </button>
        </div>
      </section>

      {batch && <progress className="batch-progress" value={batch.done} max={batch.total} />}

      {notice && (
        <div className={`card notice ${notice.kind}`}>
          <div className="card-header">
            <span>{notice.text}</span>
            <button type="button" className="ghost" onClick={() => setNotice(null)}>Dismiss</button>
          </div>
          {notice.details?.length > 0 && <ul className="muted">{notice.details.slice(0, 20).map((line) => <li key={line}>{line}</li>)}</ul>}
        </div>
      )}

      <div className="layout">
        <section className="card">
          <div className="card-header">
            <h2>Catalog <small>{products.length} products</small></h2>
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

          {products.length === 0 ? (
            <p className="empty">No products yet. Import a CSV/JSON file or load the sample products.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>SKU</th><th>Product</th><th>Completeness</th><th>Description</th><th /></tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr
                      key={product.id}
                      className={selected?.product.id === product.id ? 'selected' : ''}
                      onClick={() => open(product.id)}
                    >
                      <td className="muted">{product.sku ?? '—'}</td>
                      <td>
                        <strong>{product.name}</strong>
                        <div className="muted">{product.category}{product.price != null && ` · ₹${Number(product.price).toLocaleString('en-IN')}`}</div>
                      </td>
                      <td><span className={`score ${product.completeness_score < 50 ? 'low' : ''}`}>{product.completeness_score ?? '—'}</span></td>
                      <td>{product.latest_description ? `v${product.latest_description.version}` : <span className="muted">none</span>}</td>
                      <td>
                        <button
                          type="button"
                          className="ghost"
                          disabled={busyIds.has(product.id)}
                          onClick={(event) => { event.stopPropagation(); generateOne(product.id); }}
                        >
                          {busyIds.has(product.id) ? '…' : product.latest_description ? 'Regenerate' : 'Generate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div>
          {!selected && <div className="card empty">Select a product to see its descriptions.</div>}
          {selected && (
            <>
              <section className="card product-card">
                <h2>{selected.product.brand ? `${selected.product.brand} ` : ''}{selected.product.name}</h2>
                <p className="muted">{selected.product.sku} · {selected.product.category}{selected.product.subcategory && ` › ${selected.product.subcategory}`}</p>
                {selected.product.features.length > 0 && <ul>{selected.product.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>}
                <p className="muted">
                  {selected.descriptions.length} version{selected.descriptions.length === 1 ? '' : 's'}
                  {selected.descriptions[0] && ` · showing v${selected.descriptions[0].version} (${selected.descriptions[0].tone}, ${selected.descriptions[0].length})`}
                </p>
              </section>
              {selected.descriptions[0]
                ? <DescriptionView result={toResult(selected.descriptions[0])} />
                : <div className="card empty">No description yet. Click Generate.</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
