// Web data source — fetches and cleans HTML from product pages and URLs.
// Does NOT send raw HTML to an LLM. Instead: fetch → clean → extract text.

import { DataSourceProvider } from './provider.js';

// Basic HTML → text cleaning. Strips tags, scripts, styles, and normalizes whitespace.
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract the page title from HTML.
function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : '';
}

// Truncate text to a sensible length to avoid feeding huge pages downstream.
const MAX_TEXT_LENGTH = 8000;
function truncate(text) {
  return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) + '…' : text;
}

export class WebDataSource extends DataSourceProvider {
  constructor() {
    super('web');
  }

  isAvailable() {
    return true; // always available — just needs fetch()
  }

  async fetchProduct(url, opts = {}) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'user-agent': 'ProductCopyStudio/1.0 (content research)',
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      clearTimeout(timeout);

      if (!res.ok) return null;

      const html = await res.text();
      const text = truncate(htmlToText(html));
      const title = extractTitle(html);

      return {
        source: 'web',
        sourceUrl: url,
        contentType: 'product_page',
        text,
        structured: { title, url },
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      // Network errors, timeouts, etc. — return null, don't crash.
      console.warn(`WebDataSource: failed to fetch ${url}: ${err.message}`);
      return null;
    }
  }
}
