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
