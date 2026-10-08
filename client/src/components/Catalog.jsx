import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { toResult } from './DescriptionView.jsx';
import { Elapsed, Spinner, ToastStack, useToasts } from './Feedback.jsx';
import ProductDetail from './ProductDetail.jsx';
import { Icon, ProductThumb } from './ui.jsx';

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
  const mainRef = useRef(null);

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
  const missing = list.filter((product) => !product.latest_description).length;
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
      // On narrow screens the list sits above the product, so bring the product into view.
      if (window.matchMedia('(max-width: 860px)').matches) mainRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      `Batch finished: ${progress.done - progress.failed} of ${progress.total} written${progress.failed ? `, ${progress.failed} failed` : ''}.`);
    setBatch(null);
    load();
    if (selected) open(selected.product.id);
  };

  const selectedId = selected?.product.id;
  const shown = selected?.descriptions.find((description) => description.id === versionId) ?? selected?.descriptions[0];
  const startedAt = selectedId && running[selectedId];

  return (
    <div className="workspace">
      <aside className="sidebar panel">
        <div className="sidebar-head">
          <h2>Catalog <span className="count">{list.length} products</span></h2>
          <div className="sidebar-tools">
            <label className={`button button-quiet ${importing ? 'is-disabled' : ''}`} title="Import a CSV or JSON file of products">
              {importing === 'file' ? <Spinner /> : <Icon name="upload" size={16} />} Import
              <input type="file" accept=".csv,.json" onChange={importFile} disabled={Boolean(importing)} hidden />
            </label>
            <button type="button" className="button-quiet" disabled={Boolean(importing)} onClick={() => runImport('sample', api.importSample)}>
              {importing === 'sample' ? <Spinner /> : <Icon name="box" size={16} />} Samples
            </button>
          </div>
        </div>

        <label className="search-field">
          <Icon name="search" size={18} />
          <input
            type="search"
            placeholder="Search name or SKU"
            aria-label="Search name or SKU"
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
          />
        </label>
        <select aria-label="Category" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}>
          <option value="">All categories</option>
          {categories.map((category) => <option key={category}>{category}</option>)}
        </select>

        {importReport && (
          <div className="inline-alert">
            <strong>{importReport.text}</strong>
            <ul>{importReport.details.slice(0, 8).map((line) => <li key={line}>{line}</li>)}</ul>
            <button type="button" className="button-quiet" onClick={() => setImportReport(null)}>Dismiss</button>
          </div>
        )}

        {products === null ? (
          <div className="list-skeleton">{[1, 2, 3, 4, 5].map((n) => <span key={n} />)}</div>
        ) : list.length === 0 ? (
          <div className="sidebar-empty">
            <p>No products yet.</p>
            <p>Import a CSV or JSON file, load the sample products, or add one in Quick generate.</p>
          </div>
        ) : (
          <ul className="product-list">
            {list.map((product) => {
              const since = running[product.id];
              const isQueued = queued.has(product.id);
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    className={[selectedId === product.id && 'selected', since && 'writing'].filter(Boolean).join(' ')}
                    onClick={() => open(product.id)}
                  >
                    <ProductThumb product={product} />
                    <span className="product-list-text">
                      <strong>{product.name}</strong>
                      <span>{product.category}</span>
                      <span className="product-list-sku">{product.sku ?? 'No SKU'}</span>
                    </span>
                    <span className="product-list-state">
                      {since ? <span className="tag tag-writing"><Spinner size={11} /> <Elapsed startedAt={since} /></span>
                        : isQueued ? <span className="tag">Queued</span>
                          : product.latest_description ? <span className="tag tag-done">v{product.latest_description.version}</span>
                            : <span className="tag tag-empty">No copy</span>}
                      <Icon name="chevron" size={18} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {list.length > 0 && (
          <div className="sidebar-foot">
            {batch ? (
              <>
                <p><Spinner /> Writing {batch.total} descriptions, {BATCH_CONCURRENCY} at a time</p>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${(batch.done / batch.total) * 100}%` }} /></div>
                <p className="hint">{batch.done} done{batch.failed ? `, ${batch.failed} failed` : ''}, {batch.total - batch.done} left</p>
              </>
            ) : (
              <button type="button" className="button-secondary" disabled={!missing} onClick={generateMissing}>
                <Icon name="sparkle" size={16} />
                {missing ? `Write copy for ${missing} without any` : 'Every product has copy'}
              </button>
            )}
          </div>
        )}
      </aside>

      <main className="workspace-main" ref={mainRef}>
        {!selected ? (
          <div className="panel placeholder">
            <Icon name="leaf" size={40} />
            <h2>Pick a product</h2>
            <p>Choose a product on the left to see its data and copy, or write a new version in another tone.</p>
          </div>
        ) : (
          <ProductDetail
            product={selected.product}
            result={shown ? toResult(shown) : null}
            versions={selected.descriptions}
            shownId={shown?.id}
            onSelectVersion={setVersionId}
            generatingSince={startedAt}
            generatingTitle={selected.descriptions.length ? 'Writing a new version' : 'Writing the first description'}
            fresh={shown?.id === freshId}
            actions={(
              <>
                <button
                  type="button"
                  className="button-primary"
                  disabled={Boolean(startedAt) || queued.has(selectedId)}
                  onClick={() => generateOne(selectedId)}
                >
                  {startedAt ? <><Spinner /> Writing…</> : <><Icon name="sparkle" size={18} />{selected.descriptions.length ? 'Regenerate copy' : 'Generate copy'}</>}
                </button>
                {shown && (
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => navigator.clipboard?.writeText(JSON.stringify(toResult(shown).output, null, 2)).then(() => push('success', 'Copy JSON copied'))}
                  >
                    <Icon name="copy" size={18} />Copy JSON
                  </button>
                )}
                <div className="tone-picker">
                  <select aria-label="Tone" value={options.tone} onChange={(event) => setOptions({ ...options, tone: event.target.value })}>
                    {choices.tones.map((tone) => <option key={tone}>{tone}</option>)}
                  </select>
                  <select aria-label="Length" value={options.length} onChange={(event) => setOptions({ ...options, length: event.target.value })}>
                    {choices.lengths.map((length) => <option key={length}>{length}</option>)}
                  </select>
                </div>
              </>
            )}
          />
        )}
      </main>

      <ToastStack toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
