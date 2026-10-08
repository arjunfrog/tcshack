import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { isAuthConfigured, supabase } from './lib/supabase.js';
import ProductForm from './components/ProductForm.jsx';
import DescriptionView, { toResult } from './components/DescriptionView.jsx';
import Catalog from './components/Catalog.jsx';
import AuthPage from './components/AuthPage.jsx';
import Landing from './components/Landing.jsx';
import History from './components/History.jsx';
import { GeneratingCard } from './components/Feedback.jsx';
import Onboarding from './components/Onboarding.jsx';

const FALLBACK_CHOICES = { tones: ['friendly'], lengths: ['medium'] };

// Tiny hash router for the logged-out pages: #/login, #/signup, anything else = homepage.
function useHashRoute() {
  const read = () => window.location.hash.replace(/^#\/?/, '');
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => {
      setRoute(read());
      if (window.location.hash.startsWith('#/')) window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

// Homepage → login/sign-up → onboarding (once) → the app.
export default function App() {
  const route = useHashRoute();
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [account, setAccount] = useState(null); // { user, retailer } from /api/me
  const [accountError, setAccountError] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);

  useEffect(() => {
    if (!supabase) return setSession(null);
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next && window.location.hash.startsWith('#/')) window.history.replaceState(null, '', window.location.pathname);
    });
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
  if (!session) {
    if (route === 'login' || route === 'signup') return <AuthPage mode={route} />;
    return <Landing />;
  }

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
  const [busy, setBusy] = useState(null); // start time while Quick generate runs
  const [tab, setTab] = useState('catalog');
  const [saved, setSaved] = useState(0); // bumps when Quick generate saves, so History reloads

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ status: 'down' }));
    api.options().then(setChoices).catch(() => {});
  }, []);

  const generate = async (product, options) => {
    setBusy(Date.now());
    setError('');
    try {
      // Saved to the account: the product lands in Catalog and the copy in History.
      const { description } = await api.quickGenerate(product, options);
      setResult(toResult(description));
      setSaved((n) => n + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const { retailer, user } = account;

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="logo"><span className="logo-mark">P</span>Product Copy Studio</h1>
        <nav className="tabs">
          <button type="button" className={tab === 'catalog' ? 'active' : ''} onClick={() => setTab('catalog')}>Catalog</button>
          <button type="button" className={tab === 'generate' ? 'active' : ''} onClick={() => setTab('generate')}>Quick generate</button>
          <button type="button" className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>History</button>
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
      {tab === 'history' && <History refreshKey={saved} />}

      <main className="layout" hidden={tab !== 'generate'}>
        <ProductForm choices={choices} busy={Boolean(busy)} onSubmit={generate} />
        <div className="detail-column">
          {error && <div className="card notice error">{error}</div>}
          {busy ? <GeneratingCard startedAt={busy} />
            : result ? (
              <>
                <div className="card notice info saved-note">✓ Saved to your catalog and history.</div>
                <div className="fresh"><DescriptionView result={result} /></div>
              </>
            ) : <div className="card empty">Fill in the product attributes and generate a description.</div>}
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
