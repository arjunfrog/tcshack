import { useEffect, useState } from 'react';
import { api } from '../api.js';
import DescriptionView, { toResult } from './DescriptionView.jsx';

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
              <button type="button" className={item.id === selectedId ? 'selected' : ''} onClick={() => setSelectedId(item.id)}>
                <strong>{item.product.brand ? `${item.product.brand} ` : ''}{item.product.name}</strong>
                <span className="muted">{item.product.category} · v{item.version} · {item.tone}, {item.length}</span>
                <span className="muted">{timeAgo(item.created_at)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <div>{selected && <DescriptionView result={toResult(selected)} />}</div>
    </div>
  );
}
