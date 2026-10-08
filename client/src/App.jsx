import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { isAuthConfigured, supabase } from './lib/supabase.js';
import ProductForm from './components/ProductForm.jsx';
import DescriptionView, { toResult } from './components/DescriptionView.jsx';
import Catalog from './components/Catalog.jsx';
import AuthPage from './components/AuthPage.jsx';
import Landing from './components/Landing.jsx';
import History from './components/History.jsx';
import GenerationTimeline from './components/GenerationTimeline.jsx';
import Icon from './ui/Icon.jsx';
import { Spinner } from './components/Feedback.jsx';
import { Logo } from './ui/Brand.jsx';
import Batch from './components/Batch.jsx';
import Review from './components/Review.jsx';
import Dashboard from './components/Dashboard.jsx';
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

function FullPageLoader({ text = 'Loading…' }) {
  return (
    <div className="full-loader">
      <Logo href={null} />
      <span className="muted-lg"><Spinner /> {text}</span>
    </div>
  );
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
  if (session === undefined) return <FullPageLoader />;
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
  if (!account) return <FullPageLoader text="Loading your account…" />;

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
  { id: 'catalog', label: 'Catalog', icon: 'layers' },
  { id: 'generate', label: 'Quick generate', icon: 'zap' },
  { id: 'batch', label: 'Batch', icon: 'list' },
  { id: 'review', label: 'Review', icon: 'clipboardCheck' },
  { id: 'dashboard', label: 'Dashboard', icon: 'chart' },
  { id: 'history', label: 'History', icon: 'clock' },
];

function Studio({ account, onEditProfile }) {
  const [health, setHealth] = useState(null);
  const [choices, setChoices] = useState(FALLBACK_CHOICES);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [run, setRun] = useState(null); // { startedAt, events } while Quick generate runs
  const [tab, setTab] = useState('catalog');
  const [saved, setSaved] = useState(0); // bumps when Quick generate saves, so History reloads

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ status: 'down' }));
    api.options().then(setChoices).catch(() => {});
  }, []);

  const generate = async (product, options) => {
    setRun({ startedAt: Date.now(), events: [] });
    setError('');
    setResult(null);
    try {
      // Saved to the account: the product lands in Catalog and the copy in History.
      const { description } = await api.quickGenerate(product, options, (event) =>
        setRun((current) => current && { ...current, events: [...current.events, { ...event, receivedAt: Date.now() }] }));
      setResult(toResult(description));
      setSaved((n) => n + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setRun(null);
    }
  };

  const { retailer, user } = account;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <Logo href={null} />
          <nav className="tabs" aria-label="Sections">
            {TABS.map((item) => (
              <button key={item.id} type="button" className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>
                <Icon name={item.icon} size={16} /> <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <AccountMenu retailer={retailer} user={user} health={health} onEditProfile={onEditProfile} />
        </div>
      </header>

      <div className="app">
        {tab === 'catalog' && <Catalog choices={choices} />}
        {tab === 'batch' && <Batch choices={choices} />}
        {tab === 'review' && <Review onReviewed={() => setSaved((n) => n + 1)} />}
        {tab === 'dashboard' && <Dashboard refreshKey={saved} />}
        {tab === 'history' && <History refreshKey={saved} />}

        <div hidden={tab !== 'generate'}>
          <div className="page-head">
            <div>
              <h1>Quick generate</h1>
              <p className="muted-lg">Type one product, get copy in your brand voice. It is saved to your catalog and history.</p>
            </div>
          </div>
          <main className="layout">
            <ProductForm choices={choices} busy={Boolean(run)} onSubmit={generate} />
            <div className="detail-column">
              {error && <div className="card notice error"><Icon name="alert" size={16} /> {error}</div>}
              {run ? <GenerationTimeline events={run.events} startedAt={run.startedAt} />
                : result ? (
                  <>
                    <div className="card notice info saved-note"><Icon name="check" size={16} /> Saved to your catalog and history.</div>
                    <div className="fresh"><DescriptionView result={result} /></div>
                  </>
                ) : (
                  <div className="card empty">
                    <span className="icon-dot xl"><Icon name="zap" size={26} /></span>
                    <h2>Your copy appears here</h2>
                    <p className="muted-lg">Fill in the product attributes and generate. You'll see each step live.</p>
                  </div>
                )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function AccountMenu({ retailer, user, health, onEditProfile }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!event.target.closest?.('.account-menu')) setOpen(false); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  const ok = health?.status === 'ok';
  return (
    <div className="account-menu">
      <button type="button" className="account-button" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className={`health-dot ${!health ? 'pending' : ok ? 'ok' : 'bad'}`} title={ok ? 'API connected' : 'API offline'} />
        <span className="account-text"><strong>{retailer.business_name}</strong><small>{retailer.seller_type === 'existing' ? 'Existing seller' : 'New seller'}</small></span>
        <span className="avatar">{retailer.business_name.trim().charAt(0).toUpperCase()}</span>
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head">
            <strong>{retailer.business_name}</strong>
            <small>{user.email}</small>
          </div>
          <div className="menu-status">
            <StatusBadge health={health} />
          </div>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onEditProfile(); }}><Icon name="settings" size={16} /> Business profile</button>
          <button type="button" role="menuitem" onClick={() => supabase.auth.signOut()}><Icon name="logOut" size={16} /> Log out</button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ health }) {
  if (!health) return <span className="badge">Connecting…</span>;
  if (health.status !== 'ok') return <span className="badge bad">API offline</span>;
  return (
    <span className="badge">
      <Icon name="sparkles" size={13} /> {health.llm.provider === 'mock' ? 'mock (no API key)' : health.llm.model}
      <span className="badge-sep" /> <Icon name="database" size={13} /> {health.database.replace('_', ' ')}
    </span>
  );
}
