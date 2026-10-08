import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Spinner } from './Feedback.jsx';

export const SAMPLE_PRODUCT = {
  name: 'Pulse Buds',
  category: 'Electronics',
  subcategory: 'Wireless Earbuds',
  brand: 'Voltix',
  price: '2999',
  features: 'Active noise cancellation\nIPX5 sweat resistance\nFast charging: 10 min for 2 hours of playback\nDual-device pairing',
  specifications: 'Battery life: 32 hours with case\nBluetooth: 5.3\nDriver size: 12 mm',
  seed_keywords: 'wireless earbuds, noise cancelling earbuds',
};

const EMPTY = { name: '', category: '', subcategory: '', brand: '', price: '', features: '', specifications: '', seed_keywords: '' };

const lines = (text) => text.split('\n').map((line) => line.trim()).filter(Boolean);

// Turns the text-friendly form state into the API's product shape.
function toProduct(form) {
  const specifications = Object.fromEntries(
    lines(form.specifications)
      .map((line) => line.split(/:(.*)/s).map((part) => part.trim()))
      .filter(([key, value]) => key && value),
  );
  return {
    name: form.name,
    category: form.category,
    subcategory: form.subcategory || undefined,
    brand: form.brand || undefined,
    price: form.price === '' ? undefined : Number(form.price),
    features: lines(form.features),
    specifications,
    seed_keywords: form.seed_keywords.split(',').map((keyword) => keyword.trim()).filter(Boolean),
  };
}

export default function ProductForm({ choices, busy, onSubmit }) {
  const [form, setForm] = useState(SAMPLE_PRODUCT);
  const [options, setOptions] = useState({ tone: 'friendly', length: 'medium', brand_voice: '' });

  // Score the data as it's typed, so thin products get a warning before generating.
  const [completeness, setCompleteness] = useState(null);
  useEffect(() => {
    if (!form.name.trim() || !form.category.trim()) return setCompleteness(null);
    const timer = setTimeout(() => {
      api.checkProduct(toProduct(form)).then(setCompleteness).catch(() => setCompleteness(null));
    }, 400);
    return () => clearTimeout(timer);
  }, [form]);

  const field = (name) => ({
    name,
    value: form[name],
    onChange: (event) => setForm({ ...form, [name]: event.target.value }),
  });

  const submit = (event) => {
    event.preventDefault();
    onSubmit(toProduct(form), { ...options, brand_voice: options.brand_voice || undefined });
  };

  return (
    <form className="card form" onSubmit={submit}>
      <div className="card-header">
        <h2>Product attributes</h2>
        <div className="row-actions">
          <button type="button" className="ghost" onClick={() => setForm(SAMPLE_PRODUCT)}>Sample</button>
          <button type="button" className="ghost" onClick={() => setForm(EMPTY)}>Clear</button>
        </div>
      </div>

      <div className="grid-2">
        <label>Name *<input required {...field('name')} /></label>
        <label>Category *<input required {...field('category')} /></label>
        <label>Subcategory<input {...field('subcategory')} /></label>
        <label>Brand<input {...field('brand')} /></label>
        <label>Price (INR)<input type="number" min="0" step="any" {...field('price')} /></label>
        <label>Seed keywords<input placeholder="comma, separated" {...field('seed_keywords')} /></label>
      </div>
      <label>Features <small>one per line</small><textarea rows={4} {...field('features')} /></label>
      <label>Specifications <small>Key: Value, one per line</small><textarea rows={3} {...field('specifications')} /></label>

      <h3>Style</h3>
      <div className="grid-2">
        <label>Tone
          <select value={options.tone} onChange={(event) => setOptions({ ...options, tone: event.target.value })}>
            {choices.tones.map((tone) => <option key={tone}>{tone}</option>)}
          </select>
        </label>
        <label>Length
          <select value={options.length} onChange={(event) => setOptions({ ...options, length: event.target.value })}>
            {choices.lengths.map((length) => <option key={length}>{length}</option>)}
          </select>
        </label>
      </div>
      <label>Brand voice notes <small>optional</small>
        <input
          placeholder="e.g. warm, eco-conscious, no exclamation marks"
          value={options.brand_voice}
          onChange={(event) => setOptions({ ...options, brand_voice: event.target.value })}
        />
      </label>

      {completeness?.sparse && (
        <p className="notice-inline" role="status">
          Thin product data ({completeness.score}/100): {completeness.issues.join(', ').toLowerCase()}. The copy will be kept short
          rather than padded; add more details for a fuller description.
        </p>
      )}

      <button type="submit" className="primary" disabled={busy}>
        {busy ? <><Spinner /> Generating…</> : 'Generate description'}
      </button>
    </form>
  );
}
