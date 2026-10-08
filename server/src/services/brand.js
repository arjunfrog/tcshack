// The retailer's brand profile from onboarding, in the shape generation uses. Attached
// server-side to every catalog generation, so the whole catalog sounds like one brand.

const splitWords = (text) =>
  String(text ?? '')
    .split(/[,;\n]/)
    .map((word) => word.trim())
    .filter(Boolean);

export function brandProfile(retailer) {
  if (!retailer) return undefined;
  const profile = {
    personality: retailer.brand_personality ?? [],
    target_customer: retailer.target_customer || undefined,
    price_positioning: retailer.price_positioning || undefined,
    admired_brands: retailer.admired_brands || undefined,
    avoid_words: splitWords(retailer.words_to_avoid),
  };
  const empty = !profile.personality.length && !profile.target_customer && !profile.price_positioning && !profile.admired_brands && !profile.avoid_words.length;
  return empty ? undefined : profile;
}
