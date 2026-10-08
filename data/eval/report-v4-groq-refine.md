# Eval report

2026-10-08 08:58 UTC · provider `groq` · length `medium` · tones: friendly · prompt version `45980aed`

Read each output against its product data, then fill in `ratings.csv` (relevance and creativity, 1-5) and run `npm run eval -- ratings ratings.csv`. Phase 1 is done when 80% or more of outputs score 4 or 5 on both and the fact check flags nothing.

## Summary

| Config | OK | Errors | SEO checks passed | Keyword coverage | Fact check clean | Flags | Style clean | Fixes kept | Words in range | Avg latency | Avg tokens in / out | Total cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| openai/gpt-oss-120b | 5/5 | 0 | 100% | 17% | 100% | 0 | 80% | 3/3 | 100% | 39.8 s | 4182 / 3379 | unknown |

## Style issues

| Issue | Outputs | Examples |
|---|---|---|
| cliche | 1 | perfect for |

## Consistency

- openai/gpt-oss-120b: no duplicate titles, repeated openings or length outliers.

## Fact-check flags

None.

## Outputs

### SKU-0018 · Orbit Fit (Electronics)

> **What to check:** Smartwatch with many figures (2.01-inch, 12 days, 5 ATM, 100+ modes). Watch for unit drift (5 ATM is not 50 m).

- **Brand:** Voltix · **Subcategory:** Smartwatch · **Price:** 12269 INR
- **Features:** Bluetooth calling; Built-in GPS; 5 ATM water resistance; 100+ sports modes
- **Specifications:** Display: 2.01-inch AMOLED; Battery life: Up to 12 days; Water resistance: 5 ATM; Compatibility: Android and iOS
- **Attributes:** strap: Metal mesh; colors: Rose Gold, Graphite
- **Seed keywords:** smart watch with calling, fitness tracker
- **Completeness:** 100/100

| Item | Title | Words | SEO | Facts | Style |
|---|---|---|---|---|---|
| SKU-0018-friendly | Voltix Orbit Fit Smartwatch with Calling, 5 ATM Water Resistance | 130 | 6/6 | clean | clean |

#### SKU-0018-friendly · friendly · openai/gpt-oss-120b

**Voltix Orbit Fit Smartwatch with Calling, 5 ATM Water Resistance** _(64 chars)_

_Stay connected on the move with Bluetooth calling, GPS tracking and a 5 ATM-rated metal mesh strap, while the 2.01-inch AMOLED display keeps your stats clear for up to 12 days._

The Voltix Orbit Fit smartwatch with calling puts your phone right on your wrist, letting you answer Bluetooth calls without digging for your device. Its 5 ATM water resistance means you can swim, shower or get caught in a downpour and the metal mesh strap stays secure and comfortable.

The 2.01-inch AMOLED screen shows your stats in crisp colour, while the built-in GPS maps every run or ride. With over 100 sports modes you can track everything from yoga to cycling, and the battery lasts up to 12 days on a single charge. It pairs with Android and iOS phones, so you stay synced wherever you go. Choose a Rose Gold or Graphite finish to match your style, and the lightweight metal mesh band feels cool even in warm weather.

- Answer calls hands-free: Bluetooth calling from the wrist
- Track routes accurately: Built-in GPS maps runs and rides
- Long-lasting power: Up to 12 days battery life
- All-sport coverage: Over 100 sports modes
- Swim-proof confidence: 5 ATM water resistance with metal mesh strap

**Meta** _(150 chars)_: Voltix Orbit Fit smartwatch with calling offers Bluetooth calls, GPS, 5 ATM water resistance and up to 12 days battery life – perfect for active life.

**Keywords:** smartwatch with calling · fitness tracker watch · 5 ATM smartwatch · Bluetooth calling smartwatch · Android iOS smartwatch · metal mesh smartwatch

> SEO 6/6 · keyword coverage 17% · 130 words (target 120-180) · 5 bullets
> Fact check: clean
> Style: clean
> openai/gpt-oss-120b (medium) · 3686 in / 2677 out tokens · 6.4 s

### SKU-0054 · Chikankari Straight Kurta (Apparel)

> **What to check:** Seed keyword "cotton kurta" contradicts the Rayon fabric. It should be dropped, not used.

- **Brand:** Loomcraft · **Subcategory:** Kurta · **Price:** 2559 INR
- **Features:** Comes with matching dupatta; Breathable natural fabric; Three-quarter sleeves; Side slits for easy movement; Hand-finished embroidery
- **Specifications:** Fabric: Rayon; Length: Calf length; Neck: Mandarin; Care: Dry clean only
- **Attributes:** sizes: XS, S, M, L, XL; occasion: Office; gender: Women
- **Seed keywords:** cotton kurta, ethnic wear
- **Completeness:** 100/100

| Item | Title | Words | SEO | Facts | Style |
|---|---|---|---|---|---|
| SKU-0054-friendly | Loomcraft Chikankari Straight Kurta with Matching Dupatta | 131 | 6/6 | clean | clean |

#### SKU-0054-friendly · friendly · openai/gpt-oss-120b

**Loomcraft Chikankari Straight Kurta with Matching Dupatta** _(57 chars)_

_Enjoy a breezy office look with this straight kurta, featuring hand-finished Chikankari embroidery, three-quarter sleeves, side slits and a matching dupatta for a complete ethnic ensemble._

The hand-finished Chikankari embroidery on this kurta catches the eye with its delicate threadwork, giving the straight kurta a subtle sparkle that works well in an office setting. Made from a breathable natural fabric, the piece feels light against the skin, while the mandarin collar adds a touch of modern elegance. Three-quarter sleeves and side slits let you move comfortably through the day, and the matching dupatta completes the look without extra effort.

Pair it with tailored trousers or a sleek skirt for a polished ethnic office outfit, and you’ll appreciate the easy-care dry-clean requirement that keeps the kurta looking fresh after each wear. Available in sizes XS to XL, the Loomcraft straight kurta offers a versatile fit for many body types, making it a reliable addition to your work-day wardrobe.

- Complete set: includes dupatta
- Breathable comfort: lightweight natural fabric
- Easy movement: side slits and three-quarter sleeves
- Artisan detail: hand-finished Chikankari embroidery
- Office ready: mandarin collar and calf length

**Meta** _(126 chars)_: Loomcraft straight kurta offers breathable fabric, hand-finished Chikankari embroidery and side slits – ideal for office wear.

**Keywords:** straight kurta · women's kurta · ethnic wear · office kurta · chikankari kurta

> SEO 6/6 · keyword coverage 20% · 131 words (target 120-180) · 5 bullets
> Fact check: clean
> Style: clean
> Fix-up: kept (1 problem(s))
> openai/gpt-oss-120b (medium) · 4517 in / 3645 out tokens · 44.2 s

### SKU-0007 · CrispAir 4L (Home & Kitchen)

> **What to check:** Name says 4L but the capacity spec is 5.5 L. Copy should use 5.5 L, not present 4 litres as the capacity.

- **Brand:** Casa Nova · **Subcategory:** Air Fryer · **Price:** 7189 INR
- **Features:** Auto shut-off; Up to 90% less oil than deep frying; Dishwasher-safe non-stick basket; Digital touch panel with 8 presets
- **Specifications:** Capacity: 5.5 L; Power: 1200 W; Temperature range: 80-200 °C; Warranty: 1 year
- **Attributes:** colors: Black
- **Seed keywords:** digital air fryer, oil free fryer
- **Completeness:** 100/100

| Item | Title | Words | SEO | Facts | Style |
|---|---|---|---|---|---|
| SKU-0007-friendly | Casa Nova CrispAir 4L Digital Air Fryer, 5.5L Capacity | 144 | 6/6 | clean | clean |

#### SKU-0007-friendly · friendly · openai/gpt-oss-120b

**Casa Nova CrispAir 4L Digital Air Fryer, 5.5L Capacity** _(54 chars)_

_Enjoy crispy meals with up to 90% less oil, thanks to the Casa Nova CrispAir 4L digital air fryer’s 5.5 L basket and auto shut-off safety._

The Casa Nova CrispAir 4L is a digital air fryer that gives you crispy fries, golden nuggets and crunchy veggies while using up to 90% less oil than a deep fryer. Its 5.5 L non-stick basket holds enough for a family meal, and the 1200 W heating element reaches temperatures from 80 °C to 200 °C in minutes, so you can enjoy fast results without the mess.

Just tap the digital touch panel and choose from eight preset programmes – from fries to chicken to desserts – and the fryer will manage time and temperature for you. With its generous 5.5 L space you can air-fry a whole chicken or a tray of spring rolls in one go. The auto shut-off feature adds safety, while the removable basket is dishwasher-safe, making cleanup a breeze. You also get a one-year warranty for peace of mind.

- Oil savings: up to 90% less oil than deep frying
- Spacious cooking: 5.5 L basket fits family meals
- Quick heat: 1200 W reaches 200 °C fast
- Smart presets: eight digital programmes for fries, chicken, desserts
- Easy cleanup: dishwasher-safe non-stick basket and auto shut-off safety

**Meta** _(132 chars)_: Experience healthier cooking with the Casa Nova CrispAir 4L digital air fryer – up to 90% less oil, auto shut-off and easy cleaning.

**Keywords:** digital air fryer · 5.5 litre air fryer · 1200 watt air fryer · air fryer with auto shut off · dishwasher safe air fryer basket · oil free cooking appliance

> SEO 6/6 · keyword coverage 17% · 144 words (target 120-180) · 5 bullets
> Fact check: clean
> Style: clean
> openai/gpt-oss-120b (medium) · 3689 in / 2859 out tokens · 33.8 s

### SKU-0042 · Hyaluronic Hydra Serum (Beauty & Personal Care)

> **What to check:** Name says Hyaluronic but the key ingredient is 10% Vitamin C. Copy must not claim hyaluronic acid.

- **Brand:** PureLeaf · **Subcategory:** Face Serum · **Price:** 929 INR
- **Features:** Suitable for daily use; Lightweight, fast-absorbing formula; Dropper for mess-free application; Fragrance-free
- **Specifications:** Volume: 30 ml; Key ingredient: 10% Vitamin C; Skin type: Oily and acne-prone
- **Attributes:** concern: Dehydration; cruelty_free: true
- **Seed keywords:** face serum, serum for glowing skin
- **Completeness:** 100/100

| Item | Title | Words | SEO | Facts | Style |
|---|---|---|---|---|---|
| SKU-0042-friendly | PureLeaf Hyaluronic Hydra Face Serum, Lightweight, Fragrance-Free | 144 | 6/6 | clean | 1 issues |

#### SKU-0042-friendly · friendly · openai/gpt-oss-120b

**PureLeaf Hyaluronic Hydra Face Serum, Lightweight, Fragrance-Free** _(65 chars)_

_A lightweight, fast-absorbing face serum with 10% Vitamin C, perfect for oily, acne-prone skin; fragrance-free, cruelty-free and easy daily use with a mess-free dropper._

A light drop of this face serum glides over the skin, disappearing in seconds without a trace. The lightweight, fast-absorbing formula feels like a breath of fresh air, suitable for oily and acne-prone skin.

Enriched with 10% Vitamin C, it tackles dehydration while the fragrance-free, mess-free dropper lets you apply the exact amount each day. Suitable for daily use, it leaves the complexion hydrated and balanced without greasiness. Its non-sticky finish means you can follow with moisturizer or makeup right away, and the gentle formula stays calm on sensitive zones.

PureLeaf keeps the formula cruelty-free, and the 30 ml bottle fits neatly on any vanity. When prepping for work or winding down at night, this serum offers a simple, effective step to keep your skin comfortably hydrated. The clear bottle lets you see exactly how much product remains, so you never run out unexpectedly.

- Lightweight feel: fast-absorbing formula that disappears instantly
- Daily hydration: 10% Vitamin C combats dehydration
- Mess-free application: dropper delivers exact amount
- Fragrance-free: suitable for sensitive, acne-prone skin
- Cruelty-free: ethically made, 30 ml bottle fits vanity

**Meta** _(141 chars)_: PureLeaf Hyaluronic Hydra Face Serum – lightweight, fragrance-free with 10% Vitamin C for oily, acne-prone skin. Hydrate daily, cruelty-free.

**Keywords:** face serum · vitamin c serum · oil control serum · cruelty free serum · hydrating face serum · fragrance free serum

> SEO 6/6 · keyword coverage 17% · 144 words (target 120-180) · 5 bullets
> Fact check: clean
> Style: cliche (perfect for)
> Fix-up: kept (3 problem(s))
> openai/gpt-oss-120b (medium) · 4540 in / 4331 out tokens · 51.5 s

### SKU-0060 · GripFlow Mat (Sports & Fitness)

> **What to check:** Straightforward yoga mat with good data. Baseline for tone and style.

- **Brand:** IronPeak · **Subcategory:** Yoga Mat · **Price:** 1779 INR
- **Features:** Non-slip textured surface; Extra cushioning for joints; Lightweight with carry strap
- **Specifications:** Thickness: 8 mm; Material: Natural cork and rubber; Dimensions: 183 x 61 cm; Weight: 0.9 kg
- **Attributes:** colors: Peach, Charcoal
- **Seed keywords:** exercise mat, yoga mat
- **Completeness:** 100/100

| Item | Title | Words | SEO | Facts | Style |
|---|---|---|---|---|---|
| SKU-0060-friendly | IronPeak GripFlow Exercise Mat, Non-Slip Cork Surface | 156 | 6/6 | clean | clean |

#### SKU-0060-friendly · friendly · openai/gpt-oss-120b

**IronPeak GripFlow Exercise Mat, Non-Slip Cork Surface** _(53 chars)_

_Enjoy stable, cushioned practice on the IronPeak GripFlow Exercise Mat – an 8 mm cork-rubber surface that stays firm, comforts joints, and folds light enough to carry anywhere._

The GripFlow feels different the first time you unroll it. Its natural cork and rubber blend creates a textured, non-slip surface that grips the floor and your feet, giving you confidence in every pose on this exercise mat. The subtle, earthy scent of cork adds a calming note to your practice, while the 8 mm thickness cushions your joints without feeling bulky. Measuring 183 by 61 centimetres, it offers ample space for full-body flows, and the lightweight 0.9 kg build means you can move it from room to room in seconds.

Carry it effortlessly with the attached strap, and choose between soothing Peach or sleek Charcoal to match your studio vibe. When you flow through vinyasa, hold a restorative pose, or add a few stretches after a run, the extra cushioning protects knees and wrists, while the non-slip texture keeps you steady even when you break a sweat. It’s a simple, reliable companion for every workout.

- Secure footing: Non-slip textured surface grips floor and feet
- Joint comfort: 8 mm extra cushioning protects knees and wrists
- Easy transport: Lightweight 0.9 kg with built-in carry strap
- Spacious area: 183 × 61 cm surface for full-body flows
- Style choice: Available in Peach or Charcoal

**Meta** _(150 chars)_: Find stability and comfort with the IronPeak GripFlow exercise mat – non-slip cork surface, 8 mm cushioning and a handy carry strap for every workout.

**Keywords:** exercise mat · yoga mat · cork yoga mat · non slip yoga mat · lightweight exercise mat · extra cushioning yoga mat · ironpeak exercise mat

> SEO 6/6 · keyword coverage 14% · 156 words (target 120-180) · 5 bullets
> Fact check: clean
> Style: clean
> Fix-up: kept (1 problem(s))
> openai/gpt-oss-120b (medium) · 4479 in / 3383 out tokens · 63.2 s
