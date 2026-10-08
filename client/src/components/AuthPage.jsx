import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function AuthPage({ onDemoLogin }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { kind, text }

  const handleDemoLogin = () => {
    localStorage.setItem('demo_token', 'demo-token');
    if (onDemoLogin) onDemoLogin();
    else window.location.reload();
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (!supabase) {
        handleDemoLogin();
        return;
      }
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // With "Confirm email" on in Supabase, there is no session until the link is clicked.
        if (!data.session) {
          setMessage({ kind: 'info', text: 'Account created. Check your email for the confirmation link, then log in.' });
          setMode('login');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      // On success, App's auth listener takes over.
    } catch (err) {
      setMessage({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setMessage(null);
  };

  return (
    <div className="auth-page">
      <div className="auth-intro">
        <h1>Product Content Intelligence Platform</h1>
        <p>AI-powered e-commerce copy grounded in catalog specifications, external evidence, and retailer brand voice.</p>
      </div>

      <form className="card auth-card" onSubmit={submit}>
        <div className="segmented">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Log in</button>
          <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => switchMode('signup')}>Sign up</button>
        </div>

        <label>Email
          <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>Password
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {mode === 'signup' && <small>At least 6 characters</small>}
        </label>

        {message && <p className={`form-message ${message.kind}`}>{message.text}</p>}

        <button type="submit" className="primary" disabled={busy} id="btn-auth-submit">
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>

        <div style={{ textAlign: 'center', margin: '16px 0 8px', borderTop: '1px solid var(--border-color, #333)', paddingTop: '16px' }}>
          <p style={{ fontSize: '0.82rem', color: '#888', marginBottom: '8px' }}>Hackathon Judge & Offline Preview</p>
          <button
            type="button"
            className="secondary-btn"
            style={{ width: '100%', padding: '10px 16px', background: 'rgba(255, 255, 255, 0.08)' }}
            onClick={handleDemoLogin}
            id="btn-demo-login"
          >
            🚀 Explore Demo Workspace (One-Click)
          </button>
        </div>
      </form>
    </div>
  );
}
