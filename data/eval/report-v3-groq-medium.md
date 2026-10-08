# Eval report

2026-10-08 08:50 UTC · provider `groq` · length `medium` · tones: friendly · prompt version `45980aed`

Read each output against its product data, then fill in `ratings.csv` (relevance and creativity, 1-5) and run `npm run eval -- ratings ratings.csv`. Phase 1 is done when 80% or more of outputs score 4 or 5 on both and the fact check flags nothing.

## Summary

| Config | OK | Errors | SEO checks passed | Keyword coverage | Fact check clean | Flags | Style clean | Words in range | Avg latency | Avg tokens in / out | Total cost |
|---|---|---|---|---|---|---|---|---|---|---|---|
| openai/gpt-oss-120b, effort medium | 12/15 | 3 | 95% | 26% | 100% | 0 | 58% | 100% | 33.1 s | 3675 / 2880 | unknown |

## Style issues

| Issue | Outputs | Examples |
|---|---|---|
| cliche | 5 | whether you · whether you · whether you |

## Fact-check flags

None.

## Errors

| Item | Error |
|---|---|
| SKU-0054-friendly | LLM request failed (413): Request too large for model `openai/gpt-oss-120b` in organization `org_01krc57wrkfhes6v57bx4g5wpj` service tier `on_demand` on tokens per minute (TPM): Limit 8000, Requested 8208, please reduce your message size and try again. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing |
| SKU-0007-friendly | LLM request failed (413): Request too large for model `openai/gpt-oss-120b` in organization `org_01krc57wrkfhes6v57bx4g5wpj` service tier `on_demand` on tokens per minute (TPM): Limit 8000, Requested 8181, please reduce your message size and try again. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing |
| SKU-0042-friendly | LLM request failed (413): Request too large for model `openai/gpt-oss-120b` in organization `org_01krc57wrkfhes6v57bx4g5wpj` service tier `on_demand` on tokens per minute (TPM): Limit 8000, Requested 8176, please reduce your message size and try again. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing |

## Outputs

### SKU-0001 · AirFlow Pro (Electronics)

> **What to check:** Sparse: one feature, no specs, no brand. Copy should be short and invent no battery life, codec or rating.

- **Brand:** (none) · **Subcategory:** Wireless Earbuds · **Price:** 7039 INR
- **Features:** Touch controls
- **Specifications:** (none)
- **Attributes:** colors: Sage Green, Ocean Blue
- **Seed keywords:** wireless earbuds, bluetooth earphones
- **Completeness:** 40/100 (sparse)

| Item | Title | Words | SEO | Facts | Style |
|---|---|---|---|---|---|
| SKU-0001-friendly | AirFlow Pro Wireless Earbuds, Touch Controls, Sage Green & Ocean Blue | 53 | 5/5 | clean | clean |

#### SKU-0001-friendly · friendly · openai/gpt-oss-120b, effort medium

**AirFlow Pro Wireless Earbuds, Touch Controls, Sage Green & Ocean Blue** _(69 chars)_

_Enjoy simple touch controls and vibrant Sage Green or Ocean Blue colour options with the AirFlow Pro wireless earbuds._

A tap on the AirFlow Pro earbuds instantly plays, pauses or skips your favourite tracks. These wireless earbuds let you stay hands-free while the smooth Sage Green or cool Ocean Blue finish adds a splash of style. Touch controls mean you never need to fumble with your phone during a workout or commute.

- Easy tap control: touch controls manage play, pause and skip
- Hands-free listening: wireless earbuds stay connected without cords
- Colour choice: available in Sage Green and Ocean Blue

**Meta** _(136 chars)_: AirFlow Pro wireless earbuds with touch controls and stylish Sage Green or Ocean Blue colours – tap to play, pause or skip effortlessly.

**Keywords:** wireless earbuds · bluetooth earphones · touch control earbuds · sage green earbuds · ocean blue earbuds

> SEO 5/5 · keyword coverage 20% · 53 words (target 40-70) · 3 bullets
> Fact check: clean
> Style: clean
> openai/gpt-oss-120b · 3655 in / 1657 out tokens · 4.5 s

### SKU-0033 · AirFlow Pro (Electronics)

> **What to check:** Feature-rich earbuds. IPX5 is sweat resistance: watch for "waterproof". Uses 38 hours, 13 mm, Bluetooth 5.3 exactly?

- **Brand:** Sonora · **Subcategory:** Wireless Earbuds · **Price:** 2549 INR
- **Features:** Active noise cancellation; Low-latency gaming mode; IPX5 sweat resistance; Touch controls; Dual-device pairing
- **Specifications:** Battery life: 38 hours with case; Driver size: 13 mm; Bluetooth: 5.3; Weight: 4 g per bud
- **Attributes:** colors: Midnight Black, Pearl White
- **Seed keywords:** noise cancelling earbuds, bluetooth earphones
- **Completeness:** 100/100

| Item | Title | Words | SEO | Facts | Style |
|---|---|---|---|---|---|
| SKU-0033-friendly | Sonora AirFlow Pro Noise Cancelling Earbuds, Active ANC & Gaming Mode | 144 | 4/5 | clean | 1 issues |

#### SKU-0033-friendly · friendly · openai/gpt-oss-120b, effort medium

**Sonora AirFlow Pro Noise Cancelling Earbuds, Active ANC & Gaming Mode** _(69 chars)_

_These Sonora AirFlow Pro noise cancelling earbuds deliver active ANC, low-latency gaming mode, IPX5 sweat resistance and up to 38 hours of playtime, all in a lightweight 4 g design._

The Sonora AirFlow Pro noise cancelling earbuds let you drift into your music while the world fades away. With active noise cancellation and a low-latency gaming mode, you stay focused whether you’re on a call, in a playlist, or battling online.

Enjoy up to 38 hours of playtime with the charging case, and each earbud weighs just 4 g, so they feel barely there. The 13 mm drivers deliver clear sound, while IPX5 sweat resistance keeps them safe during workouts. Touch controls let you pause, skip or answer calls with a tap, and dual-device pairing means you can hop between your phone and laptop without re-pairing.

Choose between Midnight Black or Pearl White to match your style, and stay connected with Bluetooth 5.3 for a stable link. Whether you’re commuting, exercising, or gaming, these earbuds give you the freedom to move and hear clearly.

- Long-lasting power: 38 hours of playback with charging case
- Active noise cancellation: blocks ambient sound for immersive listening
- Low-latency gaming mode: smooth audio sync during play
- Sweat-proof design: IPX5 resistance for workouts
- Touch control & dual pairing: easy commands and switch between devices

**Meta** _(163 chars)_: Experience Sonora AirFlow Pro noise cancelling earbuds with 38-hour battery, IPX5 sweat resistance and low-latency gaming mode – perfect for music, calls and play.

**Keywords:** noise cancelling earbuds · bluetooth earphones · wireless earbuds · sonora earbuds · gaming earbuds · sweat resistant earbuds · touch control earbuds

> SEO 4/5 (failed: meta_length_ok) · keyword coverage 14% · 144 words (target 120-180) · 5 bullets
> Fact check: clean
> Style: cliche (whether you)
> openai/gpt-oss-120b · 3689 in / 2590 out tokens · 15.3 s

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
| SKU-0018-friendly | Voltix Orbit Fit Smartwatch With Calling, GPS, 5 ATM Water Resistance | 153 | 5/5 | clean | clean |

#### SKU-0018-friendly · friendly · openai/gpt-oss-120b, effort medium

**Voltix Orbit Fit Smartwatch With Calling, GPS, 5 ATM Water Resistance** _(69 chars)_

_A smartwatch with calling that lets you answer calls, track routes with GPS, and stay active with 100+ sports modes, all backed by 5 ATM water resistance._

The moment you fasten the metal mesh strap, the 2.01-inch AMOLED display lights up with vivid colours, making the Orbit Fit feel like a piece of tech jewellery. This smartwatch with calling lets you pick up a call straight from your wrist, so you never have to fumble for your phone during a workout or a meeting. Built-in GPS maps your routes without needing a phone, and the 5 ATM water resistance means rain or a swim won’t slow you down.

You’ll enjoy up to 12 days of battery life on a single charge, keeping the watch on through work weeks and weekend adventures. With more than 100 sports modes, it acts as a fitness tracker that records everything from cycling to yoga, and all data syncs smoothly with Android and iOS devices. Notifications, music control and health stats appear on the crisp screen, so you stay informed without reaching for your phone.

- Answer calls hands-free: Bluetooth calling lets you speak directly from the watch
- Never miss a turn: Built-in GPS maps routes, making it a reliable GPS smartwatch
- All-day endurance: Up to 12 days of battery life on a single charge
- Stay active: Over 100 sports modes monitor a wide range of workouts
- Ready for any splash: 5 ATM water resistance protects this metal mesh strap smartwatch

**Meta** _(154 chars)_: Voltix Orbit Fit smartwatch with calling offers GPS, 5 ATM water resistance and up to 12 days battery, perfect for staying connected and tracking fitness.

**Keywords:** smartwatch with calling · fitness tracker · 5 ATM smartwatch · GPS smartwatch · metal mesh strap smartwatch · Voltix smartwatch

> SEO 5/5 · keyword coverage 67% · 153 words (target 120-180) · 5 bullets
> Fact check: clean
> Style: clean
> openai/gpt-oss-120b · 3686 in / 4492 out tokens · 57.6 s

### SKU-0054 · Chikankari Straight Kurta (Apparel)

> **What to check:** Seed keyword "cotton kurta" contradicts the Rayon fabric. It should be dropped, not used.

- **Brand:** Loomcraft · **Subcategory:** Kurta · **Price:** 2559 INR
- **Features:** Comes with matching dupatta; Breathable natural fabric; Three-quarter sleeves; Side slits for easy movement; Hand-finished embroidery
- **Specifications:** Fabric: Rayon; Length: Calf length; Neck: Mandarin; Care: Dry clean only
- **Attributes:** sizes: XS, S, M, L, XL; occasion: Office; gender: Women
- **Seed keywords:** cotton kurta, ethnic wear

| Item | Title | Words | SEO | Facts | Style |
|---|---|---|---|---|---|
| SKU-0054-friendly | error |  |  |  |  |

#### SKU-0054-friendly · friendly · openai/gpt-oss-120b, effort medium

**Error:** LLM request failed (413): Request too large for model `openai/gpt-oss-120b` in organization `org_01krc57wrkfhes6v57bx4g5wpj` service tier `on_demand` on tokens per minute (TPM): Limit 8000, Requested 8208, please reduce your message size and try again. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing

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
| SKU-0037-friendly | Trail Blaze Women’s Running Shoes, Responsive Foam Midsole | 55 | 5/5 | clean | clean |

#### SKU-0037-friendly · friendly · openai/gpt-oss-120b, effort medium

**Trail Blaze Women’s Running Shoes, Responsive Foam Midsole** _(58 chars)_

_These Trail Blaze women’s running shoes feature a responsive foam midsole for smooth treadmill runs and come in UK sizes 6 to 10._

Feel the spring in every step with the responsive foam midsole of the Trail Blaze women’s running shoes, giving you a smooth ride on the treadmill. Designed for women, they fit UK sizes 6 through 10, so you’ll find the right match without hassle. The sleek silhouette keeps you looking fresh while you log miles.

- Responsive comfort: foam midsole cushions each stride
- Perfect fit: UK sizes 6 to 10 for women
- Treadmill ready: smooth ride on indoor tracks

**Meta** _(127 chars)_: Explore Trail Blaze women’s running shoes with a responsive foam midsole for smooth treadmill runs, available in UK sizes 6-10.

**Keywords:** running shoes · women's running shoes · treadmill running shoes · responsive foam shoes · UK size running shoes · lightweight trainers

> SEO 5/5 · keyword coverage 17% · 55 words (target 40-70) · 3 bullets
> Fact check: clean
> Style: clean
> openai/gpt-oss-120b · 3688 in / 1913 out tokens · 4.8 s

### SKU-0007 · CrispAir 4L (Home & Kitchen)

> **What to check:** Name says 4L but the capacity spec is 5.5 L. Copy should use 5.5 L, not present 4 litres as the capacity.

- **Brand:** Casa Nova · **Subcategory:** Air Fryer · **Price:** 7189 INR
- **Features:** Auto shut-off; Up to 90% less oil than deep frying; Dishwasher-safe non-stick basket; Digital touch panel with 8 presets
- **Specifications:** Capacity: 5.5 L; Power: 1200 W; Temperature range: 80-200 °C; Warranty: 1 year
- **Attributes:** colors: Black
- **Seed keywords:** digital air fryer, oil free fryer

| Item | Title | Words | SEO | Facts | Style |
|---|---|---|---|---|---|
| SKU-0007-friendly | error |  |  |  |  |

#### SKU-0007-friendly · friendly · openai/gpt-oss-120b, effort medium

**Error:** LLM request failed (413): Request too large for model `openai/gpt-oss-120b` in organization `org_01krc57wrkfhes6v57bx4g5wpj` service tier `on_demand` on tokens per minute (TPM): Limit 8000, Requested 8181, please reduce your message size and try again. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing

### SKU-0008 · Percale Comfort Set (Home & Kitchen)

> **What to check:** Seed keyword "cotton bedsheet" contradicts the Microfibre material. "Two pillow covers" is fine.

- **Brand:** HearthWare · **Subcategory:** Bedsheet Set · **Price:** 1889 INR
- **Features:** Includes two pillow covers; Soft, breathable weave; Fade-resistant colours
- **Specifications:** Thread count: 180 TC; Material: Microfibre; Size: Queen; Contents: 1 bedsheet, 2 pillow covers
- **Attributes:** pattern: Stripes; colors: Ivory, Indigo
- **Seed keywords:** double bedsheet with pillow covers, cotton bedsheet
- **Completeness:** 100/100

| Item | Title | Words | SEO | Facts | Style |
|---|---|---|---|---|---|
| SKU-0008-friendly | HearthWare Percale Comfort Queen Bedsheet Set with Pillow Covers | 124 | 5/5 | clean | 1 issues |

#### SKU-0008-friendly · friendly · openai/gpt-oss-120b, effort medium

**HearthWare Percale Comfort Queen Bedsheet Set with Pillow Covers** _(64 chars)_

_Enjoy soft, breathable microfibre sheets with fade-resistant ivory-indigo stripes, plus two matching pillow covers – a complete queen set for cozy nights._

The soft, breathable weave of the microfibre feels gentle against the skin, while the ivory and indigo stripes add a calm, stylish touch. As a queen bedsheet set, it offers a generous 180 TC count that balances smoothness with durability, making nightly comfort effortless.

The fade-resistant colours stay vivid wash after wash, and the set comes with two matching pillow covers for a coordinated look. It’s a queen bedsheet with pillow covers that match the striped design.

Whether you’re curling up with a good book or drifting to sleep, the breathable fabric helps regulate temperature, keeping you cool in summer and cosy in winter. The striped pattern adds a subtle decorative accent to any bedroom décor, making the set a practical yet stylish upgrade.

- Soft breathable feel: microfibre weave with 180 TC
- Stylish stripes: ivory and indigo fade-resistant colours
- Complete set: 1 bedsheet and 2 pillow covers
- Easy care: tumble dry low, colours stay vivid
- Temperature regulation: breathable fabric keeps you cool or cosy

**Meta** _(147 chars)_: HearthWare queen bedsheet set offers soft microfibre, fade-resistant ivory-indigo stripes and matching pillow covers for breathable, stylish sleep.

**Keywords:** queen bedsheet set · bedsheet with pillow covers · microfibre bedsheet · striped bedsheet · fade resistant bedsheet · queen size bedding

> SEO 5/5 · keyword coverage 33% · 124 words (target 120-180) · 5 bullets
> Fact check: clean
> Style: cliche (whether you)
> openai/gpt-oss-120b · 3687 in / 4291 out tokens · 9.6 s

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
| SKU-0011-friendly | Derma Lab Matte Shield Sunscreen SPF 30, Non-Greasy Finish | 123 | 5/5 | clean | clean |

#### SKU-0011-friendly · friendly · openai/gpt-oss-120b, effort medium

**Derma Lab Matte Shield Sunscreen SPF 30, Non-Greasy Finish** _(58 chars)_

_Enjoy a lightweight, non-greasy sunscreen that stays invisible under makeup, resists water for 80 minutes and protects oily skin with SPF 30 and PA++++ broad-spectrum coverage._

A creamy, non-greasy veil glides over your skin, leaving no white cast and feeling feather-light under makeup. This Derma Lab Matte Shield Sunscreen SPF 30 delivers broad-spectrum UVA and UVB protection with a PA++++ rating, packed in a 50 g cream tube. The smooth texture lets you apply it quickly, and because it stays invisible, your foundation looks flawless all day.

Designed for oily skin, the formula controls shine while keeping your skin safe from sun damage. It resists water for up to 80 minutes, so a quick splash or a sweaty workout won’t wash the protection away. With its lightweight finish you can reapply throughout the day daily without feeling heavy, making it a reliable companion for outdoor errands or beach trips.

- Invisible under makeup: no white cast and non-greasy finish
- Strong sun defence: SPF 30 and PA++++ broad-spectrum protection
- Water resistant: stays effective for 80 minutes
- Oil-control formula: suited for oily skin
- Lightweight cream: 50 g tube feels feather-light

**Meta** _(140 chars)_: Derma Lab Matte Shield Sunscreen SPF 30 offers a non-greasy, no-white-cast formula that stays on oily skin and resists water for 80 minutes.

**Keywords:** sunscreen SPF 30 · sunscreen for oily skin · non greasy sunscreen · water resistant sunscreen · broad spectrum sunscreen · SPF 30 cream · matte sunscreen

> SEO 5/5 · keyword coverage 14% · 123 words (target 120-180) · 5 bullets
> Fact check: clean
> Style: clean
> openai/gpt-oss-120b · 3689 in / 2724 out tokens · 48.7 s

### SKU-0042 · Hyaluronic Hydra Serum (Beauty & Personal Care)

> **What to check:** Name says Hyaluronic but the key ingredient is 10% Vitamin C. Copy must not claim hyaluronic acid.

- **Brand:** PureLeaf · **Subcategory:** Face Serum · **Price:** 929 INR
- **Features:** Suitable for daily use; Lightweight, fast-absorbing formula; Dropper for mess-free application; Fragrance-free
- **Specifications:** Volume: 30 ml; Key ingredient: 10% Vitamin C; Skin type: Oily and acne-prone
- **Attributes:** concern: Dehydration; cruelty_free: true
- **Seed keywords:** face serum, serum for glowing skin

| Item | Title | Words | SEO | Facts | Style |
|---|---|---|---|---|---|
| SKU-0042-friendly | error |  |  |  |  |

#### SKU-0042-friendly · friendly · openai/gpt-oss-120b, effort medium

**Error:** LLM request failed (413): Request too large for model `openai/gpt-oss-120b` in organization `org_01krc57wrkfhes6v57bx4g5wpj` service tier `on_demand` on tokens per minute (TPM): Limit 8000, Requested 8176, please reduce your message size and try again. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing

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
| SKU-0013-friendly | FlexCore Power Hitter Cricket Bat, Pre-Knocked, Shock-Absorbing Cane Handle | 149 | 4/5 | clean | clean |

#### SKU-0013-friendly · friendly · openai/gpt-oss-120b, effort medium

**FlexCore Power Hitter Cricket Bat, Pre-Knocked, Shock-Absorbing Cane Handle** _(75 chars)_

_Ready to swing straight out of the box, the FlexCore Power Hitter cricket bat features a shock-absorbing cane handle, thick edges for big hits and Grade 2 English willow for solid performance._

The first thing you notice about this cricket bat is its pre-knocked readiness – there’s no need for any extra preparation before you step onto the pitch. Weighing 1152 g and sized at a comfortable Size 6, it feels balanced in your hands, making it ideal for beginners who practice with a tennis ball. The eight-grain construction adds a solid feel without being too heavy, so you can swing confidently from the first over.

What sets the Power Hitter apart is its cane handle designed with shock absorption, so every impact is softened and your wrists stay comfortable during long sessions. Thick edges give you extra surface area for big hitting, helping you send the ball farther with less effort. Crafted from Grade 2 English willow, the bat offers a reliable grain structure that holds up well as you develop your technique, giving you confidence to play more aggressively.

- Ready to play: pre-knocked and usable straight out of the box
- Comfortable swing: 1152 g weight and Size 6 for balanced handling
- Shock-absorbing handle: cane construction reduces impact on wrists
- Big-hit edges: thick edges give extra surface for powerful strokes
- Beginner friendly: Grade 2 English willow and eight grains suit tennis-ball play

**Meta** _(155 chars)_: FlexCore Power Hitter cricket bat is pre-knocked, lightweight and features a shock-absorbing cane handle, perfect for beginners playing with a tennis ball.

**Keywords:** cricket bat · English willow cricket bat · cane handle cricket bat · beginner cricket bat · tennis ball cricket bat · pre-knocked cricket bat

> SEO 4/5 (failed: title_length_ok) · keyword coverage 17% · 149 words (target 120-180) · 5 bullets
> Fact check: clean
> Style: clean
> openai/gpt-oss-120b · 3683 in / 2855 out tokens · 6.7 s

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
| SKU-0060-friendly | IronPeak GripFlow Exercise Mat, 8mm Cork & Rubber, Non-Slip | 140 | 5/5 | clean | 1 issues |

#### SKU-0060-friendly · friendly · openai/gpt-oss-120b, effort medium

**IronPeak GripFlow Exercise Mat, 8mm Cork & Rubber, Non-Slip** _(59 chars)_

_Enjoy stable, cushioned practice on the 8 mm GripFlow exercise mat, featuring a non-slip cork-rubber surface and a handy carry strap for easy transport._

The GripFlow exercise mat feels firm yet gentle underfoot, thanks to its 8 mm thick natural cork and rubber construction. Its non-slip textured surface keeps you steady during every pose, while the generous 183 × 61 cm area gives plenty of room to stretch. Choose a soft peach or sleek charcoal finish to match your studio style.

Extra cushioning protects your joints, making longer sessions comfortable, and the mat weighs only 0.9 kg, so you can roll it up and carry it with the built-in strap. Whether you’re practicing yoga or a high-intensity workout, the lightweight design lets you set up quickly and store it without hassle.

The natural cork also offers antimicrobial properties, so the mat stays fresh between sessions. Simply wipe with a damp cloth after use, and the durable rubber base resists wear, ready for daily practice.

- Secure grip: non-slip textured surface
- Joint comfort: 8 mm extra cushioning
- Easy transport: lightweight 0.9 kg with built-in carry strap
- Spacious area: 183 × 61 cm dimensions
- Natural feel: cork and rubber material

**Meta** _(137 chars)_: IronPeak GripFlow exercise mat offers 8 mm cork-rubber cushioning, non-slip texture and a carry strap for comfortable, portable workouts.

**Keywords:** exercise mat · yoga mat · cork yoga mat · non slip yoga mat · lightweight yoga mat · extra cushioning mat · portable yoga mat

> SEO 5/5 · keyword coverage 14% · 140 words (target 120-180) · 5 bullets
> Fact check: clean
> Style: cliche (whether you)
> openai/gpt-oss-120b · 3673 in / 2820 out tokens · 49.0 s

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
| SKU-0014-friendly | Himalayan Harvest Tulsi Green Tea, Whole-leaf | 124 | 5/5 | clean | clean |

#### SKU-0014-friendly · friendly · openai/gpt-oss-120b, effort medium

**Himalayan Harvest Tulsi Green Tea, Whole-leaf** _(45 chars)_

_Enjoy Himalayan Harvest Tulsi Green Tea – whole-leaf, vegan and gluten-free, packed in a resealable pouch with 50 tea bags, free from artificial flavours and sourced from hill estates._

Whole-leaf tea from hill estates in Assam gives this green tea a fresh, herbaceous aroma that fills the cup with natural brightness. Each resealable pouch holds 50 individually sealed tea bags, making it easy to brew a cup at home or on the go. The blend is vegan and gluten-free, and contains no artificial flavours, so you enjoy a pure taste every time.

The tea’s antioxidant profile adds a subtle health boost, while the 18-month shelf life ensures freshness long after purchase. Simply steep one bag in hot water for two minutes to release the full flavour, then savour the lingering notes of tulsi and green tea leaves. Ideal for morning rituals or afternoon pauses, it brings a calm, revitalising moment to any day.

- Whole-leaf freshness: harvested from hill estates in Assam
- Convenient packaging: resealable pouch with 50 tea bags
- Pure taste: no artificial flavours
- Vegan & gluten-free: suitable for plant-based diets
- Long shelf life: 18 months from pack date

**Meta** _(153 chars)_: Himalayan Harvest Tulsi Green Tea delivers whole-leaf, vegan green tea in a resealable pouch – antioxidant-rich, no artificial flavours, fresh pure brew.

**Keywords:** green tea · tulsi green tea · vegan green tea · gluten free tea · whole leaf green tea · hill estate tea

> SEO 5/5 · keyword coverage 33% · 124 words (target 120-180) · 5 bullets
> Fact check: clean
> Style: clean
> openai/gpt-oss-120b · 3685 in / 3841 out tokens · 50.9 s

### SKU-0047 · Sea Salt Almond Dark (Grocery & Gourmet)

> **What to check:** Sparse chocolate with "healthy chocolate" seed keyword: no health claims, no invented cocoa %.

- **Brand:** (none) · **Subcategory:** Dark Chocolate · **Price:** 369 INR
- **Features:** Small-batch production
- **Specifications:** (none)
- **Attributes:** diet: Vegan; gift_ready: false
- **Seed keywords:** healthy chocolate, craft chocolate
- **Completeness:** 40/100 (sparse)

| Item | Title | Words | SEO | Facts | Style |
|---|---|---|---|---|---|
| SKU-0047-friendly | Sea Salt Dark Chocolate with Almond, Small-Batch Vegan | 52 | 5/5 | clean | 2 issues |

#### SKU-0047-friendly · friendly · openai/gpt-oss-120b, effort medium

**Sea Salt Dark Chocolate with Almond, Small-Batch Vegan** _(54 chars)_

_A vegan dark chocolate made in small batches, packed with crunchy almonds and a hint of sea salt for a satisfying bite._

The bite of this sea salt dark chocolate reveals crunchy almonds and a whisper of sea salt, all crafted in small batches. Its smooth cocoa base stays creamy while the almond pieces add texture, and the vegan recipe means no dairy. Perfect for a quick indulgence that feels both rich and thoughtful.

- Small-Batch Quality: Crafted in small batches for fresh flavor
- Vegan Friendly: Contains no dairy ingredients
- Crunchy Almonds: Includes almond pieces for texture

**Meta** _(152 chars)_: Enjoy Sea Salt Dark Chocolate with almond – a vegan, small-batch treat that offers creamy cocoa and a salty crunch, perfect for a guilt-free indulgence.

**Keywords:** sea salt dark chocolate · vegan dark chocolate · almond chocolate · small batch chocolate · gourmet vegan chocolate · dark chocolate snack

> SEO 5/5 · keyword coverage 33% · 52 words (target 40-70) · 3 bullets
> Fact check: clean
> Style: cliche (indulge); cliche (perfect for)
> openai/gpt-oss-120b · 3656 in / 2171 out tokens · 53.3 s

### SKU-0016 · Mini Engineers Kit (Toys & Baby)

> **What to check:** Toy with age (6+ years), 500 pieces and BIS certification. Safety copy must stick to the data.

- **Brand:** Playloop · **Subcategory:** Building Blocks · **Price:** 3029 INR
- **Features:** Compatible with major brick brands; Builds fine motor skills; Non-toxic, BPA-free plastic
- **Specifications:** Pieces: 500; Recommended age: 6+ years; Material: ABS plastic; Certification: BIS certified
- **Attributes:** theme: Space
- **Seed keywords:** building blocks, educational toys
- **Completeness:** 100/100

| Item | Title | Words | SEO | Facts | Style |
|---|---|---|---|---|---|
| SKU-0016-friendly | Playloop Mini Engineers Kit Building Blocks, Space Theme | 147 | 5/5 | clean | 1 issues |

#### SKU-0016-friendly · friendly · openai/gpt-oss-120b, effort medium

**Playloop Mini Engineers Kit Building Blocks, Space Theme** _(56 chars)_

_A 500-piece space-themed building-blocks set that fits with major brick brands, helps develop fine motor skills, and is made from non-toxic BPA-free plastic._

The moment you open the Playloop Mini Engineers Kit, the bright space-themed pieces spill out, inviting imagination and hours of building blocks fun. With 500 sturdy ABS plastic elements, you can snap together rockets, satellites and alien bases, all while the pieces click together just like the bricks you already own.

Because the blocks are compatible with major brick brands, they blend seamlessly into any existing collection, giving you endless possibilities without buying extra sets. The design encourages fine motor skill development, and the BPA-free, non-toxic plastic meets BIS certification, so parents can feel confident about safety for kids aged six and up.

You’ll love watching your child create their own space missions, then easily store the colourful pieces back into the handy box that comes with the kit. Whether building alone or sharing with friends, the Mini Engineers Kit turns playtime into a creative learning adventure.

- Compatible play: works with major brick brands
- Motor skill boost: builds fine motor skills
- Safe material: non-toxic BPA-free ABS plastic
- Large set: 500 pieces for endless builds
- Kid-friendly age: suitable for 6+ years

**Meta** _(147 chars)_: Playloop Mini Engineers Kit building blocks set offers 500 space-themed pieces, BPA-free safety and compatibility with major brick brands for play.

**Keywords:** building blocks · space building blocks · educational toys · BIS certified toys · 500 piece building set · compatible brick toys · fine motor skill toys

> SEO 5/5 · keyword coverage 14% · 147 words (target 120-180) · 5 bullets
> Fact check: clean
> Style: cliche (seamless)
> openai/gpt-oss-120b · 3662 in / 3248 out tokens · 46.2 s

### SKU-0048 · Mini Engineers Kit (Toys & Baby)

> **What to check:** Sparse building blocks: no age range in the data, so the copy must not invent one.

- **Brand:** (none) · **Subcategory:** Building Blocks · **Price:** 1399 INR
- **Features:** Compatible with major brick brands
- **Specifications:** (none)
- **Attributes:** theme: Vehicles
- **Seed keywords:** building blocks, educational toys
- **Completeness:** 40/100 (sparse)

| Item | Title | Words | SEO | Facts | Style |
|---|---|---|---|---|---|
| SKU-0048-friendly | Mini Engineers Kit Building Blocks Set – Vehicles Theme | 56 | 4/5 | clean | clean |

#### SKU-0048-friendly · friendly · openai/gpt-oss-120b, effort medium

**Mini Engineers Kit Building Blocks Set – Vehicles Theme** _(55 chars)_

_A friendly building blocks kit that works with major brick brands, letting kids create vehicle models like cars, trucks and buses._

You’ll love that the Mini Engineers Kit building blocks snap together with the same bricks you already own, because it’s compatible with major brick brands. The set is themed around vehicles, so little engineers can build cars, trucks and buses right out of the box. It’s a simple way to expand play without buying new pieces.

- Easy compatibility: works with major brick brands
- Vehicle theme: lets kids build cars, trucks and buses
- No extra bricks needed: expands play with existing pieces

**Meta** _(167 chars)_: Mini Engineers Kit building blocks set is compatible with major brick brands and features a vehicles theme, letting kids expand play with the pieces they already have.

**Keywords:** building blocks · vehicle building blocks · compatible brick toys · building blocks set · kids construction toys · educational building blocks

> SEO 4/5 (failed: meta_length_ok) · keyword coverage 33% · 56 words (target 40-70) · 3 bullets
> Fact check: clean
> Style: clean
> openai/gpt-oss-120b · 3646 in / 1961 out tokens · 50.8 s
