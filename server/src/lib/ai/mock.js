// Mock AI provider — deterministic template responses for offline/test use.
// Implements realistic schema-compliant JSON responses for generation, extraction,
// review analysis, and retailer writing style profiling.

import { AIProvider } from './provider.js';

export class MockProvider extends AIProvider {
  constructor() {
    super('mock');
  }

  isAvailable() {
    return true; // always available for offline/testing
  }

  async complete(messages, opts = {}) {
    const started = Date.now();
    const userMsg = messages.find((m) => m.role === 'user')?.content ?? '';
    const sysMsg = messages.find((m) => m.role === 'system')?.content ?? '';
    const combined = `${sysMsg}\n${userMsg}`.toLowerCase();

    let content;

    if (opts.json) {
      if (combined.includes('short_description') || combined.includes('long_description') || combined.includes('bullet_points')) {
        // TaskType.GENERATION: Product description schema
        // Extract product name from user message if possible
        const nameMatch = userMsg.match(/Product:\s*([^\n(]+)/i) || userMsg.match(/"name":\s*"([^"]+)"/i);
        const brandMatch = userMsg.match(/Brand:\s*([^\n,)]+)/i) || userMsg.match(/"brand":\s*"([^"]+)"/i);
        const name = nameMatch ? nameMatch[1].trim() : 'Pulse Buds';
        const brand = brandMatch ? brandMatch[1].trim() : 'Voltix';

        // Check if retailer requested specific title structure
        let title = `${brand} ${name} - Premium Wireless Audio`;
        if (combined.includes('preferred title structure') || combined.includes('title_structure')) {
          title = `${brand} ${name} - Active Noise Cancelling`;
        }
        title = title.slice(0, 70);

        // Extract features from prompt if available so bullets are genuinely grounded in facts
        const featureMatches = [];
        const rawJsonMatch = userMsg.match(/raw product data:\s*(\{[\s\S]*?\})/i);
        if (rawJsonMatch) {
          try {
            const raw = JSON.parse(rawJsonMatch[1]);
            if (Array.isArray(raw.features)) featureMatches.push(...raw.features);
          } catch {}
        }
        if (!featureMatches.length) {
          featureMatches.push('Active noise cancellation', '35hr playtime', 'Bluetooth 5.3');
        }

        const bullets = featureMatches.slice(0, 4).map((f) => `${f} for verified performance and reliability`);

        content = JSON.stringify({
          title,
          short_description: `Engineered for superior everyday performance, the ${name} by ${brand} delivers rich acoustics and verified endurance.`,
          long_description: `The ${name} brings verified precision and comfort to your daily routine.\n\nBuilt with reliable wireless connectivity, this model turns essential features into tangible lifestyle benefits.`,
          bullet_points: bullets,
          seo_keywords: [
            `${brand.toLowerCase()} ${name.toLowerCase()}`,
            `${name.toLowerCase()}`,
            'wireless earbuds',
            'bluetooth',
            'noise cancelling',
          ],
          meta_description: `Shop the ${brand} ${name} featuring active noise cancellation and verified battery life.`.slice(0, 155),
        });
      } else if (combined.includes('review') || combined.includes('sentiment') || combined.includes('themes')) {
        // TaskType.REVIEW_ANALYSIS
        content = JSON.stringify([
          {
            theme: 'Battery Life & Charging',
            sentiment: 'positive',
            strength: 0.94,
            mention_count: 14,
            sample_quotes: ['Easily lasts through long commutes', 'Fast charge works as advertised'],
          },
          {
            theme: 'Comfort & Secure Fit',
            sentiment: 'positive',
            strength: 0.88,
            mention_count: 11,
            sample_quotes: ['Stays firmly in ears during running', 'Lightweight and comfortable'],
          },
          {
            theme: 'Touch Controls Sensitivity',
            sentiment: 'mixed',
            strength: 0.62,
            mention_count: 5,
            sample_quotes: ['Takes a day to get used to the tap gestures'],
          },
        ]);
      } else if (combined.includes('sentence_style') || combined.includes('benefit_vs_feature') || combined.includes('writing pattern')) {
        // TaskType.EXTRACTION: Retailer pattern profiling
        content = JSON.stringify({
          sentence_style: 'Punchy, benefit-first structure with clean scannability',
          benefit_vs_feature: 0.72,
          vocabulary_patterns: ['ergonomic', 'high-performance', 'seamless connectivity', 'durable build'],
          bullet_structure: 'Bold Benefit: Concrete specification or detail',
        });
      } else {
        // Generic JSON extraction
        content = JSON.stringify([
          { claim_or_fact: 'Verified specifications match manufacturer claims', category: 'specification', confidence: 0.95 },
          { claim_or_fact: 'Engineered for all-day daily reliability', category: 'benefit', confidence: 0.90 },
        ]);
      }
    } else {
      content = `[mock response] Processed request for: ${userMsg.slice(0, 100)}`;
    }

    return {
      content,
      usage: { input: 250, output: 200 },
      model: 'mock',
      latencyMs: Date.now() - started,
    };
  }

  async embed(text) {
    const hash = [...text].reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
    const vec = Array.from({ length: 8 }, (_, i) => Math.sin(hash + i));
    return { embedding: vec, model: 'mock' };
  }
}
