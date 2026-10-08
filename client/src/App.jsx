import { useEffect, useState } from 'react';
import { api } from './api.js';
import ProductForm from './components/ProductForm.jsx';
import DescriptionView from './components/DescriptionView.jsx';
import Catalog from './components/Catalog.jsx';

const FALLBACK_CHOICES = { tones: ['friendly'], lengths: ['medium'] };

export default function App() {
  const [health, setHealth] = useState(null);
  const [choices, setChoices] = useState(FALLBACK_CHOICES);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('catalog');

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ status: 'down' }));
    api.options().then(setChoices).catch(() => {});
  }, []);

  const generate = async (product, options) => {
    setBusy(true);
    setError('');
    try {
      setResult(await api.generate(product, options));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>Product Copy Studio</h1>
        <nav className="tabs">
          <button type="button" className={tab === 'catalog' ? 'active' : ''} onClick={() => setTab('catalog')}>Catalog</button>
          <button type="button" className={tab === 'generate' ? 'active' : ''} onClick={() => setTab('generate')}>Quick generate</button>
        </nav>
        <StatusBadge health={health} />
      </header>

      {tab === 'catalog' && <Catalog choices={choices} />}

      <main className="layout" hidden={tab !== 'generate'}>
        <ProductForm choices={choices} busy={busy} onSubmit={generate} />
        <div>
          {error && <div className="card error">{error}</div>}
          {result
            ? <DescriptionView result={result} />
            : <div className="card empty">Fill in the product attributes and generate a description.</div>}
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ health }) {
  if (!health) return <span className="badge">Connecting…</span>;
  if (health.status !== 'ok') return <span className="badge bad">API offline</span>;
  return (
    <span className="badge">
      LLM: {health.llm.provider === 'mock' ? 'mock (no API key)' : health.llm.model} · DB: {health.database.replace('_', ' ')}
    </span>
  );
}
