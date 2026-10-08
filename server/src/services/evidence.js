// Product Evidence Service — coordinates multi-source data acquisition,
// enforces strict source hierarchy, resolves conflicts, and maintains the evidence store.
//
// STRICT SOURCE HIERARCHY:
// Priority 1: User-provided specifications (spec) — confidence: 1.0 (authoritative)
// Priority 2: Official manufacturer/retailer information (official_web) — confidence: 0.95
// Priority 3: Structured product data / marketplace (marketplace) — confidence: 0.88
// Priority 4: Aggregated customer insights (aggregated_reviews) — confidence: 0.82
// Priority 5: Trusted external sources (external) — confidence: 0.75
// Priority 6: Visual observations (visual) — confidence: 0.70
// Priority 7: Individual review claims (review) — confidence: 0.60
//
// RULE: When conflicting values exist for any attribute (e.g. battery life, dimensions),
// higher-priority sources ALWAYS take precedence. A single customer review can NEVER
// overwrite or mutate a verified specification.

import { extractFactsFromProduct, extractFactsWithAI } from '../lib/extractor.js';
import { dataSources } from '../lib/datasources/registry.js';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

export const SOURCE_HIERARCHY = Object.freeze({
  spec: { priority: 1, label: 'User Specification', baseConfidence: 1.0 },
  official_web: { priority: 2, label: 'Official Manufacturer Web', baseConfidence: 0.95 },
  marketplace: { priority: 3, label: 'Structured Marketplace Data', baseConfidence: 0.88 },
  aggregated_reviews: { priority: 4, label: 'Aggregated Customer Insights', baseConfidence: 0.82 },
  external: { priority: 5, label: 'Trusted External Sources', baseConfidence: 0.75 },
  visual: { priority: 6, label: 'Visual Observation', baseConfidence: 0.70 },
  review: { priority: 7, label: 'Individual Review Claim', baseConfidence: 0.60 },
});

/**
 * Extracts a normalized metric key for conflict resolution.
 * e.g. "Battery life: 32 hours" -> "battery"
 * "Bluetooth: 5.3" -> "bluetooth"
 */
function getAttributeKey(claimText) {
  const lower = claimText.toLowerCase();
  if (lower.includes('battery') || lower.includes('playback') || lower.includes('runtime')) return 'battery';
  if (lower.includes('bluetooth') || lower.includes('wireless version')) return 'bluetooth';
  if (lower.includes('price')) return 'price';
  if (lower.includes('weight')) return 'weight';
  if (lower.includes('driver')) return 'driver';
  if (lower.includes('water') || lower.includes('ipx') || lower.includes('resistance')) return 'water_resistance';
  if (lower.includes('noise cancel') || lower.includes('anc')) return 'anc';
  if (lower.includes('charging') || lower.includes('charge')) return 'charging';
  return null;
}

/**
 * Resolves conflicts across evidence pieces based on strict source hierarchy.
 * Higher priority source wins. Lower priority conflicting pieces are flagged.
 * @param {Array<object>} rawEvidence
 * @returns {Array<object>}
 */
export function resolveEvidenceConflicts(rawEvidence) {
  const resolved = [];
  const attributeMap = new Map();

  // Sort by priority (1 is highest)
  const sorted = [...rawEvidence].sort((a, b) => {
    const prioA = SOURCE_HIERARCHY[a.source_type]?.priority ?? 99;
    const prioB = SOURCE_HIERARCHY[b.source_type]?.priority ?? 99;
    return prioA - prioB;
  });

  for (const item of sorted) {
    const attrKey = getAttributeKey(item.claim_or_fact);
    if (!attrKey) {
      resolved.push({ ...item, is_authoritative: true });
      continue;
    }

    if (attributeMap.has(attrKey)) {
      const existing = attributeMap.get(attrKey);
      // Higher priority already claimed this attribute!
      // Check if values diverge
      const existingText = existing.claim_or_fact.toLowerCase();
      const currentText = item.claim_or_fact.toLowerCase();
      if (existingText !== currentText) {
        // Conflicting lower-priority claim: flag it as overridden
        resolved.push({
          ...item,
          is_authoritative: false,
          conflict_flag: `Subordinate to higher-priority source (${existing.source_name}): "${existing.claim_or_fact}"`,
        });
        continue;
      }
    } else {
      attributeMap.set(attrKey, item);
    }

    resolved.push({ ...item, is_authoritative: true });
  }

  return resolved;
}

/**
 * Gathers evidence for a product from all available channels with hierarchy enforcement.
 * @param {object} product
 * @param {object} [opts]
 * @returns {Promise<Array<object>>}
 */
export async function gatherEvidence(product, opts = {}) {
  const rawEvidence = [];

  // 1. Authoritative: Catalog specifications and attributes (Priority 1)
  const catalogFacts = extractFactsFromProduct(product);
  for (const fact of catalogFacts) {
    rawEvidence.push({
      product_id: product.id,
      retailer_id: product.retailer_id,
      source_type: 'spec',
      source_name: 'Verified Catalog Spec',
      source_url: null,
      claim_or_fact: fact.claim_or_fact,
      category: fact.category,
      confidence: 1.0,
      raw_context: fact.raw_context || null,
      created_at: new Date().toISOString(),
    });
  }

  // 2. Official Manufacturer Web Content (Priority 2)
  const targetUrl = product.source_url || product.external_url || product.image_url;
  if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
    try {
      const webSource = dataSources.getDataSource('web');
      if (webSource && webSource.isAvailable()) {
        const rawWeb = await webSource.fetchProduct(targetUrl);
        if (rawWeb && rawWeb.text) {
          const webFacts = await extractFactsWithAI(rawWeb.text, 'Official Web');
          for (const fact of webFacts.slice(0, 8)) {
            rawEvidence.push({
              product_id: product.id,
              retailer_id: product.retailer_id,
              source_type: 'official_web',
              source_name: 'Official Manufacturer Web',
              source_url: targetUrl,
              claim_or_fact: fact.claim_or_fact,
              category: fact.category,
              confidence: 0.95,
              raw_context: fact.raw_context || null,
              created_at: new Date().toISOString(),
            });
          }
        }
      }
    } catch {
      // Non-blocking enrichment failure
    }
  }

  // 3. Anakin Marketplace Enrichment (Priority 3)
  const anakinSource = dataSources.getDataSource('anakin');
  if (anakinSource) {
    try {
      const query = opts.asin || `${product.brand || ''} ${product.name}`.trim();
      const rawResults = await anakinSource.search(query, { limit: 2 });
      for (const item of rawResults) {
        const isLive = item.source === 'anakin_live';
        rawEvidence.push({
          product_id: product.id,
          retailer_id: product.retailer_id,
          source_type: 'marketplace',
          source_name: isLive ? 'Marketplace Intelligence (Live Wire)' : 'Marketplace Intelligence (Demo Fixture)',
          source_url: item.sourceUrl,
          claim_or_fact: item.text.slice(0, 200),
          category: 'feature',
          confidence: isLive ? 0.88 : 0.80,
          raw_context: JSON.stringify(item.structured || {}).slice(0, 300),
          data_mode: isLive ? 'LIVE DATA' : 'DEMO / MOCK DATA',
          created_at: new Date().toISOString(),
        });
      }
    } catch {
      // Non-blocking marketplace enrichment failure
    }
  }

  // 4. Resolve conflicts and enforce hierarchy
  const finalEvidence = resolveEvidenceConflicts(rawEvidence);

  // Persist to Supabase if configured and product has a persisted ID
  if (isSupabaseConfigured() && product.id) {
    try {
      const rows = finalEvidence.filter((e) => e.is_authoritative).map((e) => ({
        product_id: e.product_id,
        retailer_id: e.retailer_id || null,
        source_type: e.source_type,
        source_name: e.source_name,
        source_url: e.source_url,
        claim_or_fact: e.claim_or_fact,
        category: e.category,
        confidence: e.confidence,
        raw_context: e.raw_context,
      }));

      await supabase.from('product_evidence').insert(rows);
    } catch {
      // Fall through to in-memory return
    }
  }

  return finalEvidence;
}

/**
 * Fetches evidence previously saved for a product.
 * @param {string} productId
 * @returns {Promise<Array<object>>}
 */
export async function getProductEvidence(productId) {
  if (!productId || !isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('product_evidence')
      .select('*')
      .eq('product_id', productId)
      .order('confidence', { ascending: false });

    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}
