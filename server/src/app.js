import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { healthRouter } from './routes/health.js';
import { generateRouter } from './routes/generate.js';
import { productsRouter } from './routes/products.js';
import { meRouter } from './routes/me.js';
import { historyRouter } from './routes/history.js';
import { signupRouter } from './routes/signup.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

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

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
