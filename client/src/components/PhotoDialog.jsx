import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import Icon from '../ui/Icon.jsx';
import { Spinner } from './Feedback.jsx';

const MAX_SIDE = 1200;

// Shrinks a photo in the browser (longest side 1200 px, JPEG) so uploads stay small.
function resize(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * scale), height: Math.round(img.height * scale) });
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.86));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as an image.')); };
    img.src = url;
  });
}

// Add or change a product's photo: upload your own, or pick a free stock photo (Pexels).
export default function PhotoDialog({ product, onClose, onSaved }) {
  const [tab, setTab] = useState('search');
  const [query, setQuery] = useState(product.subcategory || product.category || product.name);
  const [photos, setPhotos] = useState(null);
  const [searchError, setSearchError] = useState(null); // { text, setup }
  const [preview, setPreview] = useState(null); // data URL to upload
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const search = async (event) => {
    event?.preventDefault();
    setBusy('search');
    setSearchError(null);
    try {
      setPhotos((await api.searchPhotos(query)).photos);
    } catch (err) {
      setPhotos(null);
      setSearchError({ text: err.message, setup: err.status === 503 });
      if (err.status === 503) setTab('upload');
    } finally {
      setBusy('');
    }
  };

  useEffect(() => { search(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const choose = async (file) => {
    if (!file) return;
    setError('');
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setError('Choose a JPEG, PNG or WebP image.');
    try {
      setPreview(await resize(file));
    } catch (err) {
      setError(err.message);
    }
  };

  const save = async (body, key) => {
    setBusy(key);
    setError('');
    try {
      const { product: updated } = await api.setProductImage(product.id, body);
      onSaved(updated);
    } catch (err) {
      setError(err.message);
      setBusy('');
    }
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div className="dialog wide" role="dialog" aria-modal="true" aria-labelledby="photo-title">
        <div className="dialog-head">
          <span className="icon-dot large"><Icon name="sparkles" size={20} /></span>
          <div>
            <h2 id="photo-title">Product photo</h2>
            <p className="muted">For {product.name}. Shown in your catalog and on the product page.</p>
          </div>
          <button type="button" className="icon-button" aria-label="Close" disabled={Boolean(busy)} onClick={onClose}><Icon name="x" /></button>
        </div>

        <div className="segmented-tabs">
          <button type="button" className={tab === 'search' ? 'active' : ''} onClick={() => setTab('search')}><Icon name="search" size={15} /> Free stock photos</button>
          <button type="button" className={tab === 'upload' ? 'active' : ''} onClick={() => setTab('upload')}><Icon name="upload" size={15} /> Upload your own</button>
        </div>

        {tab === 'search' && (
          <>
            <form className="inline-add" onSubmit={search}>
              <span className="input-icon">
                <Icon name="search" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. wireless earbuds" />
              </span>
              <button type="submit" disabled={busy === 'search' || !query.trim()}>{busy === 'search' ? <Spinner /> : 'Search'}</button>
            </form>
            {searchError && (
              <div className="notice-inline">
                {searchError.text}
                {searchError.setup && <> Uploading your own photo works without it.</>}
              </div>
            )}
            {busy === 'search' && !photos && <div className="photo-grid">{Array.from({ length: 8 }, (_, i) => <span key={i} className="photo-skeleton" />)}</div>}
            {photos && (photos.length ? (
              <div className="photo-grid">
                {photos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    className="photo-option"
                    style={{ background: photo.color }}
                    disabled={Boolean(busy)}
                    title={photo.alt}
                    onClick={() => save({ photo: { url: photo.url, credit: photo.credit, credit_url: photo.credit_url } }, photo.id)}
                  >
                    <img src={photo.thumb} alt={photo.alt} loading="lazy" />
                    <span className="photo-credit-tag">{busy === photo.id ? <><Spinner size={11} /> Saving…</> : photo.credit}</span>
                  </button>
                ))}
              </div>
            ) : <p className="muted">No photos found. Try a simpler search, like the product type.</p>)}
            <p className="muted">Free photos from <a href="https://www.pexels.com" target="_blank" rel="noreferrer">Pexels</a>. They illustrate the product type; upload your own for the exact product.</p>
          </>
        )}

        {tab === 'upload' && (
          <>
            <button
              type="button"
              className={`dropzone ${dragging ? 'dragging' : ''} ${preview ? 'has-file' : ''}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0]); }}
            >
              {preview ? <img className="upload-preview" src={preview} alt="Selected" /> : <span className="dropzone-icon"><Icon name="upload" size={26} /></span>}
              <strong>{preview ? 'Click to choose a different photo' : 'Drop a photo here, or click to browse'}</strong>
              <span className="muted">JPEG, PNG or WebP. Resized to {MAX_SIDE} px before upload.</span>
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { choose(event.target.files[0]); event.target.value = ''; }} />
            </button>
            <div className="dialog-actions">
              <button type="button" disabled={Boolean(busy)} onClick={onClose}>Cancel</button>
              <button type="button" className="primary" disabled={!preview || Boolean(busy)} onClick={() => save({ upload: preview }, 'upload')}>
                {busy === 'upload' ? <><Spinner /> Uploading…</> : <><Icon name="upload" size={16} /> Use this photo</>}
              </button>
            </div>
          </>
        )}

        {error && <p className="form-message error"><Icon name="alert" size={16} /> {error}</p>}
      </div>
    </div>
  );
}
