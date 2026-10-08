import { useState } from 'react';
import { api } from '../api.js';
import Icon from '../ui/Icon.jsx';
import { Logo } from '../ui/Brand.jsx';
import { Hills, LeafSprig } from '../ui/Art.jsx';
import { Spinner } from './Feedback.jsx';

const CHANNEL_LABELS = {
  amazon: 'Amazon',
  flipkart: 'Flipkart',
  meesho: 'Meesho',
  myntra: 'Myntra',
  nykaa: 'Nykaa',
  shopify: 'Shopify store',
  website: 'Own website',
  offline: 'Offline store',
  other: 'Other',
};

const CATEGORY_PRESETS = [
  'Electronics', 'Apparel', 'Home & Kitchen', 'Beauty & Personal Care',
  'Sports & Fitness', 'Grocery & Gourmet', 'Toys & Baby', 'Books & Stationery', 'Jewellery & Accessories',
];

const PRICE_OPTIONS = [
  { value: 'budget', label: 'Budget', hint: 'Value for money, deals' },
  { value: 'mid', label: 'Mid-range', hint: 'Quality at a fair price' },
  { value: 'premium', label: 'Premium', hint: 'Craftsmanship, experience' },
];

const PERSONALITY = ['Warm', 'Bold', 'Minimal', 'Playful', 'Expert', 'Luxurious', 'Eco-conscious', 'Trustworthy', 'Youthful', 'Fun'];
const MAX_PERSONALITY = 3;

const EMPTY = {
  business_name: '',
  seller_type: '',
  channels: [],
  store_url: '',
  categories: [],
  target_customer: '',
  price_positioning: '',
  brand_personality: [],
  admired_brands: '',
  words_to_avoid: '',
};

const toggle = (list, value) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

// Multi-step onboarding. Also used to edit the profile later (pass `initial`).
export default function Onboarding({ initial, onDone, onCancel }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ...stripNulls(initial) }));
  const [step, setStep] = useState(0);
  const [customCategory, setCustomCategory] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isExisting = form.seller_type === 'existing';
  const steps = ['business', ...(isExisting ? ['channels'] : []), 'brand'];
  const current = steps[step];
  const set = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setError('');
  };

  const stepError = () => {
    if (current === 'business') {
      if (!form.business_name.trim()) return 'Enter your business or brand name.';
      if (!form.seller_type) return 'Tell us whether you already sell online.';
    }
    if (current === 'channels' && form.channels.length === 0) return 'Pick at least one place you sell today.';
    if (current === 'brand') {
      if (form.categories.length === 0) return 'Pick at least one category.';
      if (!form.price_positioning) return 'Choose your price positioning.';
    }
    return '';
  };

  const next = async () => {
    const problem = stepError();
    if (problem) return setError(problem);
    setError('');
    if (step < steps.length - 1) return setStep(step + 1);

    setBusy(true);
    try {
      const { retailer } = await api.saveRetailer(form);
      onDone(retailer);
    } catch (err) {
      setError(err.details?.[0]?.message ?? err.message);
    } finally {
      setBusy(false);
    }
  };

  const addCustomCategory = () => {
    const value = customCategory.trim();
    if (value && !form.categories.includes(value)) set({ categories: [...form.categories, value] });
    setCustomCategory('');
  };

  const needsStoreUrl = form.channels.includes('shopify') || form.channels.includes('website');

  const STEP_INFO = {
    business: { title: 'Your business', text: 'Name and whether you already sell', icon: 'store' },
    channels: { title: 'Where you sell', text: 'Marketplaces and your store', icon: 'globe' },
    brand: { title: 'Brand and voice', text: 'Categories, customers, personality', icon: 'leaf' },
  };
  const isLast = step === steps.length - 1;

  return (
    <div className="onboarding-shell">
      <aside className="onboarding-aside">
        <Logo light={false} href={null} />
        <div>
          <span className="eyebrow">{initial ? 'Business profile' : 'Set up in 2 minutes'}</span>
          <h2>{initial ? 'Update how your brand sounds' : 'Tell us about your brand'}</h2>
          <p className="muted-lg">Your answers shape every description: the voice, what to emphasise and what never to say.</p>
        </div>
        <ol className="onboarding-steps">
          {steps.map((name, i) => (
            <li key={name} className={i < step ? 'done' : i === step ? 'active' : ''}>
              <span className="step-dot">{i < step ? <Icon name="check" size={16} /> : <Icon name={STEP_INFO[name].icon} size={16} />}</span>
              <span><strong>{STEP_INFO[name].title}</strong><small>{STEP_INFO[name].text}</small></span>
            </li>
          ))}
        </ol>
        <Hills className="aside-hills" />
        <LeafSprig className="aside-sprig" flip />
      </aside>

      <main className="onboarding-main">
        <div className="onboarding-card fade-up" key={current}>
          <div className="onboarding-progress">
            <span className="muted">Step {step + 1} of {steps.length}</span>
            <div className="stepper">{steps.map((name, i) => <span key={name} className={i <= step ? 'done' : ''} />)}</div>
          </div>

          {current === 'business' && (
            <>
              <h1>{initial ? 'Edit business profile' : 'Set up your business'}</h1>
              <label className="field">
                <span className="field-label">Business or brand name *</span>
                <span className="input-icon">
                  <Icon name="store" />
                  <input autoFocus value={form.business_name} onChange={(event) => set({ business_name: event.target.value })} placeholder="e.g. NewBrew Coffee Co." />
                </span>
              </label>

              <h3 className="field-label">Are you already selling online? *</h3>
              <div className="choice-grid">
                <button
                  type="button"
                  className={`choice ${form.seller_type === 'existing' ? 'selected' : ''}`}
                  onClick={() => set({ seller_type: 'existing' })}
                >
                  <span className="icon-dot large"><Icon name="store" size={20} /></span>
                  <strong>Yes, I already sell</strong>
                  <span>On Amazon, Flipkart, Meesho or my own store. We keep new listings consistent with your style.</span>
                  <span className="choice-check"><Icon name="check" size={14} /></span>
                </button>
                <button
                  type="button"
                  className={`choice ${form.seller_type === 'new' ? 'selected' : ''}`}
                  onClick={() => set({ seller_type: 'new' })}
                >
                  <span className="icon-dot large"><Icon name="sparkles" size={20} /></span>
                  <strong>No, I'm just starting</strong>
                  <span>We build your brand voice from a few questions and what's working in the market.</span>
                  <span className="choice-check"><Icon name="check" size={14} /></span>
                </button>
              </div>
            </>
          )}

          {current === 'channels' && (
            <>
              <h1>Where do you sell today?</h1>
              <p className="muted-lg">Pick every place you list products. *</p>
              <div className="chip-picker">
                {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`chip-toggle ${form.channels.includes(value) ? 'selected' : ''}`}
                    onClick={() => set({ channels: toggle(form.channels, value) })}
                  >
                    {form.channels.includes(value) && <Icon name="check" size={14} />} {label}
                  </button>
                ))}
              </div>
              {needsStoreUrl && (
                <label className="field">
                  <span className="field-label">Store URL</span>
                  <span className="input-icon">
                    <Icon name="globe" />
                    <input type="url" value={form.store_url} onChange={(event) => set({ store_url: event.target.value })} placeholder="https://yourstore.com" />
                  </span>
                  <small className="field-hint">Saved with your profile for importing your existing listings later.</small>
                </label>
              )}
            </>
          )}

          {current === 'brand' && (
            <>
              <h1>{isExisting ? 'What do you sell?' : 'What do you plan to sell?'}</h1>
              <span className="field-label">Categories *</span>
              <div className="chip-picker">
                {[...new Set([...CATEGORY_PRESETS, ...form.categories])].map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={`chip-toggle ${form.categories.includes(category) ? 'selected' : ''}`}
                    onClick={() => set({ categories: toggle(form.categories, category) })}
                  >
                    {form.categories.includes(category) && <Icon name="check" size={14} />} {category}
                  </button>
                ))}
              </div>
              <div className="inline-add">
                <span className="input-icon">
                  <Icon name="plus" />
                  <input
                    value={customCategory}
                    onChange={(event) => setCustomCategory(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomCategory(); } }}
                    placeholder="Another category, e.g. Coffee"
                  />
                </span>
                <button type="button" onClick={addCustomCategory}>Add</button>
              </div>

              <span className="field-label">Price positioning *</span>
              <div className="choice-grid three">
                {PRICE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`choice compact ${form.price_positioning === option.value ? 'selected' : ''}`}
                    onClick={() => set({ price_positioning: option.value })}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.hint}</span>
                    <span className="choice-check"><Icon name="check" size={14} /></span>
                  </button>
                ))}
              </div>

              <label className="field">
                <span className="field-label">Who are your customers?</span>
                <span className="input-icon">
                  <Icon name="users" />
                  <input value={form.target_customer} onChange={(event) => set({ target_customer: event.target.value })} placeholder="e.g. young professionals who cook at home" />
                </span>
              </label>

              <span className="field-label">Brand personality <small>pick up to {MAX_PERSONALITY}</small></span>
              <div className="chip-picker">
                {PERSONALITY.map((trait) => {
                  const selected = form.brand_personality.includes(trait);
                  return (
                    <button
                      key={trait}
                      type="button"
                      className={`chip-toggle ${selected ? 'selected' : ''}`}
                      disabled={!selected && form.brand_personality.length >= MAX_PERSONALITY}
                      onClick={() => set({ brand_personality: toggle(form.brand_personality, trait) })}
                    >
                      {selected && <Icon name="check" size={14} />} {trait}
                    </button>
                  );
                })}
              </div>

              <div className="grid-2">
                <label className="field">
                  <span className="field-label">{isExisting ? 'Main competitors' : 'Brands you admire'}</span>
                  <input value={form.admired_brands} onChange={(event) => set({ admired_brands: event.target.value })} placeholder="e.g. boAt, Mamaearth" />
                </label>
                <label className="field">
                  <span className="field-label">Words or claims to avoid</span>
                  <input value={form.words_to_avoid} onChange={(event) => set({ words_to_avoid: event.target.value })} placeholder="e.g. cheap, miracle" />
                </label>
              </div>
            </>
          )}

          {error && <p className="form-message error"><Icon name="alert" size={16} /> {error}</p>}

          <div className="wizard-actions">
            {step > 0
              ? <button type="button" onClick={() => { setError(''); setStep(step - 1); }}><Icon name="arrowLeft" size={16} /> Back</button>
              : onCancel ? <button type="button" onClick={onCancel}>Cancel</button> : <span />}
            <button type="button" className="primary large" disabled={busy} onClick={next}>
              {busy ? <><Spinner /> Saving…</> : isLast ? <>{initial ? 'Save profile' : 'Finish setup'} <Icon name="check" /></> : <>Continue <Icon name="arrowRight" /></>}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

// Database rows use null for empty fields; the form uses ''.
function stripNulls(row) {
  if (!row) return {};
  return Object.fromEntries(
    Object.entries(EMPTY).map(([key, fallback]) => [key, row[key] ?? fallback]),
  );
}
