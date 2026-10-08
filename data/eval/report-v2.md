# Eval report

2026-10-08 08:24 UTC · provider `openrouter` · length `medium` · tones: friendly · prompt version `96b4ef68`

Read each output against its product data, then fill in `ratings.csv` (relevance and creativity, 1-5) and run `npm run eval -- ratings ratings.csv`. Phase 1 is done when 80% or more of outputs score 4 or 5 on both and the fact check flags nothing.

## Summary

| Config | OK | Errors | SEO checks passed | Keyword coverage | Fact check clean | Flags | Style clean | Words in range | Avg latency | Avg tokens in / out | Total cost |
|---|---|---|---|---|---|---|---|---|---|---|---|
| nvidia/nemotron-3-super-120b-a12b:free | 8/8 | 0 | 100% | 26% | 88% | 1 | 63% | 100% | 63.4 s | 3873 / 7562 | $0.0000 |

## Style issues

| Issue | Outputs | Examples |
|---|---|---|
| title_repeat | 2 | calling · serum |
| cliche | 1 | perfect for |
| keyword_stuffing | 1 | "tulsi green tea" 3 times |

## Fact-check flags

| Item | Flagged text | Issue | Fields |
|---|---|---|---|
| SKU-0054-friendly | handmade | Claim not supported by the product data | bullet_points |

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
| SKU-0018-friendly | Voltix Orbit Fit Smart Watch with Calling, Bluetooth Calling | 138 | 5/5 | clean | 1 issues |

#### SKU-0018-friendly · friendly · nvidia/nemotron-3-super-120b-a12b:free

**Voltix Orbit Fit Smart Watch with Calling, Bluetooth Calling** _(60 chars)_

_Stay connected with Bluetooth calling, track routes via built-in GPS and choose from 100+ sports modes on a vivid 2.01-inch AMOLED screen._

When you lift your wrist to check a notification, the Orbit Fit feels light yet sturdy, its 2.01-inch AMOLED display glowing with clear colours. This smart watch with calling lets you take calls straight from your wrist via Bluetooth, so you never miss a conversation while on the move.

Built-in GPS tracks your runs and rides with accurate route mapping, while over 100 sports modes let you log everything from yoga to high-intensity interval training. The 5 ATM water resistance means you can wear it swimming or in the rain without worry, and the battery lasts up to 12 days on a single charge, reducing the need for frequent recharging. Compatible with both Android and iOS devices, the watch pairs easily, and the metal-mesh strap in Rose Gold or Graphite adds a polished look that matches any outfit.

- Hands-free calls: Bluetooth calling lets you take calls straight from your wrist.
- Accurate routing: Built-in GPS tracks runs and rides with precise route mapping.
- Swim-ready durability: 5 ATM water resistance lets you wear it while swimming or in rain.
- Long-lasting power: Battery life up to 12 days reduces frequent charging needs.
- Versatile style: Metal-mesh strap in Rose Gold or Graphite complements any outfit.

**Meta** _(124 chars)_: Voltix Orbit Fit smart watch with calling offers Bluetooth calls, GPS, 5 ATM water resistance and up to 12-day battery life.

**Keywords:** smart watch with calling · fitness tracker · Bluetooth calling smartwatch · AMOLED smartwatch · 5 ATM water resistant watch · 12 day battery smartwatch · Android iOS compatible watch · metal mesh strap smartwatch

> SEO 5/5 · keyword coverage 13% · 138 words (target 120-180) · 5 bullets
> Fact check: clean
> Style: title_repeat (calling)
> nvidia/nemotron-3-super-120b-a12b:free · 3874 in / 6827 out tokens · 69.7 s

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
| SKU-0054-friendly | Loomcraft Chikankari Straight Kurta With Dupatta | 120 | 5/5 | 1 flagged | clean |

#### SKU-0054-friendly · friendly · nvidia/nemotron-3-super-120b-a12b:free

**Loomcraft Chikankari Straight Kurta With Dupatta** _(48 chars)_

_A Loomcraft Chikankari straight kurta with matching dupatta, breathable rayon fabric, three-quarter sleeves and side slits for easy movement._

As you head to the office, the Loomcraft Chikankari straight kurta offers a truly breathable rayon feel. The straight cut gives a polished silhouette while the calf-length design keeps you covered and comfortable throughout the day.

It comes with a matching dupatta that mirrors the hand-finished chikankari embroidery on the kurta, adding a coordinated touch. The breathable rayon fabric and the three-quarter sleeves offer ease of movement. Side slits at the hem allow you to walk or sit comfortably, and the mandarin neck frames the face neatly. Remember to dry clean only to preserve the delicate embroidery and fabric finish.

Ideal for office wear, the kurta balances tradition with a modern cut that works for meetings and casual Fridays alike.

- Coordinated look: comes with matching dupatta
- Breathable comfort: rayon fabric is breathable and natural
- Easy movement: three-quarter sleeves and side slits allow easy movement
- Handcrafted detail: hand-finished chikankari embroidery adorns the kurta and dupatta
- Office ready: suited for office occasion with calf length and mandarin neck

**Meta** _(140 chars)_: Shop the Loomcraft Chikankari straight kurta with matching dupatta, breathable rayon and hand-finished embroidery - perfect for office wear.

**Keywords:** straight kurta · chikankari kurta · kurta with dupatta · office wear kurta · rayon kurta · ethnic wear kurta

> SEO 5/5 · keyword coverage 33% · 120 words (target 120-180) · 5 bullets
> Fact check: **"handmade"** (Claim not supported by the product data; in bullet_points)
> Style: clean
> nvidia/nemotron-3-super-120b-a12b:free · 3900 in / 7987 out tokens · 67.8 s

### SKU-0037 · Trail Blaze (Apparel)

> **What to check:** Sparse running shoes: one feature, no specs, no brand. No invented cushioning tech, weight or drop.

- **Brand:** (none) · **Subcategory:** Running Shoes · **Price:** 2639 INR
- **Features:** Responsive foam midsole
- **Specifications:** (none)
- **Attributes:** sizes: UK 6, UK 7, UK 8, UK 9, UK 10; gender: Women; terrain: Treadmill
- **Seed keywords:** running shoes, lightweight trainers
- **Completeness:** 40/100 (sparse)

| Item | Title | Words | SEO | Facts | Style |
|---|---|---|---|---|---|
| SKU-0037-friendly | Trail Blaze Running Shoes for Women | 45 | 5/5 | clean | clean |

#### SKU-0037-friendly · friendly · nvidia/nemotron-3-super-120b-a12b:free

**Trail Blaze Running Shoes for Women** _(35 chars)_

_These women's running shoes feature a responsive foam midsole for a smooth ride on the treadmill. Available in UK sizes 6 to 10._

When you step onto the treadmill, these running shoes feel light underfoot thanks to their responsive foam midsole.

They are built for women and come in UK sizes 6 through 10. The responsive foam midsole gives a springy feel underfoot, ready for your treadmill runs.

- Responsive cushioning: foam midsole that feels springy underfoot
- Women's fit: built for women in UK sizes 6 to 10
- Treadmill ready: designed for treadmill running sessions

**Meta** _(153 chars)_: Running shoes for women with a responsive foam midsole, built for treadmill runs and available in UK sizes 6 to 10. Enjoy a springy feel with every step.

**Keywords:** running shoes · women's running shoes · treadmill running shoes · responsive foam shoes · UK size running shoes · running shoes for women

> SEO 5/5 · keyword coverage 50% · 45 words (target 40-70) · 3 bullets
> Fact check: clean
> Style: clean
> nvidia/nemotron-3-super-120b-a12b:free · 3871 in / 3664 out tokens · 30.9 s

### SKU-0011 · Matte Shield Sunscreen (Beauty & Personal Care)

> **What to check:** Seed keyword "sunscreen spf 50" contradicts SPF 30. Any SPF 50 in the copy is a serious error.

- **Brand:** Derma Lab · **Subcategory:** Sunscreen · **Price:** 859 INR
- **Features:** Works under makeup; Water resistant for 80 minutes; No white cast; Broad spectrum UVA and UVB protection; Non-greasy finish
- **Specifications:** SPF: SPF 30; PA: PA++++; Volume: 50 g; Texture: Cream
- **Attributes:** skin_type: Oily
- **Seed keywords:** sunscreen spf 50, sunscreen for oily skin
- **Completeness:** 100/100

| Item | Title | Words | SEO | Facts | Style |
|---|---|---|---|---|---|
| SKU-0011-friendly | Derma Lab Matte Shield Sunscreen for Oily Skin, SPF 30 | 155 | 5/5 | clean | clean |

#### SKU-0011-friendly · friendly · nvidia/nemotron-3-super-120b-a12b:free

**Derma Lab Matte Shield Sunscreen for Oily Skin, SPF 30** _(54 chars)_

_A matte-finish sunscreen that works under makeup, resists water for 80 minutes and leaves no white cast on oily skin._

When you smooth Derma Lab Matte Shield Sunscreen onto your face, it feels lightweight and blends instantly, giving a matte base that sits comfortably under makeup. This sunscreen for oily skin delivers broad-spectrum UVA and UVB protection with SPF 30 and the highest PA++++ rating, so it shields against both burning and ageing rays. The formula is water resistant for 80 minutes, leaving no white cast and a non-greasy finish that stays matte even in humidity.

Packed in a 50 g tube, the cream texture spreads easily and a little goes a long way, making it practical for daily use and travel. Because it works under makeup, you can apply it as the last step of your skincare routine and then layer foundation or powder without worrying about pilling or shine. Reapply after swimming, sweating or towel-drying to keep the protection steady, and enjoy the confidence of skin that looks fresh and protected all day.

- Matte finish: non-greasy cream that leaves no white cast
- Makeup friendly: works under makeup without pilling
- Water resistant: stays effective for 80 minutes of sweat or water
- Broad protection: SPF 30 and PA++++ guard against UVA and UVB
- Oily skin fit: specially formulated for oily skin type

**Meta** _(140 chars)_: Derma Lab Matte Shield Sunscreen for oily skin offers SPF 30, PA++++, water-resistant protection and a matte finish that works under makeup.

**Keywords:** sunscreen for oily skin · SPF 30 sunscreen · water resistant sunscreen · broad spectrum sunscreen · matte finish sunscreen · 50g sunscreen

> SEO 5/5 · keyword coverage 17% · 155 words (target 120-180) · 5 bullets
> Fact check: clean
> Style: clean
> nvidia/nemotron-3-super-120b-a12b:free · 3874 in / 4155 out tokens · 33.3 s

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
| SKU-0042-friendly | PureLeaf Hyaluronic Hydra Serum Face Serum, 30 ml | 143 | 5/5 | clean | 2 issues |

#### SKU-0042-friendly · friendly · nvidia/nemotron-3-super-120b-a12b:free

**PureLeaf Hyaluronic Hydra Serum Face Serum, 30 ml** _(49 chars)_

_A lightweight, fast-absorbing hyaluronic hydra serum with 10% vitamin C, perfect for daily use on oily, acne-prone skin. The dropper lets you apply just the right amount, mess-free._

When you press the dropper, a few drops of the PureLeaf Hyaluronic Hydra Serum glide onto your fingertips, feeling light and instantly sinking in. This face serum is designed for daily use, so you can reach for it each morning and night without fuss.

The lightweight, fast-absorbing formula delivers 10% vitamin C directly to oily and acne-prone skin, helping to brighten the look while staying non-greasy. Because it is fragrance-free, it layers well under moisturizer or makeup and won’t irritate sensitive areas. The glass dropper lets you measure the exact amount you need, keeping the bottle clean and the application mess-free.

Housed in a 30 ml bottle, the serum is cruelty-free, aligning with a kinder beauty routine. Its simple, no-nonsense package fits neatly on a vanity or in a travel pouch, ready whenever your skin needs a boost of hydration and vitamin C.

- Daily use: Suitable for daily use, morning and night.
- Lightweight feel: Lightweight, fast-absorbing formula sinks in quickly without grease.
- Mess-free dropper: Glass dropper lets you measure the exact amount for clean application.
- Fragrance-free: Fragrance-free formula layers well under moisturizer or makeup.
- Vitamin C boost: Contains 10% vitamin C to support oily, acne-prone skin.

**Meta** _(144 chars)_: Hyaluronic Hydra Serum is a lightweight, no fragrance face serum with 10% vitamin C, ideal for oily, acne-prone skin. Try the mess-free dropper.

**Keywords:** face serum · vitamin c face serum · 30 ml serum · fragrance free serum · cruelty free serum

> SEO 5/5 · keyword coverage 20% · 143 words (target 120-180) · 5 bullets
> Fact check: clean
> Style: cliche (perfect for); title_repeat (serum)
> nvidia/nemotron-3-super-120b-a12b:free · 3868 in / 7032 out tokens · 53.3 s

### SKU-0013 · Power Hitter (Sports & Fitness)

> **What to check:** Seed keyword "kashmir willow bat" contradicts the English willow spec. Beginner level, tennis ball.

- **Brand:** FlexCore · **Subcategory:** Cricket Bat · **Price:** 3119 INR
- **Features:** Pre-knocked and ready to play; Cane handle with shock absorption; Thick edges for big hitting
- **Specifications:** Willow: Grade 2 English willow; Weight: 1152 g; Size: Size 6; Grains: 8
- **Attributes:** level: Beginner; ball_type: Tennis ball
- **Seed keywords:** cricket bat, kashmir willow bat
- **Completeness:** 100/100

| Item | Title | Words | SEO | Facts | Style |
|---|---|---|---|---|---|
| SKU-0013-friendly | FlexCore Power Hitter Cricket Bat, Pre-Knocked Ready to Play | 129 | 5/5 | clean | clean |

#### SKU-0013-friendly · friendly · nvidia/nemotron-3-super-120b-a12b:free

**FlexCore Power Hitter Cricket Bat, Pre-Knocked Ready to Play** _(60 chars)_

_You get a pre-knocked bat ready to play, with a cane handle that absorbs shock and thick edges for big hitting._

When you pick up this FlexCore Power Hitter cricket bat, you notice it’s already knocked in and ready for the net or the park. It weighs 1152 g and comes in Size 6, made from Grade 2 English willow with 8 straight grains. The pre-knocked surface means you save time on knocking in and can focus on your shots from the first swing.

The cane handle is built to absorb shock, so each stroke feels steady even on a fast tennis ball. Thick edges give you a larger hitting area, which helps beginners play while they learn timing.

Because it’s labelled for beginner use and tennis-ball play, you can start practicing right away without extra preparation. The bat’s solid feel and clear grain pattern give you a traditional look.

- Ready to play: Pre-knocked and ready to play
- Shock-absorbing handle: Cane handle with shock absorption
- Big-hitting edges: Thick edges
- Grade 2 willow: Made from Grade 2 English willow with 8 straight grains
- Beginner friendly: Rated for beginner level and tennis-ball use

**Meta** _(150 chars)_: FlexCore Power Hitter cricket bat – pre-knocked, cane-handled shock absorption and thick edges for big hitting. Ready to play straight out of the box.

**Keywords:** cricket bat · english willow cricket bat · pre knocked cricket bat · cane handle cricket bat · beginner cricket bat · size 6 cricket bat

> SEO 5/5 · keyword coverage 17% · 129 words (target 120-180) · 5 bullets
> Fact check: clean
> Style: clean
> nvidia/nemotron-3-super-120b-a12b:free · 3864 in / 9806 out tokens · 83.2 s

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
| SKU-0060-friendly | IronPeak GripFlow Yoga Mat | 177 | 5/5 | clean | clean |

#### SKU-0060-friendly · friendly · nvidia/nemotron-3-super-120b-a12b:free

**IronPeak GripFlow Yoga Mat** _(26 chars)_

_The IronPeak GripFlow Yoga Mat gives you a non-slip surface and extra cushioning for joints, all in a lightweight design with a carry strap._

The IronPeak GripFlow Yoga Mat unrolls to a surface made from natural cork and rubber, giving it a firm yet yielding feel. When you place your hands or feet on the mat, the non-slip textured surface grips the floor, so you stay steady in each pose. Meanwhile, the extra cushioning built into the mat protects your joints, letting you hold kneeling or seated postures longer without discomfort. This blend of grip and support makes the mat feel reliable from the first stretch to the final savasana.

The mat measures 183 × 61 cm and is 8 mm thick, giving you ample space for full-length moves and a comfortable layer under body weight. At just 0.9 kg it is lightweight enough to carry to a class or park, and the built-in strap lets you sling it over your shoulder with ease. Available in Peach and Charcoal, it suits yoga, pilates, stretching or any low-impact exercise you prefer. Because the surface stays grippy and the cushioning stays even, you can count on the mat to perform session after session.

- Secure footing: non-slip textured surface stays put during practice.
- Joint protection: extra cushioning shields knees and wrists.
- Easy to carry: lightweight at 0.9 kg with a built-in carry strap.
- Full-size coverage: 183 × 61 cm gives ample space for poses.
- Natural feel: made from cork and rubber for a soft, supportive surface.

**Meta** _(135 chars)_: IronPeak GripFlow Yoga Mat - non-slip surface, extra joint cushioning, lightweight with carry strap. Ideal for home or studio practice.

**Keywords:** yoga mat · exercise mat · cork yoga mat · non slip yoga mat · lightweight yoga mat · yoga mat with strap

> SEO 5/5 · keyword coverage 17% · 177 words (target 120-180) · 5 bullets
> Fact check: clean
> Style: clean
> nvidia/nemotron-3-super-120b-a12b:free · 3860 in / 15908 out tokens · 128.0 s

### SKU-0014 · Tulsi Green Tea (Grocery & Gourmet)

> **What to check:** Seed keyword "organic green tea" is unsupported. "Rich in antioxidants" must not become a health promise.

- **Brand:** Himalayan Harvest · **Subcategory:** Green Tea · **Price:** 719 INR
- **Features:** Whole-leaf tea; Rich in antioxidants; Resealable pouch; No artificial flavours; Sourced from hill estates
- **Specifications:** Net weight: 250 g; Form: 50 tea bags; Shelf life: 18 months; Origin: Assam
- **Attributes:** diet: Vegan, Gluten-free
- **Seed keywords:** green tea, organic green tea
- **Completeness:** 100/100

| Item | Title | Words | SEO | Facts | Style |
|---|---|---|---|---|---|
| SKU-0014-friendly | Himalayan Harvest Tulsi Green Tea, Whole-leaf in Resealable Pouch | 153 | 5/5 | clean | 1 issues |

#### SKU-0014-friendly · friendly · nvidia/nemotron-3-super-120b-a12b:free

**Himalayan Harvest Tulsi Green Tea, Whole-leaf in Resealable Pouch** _(65 chars)_

_You’ll enjoy a cup of Himalayan Harvest Tulsi green tea made from whole-leaf leaves, rich in antioxidants and free of artificial flavours, packed in a resealable pouch for lasting freshness._

When you steep a spoonful of this Tulsi green tea, the aroma rises with hints of earthy basil and fresh grass. The whole-leaf tea bags unfurl slowly, releasing a smooth, amber-coloured brew that feels gentle on the palate. It’s a moment of calm you can reach for any time of day.

Each cup delivers the antioxidants naturally present in the leaves, supporting your daily wellbeing without any artificial flavours. The tea comes from hill estates in Assam, packed in a resealable pouch that keeps the 250 g of fifty tea bags fresh for up to 18 months. It’s also vegan and gluten-free, fitting a range of diets.

Brew one bag in hot water for two to three minutes, then enjoy it plain or with a slice of lemon. The convenient pouch lets you store the tea at home or take it to the office, so your favourite green tea is always within reach.

- Whole-leaf flavor: Tea bags contain whole-leaf tea for a smoother, richer brew.
- Antioxidant boost: Each cup delivers natural antioxidants from the leaves.
- Freshness lock: Resealable pouch keeps 250 g of fifty tea bags fresh for 18 months.
- Pure taste: No artificial flavours are added, letting the true tea shine.
- Assam source: Sourced from hill estates in Assam, the tea is vegan and gluten-free.

**Meta** _(143 chars)_: Himalayan Harvest Tulsi green tea offers whole-leaf flavor, antioxidant richness and a resealable pouch for fresh, flavoursome cups every time.

**Keywords:** green tea · tulsi green tea · whole leaf tea · resealable tea pouch · assam green tea

> SEO 5/5 · keyword coverage 40% · 153 words (target 120-180) · 5 bullets
> Fact check: clean
> Style: keyword_stuffing ("tulsi green tea" 3 times)
> nvidia/nemotron-3-super-120b-a12b:free · 3874 in / 5120 out tokens · 41.2 s
