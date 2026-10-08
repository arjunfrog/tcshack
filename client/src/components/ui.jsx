// Shared visual pieces: line icons, the category product tile, small badges.

const PATHS = {
  leaf: 'M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19l7-7',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  chevron: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  check: 'M5 12.5l4.5 4.5L19 7',
  alert: 'M12 4l9 16H3zM12 10v4M12 17.5v.5',
  upload: 'M12 16V4M7 9l5-5 5 5M5 20h14',
  download: 'M12 4v12M7 11l5 5 5-5M5 20h14',
  refresh: 'M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c1.5-4 4.5-6 8-6s6.5 2 8 6',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  battery: 'M4 8h13v8H4zM20 11v2M7 11v2M10 11v2',
  wave: 'M3 12h2M7 8v8M11 5v14M15 8v8M19 11v2',
  shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z',
  feather: 'M20 4c-8 0-13 5-13 13M7 17l-3 3M20 4c0 8-5 12-11 12',
  grip: 'M6 6h2v2H6zM11 6h2v2h-2zM16 6h2v2h-2zM6 11h2v2H6zM11 11h2v2h-2zM16 11h2v2h-2zM6 16h2v2H6zM11 16h2v2h-2zM16 16h2v2h-2z',
  layers: 'M12 4l8 4-8 4-8-4zM4 12l8 4 8-4M4 16l8 4 8-4',
  ruler: 'M4 15l11-11 5 5-11 11zM8 11l2 2M11 8l2 2M14 5l2 2',
  weight: 'M7 9h10l2 11H5zM9.5 9a2.5 2.5 0 1 1 5 0',
  palette: 'M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4.5-4-8-9-8zM7.5 11.5h0M10 7.5h0M14.5 7.5h0',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h0M4.5 12h0M4.5 18h0',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 8h0',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  box: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8',
  flame: 'M12 21c-4 0-6-3-6-6 0-4 4-6 4-10 3 2 4 4 4 6 1-1 2-2 2-3 2 2 2 4 2 7 0 3-2 6-6 6z',
  // Category glyphs for product tiles.
  headphones: 'M4 15v-3a8 8 0 0 1 16 0v3M4 15h3v5H4zM17 15h3v5h-3z',
  shirt: 'M8 4l-4 3 2 4 2-1v10h8V10l2 1 2-4-4-3c-1 1.5-2.2 2-4 2s-3-.5-4-2z',
  pot: 'M4 10h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6zM2 10h2M20 10h2M9 6c0-1 1-1 1-2M14 6c0-1 1-1 1-2',
  bottle: 'M10 3h4v3l2 3v11H8V9l2-3zM8 13h8',
  dumbbell: 'M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12',
  cup: 'M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M9 3c0 2 2 2 2 4',
  blocks: 'M4 12h7v8H4zM13 12h7v8h-7zM8.5 4h7v8h-7z',
};

export function Icon({ name, size = 20, className = '', title }) {
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : 'true'} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <path d={PATHS[name] ?? PATHS.box} />
    </svg>
  );
}

// Each category gets a soft tint and a glyph, standing in for product photos we don't have.
const CATEGORIES = [
  { match: /electronic|audio|phone|gadget/i, tone: 'slate', glyph: 'headphones' },
  { match: /apparel|fashion|cloth|wear|shoe|kurta/i, tone: 'mauve', glyph: 'shirt' },
  { match: /home|kitchen|furnish/i, tone: 'sand', glyph: 'pot' },
  { match: /beauty|personal|care|cosmetic/i, tone: 'blush', glyph: 'bottle' },
  { match: /sport|fitness|gym|yoga/i, tone: 'lavender', glyph: 'dumbbell' },
  { match: /grocery|gourmet|food|tea|coffee/i, tone: 'sage', glyph: 'cup' },
  { match: /toy|baby|kid/i, tone: 'butter', glyph: 'blocks' },
];
export const categoryStyle = (category = '') =>
  CATEGORIES.find((entry) => entry.match.test(category)) ?? { tone: 'stone', glyph: 'box' };

export function ProductThumb({ product, size = 'sm', children }) {
  const { tone, glyph } = categoryStyle(product?.category);
  const realImage = product?.image_url && !/placehold\.co/.test(product.image_url) ? product.image_url : null;
  return (
    <div className={`thumb thumb-${size} tone-${tone}`}>
      {realImage
        ? <img src={realImage} alt="" loading="lazy" />
        : <Icon name={glyph} size={size === 'lg' ? 128 : size === 'md' ? 40 : 28} className="thumb-glyph" />}
      {children}
    </div>
  );
}

// A feature's icon, picked from what the feature talks about.
const FEATURE_ICONS = [
  [/water|sweat|ip\d|waterproof|splash/i, 'drop'],
  [/battery|charg|hour|power bank|mah/i, 'battery'],
  [/noise|sound|audio|bass|speaker|call/i, 'wave'],
  [/clean|wash|dishwasher|wipe/i, 'sparkle'],
  [/light|weight|portable|carry|strap/i, 'feather'],
  [/safe|non-toxic|bpa|certif|tested|protect|uv/i, 'shield'],
  [/grip|slip|textur/i, 'grip'],
  [/heat|temp|fry|oil|cook/i, 'flame'],
  [/organic|natural|leaf|tea|plant|cotton|linen/i, 'leaf'],
];
export const featureIcon = (text) => FEATURE_ICONS.find(([pattern]) => pattern.test(text))?.[1] ?? 'sparkle';

// Spec rows get an icon from their name.
const SPEC_ICONS = [
  [/thick|layer/i, 'layers'], [/dimension|size|length|width|height/i, 'ruler'], [/weight|net/i, 'weight'],
  [/material|fabric|willow|ingredient/i, 'leaf'], [/colou?r/i, 'palette'], [/battery|power|capacity|output|mah/i, 'battery'],
  [/water|resist|spf|ip/i, 'drop'], [/warranty|certif|safe/i, 'shield'], [/life|time|shelf/i, 'clock'],
];
export const specIcon = (key) => SPEC_ICONS.find(([pattern]) => pattern.test(key))?.[1] ?? 'list';

// A swatch only when the colour name is exactly one the browser knows ("Teal", "Navy");
// "Sage Green" gets no swatch rather than a wrong one.
export function colourValue(name) {
  const css = String(name).toLowerCase().replace(/[^a-z]/g, '');
  return typeof CSS !== 'undefined' && CSS.supports?.('color', css) ? css : null;
}

export function StatusDot({ kind = 'good', children }) {
  return <span className={`pill pill-${kind}`}><span className="pill-dot" aria-hidden="true" />{children}</span>;
}
