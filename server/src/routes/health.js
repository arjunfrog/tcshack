import { Router } from 'express';
import { config } from '../config/env.js';
import { pingDatabase } from '../lib/supabase.js';

export const healthRouter = Router();

healthRouter.get('/', async (req, res) => {
  res.json({
    status: 'ok',
    llm: { provider: config.llm.provider, model: config.llm.provider === 'mock' ? 'mock' : config.llm.model },
    database: await pingDatabase(),
  });
});
