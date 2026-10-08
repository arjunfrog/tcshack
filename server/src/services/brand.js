// The retailer's brand profile from onboarding, in the shape generation uses. Attached
// server-side to every catalog generation, so the whole catalog sounds like one brand.

const splitWords = (text) =>
  String(text ?? '')
    .split(/[,;\n]/)
    .map((word) => word.trim())
    .filter(Boolean);

export function brandProfile(retailer) {
  if (!retailer) return undefined;
  return {
    seller: retailer.business_name || undefined,
    personality: retailer.brand_personality ?? [],
    target_customer: retailer.target_customer || undefined,
    price_positioning: retailer.price_positioning || undefined,
    avoid_words: splitWords(retailer.words_to_avoid),
  };
}
