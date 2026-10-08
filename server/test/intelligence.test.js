import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ai } from '../src/lib/ai/router.js';
import { TaskType } from '../src/lib/ai/provider.js';
import { extractFactsFromProduct, extractHeuristicFactsFromText } from '../src/lib/extractor.js';
import { buildDeterministicIntelligence } from '../src/services/productIntelligence.js';
import { computeCompositeQuality, checkFactConsistency, checkBrandFit, checkEvidenceAlignment } from '../src/services/quality.js';
import { traceClaimsToEvidence } from '../src/services/explainability.js';
import { detectEditDivergence, extractPatternsFromFeedback, recordFeedbackAndLearn } from '../src/services/feedbackLearning.js';
import { resolveEvidenceConflicts, SOURCE_HIERARCHY } from '../src/services/evidence.js';
import { aggregateReviews } from '../src/services/reviewIntelligence.js';
import { AnakinDataSource } from '../src/lib/datasources/anakin.js';
import { generateForProduct } from '../src/services/generator.js';

test('AI Model Router resolves providers by task type', () => {
  const status = ai.status();
  assert.ok(status.mock.available);
  assert.ok(status.routing.generation);
  assert.ok(status.routing.extraction);

  const table = ai.getRoutingTable();
  assert.equal(table.length, 7);
  assert.ok(table.some((r) => r.task === 'generation'));
  assert.ok(table.some((r) => r.task === 'extraction'));
  assert.ok(table.some((r) => r.task === 'classification'));
  assert.ok(table.some((r) => r.task === 'review_analysis'));
  assert.ok(table.some((r) => r.task === 'image_understanding'));
});

test('Extractor extracts atomic verified facts from structured product data', () => {
  const product = {
    name: 'AeroGlide Pro Earbuds',
    brand: 'AeroAudio',
    price: 3499,
    currency: 'INR',
    features: ['Active Noise Cancellation', '36hr battery life', 'IPX5 water resistance'],
    specifications: { Bluetooth: '5.3', Driver: '12mm titanium' },
    attributes: { color: 'Matte Black' },
  };

  const facts = extractFactsFromProduct(product);
  assert.ok(facts.length >= 6);
  assert.ok(facts.some((f) => f.claim_or_fact === 'Brand: AeroAudio'));
  assert.ok(facts.some((f) => f.claim_or_fact === 'Price: INR 3499'));
  assert.ok(facts.some((f) => f.claim_or_fact.includes('Active Noise Cancellation')));
  assert.ok(facts.every((f) => f.confidence >= 0.9));
});

test('Extractor handles heuristic extraction from unstructured text', () => {
  const text = `
• Features 40mm neodymium drivers for deep bass
• Delivers up to 40 hours of playback on a single charge
• Designed for comfort during long gaming sessions
  `;

  const facts = extractHeuristicFactsFromText(text, 'spec_sheet');
  assert.ok(facts.length >= 2);
  assert.ok(facts.some((f) => f.category === 'specification'));
});

test('Product Intelligence Builder generates canonical facts and grounded benefits', () => {
  const product = {
    name: 'Pulse X',
    brand: 'Volt',
    category: 'Electronics',
    features: ['Fast charging', 'Lightweight chassis'],
  };

  const intelligence = buildDeterministicIntelligence(product, []);
  assert.ok(intelligence.canonical_facts.length >= 2);
  assert.ok(intelligence.key_benefits.length >= 1);
  assert.ok(intelligence.overall_confidence > 0.8);
  assert.ok(intelligence.summary.includes('Pulse X'));
});

test('Composite Quality Engine evaluates 4 pillars accurately', () => {
  const product = {
    name: 'Pulse Buds',
    category: 'Electronics',
    brand: 'Voltix',
    price: 2999,
    features: ['ANC', 'Touch controls', 'IPX5'],
    specifications: { Bluetooth: '5.3', 'Battery life': '30 hours' },
    attributes: { colors: ['Black'] },
    seed_keywords: ['wireless earbuds'],
  };

  const output = {
    title: 'Voltix Pulse Buds - Active Noise Cancelling Earbuds',
    short_description: 'Immerse in pure sound with 30 hours playback and ANC.',
    long_description: 'The Voltix Pulse Buds feature 30 hours battery life and Bluetooth 5.3 connection.',
    bullet_points: [
      'Active Noise Cancellation for undisturbed focus',
      'Long-lasting 30 hours total battery life',
      'IPX5 water resistance for workouts',
    ],
    seo_keywords: ['wireless earbuds', 'bluetooth earphones', 'anc earbuds'],
    meta_description: 'Experience pure music with Voltix Pulse Buds featuring 30 hours battery life.',
  };

  const retailerProfile = {
    preferred_tone: 'modern',
    sentence_style: 'punchy',
    profile_data: { words_to_avoid: ['cheap'] },
  };

  const report = computeCompositeQuality(output, product, null, retailerProfile, []);

  assert.ok(report.overall_score >= 70);
  assert.ok(report.pillars.content_quality.score > 0);
  assert.ok(report.pillars.brand_fit.score > 0);
  assert.ok(report.pillars.evidence_confidence.score > 0);
  assert.ok(report.pillars.seo_readiness.score > 0);
});

test('Fact consistency flags unverified numeric metrics', () => {
  const product = {
    name: 'Volt Earphones',
    features: ['10 hours battery life'],
    specifications: { Bluetooth: '5.0' },
  };

  const copyWithInventedMetric = {
    title: 'Volt Earphones',
    short_description: 'Now with 100 hours playtime!', // 100 hours is not in product specs
    long_description: 'Experience battery life.',
    bullet_points: ['10 hours battery life'],
  };

  const result = checkFactConsistency(copyWithInventedMetric, product, null);
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((i) => i.includes('100 hours')));
});

test('Explainability audits claims and flags unsupported statements for review', () => {
  const output = {
    title: 'Voltix Pulse Buds - Noise Cancelling Earbuds',
    short_description: 'Wireless earbuds designed with Bluetooth 5.3 connectivity.',
    long_description: 'Includes diamond-coated 24K gold audio connectors.', // completely unsupported!
    bullet_points: ['Bluetooth 5.3 for stable connectivity'],
  };

  const evidence = [
    { claim_or_fact: 'Bluetooth 5.3', source_name: 'Verified Spec Sheet', source_type: 'spec', confidence: 1.0 },
  ];

  const trace = traceClaimsToEvidence(output, evidence, null);
  assert.ok(trace.grounded_claims.length > 0);
  assert.ok(trace.unsupported_claims.length > 0);
  const unverified = trace.unsupported_claims.find((c) => c.claim_text.includes('gold'));
  assert.ok(unverified);
  assert.equal(unverified.is_grounded, false);
  assert.equal(unverified.status, 'flagged_for_review');
  assert.equal(unverified.confidence, 0.0);
});

test('Source hierarchy: verified specifications win over conflicting review claims', () => {
  const rawEvidence = [
    {
      source_type: 'spec',
      source_name: 'Official Lab Spec',
      claim_or_fact: 'Battery life: 32 hours total runtime',
      confidence: 1.0,
    },
    {
      source_type: 'review',
      source_name: 'Shopper Review',
      claim_or_fact: 'Battery only lasted 4 hours for me',
      confidence: 0.60,
    },
  ];

  const resolved = resolveEvidenceConflicts(rawEvidence);
  const spec = resolved.find((e) => e.source_type === 'spec');
  const review = resolved.find((e) => e.source_type === 'review');

  assert.equal(spec.is_authoritative, true);
  assert.equal(review.is_authoritative, false);
  assert.ok(review.conflict_flag.includes('Subordinate to higher-priority source'));
});

test('Review Intelligence produces multi-dimensional consensus themes and retains quotes', () => {
  const reviews = [
    { text: 'Battery lasts for days without charging. Awesome battery life.', rating: 5 },
    { text: 'Great battery backup for weekly travels.', rating: 5 },
    { text: 'Long battery runtime is the best feature.', rating: 5 },
    { text: 'Very comfortable in ears for hours without pain.', rating: 5 },
    { text: 'Super ergonomic fit while working out.', rating: 5 },
    { text: 'Touch controls are overly sensitive and difficult to use.', rating: 2 },
    { text: 'The tap controls take some getting used to.', rating: 3 },
  ];

  const themes = aggregateReviews(reviews);
  assert.ok(themes.length >= 2);

  const batteryTheme = themes.find((t) => t.theme.includes('Battery'));
  assert.ok(batteryTheme);
  assert.equal(batteryTheme.sentiment, 'positive');
  assert.equal(batteryTheme.signal_type, 'consensus');
  assert.ok(batteryTheme.mention_count >= 3);
  assert.ok(batteryTheme.sample_quotes.length > 0);

  const controlsTheme = themes.find((t) => t.theme.includes('Controls'));
  assert.ok(controlsTheme);
  assert.equal(controlsTheme.sentiment, 'mixed');
});

test('Anakin provider clearly distinguishes live data from demo fixture', async () => {
  const provider = new AnakinDataSource();
  const searchResults = await provider.search('wireless earbuds');

  assert.ok(searchResults.length > 0);
  const first = searchResults[0];

  if (first.source === 'anakin_live') {
    assert.equal(first.structured.data_mode, 'LIVE DATA');
    assert.equal(first.source, 'anakin_live');
  } else {
    assert.equal(first.structured.data_mode, 'DEMO / MOCK DATA');
    assert.equal(first.source, 'anakin_demo');
    assert.ok(first.text.includes('[DEMO FIXTURE]'));
  }
});

test('Feedback Learning: single feedback is an observation; 3 repetitions graduate to persistent preference', async () => {
  const retailerId = `retailer_test_${Date.now()}`;
  const descId = 'desc_123';

  // Feedback 1: single feedback "Too technical."
  const res1 = await recordFeedbackAndLearn(retailerId, descId, { comment: 'Too technical. Use simpler words.' });
  assert.equal(res1.patterns_detected.length, 1);
  assert.equal(res1.profile_updated, false, 'Single feedback must NOT rewrite retailer profile');

  // Feedback 2: repeated feedback
  const res2 = await recordFeedbackAndLearn(retailerId, descId, { comment: 'Too complex, too technical.' });
  assert.equal(res2.profile_updated, false, 'Second feedback still accumulates observation');

  // Feedback 3: third occurrence crosses threshold
  const res3 = await recordFeedbackAndLearn(retailerId, descId, { comment: 'Still too technical, make conversational.' });
  assert.equal(res3.profile_updated, true, 'Third repetition must graduate to persistent preference');
});

test('Full end-to-end generation integrates evidence, intelligence, quality, and explainability', async () => {
  const product = {
    name: 'SoundWave ANC',
    category: 'Electronics',
    brand: 'Aero',
    price: 3999,
    features: ['Active noise cancellation', '35hr playtime', 'Bluetooth 5.3'],
    specifications: { 'Battery life': '35 hours', Bluetooth: '5.3' },
    seed_keywords: ['anc headphones', 'bluetooth wireless'],
  };

  const result = await generateForProduct(product, { tone: 'professional', length: 'medium' });

  // 1. Output structure
  assert.ok(result.output.title);
  assert.ok(result.output.short_description);
  assert.ok(result.output.long_description);
  assert.ok(result.output.bullet_points.length >= 3);

  // 2. Intelligence synthesis
  assert.ok(result.intelligence.canonical_facts.length >= 2);
  assert.ok(result.intelligence.key_benefits.length >= 1);
  assert.ok(result.intelligence.overall_confidence > 0.8);

  // 3. Evidence and claim tracing
  assert.ok(result.evidence.traced_claims.length > 0);
  assert.ok(result.evidence.grounded_claims.length > 0);
  assert.ok(result.evidence.evidence_summary.grounding_rate_percent >= 50);

  // 4. Quality 4 pillars
  assert.ok(result.quality.pillars.content_quality.score >= 50);
  assert.ok(result.quality.pillars.brand_fit.score >= 50);
  assert.ok(result.quality.pillars.evidence_confidence.score >= 50);
  assert.ok(result.quality.pillars.seo_readiness.score >= 50);
});
