import { z } from 'zod';

export const SELLER_TYPES = ['existing', 'new'];
export const CHANNELS = ['amazon', 'flipkart', 'meesho', 'myntra', 'nykaa', 'shopify', 'website', 'offline', 'other'];
export const PRICE_POSITIONING = ['budget', 'mid', 'premium'];

const optionalText = (max) => z.string().trim().max(max).optional().transform((value) => value || null);

// What the onboarding form submits.
export const RetailerInput = z
  .object({
    business_name: z.string().trim().min(1, 'Business name is required').max(120),
    seller_type: z.enum(SELLER_TYPES),
    channels: z.array(z.enum(CHANNELS)).default([]),
    store_url: z.union([z.literal(''), z.url('Store URL must be a full link, e.g. https://yourstore.com')]).optional()
      .transform((value) => value || null),
    categories: z.array(z.string().trim().min(1).max(60)).min(1, 'Pick at least one category').max(20),
    target_customer: optionalText(300),
    price_positioning: z.enum(PRICE_POSITIONING),
    brand_personality: z.array(z.string().trim().min(1).max(30)).max(5).default([]),
    admired_brands: optionalText(300),
    words_to_avoid: optionalText(300),
  })
  .refine((retailer) => retailer.seller_type === 'new' || retailer.channels.length > 0, {
    message: 'Pick at least one place you sell today',
    path: ['channels'],
  });
