#!/usr/bin/env node
// Generates a diverse, reproducible set of synthetic product attribute records.
//
//   node scripts/generate-synthetic.js [--count 60] [--seed 42] [--out data/generated]
//
// Writes products.json and products.csv (format: docs/DATA_FORMAT.md). About 10% of
// records are deliberately incomplete so the data quality checks have something to flag.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1]]);
    return pairs;
  }, []),
);
const COUNT = Number(args.count ?? 60);
const SEED = Number(args.seed ?? 42);
const OUT_DIR = args.out ?? 'data/generated';

// mulberry32: tiny seeded PRNG so the same seed always gives the same catalog.
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = prng(SEED);
const pick = (list) => list[Math.floor(rand() * list.length)];
const between = (min, max) => Math.round(min + rand() * (max - min));
const sample = (list, n) => [...list].sort(() => rand() - 0.5).slice(0, n);
const price = (min, max) => Math.round(between(min, max) / 10) * 10 - 1;

// Fictional brands, so generated copy never makes claims about real companies.
const CATALOG = [
  {
    category: 'Electronics', brands: ['Voltix', 'Sonora', 'Aurex', 'Nimbus Audio'],
    types: [
      {
        subcategory: 'Wireless Earbuds', names: ['Pulse Buds', 'AirFlow Pro', 'Echo Mini'], price: [1499, 7999],
        features: ['Active noise cancellation', 'Touch controls', 'IPX5 sweat resistance', 'Low-latency gaming mode', 'Dual-device pairing', 'Fast charging: 10 min for 2 hours of playback', 'Quad-mic call clarity'],
        specs: () => ({ 'Battery life': `${between(20, 40)} hours with case`, 'Driver size': `${pick([10, 11, 12, 13])} mm`, Bluetooth: pick(['5.3', '5.4']), Weight: `${between(4, 6)} g per bud` }),
        attributes: () => ({ colors: sample(['Midnight Black', 'Pearl White', 'Ocean Blue', 'Sage Green'], 2) }),
        keywords: ['wireless earbuds', 'bluetooth earphones', 'noise cancelling earbuds'],
      },
      {
        subcategory: 'Smartwatch', names: ['Stride Watch', 'Orbit Fit', 'Pulse Active'], price: [2499, 14999],
        features: ['AMOLED always-on display', 'SpO2 and heart-rate monitoring', 'Built-in GPS', 'Bluetooth calling', '100+ sports modes', 'Sleep tracking', '5 ATM water resistance'],
        specs: () => ({ Display: `${pick(['1.43', '1.96', '2.01'])}-inch AMOLED`, 'Battery life': `Up to ${between(5, 14)} days`, 'Water resistance': '5 ATM', Compatibility: 'Android and iOS' }),
        attributes: () => ({ strap: pick(['Silicone', 'Metal mesh', 'Nylon loop']), colors: sample(['Graphite', 'Rose Gold', 'Silver'], 2) }),
        keywords: ['smartwatch', 'fitness tracker', 'smart watch with calling'],
      },
      {
        subcategory: 'Bluetooth Speaker', names: ['Boom Cube', 'Wave Go', 'Thunder Mini'], price: [999, 8999],
        features: ['360-degree sound', 'Deep bass radiator', 'IP67 waterproof and dustproof', 'Party pairing with a second speaker', 'Built-in microphone', 'USB-C charging'],
        specs: () => ({ Output: `${pick([10, 16, 20, 30, 40])} W`, 'Battery life': `${between(8, 24)} hours`, 'Water resistance': 'IP67', Weight: `${between(300, 900)} g` }),
        attributes: () => ({ colors: sample(['Black', 'Teal', 'Red', 'Camo'], 2), use_case: 'Outdoor and travel' }),
        keywords: ['bluetooth speaker', 'portable speaker', 'waterproof speaker'],
      },
    ],
  },
  {
    category: 'Apparel', brands: ['Loomcraft', 'Urban Thread', 'Kesari', 'Northline'],
    types: [
      {
        subcategory: 'T-Shirt', names: ['Everyday Crew Tee', 'Oversized Graphic Tee', 'Pima Polo'], price: [399, 1499],
        features: ['Breathable 180 GSM cotton', 'Pre-shrunk fabric', 'Reinforced shoulder seams', 'Tagless neck label', 'Colourfast dyes'],
        specs: () => ({ Fabric: pick(['100% cotton', '100% Supima cotton', '60% cotton, 40% polyester']), Fit: pick(['Regular', 'Slim', 'Oversized']), Neck: pick(['Crew', 'V-neck', 'Polo collar']), Care: 'Machine wash cold' }),
        attributes: () => ({ sizes: ['S', 'M', 'L', 'XL', 'XXL'], colors: sample(['Navy', 'Olive', 'White', 'Black', 'Mustard'], 3), gender: pick(['Men', 'Women', 'Unisex']) }),
        keywords: ['cotton t-shirt', 'casual tee', 'everyday t-shirt'],
      },
      {
        subcategory: 'Running Shoes', names: ['Velocity Runner', 'CloudStep 2', 'Trail Blaze'], price: [1999, 8999],
        features: ['Responsive foam midsole', 'Breathable engineered mesh upper', 'Rubber outsole with multi-directional grip', 'Padded heel collar', 'Reflective details for low light'],
        specs: () => ({ 'Heel-to-toe drop': `${pick([4, 6, 8, 10])} mm`, Weight: `${between(220, 310)} g (UK 8)`, Upper: 'Engineered mesh', Outsole: 'Carbon rubber' }),
        attributes: () => ({ sizes: ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10'], gender: pick(['Men', 'Women']), terrain: pick(['Road', 'Trail', 'Treadmill']) }),
        keywords: ['running shoes', 'sports shoes', 'lightweight trainers'],
      },
      {
        subcategory: 'Kurta', names: ['Chikankari Straight Kurta', 'Block Print A-Line Kurta', 'Festive Silk Kurta'], price: [799, 3999],
        features: ['Hand-finished embroidery', 'Side slits for easy movement', 'Three-quarter sleeves', 'Breathable natural fabric', 'Comes with matching dupatta'],
        specs: () => ({ Fabric: pick(['Cotton', 'Rayon', 'Art silk', 'Linen blend']), Length: 'Calf length', Neck: pick(['Round', 'Mandarin', 'V-neck']), Care: pick(['Hand wash', 'Dry clean only']) }),
        attributes: () => ({ sizes: ['XS', 'S', 'M', 'L', 'XL'], occasion: pick(['Festive', 'Office', 'Casual']), gender: 'Women' }),
        keywords: ['women kurta', 'ethnic wear', 'cotton kurta'],
      },
    ],
  },
  {
    category: 'Home & Kitchen', brands: ['HearthWare', 'Casa Nova', 'Pristine Home'],
    types: [
      {
        subcategory: 'Air Fryer', names: ['CrispAir 4L', 'HealthyFry Max', 'TurboCrisp'], price: [3499, 11999],
        features: ['Up to 90% less oil than deep frying', 'Digital touch panel with 8 presets', 'Dishwasher-safe non-stick basket', 'Auto shut-off', 'Shake reminder'],
        specs: () => ({ Capacity: `${pick([3.5, 4.2, 5.5, 6.2])} L`, Power: `${pick([1200, 1500, 1700])} W`, 'Temperature range': '80-200 °C', Warranty: `${pick([1, 2])} year` }),
        attributes: () => ({ colors: [pick(['Black', 'White', 'Grey'])] }),
        keywords: ['air fryer', 'oil free fryer', 'digital air fryer'],
      },
      {
        subcategory: 'Bedsheet Set', names: ['Percale Comfort Set', 'Floral Dream Bedsheet', 'Egyptian Weave Set'], price: [699, 4499],
        features: ['Soft, breathable weave', 'Fade-resistant colours', 'Includes two pillow covers', 'Elasticated fitted corners', 'Gets softer with every wash'],
        specs: () => ({ 'Thread count': `${pick([180, 210, 300, 400])} TC`, Material: pick(['100% cotton', 'Cotton sateen', 'Microfibre']), Size: pick(['Double', 'Queen', 'King']), Contents: '1 bedsheet, 2 pillow covers' }),
        attributes: () => ({ pattern: pick(['Floral', 'Solid', 'Geometric', 'Stripes']), colors: sample(['Ivory', 'Blush', 'Indigo', 'Mint'], 2) }),
        keywords: ['cotton bedsheet', 'double bedsheet with pillow covers', 'bed linen'],
      },
      {
        subcategory: 'Insulated Water Bottle', names: ['ThermoFlask', 'Hydra Steel', 'Trek Bottle'], price: [499, 1999],
        features: ['Keeps drinks cold for 24 hours and hot for 12', 'Double-wall vacuum insulation', 'Leak-proof lid', 'BPA-free', 'Powder-coated grip'],
        specs: () => ({ Capacity: `${pick([500, 750, 1000])} ml`, Material: '18/8 stainless steel', Weight: `${between(280, 450)} g`, 'Dishwasher safe': 'Lid only' }),
        attributes: () => ({ colors: sample(['Matte Black', 'Coral', 'Forest Green', 'Sky Blue'], 3) }),
        keywords: ['steel water bottle', 'insulated bottle', 'vacuum flask'],
      },
    ],
  },
  {
    category: 'Beauty & Personal Care', brands: ['Glowveda', 'PureLeaf', 'Derma Lab'],
    types: [
      {
        subcategory: 'Face Serum', names: ['Vitamin C Brightening Serum', 'Niacinamide Clear Skin Serum', 'Hyaluronic Hydra Serum'], price: [399, 1499],
        features: ['Lightweight, fast-absorbing formula', 'Fragrance-free', 'Dermatologically tested', 'Suitable for daily use', 'Dropper for mess-free application'],
        specs: () => ({ Volume: `${pick([15, 30, 50])} ml`, 'Key ingredient': pick(['10% Vitamin C', '10% Niacinamide + 1% Zinc', '2% Hyaluronic acid']), 'Skin type': pick(['All skin types', 'Oily and acne-prone', 'Dry skin']) }),
        attributes: () => ({ concern: pick(['Dullness', 'Acne marks', 'Dehydration']), cruelty_free: true }),
        keywords: ['face serum', 'serum for glowing skin', 'skincare serum'],
      },
      {
        subcategory: 'Sunscreen', names: ['Invisible Sun Gel', 'Matte Shield Sunscreen', 'Mineral Sun Fluid'], price: [299, 999],
        features: ['Broad spectrum UVA and UVB protection', 'No white cast', 'Non-greasy finish', 'Water resistant for 80 minutes', 'Works under makeup'],
        specs: () => ({ SPF: pick(['SPF 30', 'SPF 50', 'SPF 50+']), PA: 'PA++++', Volume: `${pick([50, 80, 100])} g`, Texture: pick(['Gel', 'Cream', 'Fluid']) }),
        attributes: () => ({ skin_type: pick(['Oily', 'All', 'Sensitive']) }),
        keywords: ['sunscreen spf 50', 'sunscreen for oily skin', 'no white cast sunscreen'],
      },
    ],
  },
  {
    category: 'Sports & Fitness', brands: ['IronPeak', 'FlexCore', 'Vayu Sports'],
    types: [
      {
        subcategory: 'Yoga Mat', names: ['GripFlow Mat', 'Balance Pro Mat', 'Eco Cork Mat'], price: [599, 2999],
        features: ['Non-slip textured surface', 'Extra cushioning for joints', 'Lightweight with carry strap', 'Easy to wipe clean', 'Alignment lines'],
        specs: () => ({ Thickness: `${pick([4, 6, 8, 10])} mm`, Material: pick(['TPE', 'NBR', 'Natural cork and rubber']), Dimensions: '183 x 61 cm', Weight: `${pick([0.9, 1.2, 1.8])} kg` }),
        attributes: () => ({ colors: sample(['Purple', 'Teal', 'Charcoal', 'Peach'], 2) }),
        keywords: ['yoga mat', 'anti slip yoga mat', 'exercise mat'],
      },
      {
        subcategory: 'Cricket Bat', names: ['Kashmir Willow Bat', 'English Willow Pro', 'Power Hitter'], price: [999, 12999],
        features: ['Hand-picked willow', 'Thick edges for big hitting', 'Cane handle with shock absorption', 'Pre-knocked and ready to play', 'Comes with a padded cover'],
        specs: () => ({ Willow: pick(['Kashmir willow', 'Grade 2 English willow']), Weight: `${between(1150, 1250)} g`, Size: pick(['Short handle', 'Size 6', 'Harrow']), Grains: `${between(6, 12)}` }),
        attributes: () => ({ level: pick(['Beginner', 'Club', 'Professional']), ball_type: pick(['Leather ball', 'Tennis ball']) }),
        keywords: ['cricket bat', 'kashmir willow bat', 'english willow bat'],
      },
    ],
  },
  {
    category: 'Grocery & Gourmet', brands: ['Farm Fable', 'Himalayan Harvest', 'Spice Route'],
    types: [
      {
        subcategory: 'Green Tea', names: ['Tulsi Green Tea', 'Kashmiri Kahwa', 'Jasmine Green Tea'], price: [199, 799],
        features: ['Whole-leaf tea', 'Rich in antioxidants', 'No artificial flavours', 'Sourced from hill estates', 'Resealable pouch'],
        specs: () => ({ 'Net weight': `${pick([100, 250])} g`, Form: pick(['Loose leaf', '25 tea bags', '50 tea bags']), 'Shelf life': '18 months', Origin: pick(['Darjeeling', 'Assam', 'Nilgiris']) }),
        attributes: () => ({ diet: ['Vegan', 'Gluten-free'] }),
        keywords: ['green tea', 'organic green tea', 'herbal tea'],
      },
      {
        subcategory: 'Dark Chocolate', names: ['70% Single-Origin Dark', 'Sea Salt Almond Dark', 'Orange Peel Dark'], price: [149, 599],
        features: ['Bean-to-bar craft chocolate', 'Low sugar', 'Made with Indian cacao', 'No palm oil', 'Small-batch production'],
        specs: () => ({ 'Cocoa content': `${pick([55, 65, 70, 80])}%`, 'Net weight': `${pick([50, 80, 100])} g`, 'Shelf life': '12 months', Allergens: pick(['Contains nuts', 'May contain milk']) }),
        attributes: () => ({ diet: [pick(['Vegetarian', 'Vegan'])], gift_ready: rand() > 0.5 }),
        keywords: ['dark chocolate', 'craft chocolate', 'healthy chocolate'],
      },
    ],
  },
  {
    category: 'Toys & Baby', brands: ['Little Sprout', 'Playloop'],
    types: [
      {
        subcategory: 'Building Blocks', names: ['City Builder Set', 'Creative Bricks Box', 'Mini Engineers Kit'], price: [599, 3999],
        features: ['Compatible with major brick brands', 'Non-toxic, BPA-free plastic', 'Illustrated build guide', 'Storage box included', 'Builds fine motor skills'],
        specs: () => ({ Pieces: `${pick([150, 300, 500, 1000])}`, 'Recommended age': pick(['3+ years', '6+ years', '8+ years']), Material: 'ABS plastic', Certification: 'BIS certified' }),
        attributes: () => ({ theme: pick(['City', 'Space', 'Vehicles']) }),
        keywords: ['building blocks', 'educational toys', 'construction toys for kids'],
      },
    ],
  },
];

// Cycle through every product type so all categories are evenly represented.
const ALL_TYPES = CATALOG.flatMap((group) => group.types.map((type) => ({ group, type })));

function makeProduct(index) {
  const { group, type } = ALL_TYPES[index % ALL_TYPES.length];
  const product = {
    sku: `SKU-${String(index + 1).padStart(4, '0')}`,
    name: pick(type.names),
    category: group.category,
    subcategory: type.subcategory,
    brand: pick(group.brands),
    price: price(...type.price),
    currency: 'INR',
    features: sample(type.features, between(3, Math.min(5, type.features.length))),
    specifications: type.specs(),
    attributes: type.attributes(),
    image_url: `https://placehold.co/600x600?text=${encodeURIComponent(type.subcategory)}`,
    seed_keywords: sample(type.keywords, 2),
  };

  // ~10% incomplete records to exercise the data quality checks.
  if (rand() < 0.1) {
    delete product.brand;
    product.specifications = {};
    product.features = product.features.slice(0, 1);
  }
  return product;
}

// CSV: lists joined with " | ", key/value maps as "key: value | key: value".
const csvCell = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const joinList = (list) => list.join(' | ');
const joinMap = (map) =>
  Object.entries(map)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
    .join(' | ');

const COLUMNS = ['sku', 'name', 'category', 'subcategory', 'brand', 'price', 'currency', 'features', 'specifications', 'attributes', 'image_url', 'seed_keywords'];

function toCsv(products) {
  const rows = products.map((product) =>
    COLUMNS.map((column) => {
      const value = product[column];
      if (Array.isArray(value)) return csvCell(joinList(value));
      if (value && typeof value === 'object') return csvCell(joinMap(value));
      return csvCell(value);
    }).join(','),
  );
  return [COLUMNS.join(','), ...rows].join('\n') + '\n';
}

const products = Array.from({ length: COUNT }, (_, i) => makeProduct(i));
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'products.json'), JSON.stringify(products, null, 2) + '\n');
writeFileSync(join(OUT_DIR, 'products.csv'), toCsv(products));

const categories = new Set(products.map((product) => product.category));
console.log(`Wrote ${products.length} products across ${categories.size} categories to ${OUT_DIR}/ (seed ${SEED})`);
