import { Router } from 'express';
import { config } from '../config/env.js';
import { pingDatabase } from '../lib/supabase.js';
import { ai } from '../lib/ai/router.js';
import { dataSources } from '../lib/datasources/registry.js';

export const healthRouter = Router();

healthRouter.get('/', async (req, res) => {
  res.json({
    status: 'ok',
    llm: { provider: config.llm.provider, model: config.llm.provider === 'mock' ? 'mock' : config.llm.model },
    database: await pingDatabase(),
    ai_router: ai.status(),
    datasources: {
      registered: ['web', 'anakin'],
      available: dataSources.getAvailableDataSources().map((d) => d.name),
    },
  });
});
