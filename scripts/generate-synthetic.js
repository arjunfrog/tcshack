#!/usr/bin/env node
// Generates a diverse, reproducible set of synthetic product attribute records.
//
//   node scripts/generate-synthetic.js [--count 60] [--seed 42] [--out data/generated] [--sku-prefix SKU]
//   node scripts/generate-synthetic.js --count 240 --seed 7 --out data/catalog --sku-prefix CAT   (demo catalog)
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
// e.g. --sku-prefix CAT for a demo catalog whose SKUs never clash with the sample's SKU-0001...
const SKU_PREFIX = args['sku-prefix'] ?? 'SKU';

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
        subcategory: 'Power Bank', names: ['VoltCore 10K', 'ChargeMate Slim', 'Juice Pack 20K', 'PocketCell', 'MaxCharge Duo', 'TravelVolt'], price: [699, 3499],
        features: ['22.5 W fast charging', 'Charges two devices at once', 'USB-C input and output', 'LED charge indicator', 'Slim aluminium body', 'Airline-safe capacity'],
        specs: () => ({ Capacity: `${pick([10000, 20000, 27000])} mAh`, Ports: pick(['1 x USB-A, 1 x USB-C', '2 x USB-A, 1 x USB-C']), Weight: `${between(180, 420)} g`, Warranty: '1 year' }),
        attributes: () => ({ colors: sample(['Graphite', 'White', 'Navy'], 2) }),
        keywords: ['power bank', 'fast charging power bank', 'portable charger'],
      },
      {
        subcategory: 'Gaming Mouse', names: ['Strike X', 'Raptor Pro', 'Phantom Lite', 'Vortex RGB', 'Swift Claw', 'Nova Glide'], price: [799, 4999],
        features: ['Adjustable DPI up to 12000', 'RGB lighting with 16.8 million colours', 'Six programmable buttons', 'Lightweight honeycomb shell', 'Braided cable', 'On-board memory profiles'],
        specs: () => ({ 'Max DPI': `${pick([6400, 8000, 12000, 16000])}`, Buttons: `${pick([6, 7, 8])}`, Weight: `${between(58, 95)} g`, Connection: pick(['Wired USB', '2.4 GHz wireless']) }),
        attributes: () => ({ grip: pick(['Palm', 'Claw', 'Fingertip']) }),
        keywords: ['gaming mouse', 'rgb mouse', 'wireless gaming mouse'],
      },
      {
        subcategory: 'Mechanical Keyboard', names: ['Keystone 87', 'TypeForge TKL', 'Clack Pro', 'Glide 65', 'Ember RGB', 'Quill Compact'], price: [1999, 8999],
        features: ['Hot-swappable switches', 'Per-key RGB backlight', 'Double-shot PBT keycaps', 'Detachable USB-C cable', 'Anti-ghosting with full N-key rollover', 'Aluminium top plate'],
        specs: () => ({ Layout: pick(['TKL (87 keys)', '65%', 'Full size (104 keys)']), Switches: pick(['Red linear', 'Brown tactile', 'Blue clicky']), Connection: pick(['Wired USB-C', 'Bluetooth and wired']), Weight: `${between(650, 1100)} g` }),
        attributes: () => ({ colors: sample(['Black', 'White', 'Sage'], 1) }),
        keywords: ['mechanical keyboard', 'gaming keyboard', 'rgb keyboard'],
      },
      {
        subcategory: 'Neckband Earphones', names: ['FlexBand 200', 'RunLoop', 'BassWire Neo', 'Commute Band', 'SportNeck', 'AirLink Band'], price: [799, 2999],
        features: ['Magnetic earbuds that switch off when clipped', 'Up to 30 hours playback', 'Environmental noise cancellation for calls', 'IPX5 sweat resistance', 'Vibration call alert', 'Fast charging'],
        specs: () => ({ 'Battery life': `${between(20, 40)} hours`, Bluetooth: '5.3', 'Driver size': `${pick([10, 12, 13])} mm`, Weight: `${between(24, 36)} g` }),
        attributes: () => ({ colors: sample(['Black', 'Blue', 'Green'], 2) }),
        keywords: ['neckband earphones', 'bluetooth neckband', 'wireless neckband'],
      },
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
        subcategory: 'Denim Jeans', names: ['Slim Taper Denim', 'Relaxed Straight Jeans', 'Stretch Skinny Jeans', 'Vintage Wash Denim', 'Mom Fit Jeans', 'Raw Indigo Denim'], price: [999, 3499],
        features: ['Comfort stretch denim', 'Five-pocket styling', 'Mid-rise waist', 'Reinforced stitching', 'Machine washable'],
        specs: () => ({ Fabric: pick(['98% cotton, 2% elastane', '100% cotton']), Fit: pick(['Slim', 'Straight', 'Relaxed']), Rise: 'Mid rise', Care: 'Machine wash cold, inside out' }),
        attributes: () => ({ sizes: ['28', '30', '32', '34', '36'], colors: sample(['Indigo', 'Light Blue', 'Black'], 2), gender: pick(['Men', 'Women']) }),
        keywords: ['denim jeans', 'slim fit jeans', 'stretch jeans'],
      },
      {
        subcategory: 'Hoodie', names: ['Cloud Fleece Hoodie', 'Campus Zip Hoodie', 'Heavyweight Pullover', 'Everyday Hoodie', 'Trail Hoodie', 'Studio Hoodie'], price: [899, 2999],
        features: ['Brushed fleece lining', 'Kangaroo pocket', 'Ribbed cuffs and hem', 'Adjustable drawstring hood', 'Pre-shrunk fabric'],
        specs: () => ({ Fabric: pick(['80% cotton, 20% polyester', '100% cotton fleece']), GSM: `${pick([280, 320, 400])}`, Fit: pick(['Regular', 'Oversized']), Care: 'Machine wash cold' }),
        attributes: () => ({ sizes: ['S', 'M', 'L', 'XL'], colors: sample(['Charcoal', 'Olive', 'Navy', 'Cream'], 2) }),
        keywords: ['hoodie', 'cotton hoodie', 'oversized hoodie'],
      },
      {
        subcategory: 'Saree', names: ['Banarasi Silk Saree', 'Handloom Cotton Saree', 'Chanderi Saree', 'Kanjivaram Silk Saree', 'Printed Georgette Saree', 'Linen Saree'], price: [999, 12999],
        features: ['Handwoven by artisans', 'Comes with an unstitched blouse piece', 'Zari border', 'Lightweight drape', 'Festive and wedding wear'],
        specs: () => ({ Fabric: pick(['Silk', 'Cotton', 'Chanderi silk-cotton', 'Georgette', 'Linen']), Length: '5.5 m saree, 0.8 m blouse piece', Care: pick(['Dry clean only', 'Gentle hand wash']) }),
        attributes: () => ({ colors: sample(['Maroon', 'Mustard', 'Teal', 'Ivory'], 2), occasion: pick(['Festive', 'Wedding', 'Everyday']) }),
        keywords: ['saree', 'silk saree', 'cotton saree'],
      },
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
        subcategory: 'Mixer Grinder', names: ['PowerBlend 750', 'SpiceMaster', 'KitchenPro 3 Jar', 'TurboGrind', 'ChefMix', 'QuickBlend 500'], price: [1999, 6999],
        features: ['Three stainless steel jars', 'Overload protection', 'Three speed settings with pulse', 'Leak-proof lids', 'Anti-skid feet'],
        specs: () => ({ Power: `${pick([500, 750, 1000])} W`, Jars: pick(['3', '4']), 'Speed settings': '3 + pulse', Warranty: pick(['2 years', '5 years on motor']) }),
        attributes: () => ({ colors: sample(['White', 'Black', 'Red'], 1) }),
        keywords: ['mixer grinder', 'mixer grinder 750 watt', 'kitchen mixer'],
      },
      {
        subcategory: 'Dinner Set', names: ['Terracotta Table Set', 'Glaze 18 Piece Set', 'Moonlight Ceramic Set', 'Heritage Dinnerware', 'Matte Stone Set', 'Blue Pottery Set'], price: [1499, 7999],
        features: ['Microwave and dishwasher safe', 'Lead-free glaze', 'Chip-resistant stoneware', 'Handcrafted finish', 'Gift box packaging'],
        specs: () => ({ Pieces: `${pick([12, 18, 24, 32])}`, Material: pick(['Stoneware', 'Bone china', 'Ceramic']), Serves: pick(['4', '6']), Care: 'Dishwasher safe' }),
        attributes: () => ({ colors: sample(['White', 'Sage', 'Blue', 'Earth Brown'], 2) }),
        keywords: ['dinner set', 'ceramic dinner set', 'stoneware dinner set'],
      },
      {
        subcategory: 'Towel Set', names: ['Spa Soft Towel Set', 'Zero Twist Towels', 'Bamboo Blend Towels', 'Hotel Luxe Set', 'Quick Dry Towels', 'Waffle Weave Set'], price: [599, 2999],
        features: ['Highly absorbent', 'Soft zero-twist loops', 'Quick drying', 'Colourfast dyes', 'Set of bath, hand and face towels'],
        specs: () => ({ Material: pick(['100% cotton', '60% bamboo, 40% cotton']), GSM: `${pick([450, 500, 600])}`, Pieces: pick(['2', '4', '6']), Care: 'Machine wash warm' }),
        attributes: () => ({ colors: sample(['White', 'Grey', 'Sage', 'Beige'], 2) }),
        keywords: ['towel set', 'cotton towels', 'bath towel set'],
      },
      {
        subcategory: 'Scented Candle', names: ['Lavender Calm Candle', 'Sandalwood Glow', 'Vanilla Hearth', 'Jasmine Night', 'Citrus Morning', 'Rain Forest Candle'], price: [299, 1499],
        features: ['Soy wax blend', 'Cotton wick', 'Long burn time', 'Reusable glass jar', 'Hand-poured in small batches'],
        specs: () => ({ 'Burn time': `${pick([25, 40, 60])} hours`, 'Net weight': `${pick([150, 200, 300])} g`, Wax: 'Soy wax blend', Fragrance: pick(['Lavender', 'Sandalwood', 'Vanilla', 'Jasmine', 'Citrus']) }),
        attributes: () => ({ gift_ready: true }),
        keywords: ['scented candle', 'aromatherapy candle', 'soy candle'],
      },
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
        subcategory: 'Hair Oil', names: ['Bhringraj Hair Oil', 'Onion Growth Oil', 'Coconut Hibiscus Oil', 'Rosemary Scalp Oil', 'Amla Shine Oil', 'Argan Repair Oil'], price: [249, 899],
        features: ['Cold-pressed oils', 'Non-sticky formula', 'Free from mineral oil', 'Suitable for all hair types', 'Dropper for easy use'],
        specs: () => ({ Volume: `${pick([100, 150, 200])} ml`, 'Key ingredient': pick(['Bhringraj', 'Onion seed', 'Coconut and hibiscus', 'Rosemary', 'Amla', 'Argan']), 'Hair type': 'All hair types' }),
        attributes: () => ({ concern: pick(['Hair fall', 'Dry scalp', 'Frizz']) }),
        keywords: ['hair oil', 'hair growth oil', 'ayurvedic hair oil'],
      },
      {
        subcategory: 'Face Wash', names: ['Neem Clear Face Wash', 'Gentle Foaming Cleanser', 'Charcoal Detox Wash', 'Rice Water Cleanser', 'Salicylic Acne Wash', 'Aloe Calm Cleanser'], price: [199, 599],
        features: ['Soap-free formula', 'pH balanced', 'Removes excess oil', 'Fragrance-free', 'Dermatologically tested'],
        specs: () => ({ Volume: `${pick([100, 150])} ml`, 'Key ingredient': pick(['Neem', 'Charcoal', 'Rice water', '1% salicylic acid', 'Aloe vera']), 'Skin type': pick(['Oily skin', 'All skin types', 'Sensitive skin']) }),
        attributes: () => ({ concern: pick(['Acne', 'Dullness', 'Oil control']) }),
        keywords: ['face wash', 'face wash for oily skin', 'gentle cleanser'],
      },
      {
        subcategory: 'Lip Balm', names: ['Berry Tint Balm', 'Cocoa Butter Balm', 'SPF Lip Shield', 'Honey Nourish Balm', 'Mint Fresh Balm', 'Rose Glow Balm'], price: [149, 449],
        features: ['Shea and cocoa butter', 'Long-lasting moisture', 'Light tint', 'Pocket-size tube', 'No parabens'],
        specs: () => ({ 'Net weight': `${pick([4, 4.5, 10])} g`, SPF: pick(['None', 'SPF 15']), Finish: pick(['Sheer tint', 'Clear', 'Glossy']) }),
        attributes: () => ({ shade: pick(['Berry', 'Nude', 'Rose', 'Clear']) }),
        keywords: ['lip balm', 'tinted lip balm', 'lip balm for dry lips'],
      },
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
        subcategory: 'Resistance Bands', names: ['FlexLoop Set', 'PowerBand Pro', 'Glute Band Trio', 'Studio Bands', 'Travel Gym Bands', 'Pull-Up Assist Bands'], price: [399, 1999],
        features: ['Five resistance levels', 'Latex-free fabric', 'Non-slip inner grip', 'Carry pouch included', 'Exercise guide included'],
        specs: () => ({ Pieces: pick(['3', '5']), Material: pick(['Fabric', 'Natural latex']), 'Resistance range': pick(['5 to 25 kg', '10 to 40 kg']) }),
        attributes: () => ({ level: pick(['Beginner', 'All levels']) }),
        keywords: ['resistance bands', 'workout bands', 'home gym equipment'],
      },
      {
        subcategory: 'Football', names: ['Strike Match Ball', 'Street Kick', 'Turf Master', 'Academy Ball', 'Pro League Ball', 'Futsal Grip'], price: [499, 2999],
        features: ['Hand-stitched panels', 'Butyl bladder for air retention', 'Textured surface for grip', 'Suitable for grass and turf', 'Comes deflated with needle'],
        specs: () => ({ Size: pick(['5', '4']), Material: pick(['PU', 'TPU', 'PVC']), Panels: pick(['32', '20']), Weight: `${between(410, 450)} g` }),
        attributes: () => ({ use: pick(['Training', 'Match', 'Street']) }),
        keywords: ['football', 'football size 5', 'training football'],
      },
      {
        subcategory: 'Dumbbell Set', names: ['HexGrip Pair', 'Neoprene Duo', 'Adjustable Iron Set', 'Home Strength Pair', 'ChromeLift Pair', 'Studio Weights'], price: [699, 6999],
        features: ['Non-slip grip', 'Hexagonal heads that do not roll', 'Floor-friendly coating', 'Colour-coded weights', 'Pair included'],
        specs: () => ({ Weight: pick(['2 x 2 kg', '2 x 5 kg', '2 x 7.5 kg', 'Adjustable up to 20 kg']), Material: pick(['Neoprene-coated cast iron', 'Rubber-coated steel']), Grip: 'Knurled handle' }),
        attributes: () => ({ level: pick(['Beginner', 'Intermediate']) }),
        keywords: ['dumbbells', 'dumbbell set', 'home workout weights'],
      },
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
        subcategory: 'Coffee Beans', names: ['Chikmagalur Estate Roast', 'Monsoon Malabar', 'Coorg Medium Roast', 'Araku Single Origin', 'Espresso Blend No. 7', 'Filter Coffee Blend'], price: [349, 1299],
        features: ['Single-estate arabica', 'Roasted to order', 'Notes of chocolate and caramel', 'Degassing valve bag', 'Whole bean or ground'],
        specs: () => ({ 'Net weight': `${pick([250, 500])} g`, Roast: pick(['Light', 'Medium', 'Dark']), Origin: pick(['Chikmagalur', 'Coorg', 'Araku Valley', 'Malabar']), Form: pick(['Whole bean', 'Ground for filter', 'Ground for espresso']) }),
        attributes: () => ({ diet: ['Vegan'] }),
        keywords: ['coffee beans', 'arabica coffee', 'filter coffee powder'],
      },
      {
        subcategory: 'Basmati Rice', names: ['Royal Aged Basmati', 'Everyday Basmati', 'Dehraduni Basmati', 'Extra Long Grain', 'Biryani Special', 'Brown Basmati'], price: [149, 999],
        features: ['Aged for aroma', 'Extra long grains', 'Non-sticky when cooked', 'Hand sorted', 'Sealed freshness pack'],
        specs: () => ({ 'Net weight': `${pick([1, 5])} kg`, 'Grain length': `${pick(['8.3', '8.4', '8.5'])} mm`, Aged: pick(['12 months', '24 months']), 'Shelf life': '24 months' }),
        attributes: () => ({ diet: ['Vegan', 'Gluten-free'] }),
        keywords: ['basmati rice', 'long grain basmati', 'biryani rice'],
      },
      {
        subcategory: 'Dry Fruits', names: ['California Almonds', 'Whole Cashews W240', 'Mixed Dry Fruits', 'Afghan Raisins', 'Salted Pistachios', 'Medjool Dates'], price: [299, 1999],
        features: ['Hand-picked and graded', 'No added preservatives', 'Resealable zip pouch', 'Rich in protein and fibre', 'Freshly packed'],
        specs: () => ({ 'Net weight': `${pick([250, 500, 1000])} g`, Grade: pick(['Premium', 'W240', 'Jumbo']), 'Shelf life': `${pick([6, 9, 12])} months`, Origin: pick(['California', 'Kerala', 'Afghanistan', 'Iran']) }),
        attributes: () => ({ diet: ['Vegan', 'Gluten-free'] }),
        keywords: ['dry fruits', 'almonds', 'healthy snacks'],
      },
      {
        subcategory: 'Honey', names: ['Wild Forest Honey', 'Multiflora Honey', 'Litchi Blossom Honey', 'Raw Mountain Honey', 'Tulsi Honey', 'Mustard Flower Honey'], price: [249, 899],
        features: ['Raw and unprocessed', 'Sourced from small beekeepers', 'No added sugar', 'Glass jar', 'Batch-tested for purity'],
        specs: () => ({ 'Net weight': `${pick([250, 500])} g`, Source: pick(['Forest', 'Litchi orchards', 'Himalayan foothills', 'Mustard fields']), 'Shelf life': '24 months' }),
        attributes: () => ({ diet: ['Vegetarian'] }),
        keywords: ['honey', 'raw honey', 'natural honey'],
      },
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
        subcategory: 'Wooden Puzzle', names: ['Alphabet Board Puzzle', 'Animal Shape Sorter', 'India Map Puzzle', 'Number Train Puzzle', 'Fruit Peg Puzzle', 'Space Jigsaw'], price: [349, 1499],
        features: ['Made from sustainably sourced wood', 'Non-toxic water-based paints', 'Chunky pieces for small hands', 'Smooth rounded edges', 'Builds shape and colour recognition'],
        specs: () => ({ Pieces: `${pick([12, 26, 36, 48])}`, 'Recommended age': pick(['2+ years', '3+ years', '5+ years']), Material: pick(['Pine wood', 'MDF', 'Rubberwood']) }),
        attributes: () => ({ theme: pick(['Alphabet', 'Animals', 'Maps', 'Numbers']) }),
        keywords: ['wooden puzzle', 'educational toys', 'puzzle for kids'],
      },
      {
        subcategory: 'Plush Toy', names: ['Cuddle Bear', 'Sleepy Elephant', 'Bunny Buddy', 'Panda Pal', 'Dino Snuggle', 'Owl Hugs'], price: [399, 1999],
        features: ['Super-soft fabric', 'Embroidered eyes, no small parts', 'Surface washable', 'Hypoallergenic filling', 'Gift-ready tag'],
        specs: () => ({ Height: `${pick([25, 30, 40, 60])} cm`, Material: 'Polyester plush', 'Recommended age': pick(['0+ years', '3+ years']) }),
        attributes: () => ({ colors: sample(['Brown', 'Grey', 'Pink', 'White'], 1) }),
        keywords: ['soft toy', 'teddy bear', 'plush toy for kids'],
      },
      {
        subcategory: 'Building Blocks', names: ['City Builder Set', 'Creative Bricks Box', 'Mini Engineers Kit'], price: [599, 3999],
        features: ['Compatible with major brick brands', 'Non-toxic, BPA-free plastic', 'Illustrated build guide', 'Storage box included', 'Builds fine motor skills'],
        specs: () => ({ Pieces: `${pick([150, 300, 500, 1000])}`, 'Recommended age': pick(['3+ years', '6+ years', '8+ years']), Material: 'ABS plastic', Certification: 'BIS certified' }),
        attributes: () => ({ theme: pick(['City', 'Space', 'Vehicles']) }),
        keywords: ['building blocks', 'educational toys', 'construction toys for kids'],
      },
    ],
  },
  {
    category: 'Books & Stationery', brands: ['Inkwell', 'Paper Trail', 'Studio Desk'],
    types: [
      {
        subcategory: 'Notebook', names: ['Dot Grid Journal', 'Kraft Ruled Notebook', 'Hardbound Sketchbook', 'Spiral Study Pad', 'Pocket Field Notes', 'Linen Cover Journal'], price: [149, 899],
        features: ['Thick paper that resists bleed-through', 'Lay-flat binding', 'Numbered pages', 'Ribbon bookmark', 'Recycled paper cover'],
        specs: () => ({ Pages: `${pick([120, 160, 192, 240])}`, Size: pick(['A5', 'A4', 'B5', 'Pocket']), 'Paper weight': `${pick([80, 100, 120])} GSM`, Ruling: pick(['Dot grid', 'Ruled', 'Plain']) }),
        attributes: () => ({ colors: sample(['Kraft', 'Black', 'Sage', 'Navy'], 1) }),
        keywords: ['notebook', 'dot grid notebook', 'journal notebook'],
      },
      {
        subcategory: 'Fountain Pen', names: ['Classic Nib Pen', 'Demonstrator Clear', 'Brass Heritage Pen', 'Student Starter Pen', 'Ebonite Signature', 'Calligraphy Set'], price: [299, 2999],
        features: ['Smooth steel nib', 'Converter and cartridges included', 'Ink window', 'Gift box', 'Comfortable grip section'],
        specs: () => ({ Nib: pick(['Fine', 'Medium', 'Broad', '1.1 mm italic']), Body: pick(['Resin', 'Brass', 'Ebonite', 'Clear acrylic']), Filling: 'Cartridge or converter' }),
        attributes: () => ({ colors: sample(['Black', 'Burgundy', 'Teal', 'Clear'], 1) }),
        keywords: ['fountain pen', 'ink pen', 'calligraphy pen'],
      },
      {
        subcategory: 'Planner', names: ['Undated Weekly Planner', 'Daily Focus Planner', 'Habit Tracker Planner', 'Student Planner', 'Goal Setting Planner', 'Budget Planner'], price: [299, 1299],
        features: ['Undated so you can start any time', 'Monthly and weekly spreads', 'Habit and goal trackers', 'Pen loop and pocket', 'Hardcover'],
        specs: () => ({ Pages: `${pick([160, 200, 240])}`, Size: pick(['A5', 'B6']), 'Paper weight': `${pick([80, 100])} GSM`, Layout: pick(['Weekly', 'Daily', 'Monthly']) }),
        attributes: () => ({ colors: sample(['Blush', 'Forest', 'Charcoal'], 1) }),
        keywords: ['planner', 'weekly planner', 'undated planner'],
      },
    ],
  },
  {
    category: 'Jewellery & Accessories', brands: ['Aranya', 'Silver Sutra', 'Northline'],
    types: [
      {
        subcategory: 'Leather Wallet', names: ['Bifold Classic Wallet', 'Slim Card Holder', 'RFID Travel Wallet', 'Trifold Heritage', 'Zip Around Wallet', 'Coin Pocket Bifold'], price: [499, 2499],
        features: ['Genuine leather', 'RFID blocking', 'Six card slots', 'Two note compartments', 'Slim profile'],
        specs: () => ({ Material: pick(['Full-grain leather', 'Top-grain leather', 'Vegan leather']), 'Card slots': `${pick([4, 6, 8])}`, Dimensions: '11 x 9 cm' }),
        attributes: () => ({ colors: sample(['Tan', 'Black', 'Brown'], 1), gender: pick(['Men', 'Women', 'Unisex']) }),
        keywords: ['leather wallet', 'wallet for men', 'rfid wallet'],
      },
      {
        subcategory: 'Silver Earrings', names: ['Jhumka Drops', 'Oxidised Chandbali', 'Minimal Studs', 'Temple Hoops', 'Leaf Danglers', 'Peacock Jhumkas'], price: [499, 3999],
        features: ['925 sterling silver', 'Hallmarked', 'Nickel-free', 'Handcrafted detailing', 'Gift pouch included'],
        specs: () => ({ Metal: '925 sterling silver', Finish: pick(['Oxidised', 'High polish', 'Matte']), Weight: `${between(3, 14)} g`, Closure: pick(['Hook', 'Push back', 'Hoop latch']) }),
        attributes: () => ({ occasion: pick(['Festive', 'Everyday', 'Wedding']) }),
        keywords: ['silver earrings', 'oxidised earrings', 'jhumka earrings'],
      },
      {
        subcategory: 'Sunglasses', names: ['Aviator Classic', 'Wayfarer Matte', 'Round Retro', 'Sport Wrap', 'Clubmaster Edge', 'Cat Eye Glam'], price: [599, 3999],
        features: ['UV400 protection', 'Polarised lenses', 'Lightweight frame', 'Spring hinges', 'Hard case included'],
        specs: () => ({ Lens: pick(['Polarised', 'Gradient', 'Mirrored']), Frame: pick(['Metal', 'Acetate', 'TR90']), Protection: 'UV400', Width: `${between(135, 145)} mm` }),
        attributes: () => ({ colors: sample(['Black', 'Gold', 'Tortoise'], 1), gender: pick(['Men', 'Women', 'Unisex']) }),
        keywords: ['sunglasses', 'polarised sunglasses', 'aviator sunglasses'],
      },
    ],
  },
];

// Cycle through every product type so all categories are evenly represented.
const ALL_TYPES = CATALOG.flatMap((group) => group.types.map((type) => ({ group, type })));

// Every product gets its own name: an unused name for its type, else a name with an edition
// suffix ("Pulse Buds Pro"), so a large catalog doesn't repeat itself.
const usedNames = new Set();
const EDITIONS = ['Lite', 'Plus', 'Pro', 'Max', 'Neo', 'Prime', 'Edge', 'Classic', 'Select', 'Signature', 'Studio', 'Air'];
function uniqueName(names) {
  const fresh = names.filter((name) => !usedNames.has(name));
  let name = fresh.length ? pick(fresh) : null;
  for (let i = 0; !name; i++) {
    const candidate = `${pick(names)} ${EDITIONS[(i + Math.floor(rand() * EDITIONS.length)) % EDITIONS.length]}`;
    if (!usedNames.has(candidate)) name = candidate;
  }
  usedNames.add(name);
  return name;
}

function makeProduct(index) {
  const { group, type } = ALL_TYPES[index % ALL_TYPES.length];
  const product = {
    sku: `${SKU_PREFIX}-${String(index + 1).padStart(4, '0')}`,
    name: uniqueName(type.names),
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
