import { config } from '../config/env.js';
import { generateDescription, refineDescription } from '../lib/llm.js';
import { checkCompleteness, checkFacts, checkSeo, checkStyle } from './quality.js';

// Models often emit typographic hyphens and spaces (non-breaking hyphen U+2011, narrow
// no-break space). They look identical but break keyword matching for search engines and
// for our SEO checks, so normalise them to plain ASCII.
const cleanText = (text) => text.replace(/[\u2010\u2011]/g, '-').replace(/[\u00a0\u202f]/g, ' ').trim();

export function cleanOutput(output) {
  return Object.fromEntries(
    Object.entries(output).map(([key, value]) => [key, Array.isArray(value) ? value.map(cleanText) : cleanText(value)]),
  );
}

// Every rule-based check on one product's copy. Also used to score human edits.
export function qualityReport(product, output, options) {
  return {
    input: checkCompleteness(product),
    seo: checkSeo(output),
    facts: checkFacts(product, output),
    style: checkStyle(output, options),
  };
}

// What a copy editor should fix, in words the model can act on, from a quality report.
const STYLE_FIXES = {
  meta_reference: (text) => `The copy mentions where a fact came from ("${text}"); state the fact directly.`,
  stock_opener: (text) => `long_description opens with a formula ("${text}"); open with the product's most distinctive fact instead.`,
  cliche: (text) => `Remove the cliché "${text}" and say plainly what it means.`,
  keyword_stuffing: (text) => `Keyword overused (${text}): use it at most twice, or four times for the primary keyword.`,
  exclamation: () => 'Remove the exclamation marks.',
  title_repeat: (text) => `The title repeats "${text}"; drop the repeat.`,
  title_case: (text) => `Write the title in Title Case (now lowercase: ${text}).`,
  avoided_word: (text) => `The brand never uses the word "${text}"; replace it.`,
};

export function refineProblems(quality, output) {
  const problems = [];
  const primary = output.seo_keywords[0] ?? '';
  const keep = primary ? `, keeping "${primary}" word for word` : '';
  if (!quality.seo.title_length_ok) problems.push(`title is ${output.title.length} characters; make it 70 or fewer${keep}.`);
  if (!quality.seo.meta_length_ok) problems.push(`meta_description is ${output.meta_description.length} characters; make it 120 to 155${keep}.`);
  if (primary && !quality.seo.primary_keyword_in_title) problems.push(`title must contain the primary keyword "${primary}" word for word.`);
  if (primary && !quality.seo.primary_keyword_in_meta) problems.push(`meta_description must contain the primary keyword "${primary}" word for word.`);
  if (primary && quality.seo.primary_keyword_early === false) problems.push(`Use the primary keyword "${primary}" word for word in the first paragraph of long_description.`);
  if (!quality.seo.bullet_count_ok) problems.push(`bullet_points has ${output.bullet_points.length} bullets; use 3 to 6.`);
  for (const flag of quality.facts.unsupported) {
    problems.push(`"${flag.text}" (in ${flag.fields.join(', ')}) is not supported by the product data: ${flag.issue.toLowerCase()}. Remove it or use the fact as the data states it.`);
  }
  for (const issue of quality.style.issues) problems.push(STYLE_FIXES[issue.type]?.(issue.text) ?? `Style: ${issue.type} (${issue.text}).`);
  return problems;
}

// Lower is better. Fact flags count double: an invented spec is worse than a cliché.
const problemScore = (quality) =>
  (quality.seo.total - quality.seo.passed) + quality.facts.unsupported.length * 2 + quality.style.issues.length;

// Generate copy for one already-validated product and attach quality reports. If the checks
// find problems, one short follow-up request asks the model to fix just those, and the fix is
// kept only if it scores better without adding fact flags. `settings` optionally overrides
// provider, model or effort (see lib/llm.js); `settings.refine = false` skips the fix.
export async function generateForProduct(product, options, settings = {}) {
  const generated = await generateDescription(product, options, settings);
  const meta = { ...generated.meta };
  let output = cleanOutput(generated.output);
  let quality = qualityReport(product, output, options);

  const problems = config.llm.refine && settings.refine !== false ? refineProblems(quality, output) : [];
  if (problems.length) {
    let refine = { problems, accepted: false };
    try {
      const refined = await refineDescription(product, output, problems, settings);
      if (refined) {
        const candidate = cleanOutput({ ...output, ...refined.changes });
        const candidateQuality = qualityReport(product, candidate, options);
        const accepted =
          problemScore(candidateQuality) < problemScore(quality) &&
          candidateQuality.facts.unsupported.length <= quality.facts.unsupported.length;
        meta.input_tokens += refined.meta.input_tokens;
        meta.output_tokens += refined.meta.output_tokens;
        meta.latency_ms += refined.meta.latency_ms;
        refine = { problems, accepted, remaining: accepted ? refineProblems(candidateQuality, candidate) : problems };
        if (accepted) {
          output = candidate;
          quality = candidateQuality;
        }
      }
    } catch (error) {
      // A failed fix (say, a rate limit) never loses the generated copy.
      refine = { problems, accepted: false, error: error.message };
    }
    quality = { ...quality, refine };
  }
  return { output, meta, quality };
}
