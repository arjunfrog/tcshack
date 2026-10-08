import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import Icon from '../ui/Icon.jsx';
import { Spinner } from './Feedback.jsx';

// Column order and an example row, as documented in docs/DATA_FORMAT.md.
const TEMPLATE = [
  'sku,name,category,subcategory,brand,price,currency,features,specifications,attributes,image_url,seed_keywords',
  'SKU-0042,Pulse Buds,Electronics,Wireless Earbuds,Voltix,2999,INR,Active noise cancellation | IPX5 sweat resistance | Dual-device pairing,Battery life: 32 hours with case | Bluetooth: 5.3,"colors: Midnight Black, Pearl White",,wireless earbuds | noise cancelling earbuds',
].join('\n');

const formatSize = (bytes) => (bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`);

// Splits one CSV line, respecting quoted fields (enough for a preview; the server parses properly).
function splitCsvLine(line) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (char === ',' && !quoted) { cells.push(cell); cell = ''; } else cell += char;
  }
  cells.push(cell);
  return cells.map((value) => value.trim());
}

// A quick look at the file before uploading: format, row count, columns, first products.
function preview(name, text) {
  const format = name.toLowerCase().endsWith('.json') ? 'json' : 'csv';
  if (format === 'json') {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error('The JSON file must be an array of products.');
    return { format, rows: data.length, columns: Object.keys(data[0] ?? {}), sample: data.slice(0, 4).map((row) => ({ name: row.name, category: row.category, sku: row.sku })) };
  }
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error('The CSV file needs a header row and at least one product.');
  const columns = splitCsvLine(lines[0]);
  const at = (cells, key) => cells[columns.indexOf(key)];
  const sample = lines.slice(1, 5).map(splitCsvLine).map((cells) => ({ name: at(cells, 'name'), category: at(cells, 'category'), sku: at(cells, 'sku') }));
  return { format, rows: lines.length - 1, columns, sample };
}

export default function ImportDialog({ onClose, onImported }) {
  const [file, setFile] = useState(null); // { name, size, text, info, error }
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { imported, errors }
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const choose = async (picked) => {
    if (!picked) return;
    setError('');
    setResult(null);
    if (!/\.(csv|json)$/i.test(picked.name)) {
      setFile(null);
      return setError('Choose a .csv or .json file.');
    }
    const text = await picked.text();
    try {
      setFile({ name: picked.name, size: picked.size, text, info: preview(picked.name, text) });
    } catch (err) {
      setFile({ name: picked.name, size: picked.size, text, error: err.message });
    }
  };

  const upload = async () => {
    setBusy(true);
    setError('');
    try {
      const outcome = await api.importProducts(file.info.format, file.text);
      setResult(outcome);
      if (outcome.imported) onImported(`Imported ${outcome.imported} product${outcome.imported === 1 ? '' : 's'} from ${file.name}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE + '\n'], { type: 'text/csv' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: 'products-template.csv' });
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <div className="dialog-head">
          <span className="icon-dot large"><Icon name="upload" size={20} /></span>
          <div>
            <h2 id="import-title">Import products</h2>
            <p className="muted">CSV or JSON with product attributes. Rows with a SKU you already have are updated.</p>
          </div>
          <button type="button" className="icon-button" aria-label="Close" disabled={busy} onClick={onClose}><Icon name="x" /></button>
        </div>

        {result ? (
          <div className="import-result">
            <span className={`result-badge ${result.errors.length ? 'warn' : 'ok'}`}>
              <Icon name={result.errors.length ? 'alert' : 'check'} size={26} strokeWidth={2.2} />
            </span>
            <h3>{result.imported} product{result.imported === 1 ? '' : 's'} imported</h3>
            <p className="muted-lg">{result.errors.length ? `${result.errors.length} row${result.errors.length === 1 ? ' was' : 's were'} skipped. Fix them and import again.` : 'Everything in the file was added to your catalog.'}</p>
            {result.errors.length > 0 && (
              <ul className="row-errors">
                {result.errors.slice(0, 30).map((rowError) => (
                  <li key={rowError.row}><strong>Row {rowError.row}</strong> {rowError.issues.join('; ')}</li>
                ))}
              </ul>
            )}
            <div className="dialog-actions">
              <button type="button" onClick={() => { setResult(null); setFile(null); }}>Import another file</button>
              <button type="button" className="primary" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              className={`dropzone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0]); }}
            >
              <span className="dropzone-icon"><Icon name={file ? 'file' : 'upload'} size={26} /></span>
              {file ? (
                <>
                  <strong>{file.name}</strong>
                  <span className="muted">{formatSize(file.size)}{file.info && ` · ${file.info.format.toUpperCase()} · ${file.info.rows} product${file.info.rows === 1 ? '' : 's'}`} · click to change</span>
                </>
              ) : (
                <>
                  <strong>Drop a file here, or click to browse</strong>
                  <span className="muted">.csv or .json</span>
                </>
              )}
              <input ref={inputRef} type="file" accept=".csv,.json" hidden onChange={(event) => { choose(event.target.files[0]); event.target.value = ''; }} />
            </button>

            {file?.error && <p className="form-message error"><Icon name="alert" size={16} /> {file.error}</p>}
            {file?.info && (
              <div className="file-preview">
                <div className="preview-columns">
                  <span className="insight-label">Columns found</span>
                  <div className="chips">
                    {file.info.columns.map((column) => (
                      <span key={column} className={`chip ${['name', 'category'].includes(column) ? 'required' : ''}`}>{column}</span>
                    ))}
                  </div>
                  {!['name', 'category'].every((column) => file.info.columns.includes(column)) && (
                    <p className="form-message error"><Icon name="alert" size={16} /> Every product needs a <strong>name</strong> and a <strong>category</strong> column.</p>
                  )}
                </div>
                <span className="insight-label">First products</span>
                <ul className="preview-rows">
                  {file.info.sample.map((row, i) => (
                    <li key={i}><strong>{row.name || <em className="muted">no name</em>}</strong><span className="muted">{row.category || 'no category'}{row.sku ? ` · ${row.sku}` : ''}</span></li>
                  ))}
                </ul>
              </div>
            )}
            {error && <p className="form-message error"><Icon name="alert" size={16} /> {error}</p>}

            <div className="dialog-actions">
              <button type="button" className="link-button" onClick={downloadTemplate}><Icon name="download" size={16} /> Download CSV template</button>
              <span className="spacer" />
              <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
              <button type="button" className="primary" disabled={!file?.info || busy} onClick={upload}>
                {busy ? <><Spinner /> Importing…</> : <>Import {file?.info ? `${file.info.rows} product${file.info.rows === 1 ? '' : 's'}` : ''}</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
