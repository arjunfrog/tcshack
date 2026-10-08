import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { isAuthConfigured, supabase } from './lib/supabase.js';
import ProductForm from './components/ProductForm.jsx';
import DescriptionView from './components/DescriptionView.jsx';
import Catalog from './components/Catalog.jsx';
import AuthPage from './components/AuthPage.jsx';
import Onboarding from './components/Onboarding.jsx';

const FALLBACK_CHOICES = { tones: ['friendly'], lengths: ['medium'] };

// Login → onboarding (once) → the app.
export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [account, setAccount] = useState(null); // { user, retailer } from /api/me
  const [accountError, setAccountError] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);

  useEffect(() => {
    if (!supabase) return setSession(null);
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  const loadAccount = useCallback(async () => {
    setAccountError('');
    try {
      setAccount(await api.me());
    } catch (err) {
      if (err.status === 401) return supabase.auth.signOut();
      setAccountError(err.message);
    }
  }, []);

  useEffect(() => {
    setAccount(null);
    if (userId) loadAccount();
  }, [userId, loadAccount]);

  if (!isAuthConfigured) {
    return (
      <div className="centered card error">
        Login is not configured. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to
        <code> server/.env</code>, then restart <code>npm run dev</code>.
      </div>
    );
  }
  if (session === undefined) return <div className="centered muted">Loading…</div>;
  if (!session) return <AuthPage />;

  if (accountError) {
    return (
      <div className="centered card error">
        <p>{accountError}</p>
        <div className="row-actions">
          <button type="button" onClick={loadAccount}>Try again</button>
          <button type="button" onClick={() => supabase.auth.signOut()}>Log out</button>
        </div>
      </div>
    );
  }
  if (!account) return <div className="centered muted">Loading your account…</div>;

  if (!account.retailer || editingProfile) {
    return (
      <Onboarding
        initial={account.retailer}
        onCancel={account.retailer ? () => setEditingProfile(false) : undefined}
        onDone={(retailer) => {
          setAccount({ ...account, retailer });
          setEditingProfile(false);
        }}
      />
    );
  }

  return <Studio account={account} onEditProfile={() => setEditingProfile(true)} />;
}

function Studio({ account, onEditProfile }) {
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

  const { retailer, user } = account;

  return (
    <div className="app">
      <header className="topbar">
        <h1>Product Copy Studio</h1>
        <nav className="tabs">
          <button type="button" className={tab === 'catalog' ? 'active' : ''} onClick={() => setTab('catalog')}>Catalog</button>
          <button type="button" className={tab === 'generate' ? 'active' : ''} onClick={() => setTab('generate')}>Quick generate</button>
        </nav>
        <StatusBadge health={health} />
        <div className="account">
          <span>
            <strong>{retailer.business_name}</strong>
            <small> · {retailer.seller_type === 'existing' ? 'Existing seller' : 'New seller'} · {user.email}</small>
          </span>
          <button type="button" className="ghost" onClick={onEditProfile}>Profile</button>
          <button type="button" className="ghost" onClick={() => supabase.auth.signOut()}>Log out</button>
        </div>
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
