// Abstract interface for data acquisition. Concrete implementations (Anakin,
// web scraper, marketplace APIs) extend this class.
//
// Data sources fetch raw content from external systems. The content then goes
// through extraction/normalization before entering the evidence store.

/**
 * A piece of raw content fetched from a data source.
 * @typedef {object} RawContent
 * @property {string} source - Provider name (e.g. 'anakin', 'web')
 * @property {string} sourceUrl - URL or identifier of the original source
 * @property {string} contentType - 'product_page' | 'review' | 'search_result' | 'image' | 'other'
 * @property {string} text - Extracted text content
 * @property {object} [structured] - Any structured data already parsed from the source
 * @property {string} fetchedAt - ISO timestamp
 */

/**
 * Base class for data source providers.
 * @abstract
 */
export class DataSourceProvider {
  /** @param {string} name */
  constructor(name) {
    if (new.target === DataSourceProvider) throw new Error('DataSourceProvider is abstract');
    this.name = name;
  }

  /**
   * Search for product information by query.
   * @param {string} query - Search query (product name, SKU, etc.)
   * @param {object} [opts] - Provider-specific options
   * @returns {Promise<RawContent[]>}
   */
  async search(query, opts = {}) {
    return [];
  }

  /**
   * Fetch product page content from a URL.
   * @param {string} url
   * @param {object} [opts]
   * @returns {Promise<RawContent|null>}
   */
  async fetchProduct(url, opts = {}) {
    return null;
  }

  /**
   * Fetch reviews for a product.
   * @param {string} identifier - URL, ASIN, or product ID
   * @param {object} [opts]
   * @returns {Promise<RawContent[]>}
   */
  async fetchReviews(identifier, opts = {}) {
    return [];
  }

  /** Whether this provider is currently usable. */
  isAvailable() {
    return false;
  }
}
