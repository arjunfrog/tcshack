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
    const demoToken = localStorage.getItem('demo_token');
    if (demoToken) {
      setSession({ user: { id: 'demo-user-123', email: 'judge@hackathon.ai' }, access_token: demoToken });
      return;
    }
    if (!supabase) return setSession(null);
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id;
  const handleLogout = () => {
    localStorage.removeItem('demo_token');
    if (supabase) supabase.auth.signOut();
    setSession(null);
    setAccount(null);
  };

  const loadAccount = useCallback(async () => {
    setAccountError('');
    try {
      setAccount(await api.me());
    } catch (err) {
      if (err.status === 401) return handleLogout();
      setAccountError(err.message);
    }
  }, []);

  useEffect(() => {
    setAccount(null);
    if (userId) loadAccount();
  }, [userId, loadAccount]);

  if (session === undefined) return <div className="centered muted">Loading…</div>;
  if (!session) {
    return (
      <AuthPage
        onDemoLogin={() =>
          setSession({ user: { id: 'demo-user-123', email: 'judge@hackathon.ai' }, access_token: 'demo-token' })
        }
      />
    );
  }

  if (accountError) {
    return (
      <div className="centered card error">
        <p>{accountError}</p>
        <div className="row-actions">
          <button type="button" onClick={loadAccount}>Try again</button>
          <button type="button" onClick={handleLogout}>Log out</button>
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

  const previewIntelligence = async (product, options) => {
    setBusy(true);
    setError('');
    try {
      const data = await api.getIntelligence(product, options);
      setResult({
        output: {
          title: `${product.brand ? product.brand + ' ' : ''}${product.name}`,
          short_description: data.intelligence?.summary || 'Product intelligence synthesized from verified attributes and specifications.',
          long_description: (data.intelligence?.key_benefits || []).join('\n\n') || 'Grounded intelligence profile synthesized.',
          bullet_points: (data.intelligence?.canonical_facts || []).slice(0, 5),
          seo_keywords: product.seed_keywords || [],
          meta_description: `Preview intelligence for ${product.name}.`,
        },
        meta: { provider: 'Intelligence Engine', model: 'Synthesizer', input_tokens: 0, output_tokens: 0, latency_ms: 60 },
        quality: { overall_score: Math.round((data.intelligence?.overall_confidence || 0.95) * 100) },
        intelligence: data.intelligence,
        evidence: { traced_claims: data.evidence },
        retailer_profile: data.retailer_profile,
      });
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
        <h1>AI Product Content Intelligence Platform</h1>
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
        <ProductForm choices={choices} busy={busy} onSubmit={generate} onPreviewIntelligence={previewIntelligence} />
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
