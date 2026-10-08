import { CopyPanel, QualityPills, QualityReport, SearchPreview } from './DescriptionView.jsx';
import { GeneratingCard } from './Feedback.jsx';
import { Icon, ProductThumb, colourValue, featureIcon, specIcon } from './ui.jsx';

const STATUS_LABELS = { draft: 'Draft', approved: 'Approved', rejected: 'Rejected' };
const price = (value) => (value === null || value === undefined ? null : `₹${Number(value).toLocaleString('en-IN')}`);

// One product page: the product's identity and data on top, its generated copy below.
// result: { output, meta, quality, status } or null; versions: description rows, newest first.
export default function ProductDetail({
  product, result, versions = [], shownId, onSelectVersion, actions, generatingSince, generatingTitle, fresh, emptyText,
}) {
  const shown = versions.find((version) => version.id === shownId) ?? versions[0];
  const features = product.features ?? [];
  return (
    <article className="product-detail">
      <div className="pd-top">
        <div className="pd-media">
          <ProductThumb product={product} size="lg">
            {result?.status && <span className={`media-badge status-${result.status}`}>{STATUS_LABELS[result.status] ?? result.status}</span>}
            {product.completeness_score != null && product.completeness_score < 50 && <span className="media-badge status-thin">Thin data</span>}
          </ProductThumb>
          {versions.length > 1 && (
            <div className="version-strip" role="tablist" aria-label="Description versions">
              {versions.map((version) => (
                <button
                  key={version.id}
                  type="button"
                  role="tab"
                  aria-selected={version.id === shown?.id}
                  className={version.id === shown?.id ? 'active' : ''}
                  onClick={() => onSelectVersion?.(version.id)}
                  title={new Date(version.created_at).toLocaleString()}
                >
                  <strong>v{version.version}</strong>
                  <span>{version.provider === 'human' ? 'edited' : version.tone}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pd-summary">
          <p className="crumbs">
            {product.category}
            {product.subcategory && <><Icon name="chevron" size={14} />{product.subcategory}</>}
          </p>
          <h1 className="pd-title">{product.brand ? `${product.brand} ` : ''}{product.name}</h1>
          <p className="pd-meta">
            {product.sku && <span>{product.sku}</span>}
            {shown && <span className="chip chip-version">v{shown.version}</span>}
            {shown && <span>{shown.provider === 'human' ? 'hand edited' : `${shown.tone}, ${shown.length}`}</span>}
          </p>
          <QualityPills quality={result?.quality} />
          {result && <p className="pd-lead">{result.output.short_description}</p>}
          {price(product.price) && <p className="pd-price">{price(product.price)}</p>}
          {actions && <div className="pd-actions">{actions}</div>}
          {features.length > 0 && (
            <ul className="pd-features">
              {features.slice(0, 4).map((feature) => (
                <li key={feature}>
                  <span className="feature-badge"><Icon name={featureIcon(feature)} size={24} /></span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {generatingSince ? (
        <GeneratingCard startedAt={generatingSince} title={generatingTitle} />
      ) : (
        <div className={fresh ? 'pd-copy fresh' : 'pd-copy'}>
          <div className="pd-grid">
            {result ? <CopyPanel output={result.output} /> : (
              <section className="panel copy-panel empty-panel">
                <h2>Description</h2>
                <p>{emptyText ?? 'No copy yet. Generate a description to see it here.'}</p>
              </section>
            )}
            <SpecsPanel product={product} />
          </div>
          {result && <SearchPreview output={result.output} product={product} quality={result.quality} />}
          {result && <QualityReport quality={result.quality} meta={result.meta} />}
        </div>
      )}
    </article>
  );
}

// Specifications and attributes from the product data, the facts the copy is built on.
export function SpecsPanel({ product }) {
  const specs = Object.entries(product.specifications ?? {});
  const attributes = Object.entries(product.attributes ?? {}).filter(([, value]) => value !== false && value !== null && value !== '');
  const keywords = product.seed_keywords ?? [];
  if (!specs.length && !attributes.length && !keywords.length) {
    return (
      <section className="panel specs-panel empty-panel">
        <h2>Specifications</h2>
        <p>No specifications in the product data, so the copy stays short. Add some in your CSV to get fuller descriptions.</p>
      </section>
    );
  }
  const label = (key) => key.replaceAll('_', ' ').replace(/^\w/, (c) => c.toUpperCase());
  return (
    <section className="panel specs-panel">
      <h2>Specifications</h2>
      <dl className="specs">
        {specs.map(([key, value]) => (
          <div key={key}>
            <dt><Icon name={specIcon(key)} size={18} />{key}</dt>
            <dd>{String(value)}</dd>
          </div>
        ))}
        {attributes.map(([key, value]) => (
          <div key={key}>
            <dt><Icon name={specIcon(key)} size={18} />{label(key)}</dt>
            <dd>{/colou?r/i.test(key) && Array.isArray(value) ? <Swatches names={value} /> : Array.isArray(value) ? value.join(', ') : value === true ? 'Yes' : String(value)}</dd>
          </div>
        ))}
        {keywords.length > 0 && (
          <div>
            <dt><Icon name="search" size={18} />Target searches</dt>
            <dd>{keywords.join(', ')}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function Swatches({ names }) {
  return (
    <span className="swatches">
      {names.map((name) => {
        const colour = colourValue(name);
        return (
          <span key={name} className="swatch-item">
            {colour && <span className="swatch" style={{ background: colour }} aria-hidden="true" />}
            {name}
          </span>
        );
      })}
    </span>
  );
}
