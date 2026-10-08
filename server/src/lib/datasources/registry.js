// Data source registry — central place to discover and use data source providers.
// New providers are registered here; services import the registry instead of
// individual providers.

import { WebDataSource } from './web.js';
import { AnakinDataSource } from './anakin.js';

// All registered data source providers, keyed by name.
const providers = new Map();

// Register built-in providers.
const web = new WebDataSource();
providers.set(web.name, web);

const anakin = new AnakinDataSource();
providers.set(anakin.name, anakin);

/**
 * Get a data source provider by name.
 * @param {string} name
 * @returns {import('./provider.js').DataSourceProvider|undefined}
 */
export function getDataSource(name) {
  return providers.get(name);
}

/**
 * Get all available data source providers.
 * @returns {import('./provider.js').DataSourceProvider[]}
 */
export function getAvailableDataSources() {
  return [...providers.values()].filter((p) => p.isAvailable());
}

/**
 * Fetch product data from all available sources.
 * @param {string} url - Product URL to fetch
 * @param {object} [opts]
 * @returns {Promise<import('./provider.js').RawContent[]>}
 */
export async function fetchFromAllSources(url, opts = {}) {
  const results = await Promise.allSettled(
    getAvailableDataSources().map((p) => p.fetchProduct(url, opts)),
  );
  return results
    .filter((r) => r.status === 'fulfilled' && r.value)
    .map((r) => r.value);
}

export const dataSources = { getDataSource, getAvailableDataSources, fetchFromAllSources };
