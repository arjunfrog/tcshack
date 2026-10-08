import { useEffect, useState } from 'react';
import { api } from '../api.js';
import DescriptionView, { toResult } from './DescriptionView.jsx';
import { ProductThumb } from '../ui/Art.jsx';

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
  const [error, setError] = useState('');

  useEffect(() => {
    api.history()
      .then(({ items }) => {
        setItems(items);
        setSelectedId((current) => current ?? items[0]?.id ?? null);
      })
      .catch((err) => setError(err.message));
  }, [refreshKey]);

  if (error) return <div className="card error">{error}</div>;
  if (!items) return <div className="card empty">Loading history…</div>;
  if (!items.length) {
    return <div className="card empty">Nothing generated yet. Descriptions you create in Catalog or Quick generate will appear here.</div>;
  }

  const selected = items.find((item) => item.id === selectedId);

  return (
    <div className="layout">
      <section className="card">
        <div className="card-header"><h2>History <small>{items.length} descriptions</small></h2></div>
        <ul className="history-list">
          {items.map((item) => (
            <li key={item.id}>
              <button type="button" className={`product-item ${item.id === selectedId ? 'selected' : ''}`} onClick={() => setSelectedId(item.id)}>
                <ProductThumb product={item.product} size={44} />
                <span className="item-text">
                  <strong>{item.product.brand ? `${item.product.brand} ` : ''}{item.product.name}</strong>
                  <small>{item.product.category} · {item.tone}, {item.length}</small>
                  <small className="sku">{timeAgo(item.created_at)}</small>
                </span>
                <span className="status done">v{item.version}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <div>{selected && <DescriptionView result={toResult(selected)} product={selected.product} />}</div>
    </div>
  );
}
