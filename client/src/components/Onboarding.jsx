import { useState } from 'react';
import { api } from '../api.js';

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

  return (
    <div className="onboarding">
      <div className="card onboarding-card">
        <div className="card-header">
          <h2>{initial ? 'Edit business profile' : 'Set up your business'}</h2>
          <span className="muted">Step {step + 1} of {steps.length}</span>
        </div>
        <div className="stepper">{steps.map((name, i) => <span key={name} className={i <= step ? 'done' : ''} />)}</div>

        {current === 'business' && (
          <>
            <label>Business or brand name *
              <input autoFocus value={form.business_name} onChange={(event) => set({ business_name: event.target.value })} placeholder="e.g. NewBrew Coffee Co." />
            </label>

            <h3>Are you already selling online? *</h3>
            <div className="choice-grid">
              <button
                type="button"
                className={`choice ${form.seller_type === 'existing' ? 'selected' : ''}`}
                onClick={() => set({ seller_type: 'existing' })}
              >
                <strong>Yes, I already sell</strong>
                <span>On Amazon, Flipkart, Meesho, my own store… We'll learn your style from your existing listings.</span>
              </button>
              <button
                type="button"
                className={`choice ${form.seller_type === 'new' ? 'selected' : ''}`}
                onClick={() => set({ seller_type: 'new' })}
              >
                <strong>No, I'm just starting</strong>
                <span>We'll build your brand voice from a few questions and what's working in the market.</span>
              </button>
            </div>
          </>
        )}

        {current === 'channels' && (
          <>
            <h3>Where do you sell today? *</h3>
            <div className="chip-picker">
              {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`chip-toggle ${form.channels.includes(value) ? 'selected' : ''}`}
                  onClick={() => set({ channels: toggle(form.channels, value) })}
                >
                  {label}
                </button>
              ))}
            </div>
            {needsStoreUrl && (
              <label>Store URL
                <input type="url" value={form.store_url} onChange={(event) => set({ store_url: event.target.value })} placeholder="https://yourstore.com" />
                <small>We can import your existing product descriptions from here to learn your style.</small>
              </label>
            )}
          </>
        )}

        {current === 'brand' && (
          <>
            <h3>{isExisting ? 'What do you sell?' : 'What do you plan to sell?'} *</h3>
            <div className="chip-picker">
              {[...new Set([...CATEGORY_PRESETS, ...form.categories])].map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`chip-toggle ${form.categories.includes(category) ? 'selected' : ''}`}
                  onClick={() => set({ categories: toggle(form.categories, category) })}
                >
                  {category}
                </button>
              ))}
            </div>
            <div className="inline-add">
              <input
                value={customCategory}
                onChange={(event) => setCustomCategory(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomCategory(); } }}
                placeholder="Another category, e.g. Coffee"
              />
              <button type="button" onClick={addCustomCategory}>Add</button>
            </div>

            <h3>Price positioning *</h3>
            <div className="choice-grid three">
              {PRICE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`choice ${form.price_positioning === option.value ? 'selected' : ''}`}
                  onClick={() => set({ price_positioning: option.value })}
                >
                  <strong>{option.label}</strong>
                  <span>{option.hint}</span>
                </button>
              ))}
            </div>

            <label>Who are your customers?
              <input value={form.target_customer} onChange={(event) => set({ target_customer: event.target.value })} placeholder="e.g. young professionals who cook at home" />
            </label>

            <h3>Brand personality <small>pick up to {MAX_PERSONALITY}</small></h3>
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
                    {trait}
                  </button>
                );
              })}
            </div>

            <label>{isExisting ? 'Main competitors' : 'Brands you admire or compete with'}
              <input value={form.admired_brands} onChange={(event) => set({ admired_brands: event.target.value })} placeholder="e.g. boAt, Mamaearth, or their website links" />
            </label>
            <label>Words or claims to avoid
              <input value={form.words_to_avoid} onChange={(event) => set({ words_to_avoid: event.target.value })} placeholder="e.g. cheap, best in the world, miracle" />
            </label>
          </>
        )}

        {error && <p className="form-message error">{error}</p>}

        <div className="wizard-actions">
          {step > 0
            ? <button type="button" onClick={() => { setError(''); setStep(step - 1); }}>Back</button>
            : onCancel ? <button type="button" onClick={onCancel}>Cancel</button> : <span />}
          <button type="button" className="primary inline" disabled={busy} onClick={next}>
            {busy ? 'Saving…' : step < steps.length - 1 ? 'Continue' : initial ? 'Save profile' : 'Finish setup'}
          </button>
        </div>
      </div>
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
