import Anthropic from '@anthropic-ai/sdk';
import { ZodError } from 'zod';

export function notFound(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
}

// Express 5 forwards rejected promises from async handlers here automatically.
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Invalid input', details: err.issues });
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return res.status(502).json({ error: 'LLM authentication failed: check ANTHROPIC_API_KEY.' });
  }
  if (err instanceof Anthropic.RateLimitError) {
    return res.status(429).json({ error: 'LLM rate limit reached, try again shortly.' });
  }
  if (err instanceof Anthropic.APIError) {
    return res.status(502).json({ error: `LLM request failed: ${err.message}` });
  }

  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Internal server error' });
}
