import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { toResult } from './DescriptionView.jsx';
import ProductDetail from './ProductDetail.jsx';
import { Icon, ProductThumb } from './ui.jsx';

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

  if (!queue) return message ? <div className="inline-alert">{message.text}</div> : <div className="panel placeholder"><p>Loading the review queue…</p></div>;
  if (!item) {
    return (
      <div className="panel placeholder">
        <Icon name="check" size={40} />
        <h2>All caught up</h2>
        <p>Every draft has your rating. Write more in Catalog or Batch, or see the results on the Dashboard.</p>
      </div>
    );
  }

  const { product, description } = item;
  return (
    <div className="review">
      <section className="panel review-bar" aria-label="Rate this description">
        <div className="review-head">
          <ProductThumb product={product} />
          <div>
            <strong>{queue.remaining - index} left to review</strong>
            <span>Keys: 1–5 rate relevance, then creativity. A approves, R rejects, → skips, E edits.</span>
          </div>
        </div>
        <div className="review-scores">
          <ScoreRow label="Relevance" hint="Accurate and useful to a shopper" value={rating.relevance} active={!rating.relevance} onChange={(relevance) => setRating({ ...rating, relevance })} />
          <ScoreRow label="Creativity" hint="Engaging and human, not generic" value={rating.creativity} active={Boolean(rating.relevance) && !rating.creativity} onChange={(creativity) => setRating({ ...rating, creativity })} />
        </div>
        <input
          aria-label="Comment"
          placeholder="Comment (optional): what would make it better?"
          value={rating.comment}
          onChange={(event) => setRating({ ...rating, comment: event.target.value })}
        />
        <div className="review-actions">
          <button type="button" className="button-primary" disabled={busy} onClick={() => act('approved')}><Icon name="check" size={18} />Approve</button>
          <button type="button" className="button-secondary" disabled={busy} onClick={() => act('rejected')}>Reject</button>
          <button type="button" className="button-secondary" disabled={busy || Boolean(editing)} onClick={startEditing}>Edit</button>
          <button type="button" className="button-quiet" disabled={busy} onClick={() => act('skip')}>{rated ? 'Save rating and skip' : 'Skip'}<Icon name="chevron" size={16} /></button>
        </div>
        {message && <p className={`form-message ${message.kind}`}>{message.text}</p>}
      </section>

      {editing ? (
        <section className="panel edit-panel">
          <div className="edit-head">
            <h2>Edit copy for {product.brand ? `${product.brand} ` : ''}{product.name}</h2>
            <p>Saving approves your edited version as a new version; the AI draft stays as it was.</p>
          </div>
          <label>Title <span className={`counter ${editing.title.length > 70 ? 'over' : ''}`}>{editing.title.length}/70</span><input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></label>
          <label>Short description<textarea rows={2} value={editing.short_description} onChange={(event) => setEditing({ ...editing, short_description: event.target.value })} /></label>
          <label>Long description<textarea rows={9} value={editing.long_description} onChange={(event) => setEditing({ ...editing, long_description: event.target.value })} /></label>
          <label>Bullet points <span className="counter">one per line</span><textarea rows={5} value={editing.bullet_points} onChange={(event) => setEditing({ ...editing, bullet_points: event.target.value })} /></label>
          <label>Meta description <span className={`counter ${editing.meta_description.length > 155 ? 'over' : ''}`}>{editing.meta_description.length}/155</span><textarea rows={2} value={editing.meta_description} onChange={(event) => setEditing({ ...editing, meta_description: event.target.value })} /></label>
          <div className="review-actions">
            <button type="button" className="button-primary" disabled={busy} onClick={() => act('edit')}>Save edit and approve</button>
            <button type="button" className="button-quiet" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </section>
      ) : (
        <ProductDetail product={product} result={toResult(description)} versions={[description]} shownId={description.id} />
      )}
    </div>
  );
}

function ScoreRow({ label, hint, value, active, onChange }) {
  return (
    <div className={`score-row ${active ? 'active' : ''}`} role="radiogroup" aria-label={label}>
      <span className="score-label"><strong>{label}</strong><small>{hint}</small></span>
      <span className="stars">
        {SCORES.map((score) => (
          <button
            key={score}
            type="button"
            role="radio"
            aria-checked={value === score}
            aria-label={`${score} of 5`}
            className={value && score <= value ? 'on' : ''}
            onClick={() => onChange(score)}
          >
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
              <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
            </svg>
          </button>
        ))}
        <span className="score-value">{value ? `${value}/5` : ''}</span>
      </span>
    </div>
  );
}
