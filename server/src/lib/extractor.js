// Content Extractor — turns unstructured raw text, HTML snippets, and specifications
// into structured, atomic evidence items with confidence scores and source tagging.
//
// Works in two modes:
// 1. Fast deterministic heuristic extraction (works offline, zero latency, guaranteed)
// 2. AI-assisted semantic extraction (when an LLM provider is reachable)

import { ai } from './ai/router.js';
import { TaskType } from './ai/provider.js';

/**
 * @typedef {object} ExtractedFact
 * @property {string} claim_or_fact
 * @property {'specification'|'feature'|'benefit'|'limitation'|'usage'} category
 * @property {number} confidence - 0.0 to 1.0
 * @property {string} source_name
 * @property {string} [raw_context]
 */

/**
 * Deterministically extract facts from structured product data.
 * @param {object} product
 * @returns {ExtractedFact[]}
 */
export function extractFactsFromProduct(product) {
  const facts = [];

  if (product.brand) {
    facts.push({
      claim_or_fact: `Brand: ${product.brand}`,
      category: 'specification',
      confidence: 1.0,
      source_name: 'verified_catalog',
    });
  }

  if (product.price !== undefined && product.price !== null) {
    facts.push({
      claim_or_fact: `Price: ${product.currency || 'INR'} ${product.price}`,
      category: 'specification',
      confidence: 1.0,
      source_name: 'verified_catalog',
    });
  }

  if (Array.isArray(product.features)) {
    for (const f of product.features) {
      if (typeof f === 'string' && f.trim()) {
        facts.push({
          claim_or_fact: f.trim(),
          category: 'feature',
          confidence: 1.0,
          source_name: 'verified_catalog',
        });
      }
    }
  }

  if (product.specifications && typeof product.specifications === 'object') {
    for (const [key, val] of Object.entries(product.specifications)) {
      if (val !== undefined && val !== null) {
        facts.push({
          claim_or_fact: `${key}: ${val}`,
          category: 'specification',
          confidence: 1.0,
          source_name: 'verified_catalog',
        });
      }
    }
  }

  if (product.attributes && typeof product.attributes === 'object') {
    for (const [key, val] of Object.entries(product.attributes)) {
      if (val !== undefined && val !== null) {
        facts.push({
          claim_or_fact: `${key}: ${Array.isArray(val) ? val.join(', ') : val}`,
          category: 'specification',
          confidence: 0.95,
          source_name: 'verified_catalog',
        });
      }
    }
  }

  return facts;
}

/**
 * Heuristically extract atomic facts from raw unstructured text.
 * @param {string} text
 * @param {string} sourceName
 * @returns {ExtractedFact[]}
 */
export function extractHeuristicFactsFromText(text, sourceName = 'external_text') {
  if (!text || typeof text !== 'string') return [];

  const lines = text
    .split(/\r?\n|•|\*|-/)
    .map((l) => l.trim())
    .filter((l) => l.length > 8 && l.length < 250);

  const facts = [];
  for (const line of lines.slice(0, 15)) {
    let category = 'feature';
    if (/\d+\s*(?:mm|cm|kg|g|v|w|mah|gb|tb|hz|inch|mp|fps|hours|hrs|watt|%)/i.test(line)) {
      category = 'specification';
    } else if (/(?:ideal for|suitable for|designed for|perfect for|use during)/i.test(line)) {
      category = 'usage';
    } else if (/(?:delivers|enables|boosts|ensures|improves|reduces|prevents)/i.test(line)) {
      category = 'benefit';
    }

    facts.push({
      claim_or_fact: line,
      category,
      confidence: 0.85,
      source_name: sourceName,
      raw_context: line,
    });
  }

  return facts;
}

/**
 * Extract structured facts from raw text using AI, falling back to heuristics.
 * @param {string} text
 * @param {string} sourceName
 * @returns {Promise<ExtractedFact[]>}
 */
export async function extractFactsWithAI(text, sourceName = 'external_text') {
  if (!text) return [];

  try {
    const prompt = `Extract all verified factual statements, specifications, and benefits from this product excerpt:
"""
${text.slice(0, 1200)}
"""

Format your response strictly as JSON with an array of objects:
[{"claim_or_fact": "...", "category": "specification"|"feature"|"benefit"|"usage", "confidence": 0.9}]`;

    const response = await ai.complete(TaskType.EXTRACTION, [
      { role: 'system', content: 'You are a product data extraction specialist. Output valid JSON array only.' },
      { role: 'user', content: prompt },
    ], { json: true });

    let parsed;
    try {
      parsed = JSON.parse(response.content);
      if (parsed && Array.isArray(parsed.facts)) parsed = parsed.facts;
      if (!Array.isArray(parsed)) parsed = null;
    } catch {
      parsed = null;
    }

    if (parsed && parsed.length > 0) {
      return parsed.map((item) => ({
        claim_or_fact: item.claim_or_fact || item.fact || '',
        category: ['specification', 'feature', 'benefit', 'limitation', 'usage'].includes(item.category)
          ? item.category
          : 'feature',
        confidence: typeof item.confidence === 'number' ? Math.max(0.1, Math.min(1.0, item.confidence)) : 0.9,
        source_name: sourceName,
      })).filter((f) => f.claim_or_fact.length > 3);
    }
  } catch {
    // LLM extraction unavailable or timed out; use heuristic
  }

  return extractHeuristicFactsFromText(text, sourceName);
}
