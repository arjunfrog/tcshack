// Public homepage shown before login. Links go to #/signup and #/login.
import { Icon, ProductThumb, StatusDot } from './ui.jsx';

const STEPS = [
  { title: 'Tell us about your brand', text: 'A two-minute setup: what you sell, who buys it, how you want to sound.' },
  { title: 'Add your catalog', text: 'Upload a CSV or JSON of product attributes, or try our 60-product sample.' },
  { title: 'Generate, review, export', text: 'SEO-ready titles, descriptions, bullets and meta tags for every product.' },
];

const FEATURES = [
  { icon: 'leaf', title: 'Your brand voice', text: 'Tone, vocabulary and structure stay consistent across every product, not just the first ten.' },
  { icon: 'search', title: 'Market-informed SEO', text: 'Keywords and title patterns drawn from what is ranking on Indian marketplaces right now.' },
  { icon: 'shield', title: 'Facts, not fiction', text: 'Copy is written only from your product data, with checks that flag anything it cannot back up.' },
  { icon: 'layers', title: 'Whole-catalog batches', text: 'Generate hundreds of descriptions in one run, with progress, retries and CSV export.' },
  { icon: 'check', title: 'Quality you can measure', text: 'Every description gets SEO checks and a completeness score, so you know what to fix.' },
  { icon: 'clock', title: 'Every version saved', text: 'Regenerate in a new tone without losing the old copy. Your history is always there.' },
];

export default function Landing() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <a href="#/" className="logo"><span className="logo-mark"><Icon name="leaf" size={20} /></span><span>Copy Studio</span></a>
        <div className="landing-nav-links">
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#/login" className="button-secondary">Log in</a>
          <a href="#/signup" className="button-primary">Get started</a>
        </div>
      </nav>

      <header className="hero">
        <div className="hero-copy fade-up">
          <h1>Product descriptions that sell, for your whole catalog.</h1>
          <p className="hero-sub">
            Turn product attributes into engaging, consistent, search-friendly copy in your brand's voice,
            for sellers already on Amazon and Flipkart and for those launching their first product.
          </p>
          <div className="hero-actions">
            <a href="#/signup" className="button-primary large">Start free</a>
            <a href="#/login" className="button-secondary large">I have an account</a>
          </div>
          <p className="hero-note">For listings on Amazon, Flipkart, Meesho, Shopify and your own store.</p>
        </div>

        <div className="hero-preview fade-up delay-1" aria-hidden="true">
          <div className="preview-product">
            <ProductThumb product={{ category: 'Home & Kitchen' }} size="md" />
            <div>
              <span className="crumbs">Home &amp; Kitchen › Air Fryer</span>
              <strong>Casa Nova CrispAir 4.2L Digital Air Fryer</strong>
              <span className="preview-price">₹5,499</span>
            </div>
          </div>
          <p className="preview-copy">Golden, crunchy favourites with up to 90% less oil. Eight one-touch presets take the guesswork out of weeknight dinners, and the basket goes straight into the dishwasher.</p>
          <div className="pills">
            <StatusDot>SEO 6/6</StatusDot>
            <StatusDot>Nothing invented</StatusDot>
            <StatusDot>Reads naturally</StatusDot>
          </div>
          <div className="preview-serp">
            <span className="serp-path">yourstore.in › home-kitchen › crispair-4-2l</span>
            <span className="serp-title">Casa Nova CrispAir 4.2L Digital Air Fryer, 8 Presets</span>
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
              <span className="feature-badge"><Icon name={feature.icon} size={22} /></span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-band">
        <h2>Ready to write your catalog?</h2>
        <p>Set up your brand in two minutes and generate your first descriptions today.</p>
        <a href="#/signup" className="button-light large">Create your free account</a>
      </section>

      <footer className="landing-footer">Copy Studio, a TCS Technology Day prototype.</footer>
    </div>
  );
}
