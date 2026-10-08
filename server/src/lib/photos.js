import { config } from '../config/env.js';

// Free stock photos from Pexels (https://www.pexels.com/api/). Results carry the
// photographer's name and page, which the app shows as credit, as Pexels asks.

export const isPhotoSearchConfigured = () => Boolean(config.photos.pexelsKey);

export async function searchPhotos(query, { perPage = 12 } = {}) {
  const url = `https://api.pexels.com/v1/search?${new URLSearchParams({ query, per_page: String(perPage), orientation: 'square' })}`;
  const res = await fetch(url, { headers: { authorization: config.photos.pexelsKey } });
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error('Pexels rejected PEXELS_API_KEY. Check the key in server/.env.'), { status: 502 });
  if (res.status === 429) throw Object.assign(new Error('Pexels photo search limit reached. Try again in a while.'), { status: 429 });
  if (!res.ok) throw Object.assign(new Error(`Pexels search failed (${res.status})`), { status: 502 });
  const data = await res.json();
  return (data.photos ?? []).map((photo) => ({
    id: photo.id,
    thumb: photo.src?.medium,
    url: photo.src?.large,
    alt: photo.alt || query,
    color: photo.avg_color,
    credit: `${photo.photographer} on Pexels`,
    credit_url: photo.url,
  }));
}

// Only Pexels CDN URLs can be saved as a picked photo (uploads go through Storage instead).
export const isPexelsUrl = (url) => {
  try {
    return new URL(url).hostname === 'images.pexels.com';
  } catch {
    return false;
  }
};

export const isPlaceholderImage = (url) => !url || /placehold\.co|placeholder/i.test(url);
