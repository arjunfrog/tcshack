// Public homepage shown before login. Links go to #/signup and #/login.

const STEPS = [
  { title: 'Tell us about your brand', text: 'A two-minute setup: what you sell, who buys it, how you want to sound.' },
  { title: 'Add your catalog', text: 'Upload a CSV or JSON of product attributes, or try our 60-product sample.' },
  { title: 'Generate, review, export', text: 'SEO-ready titles, descriptions, bullets and meta tags for every product.' },
];

const FEATURES = [
  { icon: '◎', title: 'Your brand voice', text: 'Tone, vocabulary and structure stay consistent across every product, not just the first ten.' },
  { icon: '↗', title: 'Market-informed SEO', text: 'Keywords and title patterns drawn from what is ranking on Indian marketplaces right now.' },
  { icon: '✓', title: 'Facts, not fiction', text: 'Copy is written only from your product data, with checks that flag anything it cannot back up.' },
  { icon: '≡', title: 'Whole-catalog batches', text: 'Generate hundreds of descriptions in one run, with progress, retries and CSV export.' },
  { icon: '★', title: 'Quality you can measure', text: 'Every description gets SEO checks and a completeness score, so you know what to fix.' },
  { icon: '⟲', title: 'Every version saved', text: 'Regenerate in a new tone without losing the old copy. Your history is always there.' },
];

export default function Landing() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <a href="#/" className="logo"><span className="logo-mark">P</span>Product Copy Studio</a>
        <div className="landing-nav-links">
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#/login" className="button ghost-button">Log in</a>
          <a href="#/signup" className="button primary-button">Get started</a>
        </div>
      </nav>

      <header className="hero">
        <div className="hero-copy fade-up">
          <span className="eyebrow">GenAI for e-commerce catalogs</span>
          <h1>Product descriptions that sell, <span className="gradient-text">for your whole catalog.</span></h1>
          <p className="hero-sub">
            Turn product attributes into engaging, consistent, search-friendly copy in your brand's voice.
            Whether you already sell on Amazon and Flipkart or you're launching your first product.
          </p>
          <div className="hero-actions">
            <a href="#/signup" className="button primary-button large">Start free</a>
            <a href="#/login" className="button ghost-button large">I have an account</a>
          </div>
          <p className="hero-note">Works with listings for Amazon · Flipkart · Meesho · Shopify · your own store</p>
        </div>

        <div className="hero-preview fade-up delay-1" aria-hidden="true">
          <div className="preview-card input-card">
            <span className="preview-label">Your product data</span>
            <div className="preview-chips">
              <span>Air Fryer</span><span>4.2 L</span><span>1500 W</span><span>8 presets</span><span>₹5,499</span>
            </div>
          </div>
          <div className="preview-arrow">↓</div>
          <div className="preview-card output-card">
            <span className="preview-label">Generated copy</span>
            <h3>CrispAir 4.2L Digital Air Fryer, 1500W with 8 Presets</h3>
            <p>Golden, crunchy favourites with up to 90% less oil. Eight one-touch presets take the guesswork out of weeknight dinners…</p>
            <div className="preview-badges">
              <span className="ok">✓ Title ≤ 70 chars</span>
              <span className="ok">✓ Keyword in meta</span>
              <span className="ok">✓ 5 bullets</span>
            </div>
          </div>
        </div>
      </header>

      <section className="stats fade-up delay-2">
        <div><strong>60+</strong><span>products per batch</span></div>
        <div><strong>6</strong><span>outputs per product: title, copy, bullets, keywords, meta</span></div>
        <div><strong>0</strong><span>invented specs: written only from your data</span></div>
      </section>

      <section id="how" className="landing-section">
        <h2>How it works</h2>
        <div className="steps">
          {STEPS.map((step, i) => (
            <div key={step.title} className="step-card">
              <span className="step-number">{i + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <h2>Built for where you are</h2>
        <div className="paths">
          <div className="path-card">
            <span className="eyebrow">Already selling?</span>
            <h3>We learn from what already works for you</h3>
            <p>Tell us where you sell. We pick up your existing style and keep every new listing consistent with it.</p>
          </div>
          <div className="path-card accent">
            <span className="eyebrow">Just starting?</span>
            <h3>We build your voice from day one</h3>
            <p>Answer a few questions about your brand, and we combine them with what top listings in your category do well.</p>
          </div>
        </div>
      </section>

      <section id="features" className="landing-section">
        <h2>Everything a catalog team needs</h2>
        <div className="features">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="feature">
              <span className="feature-icon">{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-band">
        <h2>Ready to write your catalog?</h2>
        <p>Set up your brand in two minutes and generate your first descriptions today.</p>
        <a href="#/signup" className="button light-button large">Create your free account</a>
      </section>

      <footer className="landing-footer">Product Copy Studio · TCS Technology Day prototype</footer>
    </div>
  );
}
