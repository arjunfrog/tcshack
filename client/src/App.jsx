import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { isAuthConfigured, supabase } from './lib/supabase.js';
import ProductForm from './components/ProductForm.jsx';
import { toResult } from './components/DescriptionView.jsx';
import ProductDetail from './components/ProductDetail.jsx';
import { Icon } from './components/ui.jsx';
import Catalog from './components/Catalog.jsx';
import AuthPage from './components/AuthPage.jsx';
import Landing from './components/Landing.jsx';
import History from './components/History.jsx';
import Batch from './components/Batch.jsx';
import Review from './components/Review.jsx';
import Dashboard from './components/Dashboard.jsx';
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

const TABS = [
  { id: 'catalog', label: 'Catalog' },
  { id: 'generate', label: 'Quick generate' },
  { id: 'batch', label: 'Batch' },
  { id: 'review', label: 'Review' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'history', label: 'History' },
];

export function Studio({ account, onEditProfile }) {
  const [health, setHealth] = useState(null);
  const [choices, setChoices] = useState(FALLBACK_CHOICES);
  const [result, setResult] = useState(null); // { product, description } from Quick generate
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null); // start time while Quick generate runs
  const [tab, setTab] = useState('catalog');
  const [saved, setSaved] = useState(0); // bumps when copy is saved or reviewed, so History and Dashboard reload

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ status: 'down' }));
    api.options().then(setChoices).catch(() => {});
  }, []);

  const generate = async (product, options) => {
    setBusy(Date.now());
    setError('');
    try {
      // Saved to the account: the product lands in Catalog and the copy in History.
      setResult(await api.quickGenerate(product, options));
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
        <a className="logo" href="#/" onClick={(event) => { event.preventDefault(); setTab('catalog'); }}>
          <span className="logo-mark"><Icon name="leaf" size={20} /></span>
          <span>Copy Studio</span>
        </a>
        <nav className="tabs" aria-label="Sections">
          {TABS.map(({ id, label }) => (
            <button key={id} type="button" className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="topbar-end">
          <StatusBadge health={health} />
          <AccountMenu retailer={retailer} user={user} onEditProfile={onEditProfile} />
        </div>
      </header>

      {tab === 'catalog' && <Catalog choices={choices} />}
      {tab === 'batch' && <Batch choices={choices} />}
      {tab === 'review' && <Review onReviewed={() => setSaved((n) => n + 1)} />}
      {tab === 'dashboard' && <Dashboard refreshKey={saved} />}
      {tab === 'history' && <History refreshKey={saved} />}

      <div className="workspace" hidden={tab !== 'generate'}>
        <ProductForm choices={choices} busy={Boolean(busy)} onSubmit={generate} />
        <main className="workspace-main">
          {error && <div className="inline-alert">{error}</div>}
          {busy ? <GeneratingCard startedAt={busy} />
            : result ? (
              <>
                <p className="saved-note"><Icon name="check" size={16} />Saved to your catalog and history.</p>
                <ProductDetail product={result.product} result={toResult(result.description)} fresh />
              </>
            ) : (
              <div className="panel placeholder">
                <Icon name="sparkle" size={40} />
                <h2>Describe one product</h2>
                <p>Fill in its attributes on the left and generate. The product and its copy are saved to your catalog.</p>
              </div>
            )}
        </main>
      </div>
    </div>
  );
}

function StatusBadge({ health }) {
  if (!health) return <span className="status-badge">Connecting…</span>;
  if (health.status !== 'ok') return <span className="status-badge bad"><span className="pill-dot" />API offline</span>;
  const dbOk = health.database === 'connected';
  return (
    <span className={`status-badge ${dbOk ? '' : 'warn'}`} title={`Database: ${health.database.replace('_', ' ')}`}>
      <span className="pill-dot" />
      {health.llm.provider === 'mock' ? 'Mock model (no API key)' : health.llm.model.replace(/^openai\//, '')}
    </span>
  );
}

function AccountMenu({ retailer, user, onEditProfile }) {
  const initials = retailer.business_name.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase();
  return (
    <details className="account-menu">
      <summary aria-label="Account">{initials}</summary>
      <div className="account-pop">
        <strong>{retailer.business_name}</strong>
        <span>{user.email}</span>
        <span>{retailer.seller_type === 'existing' ? 'Existing seller' : 'New seller'}</span>
        <button type="button" onClick={onEditProfile}><Icon name="user" size={16} />Brand profile</button>
        <button type="button" onClick={() => supabase.auth.signOut()}><Icon name="logout" size={16} />Log out</button>
      </div>
    </details>
  );
}
