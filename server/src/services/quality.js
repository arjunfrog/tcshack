// Rule-based checks that run without an LLM: one on the input data (is there
// enough to write good copy?), one on the generated copy (does it meet SEO rules?)
// and a fact check (does every figure and claim in the copy come from the data?).

// Products scoring below this are "sparse": the UI warns before generating, and the
// prompt asks for shorter copy instead of padding.
export const SPARSE_BELOW = 50;

// 0-100 score plus the reasons points were lost. Shown to users before generating.
export function checkCompleteness(product) {
  const checks = [
    { ok: Boolean(product.brand), weight: 10, issue: 'No brand' },
    { ok: product.price !== undefined, weight: 10, issue: 'No price' },
    { ok: product.features.length >= 3, weight: 30, issue: 'Fewer than 3 features' },
    { ok: Object.keys(product.specifications).length >= 2, weight: 20, issue: 'Fewer than 2 specifications' },
    { ok: Boolean(product.subcategory), weight: 10, issue: 'No subcategory' },
    { ok: product.seed_keywords.length > 0, weight: 10, issue: 'No seed keywords' },
    { ok: Object.keys(product.attributes).length > 0, weight: 10, issue: 'No extra attributes (color, material, audience...)' },
  ];
  const score = checks.reduce((sum, check) => sum + (check.ok ? check.weight : 0), 0);
  return {
    score,
    sparse: score < SPARSE_BELOW,
    issues: checks.filter((check) => !check.ok).map((check) => check.issue),
  };
}

const LIMITS = { title: 70, meta_description: 155 };

export function checkSeo(output) {
  const body = `${output.title} ${output.short_description} ${output.long_description} ${output.bullet_points.join(' ')}`.toLowerCase();
  const keywords = output.seo_keywords.map((keyword) => keyword.toLowerCase());
  const covered = keywords.filter((keyword) => body.includes(keyword));
  const primary = keywords[0] ?? '';

  const checks = {
    title_length_ok: output.title.length <= LIMITS.title,
    meta_length_ok: output.meta_description.length <= LIMITS.meta_description,
    primary_keyword_in_title: primary !== '' && output.title.toLowerCase().includes(primary),
    primary_keyword_in_meta: primary !== '' && output.meta_description.toLowerCase().includes(primary),
    bullet_count_ok: output.bullet_points.length >= 3 && output.bullet_points.length <= 6,
  };

  return {
    ...checks,
    keyword_coverage: keywords.length ? Math.round((covered.length / keywords.length) * 100) : 0,
    passed: Object.values(checks).filter(Boolean).length,
    total: Object.keys(checks).length,
  };
}

// ---------------------------------------------------------------------------
// Fact check. Invented specs are the most damaging failure in retail copy, so every
// figure ("32 hours", "5.3"), code ("IPX5", "SPF 30") and strong claim word ("organic",
// "waterproof") in the copy must be traceable to the product data. Seed keywords are
// search terms, not facts, so they don't count as evidence.

const UNIT_ALIASES = {
  h: ['h', 'hr', 'hrs', 'hour', 'hours'],
  min: ['min', 'mins', 'minute', 'minutes'],
  s: ['sec', 'secs', 'second', 'seconds'],
  day: ['day', 'days'],
  week: ['week', 'weeks'],
  month: ['month', 'months'],
  year: ['yr', 'yrs', 'year', 'years'],
  mm: ['mm', 'millimetre', 'millimetres', 'millimeter', 'millimeters'],
  cm: ['cm', 'centimetre', 'centimetres', 'centimeter', 'centimeters'],
  m: ['m', 'metre', 'metres', 'meter', 'meters'],
  in: ['inch', 'inches', '"'],
  ml: ['ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters'],
  l: ['l', 'ltr', 'litre', 'litres', 'liter', 'liters'],
  g: ['g', 'gm', 'gms', 'gram', 'grams'],
  kg: ['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms'],
  w: ['w', 'watt', 'watts'],
  mah: ['mah'],
  v: ['v', 'volt', 'volts'],
  hz: ['hz'],
  gb: ['gb'],
  tb: ['tb'],
  mp: ['mp', 'megapixel', 'megapixels'],
  gsm: ['gsm'],
  tc: ['tc'],
  atm: ['atm'],
  '%': ['%', 'percent'],
  c: ['°c', '°', 'c'],
  piece: ['pc', 'pcs', 'piece', 'pieces'],
};
const UNITS = new Map(Object.entries(UNIT_ALIASES).flatMap(([unit, aliases]) => aliases.map((alias) => [alias, unit])));
// Words that come before the number they qualify: "SPF 50", "UK 8", "Grade 2".
const PREFIX_UNITS = new Set(['spf', 'uk', 'us', 'eu', 'size', 'grade', 'class', 'version']);
const ORDINALS = new Set(['st', 'nd', 'rd', 'th']);

// Number words in the data count as the digits the copy may use instead ("two pillow covers", "dual-device").
const NUMBER_WORDS = Object.fromEntries(
  ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
    .map((word, value) => [word, value])
    .concat([['single', 1], ['dual', 2], ['twin', 2], ['double', 2], ['triple', 3]]),
);

// Claim words that need explicit support in the data, keyed by how they are reported.
const CLAIMS = {
  organic: /\borganic/,
  natural: /\ball natural|\b100 ?% natural/,
  certified: /\bcertifi/,
  'clinically proven': /\bclinical/,
  dermatologist: /\bdermatolog/,
  hypoallergenic: /\bhypoallergenic/,
  'non-comedogenic': /\bnon ?comedogenic/,
  'paraben-free': /\bparaben free/,
  'sulphate-free': /\bsul(ph|f)ate free/,
  waterproof: /\bwaterproof/,
  'BPA-free': /\bbpa free/,
  'non-toxic': /\bnon ?toxic/,
  vegan: /\bvegan/,
  'gluten-free': /\bgluten free/,
  'sugar-free': /\bsugar free/,
  'cruelty-free': /\bcruelty free/,
  award: /\baward/,
  bestseller: /\bbest ?sell/,
  '#1': /#1\b|\bnumber one\b/,
  guarantee: /\bguarantee/,
  warranty: /\bwarrant(y|ies)\b/,
  patented: /\bpatent/,
  'eco-friendly': /\beco friendly/,
  sustainable: /\bsustainab/,
  biodegradable: /\bbiodegradable/,
  recyclable: /\brecycl/,
  handmade: /\bhand ?(made|crafted)\b|\bhandcraft/,
  'medical-grade': /\bmedical grade/,
  antibacterial: /\banti ?bacterial/,
};

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[‐-―−]/g, '-')
    .replace(/ /g, ' ')
    .replace(/per ?cent\b/g, '%')
    .replace(/(\d),(?=\d{2,3}\b)/g, '$1'); // 2,999 and 1,19,999 -> 2999 and 119999
}

const canonicalNumber = (digits) => String(Number(digits));

// Finds figures (number + optional unit) and codes (letters and digits mixed, like ipx5).
function extractFigures(text) {
  const figures = [];
  const codes = [];

  // Pass 1: tokens that mix letters and digits: either a number with a glued unit (750ml,
  // 2nd) or a code (ipx5, spo2). Blank them out so pass 2 doesn't count their digits again.
  const plain = text.replace(/[a-z0-9.]*[a-z][a-z0-9.]*/g, (token) => {
    const word = token.replace(/^\.+|\.+$/g, '');
    if (!/\d/.test(word)) return token;
    const glued = word.match(/^(\d+(?:\.\d+)?)([a-z]+)$/);
    const version = word.match(/^v(\d+(?:\.\d+)?)$/);
    if (glued && (UNITS.has(glued[2]) || ORDINALS.has(glued[2]))) {
      figures.push({ value: canonicalNumber(glued[1]), unit: UNITS.get(glued[2]) ?? null, text: word });
    } else if (version) {
      figures.push({ value: canonicalNumber(version[1]), unit: null, text: word });
    } else {
      codes.push(word);
    }
    return ' '.repeat(token.length);
  });

  // Pass 2: standalone numbers, with a unit after them ("32 hours", "80%") or before them ("spf 50").
  for (const match of plain.matchAll(/\d+(?:\.\d+)?/g)) {
    const before = text.slice(0, match.index);
    const after = text.slice(match.index + match[0].length);
    const suffix = after.match(/^[\s-]*\+?\s*(°c|°|%|"|[a-z]+)/);
    const prefix = before.match(/([a-z]+)[\s:-]*$/);
    let unit = null;
    let label = match[0];
    if (suffix && UNITS.has(suffix[1])) {
      unit = UNITS.get(suffix[1]);
      label = `${match[0]} ${suffix[1]}`;
    } else if (prefix && PREFIX_UNITS.has(prefix[1])) {
      unit = prefix[1];
      label = `${prefix[1]} ${match[0]}`;
    }
    figures.push({ value: canonicalNumber(match[0]), unit, text: label });
  }
  return { figures, codes };
}

// Everything the copy may cite, as one lowercase string. Attributes set to false are left
// out, so "gift_ready: false" can't back up a "gift-ready" claim.
function factsText(product) {
  const parts = [product.name, product.brand, product.category, product.subcategory, ...product.features];
  if (product.price !== undefined) parts.push(`price ${product.price}`);
  const flatten = (value) => (Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value));
  for (const [key, value] of [...Object.entries(product.specifications), ...Object.entries(product.attributes)]) {
    if (value === false || value === null || value === undefined) continue;
    parts.push(`${key}: ${flatten(value)}`);
  }
  const text = normalize(parts.filter(Boolean).join('\n'));
  // Keep the original word too, so claims and codes can still match it.
  return text.replace(new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join('|')})\\b`, 'g'), (word) => `${word} ${NUMBER_WORDS[word]}`);
}

const COPY_FIELDS = ['title', 'short_description', 'long_description', 'bullet_points', 'meta_description'];

export function checkFacts(product, output) {
  const facts = factsText(product);
  const factFigures = extractFigures(facts);
  const unitsByValue = new Map();
  for (const { value, unit } of factFigures.figures) {
    if (!unitsByValue.has(value)) unitsByValue.set(value, new Set());
    unitsByValue.get(value).add(unit);
  }
  const compactFacts = facts.replace(/[\s-]/g, '');
  const claimFacts = facts.replace(/[-_]/g, ' ');

  const found = new Map();
  const flag = (text, issue, field) => {
    const key = `${text}|${issue}`;
    if (!found.has(key)) found.set(key, { text, issue, fields: [] });
    const entry = found.get(key);
    if (!entry.fields.includes(field)) entry.fields.push(field);
  };

  let checked = 0;
  for (const field of COPY_FIELDS) {
    const raw = Array.isArray(output[field]) ? output[field].join('\n') : output[field];
    const text = normalize(raw ?? '');
    const { figures, codes } = extractFigures(text);
    checked += figures.length + codes.length;

    for (const figure of figures) {
      const units = unitsByValue.get(figure.value);
      if (!units) {
        flag(figure.text, 'Number not in the product data', field);
      } else if (figure.unit && !units.has(figure.unit) && !units.has(null)) {
        const known = factFigures.figures.filter((fact) => fact.value === figure.value).map((fact) => fact.text);
        flag(figure.text, `Unit differs from the product data (${[...new Set(known)].join(', ')})`, field);
      }
    }
    for (const code of codes) {
      if (!compactFacts.includes(code.replace(/-/g, ''))) flag(code, 'Code or model number not in the product data', field);
    }

    const claimText = text.replace(/[-_]/g, ' ');
    for (const [claim, pattern] of Object.entries(CLAIMS)) {
      if (pattern.test(claimText) && !pattern.test(claimFacts)) flag(claim, 'Claim not supported by the product data', field);
    }
  }

  const unsupported = [...found.values()];
  return { passed: unsupported.length === 0, checked, unsupported };
}

// ---------------------------------------------------------------------------
// Style check: the tells that make copy read as machine-written rather than by a person
// who knows the product. Like the fact check, a flag means "read this again".

// Copy that narrates its source: "rich in antioxidants, as noted in the product features".
const META_REFERENCE = /\b(as (noted|listed|stated|mentioned|described|specified|shown) (in|by)|according to the|(product|feature|attribute|spec|specification)s? (data|list|sheet)|the attributes)\b/;
const STOCK_OPENER = /^(for (those|anyone|everyone|people|women|men|children|kids|parents|[a-z]+ lovers)\b|if you\b|designed for\b|discover\b|whether\b|introducing\b|looking for\b|meet the\b)/;
const CLICHES = [
  'look no further', 'elevate', 'game-changer', 'game changer', 'must-have', 'unparalleled', 'revolutionary',
  'seamless', 'next level', 'whether you', "in today's", 'boasts', 'unleash', 'indulge', 'perfect for',
  'perfect companion', 'quiet luxury', 'second to none', 'like never before',
];
// Lowercase words allowed in a Title Case title.
const MINOR_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with', 'x']);

export function checkStyle(output, options = {}) {
  const issues = [];
  const body = [output.title, output.short_description, output.long_description, ...output.bullet_points].join('\n');
  const lower = body.toLowerCase();

  const reference = `${lower}\n${output.meta_description.toLowerCase()}`.match(META_REFERENCE);
  if (reference) issues.push({ type: 'meta_reference', text: reference[0] });

  const opener = output.long_description.trim().toLowerCase().match(STOCK_OPENER);
  if (opener) issues.push({ type: 'stock_opener', text: output.long_description.trim().split(/[,.]/)[0] });

  for (const cliche of CLICHES) {
    if (lower.includes(cliche)) issues.push({ type: 'cliche', text: cliche });
  }

  // The primary keyword is required in the title and the first paragraph, so it gets more room.
  // Uses inside a longer keyword don't count ("power bank" within "usb-c power bank").
  const keywords = output.seo_keywords.map((keyword) => keyword.toLowerCase().trim());
  keywords.forEach((keyword, i) => {
    if (!keyword) return;
    const longer = keywords.filter((other) => other !== keyword && other.includes(keyword));
    const text = longer.reduce((rest, other) => rest.replaceAll(other, ' '), lower);
    const count = text.split(keyword).length - 1;
    if (count > (i === 0 ? 4 : 2)) issues.push({ type: 'keyword_stuffing', text: `"${output.seo_keywords[i]}" ${count} times` });
  });

  const exclamations = (body.match(/!/g) ?? []).length;
  if (exclamations > (options.tone === 'playful' ? 1 : 0)) issues.push({ type: 'exclamation', text: `${exclamations} exclamation mark(s)` });

  const seen = new Set();
  for (const word of output.title.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 4)) {
    if (seen.has(word) && !issues.some((issue) => issue.type === 'title_repeat' && issue.text === word)) issues.push({ type: 'title_repeat', text: word });
    seen.add(word);
  }
  // Hyphenated words count by their first part ("Pre-knocked" is fine).
  const titleWords = output.title.split(/[\s,:;()|]+/).filter(Boolean);
  const lowercase = titleWords.filter((word, i) => /^[a-z]/.test(word) && (i === 0 || !MINOR_WORDS.has(word)) && !UNITS.has(word));
  if (lowercase.length) issues.push({ type: 'title_case', text: lowercase.join(', ') });

  return { passed: issues.length === 0, issues };
}
