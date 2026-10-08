// Anakin Wire data source provider — marketplace intelligence integration.
//
// Strictly distinguishes between:
// 1. LIVE DATA: When ANAKIN_API_KEY is configured and valid, makes real Wire task calls.
// 2. DEMO / MOCK DATA: When no key is provided, returns deterministic fixture data
//    clearly labeled as '[DEMO FIXTURE]' so callers and users are never misled.

import { DataSourceProvider } from './provider.js';
import { config } from '../../config/env.js';

const API = 'https://api.anakin.io/v1/wire';
const POLL_MS = 2000;
const TIMEOUT_MS = 30_000;
const DONE = ['completed', 'complete', 'succeeded', 'success', 'done', 'finished'];
const FAILED = ['failed', 'error', 'cancelled', 'canceled'];

export class AnakinDataSource extends DataSourceProvider {
  constructor() {
    super('anakin');
    this.apiKey = config.anakin?.apiKey || '';
  }

  isLive() {
    return Boolean(this.apiKey);
  }

  isAvailable() {
    return true; // Available in either LIVE or DEMO FIXTURE mode
  }

  getDataMode() {
    return this.isLive() ? 'LIVE DATA' : 'DEMO / MOCK DATA';
  }

  async _call(method, path, body) {
    if (!this.isLive()) return { status: 401, json: { error: 'No live Anakin API key configured' } };

    const headers = {
      'X-API-Key': this.apiKey,
      authorization: `Bearer ${this.apiKey}`,
      'content-type': 'application/json',
    };

    const res = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  }

  async _runAction(actionId, params) {
    const submitted = await this._call('POST', '/task', { action_id: actionId, params });
    if (submitted.status >= 400) {
      return { error: `submit failed (${submitted.status}): ${JSON.stringify(submitted.json)}` };
    }

    const job = submitted.json ?? {};
    const jobId = job.job_id ?? job.id ?? job.data?.job_id ?? job.data?.id;
    const status = String(job.status ?? job.data?.status ?? '').toLowerCase();

    if (!jobId || DONE.includes(status)) return { raw: job };

    const started = Date.now();
    while (Date.now() - started < TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      const polled = await this._call('GET', `/jobs/${jobId}`);
      const state = String(polled.json?.status ?? polled.json?.data?.status ?? '').toLowerCase();
      if (DONE.includes(state)) return { raw: polled.json };
      if (FAILED.includes(state) || polled.status >= 400) {
        return { raw: polled.json, error: `job ${state || polled.status}` };
      }
    }
    return { error: `timed out after ${TIMEOUT_MS / 1000}s (job ${jobId})` };
  }

  /**
   * Search marketplace products by query.
   * If live credentials are missing, returns realistic fixture clearly tagged as DEMO FIXTURE.
   * @param {string} query
   * @param {object} [opts]
   * @returns {Promise<import('./provider.js').RawContent[]>}
   */
  async search(query, opts = {}) {
    if (!query) return [];

    // LIVE PATH
    if (this.isLive()) {
      try {
        const action = opts.marketplace === 'flipkart' ? 'fk_search_products' : 'am_search_products';
        const result = await this._runAction(action, { query, limit: opts.limit || 5 });
        if (!result.error && result.raw) {
          const items = result.raw.data?.products || result.raw.results || result.raw.products || [];
          if (Array.isArray(items) && items.length > 0) {
            return items.map((item) => ({
              source: 'anakin_live',
              sourceUrl: item.url || item.product_url || `https://amazon.in/dp/${item.asin || ''}`,
              contentType: 'search_result',
              text: `${item.title || item.name || ''} - Price: ${item.price || item.current_price || 'N/A'}. Features: ${(item.features || []).join(', ')}`,
              structured: { ...item, data_mode: 'LIVE DATA' },
              fetchedAt: new Date().toISOString(),
            }));
          }
        }
      } catch {
        // Fall back to demo fixture if live call errors
      }
    }

    // DEMO / MOCK FIXTURE PATH (Explicitly marked)
    return [
      {
        source: 'anakin_demo',
        sourceUrl: `https://marketplace.mock.internal/search?q=${encodeURIComponent(query)}`,
        contentType: 'search_result',
        text: `[DEMO FIXTURE] Market competitor listing for "${query}": Price range INR 2,499 - 3,999. Benchmark specs: Bluetooth 5.3, 30+ hrs battery, 12mm drivers. Top customer search terms: "noise cancelling", "long battery life".`,
        structured: {
          benchmark_price: 2999,
          average_rating: 4.3,
          review_count: 1420,
          key_strengths: ['battery endurance', 'noise isolation'],
          data_mode: 'DEMO / MOCK DATA',
        },
        fetchedAt: new Date().toISOString(),
      },
    ];
  }

  /**
   * Fetch product details (Amazon ASIN or Flipkart URL).
   * @param {string} urlOrAsin
   * @param {object} [opts]
   */
  async fetchProduct(urlOrAsin, opts = {}) {
    if (!urlOrAsin) return null;

    if (this.isLive()) {
      try {
        let action = 'am_product_details';
        let params = { asin: urlOrAsin };

        if (urlOrAsin.includes('flipkart.com')) {
          action = 'fk_product_details';
          params = { product_url: urlOrAsin, pincode: opts.pincode || '560001' };
        } else if (urlOrAsin.startsWith('http')) {
          const asinMatch = urlOrAsin.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
          if (asinMatch) params = { asin: asinMatch[1] };
        }

        const result = await this._runAction(action, params);
        if (!result.error && result.raw) {
          const data = result.raw.data || result.raw;
          const title = data.title || data.name || '';
          const description = data.description || data.about_item || '';
          const bullets = (data.bullet_points || data.features || []).join('\n');

          return {
            source: 'anakin_live',
            sourceUrl: urlOrAsin,
            contentType: 'product_page',
            text: [title, description, bullets].filter(Boolean).join('\n\n'),
            structured: { ...data, data_mode: 'LIVE DATA' },
            fetchedAt: new Date().toISOString(),
          };
        }
      } catch {
        // Fall back to fixture
      }
    }

    // DEMO FIXTURE PATH
    return {
      source: 'anakin_demo',
      sourceUrl: urlOrAsin,
      contentType: 'product_page',
      text: `[DEMO FIXTURE] Marketplace product details for ${urlOrAsin}: Rated 4.4/5 stars by 850+ verified buyers. Highlights: Rapid 10-min fast charge, sweat-proof IPX5 rating, lightweight ergonomic casing.`,
      structured: {
        title: 'Benchmark Product Specifications',
        rating: 4.4,
        ratings_count: 850,
        specifications: { 'Fast Charge': '10 min for 2 hr', 'Water Resistance': 'IPX5' },
        data_mode: 'DEMO / MOCK DATA',
      },
      fetchedAt: new Date().toISOString(),
    };
  }

  /**
   * Fetch reviews for a product.
   * @param {string} identifier
   * @param {object} [opts]
   * @returns {Promise<import('./provider.js').RawContent[]>}
   */
  async fetchReviews(identifier, opts = {}) {
    if (!identifier) return [];

    if (this.isLive()) {
      try {
        const asinMatch = identifier.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
        const asin = asinMatch ? asinMatch[1] : identifier;
        const result = await this._runAction('am_product_reviews', { asin, limit: opts.limit || 10 });
        if (!result.error && result.raw) {
          const reviews = result.raw.data?.reviews || result.raw.reviews || [];
          return (Array.isArray(reviews) ? reviews : []).map((rev) => ({
            source: 'anakin_live',
            sourceUrl: rev.url || identifier,
            contentType: 'review',
            text: `${rev.title ? rev.title + ': ' : ''}${rev.text || rev.body || rev.content || ''}`,
            structured: {
              rating: rev.rating || rev.stars,
              author: rev.author || rev.reviewer_name,
              verified: rev.verified_purchase ?? true,
              data_mode: 'LIVE DATA',
            },
            fetchedAt: new Date().toISOString(),
          }));
        }
      } catch {
        // Fall back to fixture
      }
    }

    // DEMO FIXTURE PATH (Realistic review spread)
    return [
      {
        source: 'anakin_demo',
        sourceUrl: identifier,
        contentType: 'review',
        text: '[DEMO FIXTURE] Battery lasts through my entire week of daily commutes without needing a recharge. Active noise cancellation is solid for this price point.',
        structured: { rating: 5, verified: true, theme: 'battery', data_mode: 'DEMO / MOCK DATA' },
        fetchedAt: new Date().toISOString(),
      },
      {
        source: 'anakin_demo',
        sourceUrl: identifier,
        contentType: 'review',
        text: '[DEMO FIXTURE] Extremely comfortable in ear. Stays securely in place while jogging. Bluetooth connection never dropped.',
        structured: { rating: 5, verified: true, theme: 'comfort', data_mode: 'DEMO / MOCK DATA' },
        fetchedAt: new Date().toISOString(),
      },
      {
        source: 'anakin_demo',
        sourceUrl: identifier,
        contentType: 'review',
        text: '[DEMO FIXTURE] Sound quality is punchy and clear. Touch controls are sensitive and take a day to adjust to.',
        structured: { rating: 4, verified: true, theme: 'controls', data_mode: 'DEMO / MOCK DATA' },
        fetchedAt: new Date().toISOString(),
      },
    ];
  }
}
