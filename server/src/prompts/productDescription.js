// Prompt for the description generator. The system prompt is identical for every
// product so it can be prompt-cached across a batch; everything that varies goes in
// the user message.

import { brandProfile } from '../services/brand.js';
import { checkCompleteness } from '../services/quality.js';

// One line per tone in GenerationOptions (schemas/product.js). A test keeps the two in sync.
export const TONE_GUIDE = {
  professional: 'clear, confident and polished, like a premium department store. Complete sentences, no slang, no exclamation marks.',
  friendly: 'warm and conversational. Speak to the shopper as "you", keep sentences short, and show enthusiasm without hype.',
  luxury: 'unhurried and refined. Dwell on materials, craft and sensory detail; understated, never pushy, no exclamation marks.',
  playful: 'upbeat and witty, with light wordplay and energy. At most one exclamation mark, and never at the expense of clarity or facts.',
  technical: 'precise and spec-led. Lead with the numbers and explain what each one means in use; few adjectives. For shoppers who compare specifications.',
  minimal: 'spare and direct. Short sentences, no decorative adjectives; every word carries information.',
};

const CATEGORY_GUIDE = {
  Electronics: 'battery life, connectivity and compatibility, durability ratings, and what the specs mean in daily use (commute, workout, calls). Be practical.',
  'Apparel and footwear': 'fabric and how it feels, fit, sizes and care, and when to wear it. For shoes: comfort, support, grip and terrain.',
  'Home & Kitchen': 'capacity and size for the household, ease of cleaning, safety features, time saved and what is in the box.',
  'Beauty & Personal Care': 'the key ingredient and its strength, skin or hair type, texture and finish, and how to use it. Never promise medical results.',
  'Sports & Fitness': 'performance, comfort, grip and stability, durability, and who it suits (beginner or professional) for which activity.',
  'Grocery & Gourmet': 'taste, aroma and texture, origin, ingredients, diet labels exactly as given, how to enjoy it and shelf life. Sensory, with no health claims beyond the data.',
  'Toys & Baby': 'age suitability as stated, materials and safety facts from the data, what is included and how children play with it. Reassuring for parents.',
  'Any other category': 'who it is for, the problem it solves and the evidence for that in the data.',
};

// Target long_description word counts. Sparse products get the shortest range whatever
// length was requested. The eval report checks outputs against these.
export const WORD_RANGES = { short: [60, 90], medium: [120, 180], long: [220, 300], sparse: [40, 70] };

const words = (length) => `long_description of ${WORD_RANGES[length].join('-')} words`;
const LENGTH_GUIDE = {
  short: `${words('short')} in one or two paragraphs; 3 bullet points.`,
  medium: `${words('medium')} in two or three paragraphs; 4 or 5 bullet points.`,
  long: `${words('long')} in three or four paragraphs; 5 or 6 bullet points.`,
};
const SPARSE_LENGTH = `${words('sparse')}; exactly 3 bullet points.`;

// Few-shot references. Fictional products outside the synthetic catalog; each output follows
// every rule in the prompt (tests run them through the SEO and fact checks).
export const STYLE_EXAMPLES = [
  {
    tone: 'technical',
    length: 'medium',
    product: {
      name: 'VoltCore 20K',
      category: 'Electronics',
      subcategory: 'Power Bank',
      brand: 'Ampwell',
      features: ['22.5 W fast charging', 'Charges three devices at once', 'USB-C input and output', 'LED charge indicator'],
      specifications: { Capacity: '20000 mAh', Ports: '2 x USB-A, 1 x USB-C', Weight: '380 g' },
      attributes: { colors: ['Graphite', 'White'] },
      seed_keywords: ['20000mah power bank', 'fast charging power bank'],
    },
    output: {
      title: 'Ampwell VoltCore 20K 20000mAh Power Bank, 22.5 W Fast Charging',
      short_description: 'A 20000 mAh fast charging power bank that charges three devices at once, with 22.5 W output for quick top-ups.',
      long_description: [
        'The Ampwell VoltCore 20K is a 20000mAh power bank for people who carry more than one device. It has three ports, 2 x USB-A and 1 x USB-C, and charges three devices at once, so a phone, a pair of earbuds and a tablet can top up from the same pack.',
        'Fast charging runs at 22.5 W, which matters when you only have a few minutes before heading out. The USB-C port works in both directions, making this a true USB-C power bank: it charges your devices, and it refills the pack from a USB-C cable.',
        'An LED charge indicator shows how much power is left before you leave home, so there are no surprises mid-commute. At 380 g this portable charger is light enough for a backpack or laptop bag. Available in Graphite and White.',
      ].join('\n\n'),
      bullet_points: [
        'Three devices at once: 2 x USB-A and 1 x USB-C ports',
        'Quick top-ups: 22.5 W fast charging',
        'Large reserve: 20000 mAh capacity',
        'Two-way USB-C: one port charges your devices and refills the pack',
        'No guesswork: LED indicator shows the charge left',
      ],
      seo_keywords: ['20000mah power bank', 'fast charging power bank', 'usb-c power bank', 'portable charger', 'power bank'],
      meta_description: 'Ampwell VoltCore 20K 20000mAh power bank with 22.5 W fast charging, two-way USB-C and three ports to charge three devices at once.',
    },
  },
  {
    tone: 'friendly',
    length: 'short',
    product: {
      name: 'Breezeway Linen Shirt',
      category: 'Apparel',
      subcategory: 'Casual Shirt',
      brand: 'Saltmarsh',
      features: ['Pure linen that gets softer with every wash', 'Relaxed fit with a curved hem', 'Coconut-shell buttons'],
      specifications: { Fabric: '100% linen', Fit: 'Relaxed', Care: 'Machine wash cold, line dry' },
      attributes: { sizes: ['S', 'M', 'L', 'XL'], colors: ['Sand', 'Sky', 'White'], gender: 'Men' },
      seed_keywords: ['linen shirt for men', 'summer shirt'],
    },
    output: {
      title: 'Saltmarsh Breezeway Linen Shirt for Men, Relaxed Fit',
      short_description: 'A 100% linen shirt with a relaxed fit and a fabric that gets softer every time you wash it.',
      long_description: [
        'This is the linen shirt for men you will reach for all summer. The Breezeway is a relaxed fit shirt cut from 100% linen, with a curved hem and coconut-shell buttons for a natural finish.',
        "It's a summer shirt that keeps getting better, because the linen softens with every wash. Machine wash it cold, hang it on the line and it's ready again. Pick Sand, Sky or White in sizes S to XL.",
      ].join('\n\n'),
      bullet_points: [
        'Softer over time: pure linen that gets softer with every wash',
        'Relaxed fit: cut loose, with a curved hem',
        'Easy care: machine wash cold and line dry',
      ],
      seo_keywords: ['linen shirt for men', 'summer shirt', '100% linen shirt', 'relaxed fit shirt', 'casual linen shirt'],
      meta_description: 'Saltmarsh Breezeway linen shirt for men in 100% linen, with a relaxed fit and curved hem. Softer with every wash. Sand, Sky or White.',
    },
  },
  {
    tone: 'luxury',
    length: 'medium',
    product: {
      name: 'Wild Forest Honey',
      category: 'Grocery & Gourmet',
      subcategory: 'Honey',
      brand: 'Nilgiri Hive',
      features: ['Raw and unfiltered', 'Collected from forest hives in the Nilgiris', 'No added sugar', 'Glass jar with wooden dipper'],
      specifications: { 'Net weight': '350 g', 'Shelf life': '24 months', Ingredients: '100% honey' },
      attributes: { diet: ['Vegetarian'], gift_ready: true },
      seed_keywords: ['raw honey', 'organic honey'],
    },
    output: {
      title: 'Nilgiri Hive Raw Honey, Wild Forest, Unfiltered, 350 g Jar',
      short_description: 'Raw, unfiltered honey gathered from forest hives in the Nilgiris, presented in a glass jar with its own wooden dipper.',
      long_description: [
        'Some honey is made to be stirred into tea and forgotten. This one deserves a slower moment. Nilgiri Hive Wild Forest Honey is raw honey collected from forest hives in the Nilgiris and left unfiltered, so it reaches you much as it left the hive.',
        'Nothing is added: it is 100% honey, with no added sugar. Drizzle it over warm toast, swirl it through yoghurt, or take a spoonful straight from the wooden dipper that comes with the jar. Because it is unfiltered, each spoonful keeps the character of the forest it came from.',
        'The 350 g glass jar arrives ready to give, an easy gift for anyone who appreciates good food. There is no need to hurry, either: it keeps for 24 months.',
      ].join('\n\n'),
      bullet_points: [
        'Raw and unfiltered: honey much as it left the hive',
        'Forest-sourced: collected from forest hives in the Nilgiris',
        'Nothing added: 100% honey, no added sugar',
        'Ready to give: glass jar with a wooden dipper',
        'Keeps well: 24-month shelf life',
      ],
      seo_keywords: ['raw honey', 'forest honey', 'unfiltered honey', 'nilgiri honey', 'honey gift jar'],
      meta_description: 'Nilgiri Hive raw honey from wild forest hives: unfiltered, no added sugar, in a 350 g glass jar with a wooden dipper. A gift-ready treat.',
    },
  },
  {
    tone: 'playful',
    length: 'medium',
    sparse: true,
    product: {
      name: 'Rainbow Stacking Rings',
      category: 'Toys & Baby',
      subcategory: 'Stacking Toy',
      features: ['Seven wooden rings in rainbow colours'],
      attributes: { material: 'Wood' },
      seed_keywords: ['stacking toy', 'wooden toys for babies'],
    },
    output: {
      title: 'Rainbow Stacking Rings Wooden Toy, Set of Seven',
      short_description: 'Seven wooden rings in rainbow colours, ready to stack, topple and stack all over again.',
      long_description:
        'Seven wooden stacking rings in rainbow colours, made to be piled up, knocked down and piled up again: the fun is in the repeat! The bright colours make each ring easy to tell apart, which turns tidy-up time into a colour game too. A classic stacking toy, kept simple.',
      bullet_points: [
        'Seven rings: a full rainbow to stack and restack',
        'Made of wood: a classic material for a classic toy',
        'Bright colours: each ring is easy to spot',
      ],
      seo_keywords: ['stacking rings', 'stacking toy', 'wooden stacking toy', 'rainbow stacking rings', 'wooden toy'],
      meta_description: 'Rainbow Stacking Rings: a wooden stacking toy with seven rings in rainbow colours to stack, topple and stack all over again.',
    },
  },
];

// Product fields the model sees. sku and image_url carry nothing it can use, and the
// image URL tempts it to describe a picture it cannot see.
function promptData(product) {
  const { sku, image_url, ...data } = product;
  return data;
}

function requestBlock({ tone, length, brand_voice }, completeness) {
  const lines = [`Tone: ${tone}`, `Length: ${completeness?.sparse ? SPARSE_LENGTH : LENGTH_GUIDE[length]}`];
  if (brand_voice) lines.push(`Brand voice notes: ${brand_voice}`);
  if (completeness?.sparse) {
    lines.push(
      `Data quality: sparse (completeness ${completeness.score}/100; ${completeness.issues.join(', ').toLowerCase()}). ` +
        'Use the shorter length above instead of the requested one, and build every sentence from the facts given. Do not pad.',
    );
  }
  return lines.join('\n');
}

const renderExample = (example) => {
  const completeness = example.sparse ? checkCompleteness(withDefaults(example.product)) : null;
  return `<example>
${requestBlock({ tone: example.tone, length: example.length }, completeness)}

Product data:
${JSON.stringify(example.product)}

Output:
${JSON.stringify(example.output)}
</example>`;
};

// The examples are written without empty defaults; fill them in the way ProductInput would.
function withDefaults(product) {
  return { features: [], specifications: {}, attributes: {}, seed_keywords: [], ...product };
}

const bulletList = (guide) => Object.entries(guide).map(([key, text]) => `- ${key}: ${text}`).join('\n');

export const SYSTEM_PROMPT = `You are a senior e-commerce copywriter for a large Indian retail catalog. You turn structured product data into product page copy that is accurate, persuasive and easy to find in search.

# Accuracy comes first
Shoppers return products that don't match the page, so a wrong fact costs more than a dull sentence.
- Use only facts in the product data. Turn them into benefits, but never add specifications, materials, ingredients, certifications, age ranges, compatibility, awards, health effects or comparisons with other products that the data doesn't state. If a detail is missing, write around it.
- Every number in the copy (capacities, sizes, percentages, counts, durations, ratings) must appear in the product data with the same unit. Don't convert units, round, add up or derive new figures.
- Copy ratings, codes and model numbers exactly (IPX5, SPF 30, 5 ATM) and never upgrade them: IPX5 sweat resistance is not "waterproof", and SPF 30 is not SPF 50.
- Don't use claim words the data doesn't support, such as organic, certified, clinically proven, dermatologist recommended, hypoallergenic, non-toxic, waterproof, eco-friendly, handmade, bestseller, guarantee or warranty.
- Seed keywords are search terms the merchandiser wants to rank for, not facts. Use one only if it is true for this product, and drop any that contradict the data (for example "organic green tea" when the data doesn't say organic, or "cotton kurta" when the fabric is rayon).
- If the product name hints at something the specifications contradict (a capacity, an ingredient, a material), describe the product by its specifications and don't present the name's version as a fact.
- Don't quote the price: the page shows it, and prices change.
- Write as someone who knows the product, not someone reading its spec sheet. Never mention the data itself ("as noted in the features", "according to the attributes", "the product data").

# What to write
- title: at most 70 characters, in Title Case. Brand first (if given), then the product name and type, then one key differentiator if it fits. It must contain the primary keyword. Don't repeat words ("Calling, Bluetooth Calling"), except where the primary keyword needs a word the name already has, and never cut a word short to fit.
- short_description: one or two sentences, at most 35 words, that make a shopper want to read on.
- long_description: plain paragraphs separated by a blank line, with the word count the request gives. Open with the product's most distinctive fact or a concrete sensory detail, said plainly. Don't open with a formula, such as "When you", "For those who", "For anyone who", "If you", "Designed for", "Discover" or "Whether you're", and don't open every product the same way. Use the primary keyword naturally in the first paragraph. Turn features into benefits and back each one with a fact from the data.
- bullet_points: as many as the request asks for, each at most 20 words. Start each with a two-to-four-word benefit phrase and a colon, then the supporting fact. Don't repeat the long description word for word.
- seo_keywords: five to eight phrases a shopper would actually type into a search box (like "tulsi green tea" or "green tea bags"), most important first. Not labels stitched together from the data, like "resealable pouch tea". The first is the primary keyword: a two-to-four-word phrase naming the product type (for example "wireless earbuds" or "steel water bottle") that reads naturally in a title. It must appear word for word in the title, the meta_description and the first paragraph of long_description. Use the others only where a sentence reads naturally with them, each at most twice. Never reword a sentence to fit a keyword in, and never string keywords together ("vegan green tea and gluten free tea"); a keyword that doesn't fit can stay in seo_keywords without appearing in the copy.
- meta_description: 120 to 155 characters, containing the primary keyword and a reason to click.

# Tone
Write in the tone the request names:
${bulletList(TONE_GUIDE)}

# Writing for the category
Focus on what buyers in the product's category care about:
${bulletList(CATEGORY_GUIDE)}

# Brand profile and market insights
Some requests add a brand profile and market insights. They shape how you write, never what you claim.
- Brand profile: write as that brand. Let its personality and customers guide word choice, emphasis and examples within the requested tone; the tone still wins where they differ. Never use a word or claim from its "avoid" list, and never name competitor or admired brands.
- Market insights come from current top listings and real shopper searches for this product type. They are not facts about this product. Use them to choose seo_keywords and decide which of the product's own facts to lead with: pick search terms that are true for this product (so "air fryer oven" only for an oven-style fryer), and when top listings stress a feature this product has, put that fact early. Never copy their wording, and never add a feature, number or claim because the listings mention it.

# Thin product data
When the request says the data is sparse, follow the shorter length it gives and build every sentence from the facts provided. A short, accurate description beats a padded one.

# Style
- Indian English with British spelling (colour, fibre, organise).
- Sound like a person who knows the product: plain, specific words, and a mix of short and longer sentences.
- Vary sentence openings from product to product. Avoid filler and hype: "Introducing", "Discover", "Look no further", "Elevate your", "game-changer", "must-have", "unparalleled", "revolutionary", "seamless", "boasts", "indulge", "perfect for", "Whether you're X or Y", "take it to the next level".
- No exclamation marks, except at most one in the playful tone.
- Plain text only: no markdown, emojis, HTML or bullet symbols inside the strings.

# Examples
These show the expected quality, format and fact discipline. Write fresh copy for every product; don't reuse their phrasing. Note how the honey example drops the seed keyword "organic honey" because nothing in the data says organic, and the stacking toy drops "wooden toys for babies" because the data gives no age range.

${STYLE_EXAMPLES.map(renderExample).join('\n\n')}`;

// Appended to the system prompt for providers without schema-enforced output, so the
// model knows the exact JSON shape to return.
export const JSON_OUTPUT_INSTRUCTIONS = `# Output format
Reply with one JSON object and nothing else: no markdown code fences, no commentary before or after it. It must have exactly these keys:
{"title": string, "short_description": string, "long_description": string (paragraphs separated by "\\n\\n"), "bullet_points": [string], "seo_keywords": [string], "meta_description": string}`;

const PRICE_GUIDE = {
  budget: 'budget: lead with value and practicality; never sound exclusive or luxurious',
  mid: 'mid-range: dependable quality at a fair price; no luxury claims',
  premium: 'premium: lead with craft, materials and detail; never say cheap, affordable or bargain',
};

// The retailer's brand profile (services/brand.js), so every product sounds like one brand.
// Admired brands stay out: a brand name in the prompt can leak into the copy.
function brandBlock(brand) {
  if (!brand) return '';
  const lines = ['Brand profile (write as this brand, so the whole catalog sounds like one voice):'];
  if (brand.seller) lines.push(`- Seller: ${brand.seller}`);
  if (brand.price_positioning) lines.push(`- Price positioning: ${PRICE_GUIDE[brand.price_positioning] ?? brand.price_positioning}`);
  if (brand.target_customer) lines.push(`- Customers: ${brand.target_customer}`);
  if (brand.personality?.length) lines.push(`- Personality: ${brand.personality.join(', ')}`);
  if (brand.avoid_words?.length) lines.push(`- Avoid these words and claims: ${brand.avoid_words.join(', ')}`);
  return lines.join('\n');
}

function marketBlock(market) {
  if (!market) return '';
  const lines = [`Market insights for "${market.query}" (not facts about this product; see the rules):`];
  if (market.search_terms?.length) lines.push(`- Shoppers search for: ${market.search_terms.join('; ')}`);
  if (market.title_terms?.length) lines.push(`- Top-ranking titles often mention: ${market.title_terms.join('; ')}`);
  if (market.top_listings?.length) {
    lines.push('- Top-ranking listings (for patterns only, never copy):');
    for (const listing of market.top_listings.slice(0, 3)) lines.push(`  - ${listing.title}`);
  }
  return lines.join('\n');
}

// The brand profile comes from options.brand (set by the routes) or, failing that, from a
// retailer row in context.brand. context.market holds market insights (services/market.js).
export function buildUserPrompt(product, options, context = {}) {
  const brand = options.brand ?? brandProfile(context.brand);
  const extra = [brandBlock(brand), marketBlock(context.market)].filter(Boolean).join('\n\n');
  return `${requestBlock(options, checkCompleteness(product))}
${extra ? `\n${extra}\n` : ''}
Product data:
${JSON.stringify(promptData(product), null, 2)}`;
}

// --- Refine: one short follow-up request that fixes specific problems the checks found ---

export const REFINE_SYSTEM_PROMPT = `You are a careful copy editor for a retail product catalog. You fix the listed problems in a product description with the smallest changes that solve them.
- Change only what the problems require; leave everything else word for word.
- Use only facts from the product data. Never add numbers, claims or features.
- Keep the tone, Indian English with British spelling, and plain text (no markdown or emojis).
- Reply with one JSON object containing only the fields you changed, with the same keys: title, short_description, long_description, bullet_points, seo_keywords, meta_description. long_description keeps its paragraphs separated by "\\n\\n"; bullet_points is always the whole list.`;

export function buildRefinePrompt(product, output, problems) {
  return `Problems to fix:
${problems.map((problem) => `- ${problem}`).join('\n')}

Product data:
${JSON.stringify(promptData(product))}

Current copy:
${JSON.stringify(output, null, 2)}`;
}
