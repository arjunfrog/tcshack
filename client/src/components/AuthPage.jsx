import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { api } from '../api.js';
import Icon from '../ui/Icon.jsx';
import { Logo } from '../ui/Brand.jsx';
import { Hills, LeafSprig } from '../ui/Art.jsx';
import { Spinner } from './Feedback.jsx';

const POINTS = [
  { icon: 'leaf', title: 'Your brand voice', text: 'Consistent copy across your whole catalog.' },
  { icon: 'globe', title: 'Market-informed SEO', text: 'Shaped by real shopper searches.' },
  { icon: 'shield', title: 'Fact-checked', text: 'Written only from your product data.' },
];

// Login / sign-up, chosen by the URL hash (#/login or #/signup). Email and password only.
export default function AuthPage({ mode }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { kind, text }
  const isSignup = mode === 'signup';

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (isSignup) {
        // Our API creates the account already confirmed (no confirmation email), then we log in.
        await api.signup(email, password);
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // On success, App's auth listener takes over.
    } catch (err) {
      setMessage({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-split">
        <aside className="auth-aside">
          <Logo />
          <div className="auth-aside-copy">
            <span className="eyebrow">{isSignup ? 'Start writing' : 'Welcome back'}</span>
            <h2>{isSignup ? <>Your whole catalog, <span className="accent-text">in your voice.</span></> : <>Good copy, <span className="accent-text">brighter listings.</span></>}</h2>
            <p>Turn product attributes into engaging, search-friendly descriptions in minutes.</p>
            <ul className="aside-points">
              {POINTS.map((point) => (
                <li key={point.title}>
                  <span className="icon-dot large"><Icon name={point.icon} size={20} /></span>
                  <span><strong>{point.title}</strong><small>{point.text}</small></span>
                </li>
              ))}
            </ul>
          </div>
          <span className="script-note">Small choices, big difference</span>
          <Hills className="aside-hills" />
          <LeafSprig className="aside-sprig" flip />
        </aside>

        <main className="auth-main">
          <div className="auth-switch">
            {isSignup ? 'Already have an account?' : 'New here?'}{' '}
            <a href={isSignup ? '#/login' : '#/signup'} onClick={() => setMessage(null)}>{isSignup ? 'Log in' : 'Create an account'}</a>
          </div>

          <form className="auth-form fade-up" onSubmit={submit} key={mode}>
            <h1>{isSignup ? 'Create your account' : 'Welcome back'}</h1>
            <p className="muted-lg">{isSignup ? 'Set up takes two minutes. We only need an email and a password.' : 'Log in to continue writing for your catalog.'}</p>

            <label className="field">
              <span className="field-label">Email address</span>
              <span className="input-icon">
                <Icon name="mail" />
                <input type="email" required autoFocus autoComplete="email" placeholder="you@business.com" value={email} onChange={(event) => setEmail(event.target.value)} />
              </span>
            </label>
            <label className="field">
              <span className="field-label">Password</span>
              <span className="input-icon">
                <Icon name="lock" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  placeholder={isSignup ? 'At least 6 characters' : 'Your password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button type="button" className="icon-button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} />
                </button>
              </span>
            </label>

            {message && <p className={`form-message ${message.kind}`}><Icon name="alert" size={16} /> {message.text}</p>}

            <button type="submit" className="primary large block" disabled={busy}>
              {busy ? <><Spinner /> Please wait…</> : <>{isSignup ? 'Create account' : 'Log in'} <Icon name="arrowRight" /></>}
            </button>
            {isSignup && <p className="fine-print">Next, a few questions about your business set up your brand voice.</p>}
            <a href="#/" className="back-link"><Icon name="arrowLeft" size={16} /> Back to home</a>
          </form>
        </main>
      </div>
    </div>
  );
}
