// Feedback Learning Service — distinguishes single feedback observations from
// persistent, repeated retailer writing preferences.
//
// CORE RULE (Requirement 8):
// - Feedback 1 ("Too technical."): Recorded as an observation (frequency: 1).
//   Does NOT modify the retailer profile.
// - Repeated feedback (frequency >= 3 across distinct submissions): Crosses threshold,
//   graduates to a confirmed persistent pattern, and updates retailer writing patterns.

import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

// In-memory pattern cache to support offline mode and local testing
const inMemoryPatterns = new Map(); // retailerId -> Map<patternKey, { frequency, confidence, is_applied, pattern_type, pattern_detail }>

/**
 * Extracts stylistic signals and intent from human reviewer comments and ratings.
 * @param {object} feedbackData - { relevance, creativity, comment }
 * @returns {Array<{type: string, detail: string}>}
 */
export function extractPatternsFromFeedback(feedbackData) {
  const patterns = [];
  const comment = (feedbackData?.comment || '').toLowerCase().trim();
  if (!comment) return patterns;

  // 1. Technical complexity feedback
  if (/too technical|overly technical|less jargon|too complex|simpler language/i.test(comment)) {
    patterns.push({
      type: 'tone',
      detail: 'Prefers conversational, non-technical consumer language',
    });
  } else if (/more technical|add specs|too simple|not enough detail/i.test(comment)) {
    patterns.push({
      type: 'tone',
      detail: 'Prefers high technical specification detail',
    });
  }

  // 2. Length feedback
  if (/too long|shorten|too wordy|more concise|brief/i.test(comment)) {
    patterns.push({
      type: 'length',
      detail: 'Prefers concise copy with shorter long_description',
    });
  } else if (/too short|expand|more detail|longer/i.test(comment)) {
    patterns.push({
      type: 'length',
      detail: 'Prefers expansive narrative description',
    });
  }

  // 3. Negative keywords / avoided words
  const avoidMatch = comment.match(/(?:avoid|don't use|do not use|remove word)\s+["']?([a-z0-9_-]+)["']?/i);
  if (avoidMatch && avoidMatch[1]) {
    patterns.push({
      type: 'avoid_word',
      detail: avoidMatch[1].toLowerCase(),
    });
  }

  return patterns;
}

/**
 * Compares original AI output with user-edited copy to detect stylistic differences.
 * @param {object} originalOutput
 * @param {object} editedOutput
 * @returns {Array<{type: string, detail: string}>}
 */
export function detectEditDivergence(originalOutput, editedOutput) {
  const diffs = [];
  if (!originalOutput || !editedOutput) return diffs;

  const origWords = (originalOutput.long_description || '').split(/\s+/).filter(Boolean);
  const editWords = (editedOutput.long_description || '').split(/\s+/).filter(Boolean);

  // Length divergence
  if (origWords.length > 30 && editWords.length < origWords.length * 0.75) {
    diffs.push({
      type: 'length',
      detail: 'Prefers concise copy with shorter long_description',
    });
  } else if (origWords.length > 0 && editWords.length > origWords.length * 1.3) {
    diffs.push({
      type: 'length',
      detail: 'Prefers expansive narrative description',
    });
  }

  // Detect removed marketing buzzwords
  const origSet = new Set(origWords.map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, '')));
  const editSet = new Set(editWords.map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, '')));

  const buzzwords = ['revolutionary', 'premium', 'luxurious', 'gamechanger', 'exceptional', 'ultimate', 'unmatched'];
  for (const b of buzzwords) {
    if (origSet.has(b) && !editSet.has(b)) {
      diffs.push({
        type: 'avoid_word',
        detail: b,
      });
    }
  }

  return diffs;
}

/**
 * Records feedback and detected edit patterns, tracking frequency.
 * Only applies to retailer profile when frequency >= 3.
 * @param {string} retailerId
 * @param {string} descriptionId
 * @param {object} feedbackData
 * @param {Array<object>} divergence
 * @returns {Promise<{ patterns_detected: Array<object>, profile_updated: boolean }>}
 */
export async function recordFeedbackAndLearn(retailerId, descriptionId, feedbackData, divergence = []) {
  const commentPatterns = extractPatternsFromFeedback(feedbackData);
  const allDivergences = [...divergence, ...commentPatterns];
  let profileUpdated = false;

  if (!retailerId) {
    return { patterns_detected: allDivergences, profile_updated: false };
  }

  // Ensure in-memory map exists for retailer
  if (!inMemoryPatterns.has(retailerId)) {
    inMemoryPatterns.set(retailerId, new Map());
  }
  const retailerMap = inMemoryPatterns.get(retailerId);

  for (const item of allDivergences) {
    const key = `${item.type}:${item.detail}`;
    const prev = retailerMap.get(key) || { frequency: 0, is_applied: false };
    const newFreq = prev.frequency + 1;
    const confidence = Math.min(0.95, 0.35 + (newFreq - 1) * 0.25);

    retailerMap.set(key, {
      frequency: newFreq,
      confidence,
      is_applied: prev.is_applied,
      pattern_type: item.type,
      pattern_detail: item.detail,
    });

    // RULE: Only when frequency reaches 3 is it declared a persistent pattern!
    if (newFreq >= 3 && !prev.is_applied) {
      retailerMap.get(key).is_applied = true;
      profileUpdated = true;
      if (isSupabaseConfigured()) {
        await applyPatternToRetailerProfile(retailerId, item.type, item.detail);
      }
    }

    // Persist to Supabase if available
    if (isSupabaseConfigured()) {
      try {
        const { data: existing } = await supabase
          .from('feedback_patterns')
          .select('*')
          .eq('retailer_id', retailerId)
          .eq('pattern_type', item.type)
          .eq('pattern_detail', item.detail)
          .maybeSingle();

        if (existing) {
          const dbFreq = existing.frequency + 1;
          const shouldApply = dbFreq >= 3 && !existing.is_applied;
          await supabase
            .from('feedback_patterns')
            .update({
              frequency: dbFreq,
              confidence: Math.min(0.95, 0.35 + (dbFreq - 1) * 0.25),
              is_applied: existing.is_applied || shouldApply,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (shouldApply) {
            await applyPatternToRetailerProfile(retailerId, item.type, item.detail);
            profileUpdated = true;
          }
        } else {
          await supabase.from('feedback_patterns').insert({
            retailer_id: retailerId,
            pattern_type: item.type,
            pattern_detail: item.detail,
            frequency: 1,
            confidence: 0.35,
            is_applied: false,
          });
        }
      } catch {
        // Fall back to in-memory tracking
      }
    }
  }

  return { patterns_detected: allDivergences, profile_updated: profileUpdated };
}

/**
 * Returns recorded pattern statistics for a retailer.
 * @param {string} retailerId
 */
export function getRetailerLearnedPatterns(retailerId) {
  if (!inMemoryPatterns.has(retailerId)) return [];
  return [...inMemoryPatterns.get(retailerId).values()];
}

/**
 * Incrementally applies a high-confidence pattern to retailer profile.
 */
async function applyPatternToRetailerProfile(retailerId, type, detail) {
  if (!isSupabaseConfigured()) return;

  try {
    const { data: profile } = await supabase
      .from('retailer_content_profile')
      .select('*')
      .eq('retailer_id', retailerId)
      .maybeSingle();

    if (!profile) return;

    if (type === 'avoid_word') {
      const words = profile.profile_data?.words_to_avoid || [];
      if (!words.includes(detail.toLowerCase())) {
        words.push(detail.toLowerCase());
        const updatedProfileData = { ...profile.profile_data, words_to_avoid: words };
        await supabase
          .from('retailer_content_profile')
          .update({ profile_data: updatedProfileData, updated_at: new Date().toISOString() })
          .eq('retailer_id', retailerId);
      }
    } else if (type === 'length') {
      if (detail.includes('concise')) {
        const newLength = Math.max(90, (profile.avg_desc_length || 150) - 25);
        await supabase
          .from('retailer_content_profile')
          .update({ avg_desc_length: newLength, updated_at: new Date().toISOString() })
          .eq('retailer_id', retailerId);
      }
    } else if (type === 'tone') {
      if (detail.includes('conversational')) {
        await supabase
          .from('retailer_content_profile')
          .update({
            sentence_style: 'Clear, conversational and accessible to everyday shoppers',
            technical_detail: 'low',
            updated_at: new Date().toISOString(),
          })
          .eq('retailer_id', retailerId);
      }
    }
  } catch {
    // Non-blocking
  }
}
