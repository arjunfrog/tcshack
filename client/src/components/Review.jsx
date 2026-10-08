import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import DescriptionView, { toResult } from './DescriptionView.jsx';

const SCORES = [1, 2, 3, 4, 5];
const COPY_FIELDS = ['title', 'short_description', 'long_description', 'bullet_points', 'meta_description'];

// Review queue (phase 4): rate each AI draft for relevance and creativity, then approve,
// reject or edit it. Keys: 1-5 rate (relevance, then creativity), A approve, R reject,
// → skip, E edit. Ratings are saved on the AI version, before any edit, so the dashboard
// measures the AI's copy rather than the human fixes.
export default function Review({ onReviewed }) {
  const [queue, setQueue] = useState(null); // { items, remaining }
  const [index, setIndex] = useState(0);
  const [rating, setRating] = useState({ relevance: null, creativity: null, comment: '' });
  const [editing, setEditing] = useState(null); // draft copy while editing
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { kind, text }

  const load = useCallback(async () => {
    try {
      setQueue(await api.reviewQueue(20));
      setIndex(0);
    } catch (err) {
      setMessage({ kind: 'error', text: err.message });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const item = queue?.items[index];
  const rated = rating.relevance && rating.creativity;

  const next = useCallback(() => {
    setRating({ relevance: null, creativity: null, comment: '' });
    setEditing(null);
    if (index + 1 < queue.items.length) setIndex(index + 1);
    else load();
  }, [index, queue, load]);

  // Saves the rating (when both scores are set), then applies the action.
  const act = useCallback(async (action) => {
    if (!item || busy) return;
    if ((action === 'approved' || action === 'rejected' || action === 'edit') && !rated) {
      setMessage({ kind: 'error', text: 'Rate relevance and creativity first (keys 1–5).' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (rated) {
        await api.rateDescription(item.description.id, {
          relevance: rating.relevance,
          creativity: rating.creativity,
          comment: rating.comment || undefined,
        });
      }
      if (action === 'approved' || action === 'rejected') {
        await api.updateDescription(item.description.id, { status: action });
      }
      if (action === 'edit') {
        const edits = { ...editing, bullet_points: editing.bullet_points.split('\n').map((line) => line.trim()).filter(Boolean) };
        await api.updateDescription(item.description.id, { status: 'approved', edits });
      }
      onReviewed?.();
      next();
    } catch (err) {
      setMessage({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }, [item, busy, rated, rating, editing, next, onReviewed]);

  const startEditing = useCallback(() => {
    if (!item) return;
    const draft = Object.fromEntries(COPY_FIELDS.map((field) => [field, item.description[field]]));
    setEditing({ ...draft, bullet_points: draft.bullet_points.join('\n') });
  }, [item]);

  // Keyboard shortcuts, ignored while typing in a field.
  useEffect(() => {
    const onKey = (event) => {
      const typing = event.target instanceof Element && event.target.closest('input, textarea, select');
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (SCORES.includes(Number(event.key))) {
        const score = Number(event.key);
        // First key rates relevance; after that, keys rate (and re-rate) creativity.
        setRating((current) => (current.relevance ? { ...current, creativity: score } : { ...current, relevance: score }));
      } else if (event.key === 'a' || event.key === 'A') act('approved');
      else if (event.key === 'r' || event.key === 'R') act('rejected');
      else if (event.key === 'ArrowRight') act('skip');
      else if ((event.key === 'e' || event.key === 'E') && !editing) startEditing();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act, editing, startEditing]);

  if (!queue) return message ? <div className="card error">{message.text}</div> : <div className="card empty">Loading the review queue…</div>;
  if (!item) {
    return (
      <div className="card empty">
        Nothing to review. Every draft has your rating. Generate more in Catalog or Batch, or see the results on the Dashboard.
      </div>
    );
  }

  const { product, description } = item;
  return (
    <div className="review">
      <div className="card review-bar">
        <div className="review-progress">
          <strong>{queue.remaining - index} to review</strong>
          <span className="muted">Keys: 1–5 rate · A approve · R reject · → skip · E edit</span>
        </div>
        <ScoreRow label="Relevance" hint="accurate, on-topic, useful to a shopper" value={rating.relevance} active={!rating.relevance} onChange={(relevance) => setRating({ ...rating, relevance })} />
        <ScoreRow label="Creativity" hint="engaging, human, not generic" value={rating.creativity} active={Boolean(rating.relevance) && !rating.creativity} onChange={(creativity) => setRating({ ...rating, creativity })} />
        <input
          placeholder="Comment (optional): what would make it better?"
          value={rating.comment}
          onChange={(event) => setRating({ ...rating, comment: event.target.value })}
        />
        <div className="row-actions">
          <button type="button" className="primary inline" disabled={busy} onClick={() => act('approved')}>Approve (A)</button>
          <button type="button" disabled={busy} onClick={() => act('rejected')}>Reject (R)</button>
          <button type="button" disabled={busy || Boolean(editing)} onClick={startEditing}>Edit (E)</button>
          <button type="button" className="ghost" disabled={busy} onClick={() => act('skip')}>{rated ? 'Save rating, next (→)' : 'Skip (→)'}</button>
        </div>
        {message && <p className={`form-message ${message.kind}`}>{message.text}</p>}
      </div>

      <div className="layout">
        <section className="card product-card">
          <h2>{product.brand ? `${product.brand} ` : ''}{product.name}</h2>
          <p className="muted">{product.sku ?? 'No SKU'} · {product.category}{product.subcategory && ` › ${product.subcategory}`}{product.price != null && ` · ₹${Number(product.price).toLocaleString('en-IN')}`}</p>
          <Attributes product={product} />
          <p className="muted">Draft v{description.version} · {description.tone}, {description.length} · {description.model}</p>
        </section>

        {editing ? (
          <section className="card form">
            <div className="card-header">
              <h2>Edit copy</h2>
              <small>Saved as a new version and approved; the AI draft stays as it was.</small>
            </div>
            <label>Title <small>{editing.title.length}/70</small><input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></label>
            <label>Short description<textarea rows={2} value={editing.short_description} onChange={(event) => setEditing({ ...editing, short_description: event.target.value })} /></label>
            <label>Long description<textarea rows={9} value={editing.long_description} onChange={(event) => setEditing({ ...editing, long_description: event.target.value })} /></label>
            <label>Bullet points <small>one per line</small><textarea rows={5} value={editing.bullet_points} onChange={(event) => setEditing({ ...editing, bullet_points: event.target.value })} /></label>
            <label>Meta description <small>{editing.meta_description.length}/155</small><textarea rows={2} value={editing.meta_description} onChange={(event) => setEditing({ ...editing, meta_description: event.target.value })} /></label>
            <div className="row-actions">
              <button type="button" className="primary inline" disabled={busy} onClick={() => act('edit')}>Save edit and approve</button>
              <button type="button" className="ghost" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </section>
        ) : (
          <DescriptionView result={toResult(description)} />
        )}
      </div>
    </div>
  );
}

function ScoreRow({ label, hint, value, active, onChange }) {
  return (
    <div className={`score-row ${active ? 'active' : ''}`} role="radiogroup" aria-label={label}>
      <span className="score-label"><strong>{label}</strong> <small>{hint}</small></span>
      <span className="score-buttons">
        {SCORES.map((score) => (
          <button
            key={score}
            type="button"
            role="radio"
            aria-checked={value === score}
            className={value && score <= value ? 'on' : ''}
            onClick={() => onChange(score)}
          >
            {score}
          </button>
        ))}
      </span>
    </div>
  );
}

function Attributes({ product }) {
  const specs = Object.entries(product.specifications ?? {});
  const attributes = Object.entries(product.attributes ?? {});
  return (
    <>
      {product.features?.length > 0 && (<><h4>Features</h4><ul>{product.features.map((feature) => <li key={feature}>{feature}</li>)}</ul></>)}
      {specs.length > 0 && (<><h4>Specifications</h4><ul>{specs.map(([key, value]) => <li key={key}>{key}: {String(value)}</li>)}</ul></>)}
      {attributes.length > 0 && (<><h4>Attributes</h4><ul>{attributes.map(([key, value]) => <li key={key}>{key}: {Array.isArray(value) ? value.join(', ') : String(value)}</li>)}</ul></>)}
      {product.seed_keywords?.length > 0 && (<><h4>Seed keywords</h4><div className="chips">{product.seed_keywords.map((keyword) => <span key={keyword} className="chip">{keyword}</span>)}</div></>)}
    </>
  );
}
