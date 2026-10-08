// Explainability Service — connects generated copy statements to their
// supporting evidence and source provenance.
//
// CORE GROUNDING RULE (Requirement 4):
// - Every major claim in the output is audited against actual stored evidence.
// - We NEVER invent a post-hoc justification for an unsupported claim.
// - If a claim lacks supporting evidence, it is explicitly flagged with status: 'flagged_for_review'
//   and confidence: 0.0, and isolated into unsupported_claims.

import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

/**
 * @typedef {object} TracedClaim
 * @property {string} claim_text
 * @property {'title'|'short_description'|'bullet'|'long_description'} section
 * @property {string} source_label
 * @property {'spec'|'official_web'|'marketplace'|'review'|'unverified'} source_type
 * @property {number} confidence
 * @property {string} rationale
 * @property {boolean} is_grounded
 * @property {'verified'|'flagged_for_review'} status
 */

/**
 * Normalizes text to extract salient tokens for evidence matching.
 */
function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !['with', 'from', 'that', 'this', 'your', 'have', 'more', 'than', 'into'].includes(w));
}

/**
 * Finds supporting evidence for a text snippet from the stored evidence list.
 * Returns { evidence, confidence } or null if no evidence matches.
 */
function findSupportingEvidence(text, evidenceList) {
  if (!text || !evidenceList || !evidenceList.length) return null;
  const textTokens = tokenize(text);
  if (!textTokens.length) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const ev of evidenceList) {
    const claimTokens = tokenize(ev.claim_or_fact || '');
    if (!claimTokens.length) continue;

    // Check overlap
    const shared = claimTokens.filter((token) => textTokens.includes(token));
    const overlapRatio = shared.length / claimTokens.length;

    // If the text makes a numeric claim (e.g. "35 hours", "5.3"), verify the evidence supports that number
    const evNumbers = (ev.claim_or_fact || '').match(/\b\d+(\.\d+)?\b/g) || [];
    const textNumbers = text.match(/\b\d+(\.\d+)?\b/g) || [];
    const numbersMatch = textNumbers.length === 0 || textNumbers.some((n) => evNumbers.includes(n));

    if (numbersMatch && (shared.length >= 2 || (claimTokens.length === 1 && shared.length === 1))) {
      const score = shared.length * 10 + overlapRatio * 5;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = ev;
      }
    }
  }

  return bestMatch;
}

/**
 * Traces all generated copy claims against stored evidence.
 * Categorizes each claim strictly as verified or flagged for review.
 * @param {object} output - GeneratedDescription output
 * @param {Array<object>} evidence - Gathered evidence list
 * @param {object} [retailerProfile]
 * @returns {{
 *   traced_claims: TracedClaim[],
 *   grounded_claims: TracedClaim[],
 *   unsupported_claims: TracedClaim[],
 *   grounding_rate: number,
 *   evidence_summary: object
 * }}
 */
export function traceClaimsToEvidence(output, evidence = [], retailerProfile = null) {
  const allClaims = [];
  const authoritativeEvidence = evidence.filter((e) => e.is_authoritative !== false);

  // Helper to audit a single snippet
  function auditSnippet(text, section) {
    if (!text || typeof text !== 'string') return;
    const match = findSupportingEvidence(text, authoritativeEvidence);

    if (match) {
      allClaims.push({
        claim_text: text,
        section,
        source_label: match.source_name,
        source_type: match.source_type,
        confidence: match.confidence,
        rationale: `Verified by ${match.source_name}: "${match.claim_or_fact}"`,
        is_grounded: true,
        status: 'verified',
      });
    } else {
      // UNSUPPORTED CLAIM: Explicitly flag for review! Do NOT invent justification!
      allClaims.push({
        claim_text: text,
        section,
        source_label: 'Unverified Claim (Flagged for Review)',
        source_type: 'unverified',
        confidence: 0.0,
        rationale: 'UNSUPPORTED CLAIM: No catalog specification or gathered evidence validates this claim.',
        is_grounded: false,
        status: 'flagged_for_review',
      });
    }
  }

  // 1. Audit Title
  if (output.title) auditSnippet(output.title, 'title');

  // 2. Audit Bullets
  if (Array.isArray(output.bullet_points)) {
    output.bullet_points.forEach((bullet) => auditSnippet(bullet, 'bullet'));
  }

  // 3. Audit Short Description
  if (output.short_description) auditSnippet(output.short_description, 'short_description');

  // 4. Audit Long Description sentences
  if (output.long_description) {
    const sentences = output.long_description
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20);

    sentences.forEach((sentence) => auditSnippet(sentence, 'long_description'));
  }

  const grounded = allClaims.filter((c) => c.is_grounded);
  const unsupported = allClaims.filter((c) => !c.is_grounded);
  const groundingRate = allClaims.length ? Math.round((grounded.length / allClaims.length) * 100) : 100;

  // Evidence summary breakdown
  const sourceBreakdown = {};
  grounded.forEach((c) => {
    sourceBreakdown[c.source_label] = (sourceBreakdown[c.source_label] || 0) + 1;
  });
  if (unsupported.length > 0) {
    sourceBreakdown['Unverified (Needs Review)'] = unsupported.length;
  }

  return {
    traced_claims: allClaims,
    grounded_claims: grounded,
    unsupported_claims: unsupported,
    grounding_rate: groundingRate,
    evidence_summary: {
      total_claims_audited: allClaims.length,
      grounded_count: grounded.length,
      unsupported_count: unsupported.length,
      grounding_rate_percent: groundingRate,
      average_confidence: grounded.length
        ? Math.round((grounded.reduce((a, b) => a + b.confidence, 0) / grounded.length) * 100) / 100
        : 0.0,
      sources_breakdown: sourceBreakdown,
    },
  };
}

/**
 * Persist claim trace links to generation_evidence table.
 */
export async function persistGenerationEvidence(descriptionId, productId, tracedClaims) {
  if (!descriptionId || !isSupabaseConfigured() || !tracedClaims.length) return;

  try {
    const rows = tracedClaims.map((c) => ({
      description_id: descriptionId,
      product_id: productId,
      claim_text: c.claim_text,
      section: c.section,
      source_type: c.source_type,
      source_label: c.source_label,
      confidence: c.confidence,
      rationale: c.rationale,
    }));

    await supabase.from('generation_evidence').insert(rows);
  } catch {
    // Non-blocking
  }
}

/**
 * Retrieve evidence explanation for a saved description.
 */
export async function getGenerationEvidence(descriptionId) {
  if (!descriptionId || !isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('generation_evidence')
      .select('*')
      .eq('description_id', descriptionId);

    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}
