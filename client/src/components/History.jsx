import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { toResult } from './DescriptionView.jsx';
import ProductDetail from './ProductDetail.jsx';
import { Icon, ProductThumb } from './ui.jsx';

const timeAgo = (iso) => {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const units = [['day', 86400], ['hour', 3600], ['minute', 60]];
  const [unit, size] = units.find(([, s]) => seconds >= s);
  const n = Math.floor(seconds / size);
  return `${n} ${unit}${n === 1 ? '' : 's'} ago`;
};

// Everything this account has generated, newest first.
export default function History({ refreshKey }) {
  const [items, setItems] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null); // { product, descriptions } of the selected item
  const [versionId, setVersionId] = useState(null);
  const [error, setError] = useState('');
  const mainRef = useRef(null);

  useEffect(() => {
    api.history()
      .then(({ items }) => {
        setItems(items);
        setSelectedId((current) => current ?? items[0]?.id ?? null);
      })
      .catch((err) => setError(err.message));
  }, [refreshKey]);

  const selected = items?.find((item) => item.id === selectedId);
  useEffect(() => {
    if (!selected) return;
    setVersionId(selected.id);
    api.product(selected.product.id).then(setDetail).catch((err) => setError(err.message));
  }, [selected]);

  if (error) return <div className="inline-alert">{error}</div>;
  if (!items) return <div className="panel placeholder"><p>Loading history…</p></div>;
  if (!items.length) {
    return (
      <div className="panel placeholder">
        <Icon name="clock" size={40} />
        <h2>Nothing written yet</h2>
        <p>Descriptions you write in Catalog, Quick generate or Batch show up here, newest first.</p>
      </div>
    );
  }

  const shown = detail?.descriptions.find((description) => description.id === versionId);
  return (
    <div className="workspace">
      <aside className="sidebar panel">
        <div className="sidebar-head"><h2>History <span className="count">{items.length} descriptions</span></h2></div>
        <ul className="product-list">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={item.id === selectedId ? 'selected' : ''}
                onClick={() => {
                  setSelectedId(item.id);
                  // On narrow screens the list sits above the product, so bring the product into view.
                  if (window.matchMedia('(max-width: 860px)').matches) mainRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                <ProductThumb product={item.product} />
                <span className="product-list-text">
                  <strong>{item.product.name}</strong>
                  <span>v{item.version}, {item.provider === 'human' ? 'hand edited' : `${item.tone}, ${item.length}`}</span>
                  <span className="product-list-sku">{timeAgo(item.created_at)}</span>
                </span>
                <span className="product-list-state"><Icon name="chevron" size={18} /></span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <main className="workspace-main" ref={mainRef}>
        {detail && shown
          ? <ProductDetail product={detail.product} result={toResult(shown)} versions={detail.descriptions} shownId={shown.id} onSelectVersion={setVersionId} />
          : <div className="panel placeholder"><p>Loading…</p></div>}
      </main>
    </div>
  );
}
