import { Router } from 'express';
import { requireRetailer, requireUser } from '../middleware/auth.js';
import { isPhotoSearchConfigured, searchPhotos } from '../lib/photos.js';

export const photosRouter = Router();
photosRouter.use(requireUser, requireRetailer);

// GET /api/photos?query=air fryer  -> { photos: [{ id, thumb, url, alt, credit, credit_url }] }
photosRouter.get('/', async (req, res) => {
  if (!isPhotoSearchConfigured()) {
    return res.status(503).json({
      error: 'Photo search needs a free Pexels key: get one at pexels.com/api, add PEXELS_API_KEY to server/.env and restart.',
      code: 'photos_not_configured',
    });
  }
  const query = String(req.query.query ?? '').trim().slice(0, 80);
  if (!query) return res.status(400).json({ error: 'Type what to search for.' });
  res.json({ photos: await searchPhotos(query) });
});
