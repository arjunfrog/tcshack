import { z } from 'zod';

// What a product looks like coming in (form, JSON upload, CSV row, synthetic data).
export const ProductInput = z.object({
  sku: z.string().trim().optional(),
  name: z.string().trim().min(1, 'name is required'),
  category: z.string().trim().min(1, 'category is required'),
  subcategory: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  price: z.coerce.number().nonnegative().optional(),
  currency: z.string().trim().default('INR'),
  features: z.array(z.string().trim().min(1)).default([]),
  specifications: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  // Free-form extras: colors, materials, sizes, target audience, occasion...
  attributes: z.record(z.string(), z.unknown()).default({}),
  image_url: z.string().trim().optional(),
  seed_keywords: z.array(z.string().trim().min(1)).default([]),
});

export const TONES = ['professional', 'friendly', 'luxury', 'playful', 'technical', 'minimal'];
export const LENGTHS = ['short', 'medium', 'long'];

export const GenerationOptions = z.object({
  tone: z.enum(TONES).default('friendly'),
  length: z.enum(LENGTHS).default('medium'),
  // Optional brand voice notes, e.g. "warm, eco-conscious, avoid exclamation marks".
  brand_voice: z.string().trim().max(500).optional(),
});

// What the model must return. Kept to plain strings and arrays so it maps cleanly
// onto structured outputs; length rules live in the prompt and in quality checks.
export const GeneratedDescription = z.object({
  title: z.string(),
  short_description: z.string(),
  long_description: z.string(),
  bullet_points: z.array(z.string()),
  seo_keywords: z.array(z.string()),
  meta_description: z.string(),
});
