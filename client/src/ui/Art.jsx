import Icon from './Icon.jsx';

// Drawn botanical illustrations (no image files), coloured from the theme tokens so they
// work in light and dark mode.

function Leaf({ x, y, scale = 1, rotate = 0, tone = 'var(--leaf-mid)' }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <path d="M0 0C-18-22-14-56 0-80C14-56 18-22 0 0Z" fill={tone} />
      <path d="M0 -4V-74M0-22l-8-9M0-36l8-10M0-50l-7-8" stroke="var(--leaf-vein)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </g>
  );
}

// A sprig of leaves, e.g. in a corner of a panel.
export function LeafSprig({ className = '', flip = false }) {
  return (
    <svg className={`leaf-sprig ${className}`} viewBox="0 0 220 220" aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M110 215C108 160 98 110 70 60" stroke="var(--leaf-dark)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <Leaf x={104} y={168} rotate={-58} scale={0.95} tone="var(--leaf-dark)" />
      <Leaf x={100} y={140} rotate={48} scale={0.9} tone="var(--leaf-mid)" />
      <Leaf x={90} y={110} rotate={-50} scale={0.8} tone="var(--leaf-mid)" />
      <Leaf x={84} y={88} rotate={40} scale={0.72} tone="var(--leaf-light)" />
      <Leaf x={72} y={64} rotate={-12} scale={0.62} tone="var(--leaf-light)" />
    </svg>
  );
}

// Layered rolling hills along the bottom of a panel.
export function Hills({ className = '' }) {
  return (
    <svg className={`hills ${className}`} viewBox="0 0 600 160" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 70C90 30 170 40 260 75S430 120 600 60V160H0Z" fill="var(--hill-1)" />
      <path d="M0 105C120 70 210 85 320 110S500 130 600 95V160H0Z" fill="var(--hill-2)" />
      <path d="M0 135C140 115 260 120 380 138S530 150 600 132V160H0Z" fill="var(--hill-3)" />
    </svg>
  );
}

// Product thumbnail: the real image when there is one, else a tinted tile with a
// category glyph (the sample catalog only has placeholder image URLs).
const CATEGORY_STYLE = [
  [/electronic|audio|phone|gadget/i, 'headphones', 'var(--tint-blue)'],
  [/apparel|fashion|cloth|shoe|footwear/i, 'shirt', 'var(--tint-rose)'],
  [/home|kitchen|living/i, 'pot', 'var(--tint-sand)'],
  [/beauty|personal|skin|care/i, 'droplet', 'var(--tint-lilac)'],
  [/sport|fitness|yoga|gym/i, 'dumbbell', 'var(--tint-mint)'],
  [/coffee|tea/i, 'coffee', 'var(--tint-sand)'],
  [/grocery|gourmet|food/i, 'leaf', 'var(--tint-sage)'],
  [/toy|baby|kid/i, 'blocks', 'var(--tint-peach)'],
  [/book|station/i, 'book', 'var(--tint-sand)'],
  [/jewel|accessor/i, 'gem', 'var(--tint-lilac)'],
];

export function categoryStyle(category = '') {
  const match = CATEGORY_STYLE.find(([pattern]) => pattern.test(category));
  return { icon: match?.[1] ?? 'bag', tint: match?.[2] ?? 'var(--tint-sage)' };
}

const isRealImage = (url) => url && !/placehold\.co|placeholder/i.test(url);

export function ProductThumb({ product, size = 56, className = '' }) {
  const { icon, tint } = categoryStyle(`${product.subcategory ?? ''} ${product.category ?? ''}`);
  if (isRealImage(product.image_url)) {
    return <img className={`thumb ${className}`} src={product.image_url} alt="" width={size} height={size} style={{ width: size, height: size }} />;
  }
  return (
    <span className={`thumb ${className}`} style={{ width: size, height: size, background: tint }} aria-hidden="true">
      <Icon name={icon} size={Math.round(size * 0.42)} strokeWidth={1.6} />
    </span>
  );
}

// Large hero tile for the product detail view.
export function ProductHero({ product }) {
  const { icon, tint } = categoryStyle(`${product.subcategory ?? ''} ${product.category ?? ''}`);
  if (isRealImage(product.image_url)) {
    return <div className="product-hero"><img src={product.image_url} alt={product.name} /></div>;
  }
  return (
    <div className="product-hero" style={{ background: tint }}>
      <svg className="hero-arch" viewBox="0 0 200 200" aria-hidden="true">
        <path d="M40 200V95a60 60 0 0 1 120 0v105Z" fill="var(--arch)" />
      </svg>
      <LeafSprig className="hero-leaf" />
      <span className="hero-glyph"><Icon name={icon} size={72} strokeWidth={1.3} /></span>
      <span className="hero-caption">{product.subcategory || product.category}</span>
    </div>
  );
}
