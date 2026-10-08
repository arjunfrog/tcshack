import { requireSupabase } from '../lib/supabase.js';
import { isPhotoSearchConfigured, isPlaceholderImage, searchPhotos } from '../lib/photos.js';

// Gives every product of a retailer without a real photo the top Pexels results for its
// product type (one search per type), so a sample or demo catalog looks like a real store.
// Used by POST /api/products/auto-photos and `npm run db:seed -- --photos`.
export async function autoPhotos(retailerId, { onType } = {}) {
  if (!isPhotoSearchConfigured()) return { updated: 0, types: 0, configured: false };
  const supabase = requireSupabase();
  const { data: rows, error } = await supabase
    .from('products')
    .select('id, category, subcategory, image_url')
    .eq('retailer_id', retailerId)
    .limit(1000);
  if (error) throw error;

  const groups = new Map();
  for (const row of rows.filter((item) => isPlaceholderImage(item.image_url))) {
    const type = (row.subcategory || row.category).trim();
    groups.set(type, [...(groups.get(type) ?? []), row.id]);
  }

  let updated = 0;
  for (const [type, ids] of [...groups].slice(0, 80)) {
    const photos = await searchPhotos(type, { perPage: Math.min(Math.max(ids.length, 1), 40) }).catch(() => []);
    if (photos.length) {
      // Different photos for products of the same type, as far as the results go.
      await Promise.all(ids.map((id, i) => {
        const photo = photos[i % photos.length];
        return supabase.from('products').update({ image_url: photo.url, image_credit: photo.credit, image_credit_url: photo.credit_url }).eq('id', id);
      }));
      updated += ids.length;
    }
    onType?.(type, ids.length, photos.length);
  }
  return { updated, types: groups.size, configured: true };
}
