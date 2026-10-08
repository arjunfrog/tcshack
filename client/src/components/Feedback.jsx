import { useCallback, useEffect, useRef, useState } from 'react';

export function Spinner({ size = 14 }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}

// Seconds since `startedAt`, updating every second while mounted.
export function useElapsed(startedAt) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);
  return startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
}

export function Elapsed({ startedAt }) {
  const seconds = useElapsed(startedAt);
  return <span className="elapsed">{seconds}s</span>;
}

// Rough stages of one generation. Timings are typical, not tracked: market data is
// only fetched for the first product of each type, so later ones skip ahead quickly.
const STAGES = [
  { after: 0, label: 'Reading product data and your brand profile' },
  { after: 2, label: 'Checking market data for this product type' },
  { after: 6, label: 'Writing the description' },
  { after: 25, label: 'Still writing (first product of a type also fetches market data)' },
  { after: 60, label: 'Taking longer than usual, hang on' },
];

export function GeneratingCard({ startedAt, title = 'Generating description' }) {
  const seconds = useElapsed(startedAt);
  const current = STAGES.filter((stage) => seconds >= stage.after).length - 1;
  return (
    <section className="card generating-card" aria-live="polite">
      <div className="card-header">
        <h2><Spinner size={16} /> {title}</h2>
        <span className="elapsed">{seconds}s</span>
      </div>
      <ol className="stages">
        {STAGES.slice(0, 3).map((stage, i) => (
          <li key={stage.label} className={i < Math.min(current, 2) ? 'done' : i === Math.min(current, 2) ? 'active' : ''}>
            {i < Math.min(current, 2) ? '✓' : i === Math.min(current, 2) ? <Spinner size={12} /> : '○'} {stage.label}
          </li>
        ))}
      </ol>
      {current >= 3 && <p className="muted">{STAGES[current].label}</p>}
      <div className="skeleton">
        <span className="line w-70" />
        <span className="line w-90" />
        <span className="line w-100" />
        <span className="line w-95" />
        <span className="line w-60" />
      </div>
    </section>
  );
}

// Small toast messages in the corner. Success toasts close themselves; errors stay.
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id) => setToasts((list) => list.filter((toast) => toast.id !== id)), []);
  const push = useCallback((kind, text) => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-3), { id, kind, text }]);
    if (kind !== 'error') setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);
  return { toasts, push, dismiss };
}

export function ToastStack({ toasts, dismiss }) {
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.kind}`}>
          <span className="toast-icon">{toast.kind === 'error' ? '!' : '✓'}</span>
          <span>{toast.text}</span>
          <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => dismiss(toast.id)}>×</button>
        </div>
      ))}
    </div>
  );
}
