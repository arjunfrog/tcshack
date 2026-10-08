import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import Icon from '../ui/Icon.jsx';
import { ProductHero, ProductThumb } from '../ui/Art.jsx';
import { CopyPanel, QualityReport, SearchPreview, copyJson, toResult } from './DescriptionView.jsx';
import PhotoDialog from './PhotoDialog.jsx';
import GenerationTimeline, { stageLabel } from './GenerationTimeline.jsx';
import ImportDialog from './ImportDialog.jsx';
import { Elapsed, Spinner, ToastStack, useToasts } from './Feedback.jsx';

const BATCH_CONCURRENCY = 3;
const rupees = (value) => `₹${Number(value).toLocaleString('en-IN')}`;

export default function Catalog({ choices }) {
  const [products, setProducts] = useState(null); // null = first load
  const [filters, setFilters] = useState({ category: '', search: '' });
  const [options, setOptions] = useState({ tone: 'friendly', length: 'medium' });
  const [selected, setSelected] = useState(null); // { product, descriptions }
  const [versionId, setVersionId] = useState(null); // which description version is shown
  const [freshId, setFreshId] = useState(null); // just-generated description, briefly highlighted
  const [running, setRunning] = useState({}); // product id -> { startedAt, events }
  const [queued, setQueued] = useState(new Set());
  const [batch, setBatch] = useState(null); // { done, total, failed }
  const [loadingSample, setLoadingSample] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [photoFor, setPhotoFor] = useState(null); // product whose photo is being changed
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
  const withoutCopy = list.filter((product) => !product.latest_description).length;

  // set: undefined = sample products in your categories; 'demo' = the 240-product demo catalog.
  const loadSample = async (set) => {
    setLoadingSample(set ?? 'sample');
    try {
      const { imported, scope } = await api.importSample(set);
      push('success', `Added ${imported} sample product${imported === 1 ? '' : 's'} from ${scope}.`);
      await load();
      // Free stock photos per product type, when a Pexels key is set up.
      const photos = await api.autoPhotos().catch(() => null);
      if (photos?.updated) {
        push('success', `Added photos to ${photos.updated} product${photos.updated === 1 ? '' : 's'}.`);
        load();
      }
    } catch (err) {
      push('error', err.message);
    } finally {
      setLoadingSample(false);
    }
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

  // Generates one product, streaming its steps into `running`; returns the new description or null.
  const generate = async (id) => {
    setQueued((ids) => { const next = new Set(ids); next.delete(id); return next; });
    setRunning((map) => ({ ...map, [id]: { startedAt: Date.now(), events: [] } }));
    const onProgress = (event) => setRunning((map) => (map[id]
      ? { ...map, [id]: { ...map[id], events: [...map[id].events, { ...event, receivedAt: Date.now() }] } }
      : map));
    try {
      return (await api.generateForProduct(id, options, onProgress)).description;
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
    // Each description uses about 5,000 tokens; Groq's free tier allows about 200,000 a day.
    if (queue.length > 30 && !window.confirm(
      `Generate ${queue.length} descriptions? That is roughly ${Math.round(queue.length * 5)}k tokens. `
      + "Groq's free tier allows about 200k tokens a day (about 40 descriptions), so the rest will fail with a rate-limit "
      + 'message. Tip: filter by category first to generate a smaller set.',
    )) return;

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
    <div className="catalog-page">
      <div className="page-head">
        <div>
          <h1>Catalog</h1>
          <p className="muted-lg">{list.length} product{list.length === 1 ? '' : 's'}{withoutCopy ? ` · ${withoutCopy} without copy` : ''}</p>
        </div>
        <div className="page-actions">
          <button type="button" onClick={() => setImportOpen(true)}><Icon name="upload" size={16} /> Import CSV / JSON</button>
          <button type="button" disabled={Boolean(loadingSample)} onClick={() => loadSample()}>
            {loadingSample === 'sample' ? <><Spinner /> Adding…</> : <><Icon name="layers" size={16} /> Sample products</>}
          </button>
          <button type="button" disabled={Boolean(loadingSample)} onClick={() => loadSample('demo')} title="240 products across 9 categories and 45 product types">
            {loadingSample === 'demo' ? <><Spinner /> Adding 240…</> : <><Icon name="store" size={16} /> Demo catalog (240)</>}
          </button>
          <span className="divider" />
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
          <button type="button" className="primary" disabled={Boolean(batch) || !withoutCopy} onClick={generateMissing}>
            {batch ? <><Spinner /> {batch.done}/{batch.total}</> : <><Icon name="sparkles" size={16} /> Generate all missing</>}
          </button>
        </div>
      </div>

      {batch && (
        <div className="card batch-card">
          <div className="batch-head">
            <span><Spinner /> Generating {batch.total} descriptions, {BATCH_CONCURRENCY} at a time</span>
            <span className="muted">{batch.done} done{batch.failed ? ` · ${batch.failed} failed` : ''} · {batch.total - batch.done} left</span>
          </div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${(batch.done / batch.total) * 100}%` }} /></div>
        </div>
      )}

      {products !== null && list.length === 0 && !filters.search && !filters.category ? (
        <EmptyCatalog onImport={() => setImportOpen(true)} onSample={loadSample} loadingSample={loadingSample} />
      ) : (
        <div className="catalog-grid">
          <aside className="card product-list">
            <div className="list-filters">
              <span className="input-icon">
                <Icon name="search" />
                <input type="search" placeholder="Search name or SKU" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
              </span>
              <select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}>
                <option value="">All categories</option>
                {categories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </div>
            {products === null ? (
              <div className="list-skeleton">{[1, 2, 3, 4, 5].map((n) => <span key={n} className="line" />)}</div>
            ) : list.length === 0 ? (
              <p className="empty">No products match.</p>
            ) : (
              <ul className="product-items">
                {list.map((product) => {
                  const run = running[product.id];
                  const isQueued = queued.has(product.id);
                  return (
                    <li key={product.id}>
                      <button
                        type="button"
                        className={`product-item ${selectedId === product.id ? 'selected' : ''} ${run ? 'generating' : ''}`}
                        onClick={() => open(product.id)}
                      >
                        <ProductThumb product={product} size={52} />
                        <span className="item-text">
                          <strong>{product.name}</strong>
                          <small>{product.subcategory || product.category} · {product.sku ?? 'No SKU'}</small>
                          <span className="item-state">
                            {run ? <span className="status writing"><Spinner size={11} /> {stageLabel(run.events)} <Elapsed startedAt={run.startedAt} /></span>
                              : isQueued ? <span className="status queued">Queued</span>
                                : product.latest_description ? <span className="status done">Copy v{product.latest_description.version}</span>
                                  : <span className="status none">No copy yet</span>}
                          </span>
                        </span>
                        <Icon name="chevronRight" size={16} className="chev" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          <section className="product-detail">
            {!selected ? (
              <div className="card empty select-prompt">
                <span className="icon-dot xl"><Icon name="layers" size={28} /></span>
                <h2>Pick a product</h2>
                <p className="muted-lg">Select a product on the left to see its copy, or generate copy for every product without one.</p>
              </div>
            ) : (
              <ProductDetail
                detail={selected}
                shown={shown}
                run={running[selected.product.id]}
                queued={queued.has(selected.product.id)}
                fresh={shown?.id === freshId}
                options={options}
                onVersion={setVersionId}
                onGenerate={() => generateOne(selected.product.id)}
                onPhoto={() => setPhotoFor(selected.product)}
                onRemovePhoto={async () => {
                  try {
                    await api.removeProductImage(selected.product.id);
                    await Promise.all([load(), open(selected.product.id, versionId)]);
                  } catch (err) {
                    push('error', err.message);
                  }
                }}
              />
            )}
          </section>
        </div>
      )}

      {photoFor && (
        <PhotoDialog
          product={photoFor}
          onClose={() => setPhotoFor(null)}
          onSaved={async () => {
            setPhotoFor(null);
            push('success', `Photo saved for ${photoFor.name}.`);
            await Promise.all([load(), open(photoFor.id, versionId)]);
          }}
        />
      )}
      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} onImported={(message) => { push('success', message); load(); }} />}
      <ToastStack toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

function ProductDetail({ detail, shown, run, queued, fresh, options, onVersion, onGenerate, onPhoto, onRemovePhoto }) {
  const { product, descriptions } = detail;
  const result = shown ? toResult(shown) : null;
  const specs = [
    ...(product.brand ? [['Brand', product.brand]] : []),
    ...Object.entries(product.specifications ?? {}),
    ...Object.entries(product.attributes ?? {}).map(([key, value]) => [key.replace(/_/g, ' '), Array.isArray(value) ? value.join(', ') : String(value)]),
  ];

  return (
    <>
      <div className="card product-top">
        <div className="hero-wrap">
          <ProductHero product={product} />
          <div className="hero-photo-actions">
            <button type="button" onClick={onPhoto}><Icon name="upload" size={15} /> {hasPhoto(product) ? 'Change photo' : 'Add photo'}</button>
            {hasPhoto(product) && <button type="button" className="icon-only" aria-label="Remove photo" title="Remove photo" onClick={onRemovePhoto}><Icon name="x" size={15} /></button>}
          </div>
          {product.image_credit && (
            <a className="photo-credit" href={product.image_credit_url ?? undefined} target="_blank" rel="noreferrer">Photo: {product.image_credit}</a>
          )}
        </div>
        <div className="product-info">
          <nav className="breadcrumb" aria-label="Category">
            <span>{product.category}</span>
            {product.subcategory && <><Icon name="chevronRight" size={14} /><span>{product.subcategory}</span></>}
          </nav>
          <h2 className="product-name">{shown?.title ?? `${product.brand ? `${product.brand} ` : ''}${product.name}`}</h2>
          <div className="meta-row">
            <span>{product.sku ?? 'No SKU'}</span>
            {shown && <span className="version-chip">v{shown.version}</span>}
            {shown && <span>{shown.tone}, {shown.length}</span>}
            <span className={`data-score ${product.completeness_score < 50 ? 'low' : ''}`} title="Completeness of the product data">
              Data {product.completeness_score ?? '—'}/100
            </span>
          </div>
          {shown && <p className="product-lead">{shown.short_description}</p>}
          {product.price != null && <div className="price">{rupees(product.price)}</div>}

          <div className="detail-actions">
            <button type="button" className="primary large" disabled={Boolean(run) || queued} onClick={onGenerate}>
              {run ? <><Spinner /> Generating…</> : <><Icon name="sparkles" /> {descriptions.length ? 'Regenerate' : 'Generate'} · {options.tone}, {options.length}</>}
            </button>
            {result && <button type="button" className="large" onClick={() => copyJson(result.output)}><Icon name="copy" /> Copy JSON</button>}
          </div>

          {product.features?.length > 0 && (
            <div className="feature-chips">
              {product.features.slice(0, 4).map((feature) => (
                <span key={feature} className="feature-chip"><span className="icon-dot"><Icon name="leaf" size={15} /></span>{feature}</span>
              ))}
            </div>
          )}

          {descriptions.length > 1 && (
            <div className="versions">
              <span className="muted">Versions</span>
              {descriptions.map((description) => (
                <button
                  key={description.id}
                  type="button"
                  className={`version-tab ${description.id === shown?.id ? 'active' : ''}`}
                  title={`${description.tone}, ${description.length} · ${new Date(description.created_at).toLocaleString()}`}
                  onClick={() => onVersion(description.id)}
                >
                  v{description.version}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {run ? (
        <GenerationTimeline events={run.events} startedAt={run.startedAt} title={descriptions.length ? 'Writing a new version' : 'Generating description'} />
      ) : (
        <div className={`detail-grid ${fresh ? 'fresh' : ''}`}>
          <div className="card">
            <div className="card-header"><h3><Icon name="pen" size={18} /> Description</h3></div>
            {result ? <CopyPanel output={result.output} showTitle={false} /> : (
              <div className="empty small">
                <p>No copy yet for this product.</p>
                <button type="button" className="primary" disabled={queued} onClick={onGenerate}><Icon name="sparkles" size={16} /> Generate now</button>
              </div>
            )}
          </div>
          <div className="detail-side">
            <div className="card">
              <div className="card-header"><h3><Icon name="list" size={18} /> Specifications</h3></div>
              {specs.length ? (
                <dl className="spec-table">
                  {specs.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}
                </dl>
              ) : <p className="muted">No specifications in the product data.</p>}
            </div>
          </div>
        </div>
      )}
      {!run && result && (
        <>
          <SearchPreview output={result.output} quality={result.quality} product={product} />
          <QualityReport result={result} />
        </>
      )}
    </>
  );
}

const hasPhoto = (product) => Boolean(product.image_url) && !/placehold\.co|placeholder/i.test(product.image_url);

function EmptyCatalog({ onImport, onSample, loadingSample }) {
  return (
    <div className="card empty-catalog">
      <span className="icon-dot xl"><Icon name="layers" size={28} /></span>
      <h2>Add your first products</h2>
      <p className="muted-lg">Bring in your catalog, or try the tool with sample products in your categories.</p>
      <div className="empty-options">
        <button type="button" className="option-card" onClick={onImport}>
          <span className="icon-dot large"><Icon name="upload" size={20} /></span>
          <strong>Import a file</strong>
          <span>CSV or JSON with product attributes. A template is included.</span>
        </button>
        <button type="button" className="option-card" disabled={Boolean(loadingSample)} onClick={() => onSample()}>
          <span className="icon-dot large">{loadingSample === 'sample' ? <Spinner size={18} /> : <Icon name="layers" size={20} />}</span>
          <strong>{loadingSample === 'sample' ? 'Adding sample products…' : 'Use sample products'}</strong>
          <span>Fictional products in the categories you picked during setup.</span>
        </button>
        <button type="button" className="option-card" disabled={Boolean(loadingSample)} onClick={() => onSample('demo')}>
          <span className="icon-dot large">{loadingSample === 'demo' ? <Spinner size={18} /> : <Icon name="store" size={20} />}</span>
          <strong>{loadingSample === 'demo' ? 'Adding 240 products…' : 'Load the demo catalog'}</strong>
          <span>240 products across 9 categories and 45 product types, to see the tool at scale.</span>
        </button>
      </div>
      <p className="muted">You can also type a single product in Quick generate.</p>
    </div>
  );
}
