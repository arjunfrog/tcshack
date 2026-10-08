import Icon from '../ui/Icon.jsx';
import { Logo } from '../ui/Brand.jsx';
import { Hills, LeafSprig } from '../ui/Art.jsx';

// Public homepage shown before login. Links go to #/signup and #/login.

const STEPS = [
  { icon: 'store', title: 'Tell us about your brand', text: 'Two minutes: what you sell, who buys it, and how you want to sound.' },
  { icon: 'upload', title: 'Add your catalog', text: 'Upload a CSV or JSON of product attributes, or start with sample products.' },
  { icon: 'sparkles', title: 'Generate and review', text: 'SEO-ready titles, descriptions, bullets and meta tags, checked for facts.' },
];

const FEATURES = [
  { icon: 'leaf', title: 'Your brand voice', text: 'Tone, vocabulary and structure stay consistent across every product, not just the first ten.' },
  { icon: 'globe', title: 'Market-informed SEO', text: 'Real shopper searches and top-ranking listings shape keywords and emphasis.' },
  { icon: 'shield', title: 'Facts, not fiction', text: 'Copy is written only from your product data, and every figure is checked.' },
  { icon: 'layers', title: 'Whole-catalog batches', text: 'Generate hundreds of descriptions in one run, with progress and CSV export.' },
  { icon: 'chart', title: 'Quality you can measure', text: 'SEO, fact and style checks on every description, plus team ratings.' },
  { icon: 'clock', title: 'Every version kept', text: 'Regenerate in a new tone without losing the old copy.' },
];

export default function Landing() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Logo />
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
          <h1>Product descriptions that sell, <span className="accent-text">for your whole catalog.</span></h1>
          <p className="hero-sub">
            Turn product attributes into engaging, consistent, search-friendly copy in your brand's voice,
            whether you already sell on Amazon and Flipkart or you're launching your first product.
          </p>
          <div className="hero-actions">
            <a href="#/signup" className="button primary-button large">Start free <Icon name="arrowRight" size={18} /></a>
            <a href="#/login" className="button ghost-button large">I have an account</a>
          </div>
          <div className="hero-points">
            <span><span className="icon-dot"><Icon name="leaf" /></span>Brand voice</span>
            <span><span className="icon-dot"><Icon name="globe" /></span>Market data</span>
            <span><span className="icon-dot"><Icon name="shield" /></span>Fact-checked</span>
          </div>
        </div>

        <div className="hero-visual fade-up delay-1" aria-hidden="true">
          <svg className="hero-arch-bg" viewBox="0 0 400 420"><path d="M60 420V170a140 140 0 0 1 280 0v250Z" /></svg>
          <LeafSprig className="hero-sprig left" />
          <LeafSprig className="hero-sprig right" flip />
          <div className="preview-card input-card">
            <span className="preview-label"><Icon name="file" size={14} /> Product data</span>
            <div className="preview-chips">
              <span>Air Fryer</span><span>4.2 L</span><span>1500 W</span><span>8 presets</span>
            </div>
          </div>
          <div className="preview-flow"><Icon name="sparkles" size={16} /> writing in your voice</div>
          <div className="preview-card output-card">
            <span className="preview-label"><Icon name="pen" size={14} /> Generated copy</span>
            <h3>CrispAir 4.2L Digital Air Fryer, 1500 W with 8 Presets</h3>
            <p>Golden, crunchy favourites from a 4.2 L basket. Eight one-touch presets take the guesswork out of weeknight dinners…</p>
            <div className="preview-badges">
              <span><Icon name="check" size={12} /> Title ≤ 70 chars</span>
              <span><Icon name="check" size={12} /> Keyword in meta</span>
              <span><Icon name="check" size={12} /> No invented specs</span>
            </div>
          </div>
          <span className="script-note">Small choices, big difference</span>
        </div>
      </header>

      <section id="how" className="landing-section">
        <span className="eyebrow center">How it works</span>
        <h2>From spreadsheet to storefront in three steps</h2>
        <div className="steps">
          {STEPS.map((step, i) => (
            <div key={step.title} className="step-card">
              <span className="step-top"><span className="icon-dot large"><Icon name={step.icon} size={20} /></span><span className="step-number">0{i + 1}</span></span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <span className="eyebrow center">Built for where you are</span>
        <h2>Already selling, or just starting out</h2>
        <div className="paths">
          <div className="path-card">
            <span className="icon-dot large"><Icon name="store" size={20} /></span>
            <h3>Already selling?</h3>
            <p>Tell us where you sell. We keep every new listing consistent with the style that already works for you.</p>
          </div>
          <div className="path-card accent">
            <span className="icon-dot large"><Icon name="sparkles" size={20} /></span>
            <h3>Just starting?</h3>
            <p>Answer a few questions about your brand, and we combine them with what top listings in your category do well.</p>
          </div>
        </div>
      </section>

      <section id="features" className="landing-section">
        <span className="eyebrow center">Why teams use it</span>
        <h2>Everything a catalog team needs</h2>
        <div className="features">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="feature">
              <span className="icon-dot large"><Icon name={feature.icon} size={20} /></span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-band">
        <div className="cta-copy">
          <span className="eyebrow light">Get started</span>
          <h2>Ready to write your catalog?</h2>
          <p>Set up your brand in two minutes and generate your first descriptions today.</p>
          <a href="#/signup" className="button light-button large">Create your free account <Icon name="arrowRight" size={18} /></a>
        </div>
        <Hills className="cta-hills" />
        <LeafSprig className="cta-sprig" flip />
      </section>

      <footer className="landing-footer">
        <Logo size={26} />
        <span>TCS Technology Day prototype · Retail product description generator</span>
      </footer>
    </div>
  );
}
