import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { healthRouter } from './routes/health.js';
import { generateRouter } from './routes/generate.js';
import { productsRouter } from './routes/products.js';
import { meRouter } from './routes/me.js';
import { historyRouter } from './routes/history.js';
import { jobsRouter } from './routes/jobs.js';
import { reviewRouter } from './routes/review.js';
import { signupRouter } from './routes/signup.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const CLIENT_DIST = fileURLToPath(new URL('../../client/dist', import.meta.url));

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: '10mb' }));

  app.use('/api/health', healthRouter);
  app.use('/api/generate', generateRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/signup', signupRouter);
  app.use('/api/me', meRouter);
  app.use('/api/history', historyRouter);
  app.use('/api/jobs', jobsRouter);
  // /api/review, /api/descriptions/:id, /api/descriptions/:id/feedback, /api/metrics
  app.use('/api', reviewRouter);

  // In production the API also serves the built React app (npm run build), so one service
  // hosts both and the browser calls /api on the same origin. Unknown pages get index.html.
  if (config.serveClient && existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile('index.html', { root: CLIENT_DIST }));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
