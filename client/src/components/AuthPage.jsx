import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { api } from '../api.js';

// Login / sign-up, chosen by the URL hash (#/login or #/signup).
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
    <div className="auth-split">
      <aside className="auth-aside">
        <a href="#/" className="logo light"><span className="logo-mark">P</span>Product Copy Studio</a>
        <div className="auth-aside-copy">
          <h2>{isSignup ? 'Your whole catalog, written in your voice.' : 'Welcome back.'}</h2>
          <ul>
            <li>SEO-ready titles, descriptions, bullets and meta tags</li>
            <li>Consistent brand voice across hundreds of products</li>
            <li>Written only from your product data</li>
          </ul>
        </div>
        <p className="auth-aside-foot">For sellers on Amazon, Flipkart, Meesho, Shopify, and those just starting out.</p>
      </aside>

      <main className="auth-main">
        <form className="auth-form fade-up" onSubmit={submit} key={mode}>
          <a href="#/" className="back-link">← Back to home</a>
          <h1>{isSignup ? 'Create your account' : 'Log in'}</h1>
          <p className="muted-lg">
            {isSignup ? 'Already have an account? ' : 'New here? '}
            <a href={isSignup ? '#/login' : '#/signup'} onClick={() => setMessage(null)}>
              {isSignup ? 'Log in' : 'Create an account'}
            </a>
          </p>

          <label>Email
            <input type="email" required autoFocus autoComplete="email" placeholder="you@business.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>Password
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                placeholder={isSignup ? 'At least 6 characters' : ''}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button type="button" className="ghost" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>

          {message && <p className={`form-message ${message.kind}`}>{message.text}</p>}

          <button type="submit" className="primary large" disabled={busy}>
            {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}
          </button>
          {isSignup && <p className="fine-print">Next, we'll ask a few questions about your business to set up your brand voice.</p>}
        </form>
      </main>
    </div>
  );
}
