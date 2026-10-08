import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';

process.env.LLM_PROVIDER = 'groq';
process.env.GROQ_API_KEY = 'test-key';
const { generateForProduct, refineProblems } = await import('../src/services/generator.js');
const { generateDescription } = await import('../src/lib/llm.js');
const { ProductInput } = await import('../src/schemas/product.js');

const product = ProductInput.parse({
  name: 'Pulse Buds', category: 'Electronics', brand: 'Voltix',
  features: ['Active noise cancellation', 'IPX5 sweat resistance', 'Touch controls'],
  specifications: { 'Battery life': '32 hours with case', Bluetooth: '5.3' },
});
const options = { tone: 'friendly', length: 'short' };
const good = {
  title: 'Voltix Pulse Buds Wireless Earbuds with Noise Cancellation',
  short_description: 'Quiet commutes and 32 hours with the case.',
  long_description: 'These wireless earbuds use active noise cancellation to hush the bus.\n\nTouch controls and IPX5 sweat resistance cover the gym.',
  bullet_points: ['Quiet: active noise cancellation', 'Sweat-proofed: IPX5 sweat resistance', 'Long-lasting: 32 hours with case'],
  seo_keywords: ['wireless earbuds', 'noise cancelling earbuds', 'bluetooth earbuds', 'ipx5 earbuds', 'voltix earbuds'],
  meta_description: 'Voltix Pulse Buds wireless earbuds with active noise cancellation, IPX5 sweat resistance, touch controls and 32 hours of battery with the case.',
};
// Same copy with a cliché and a meta description over 155 characters.
const flawed = {
  ...good,
  long_description: 'Whether you commute or train, these wireless earbuds use active noise cancellation to hush the bus.\n\nTouch controls and IPX5 sweat resistance cover the gym.',
  meta_description: `${good.meta_description} Order today and enjoy your music anywhere you go.`,
};

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const reply = (content, finish = 'stop') =>
  new Response(JSON.stringify({
    model: 'openai/gpt-oss-120b',
    choices: [{ finish_reason: finish, message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }],
    usage: { prompt_tokens: 100, completion_tokens: 50 },
  }));
function stub(...responses) {
  const sent = [];
  globalThis.fetch = async (url, init) => {
    sent.push(JSON.parse(init.body));
    return responses.shift();
  };
  return sent;
}

test('the checks turn into concrete instructions for the editor', () => {
  const problems = refineProblems(
    { seo: { title_length_ok: true, meta_length_ok: false, primary_keyword_in_title: true, primary_keyword_in_meta: true, bullet_count_ok: true }, facts: { unsupported: [{ text: '40 hours', issue: 'Number not in the product data', fields: ['short_description'] }] }, style: { issues: [{ type: 'cliche', text: 'whether you' }] } },
    flawed,
  );
  assert.equal(problems.length, 3);
  assert.match(problems[0], /meta_description is \d+ characters; make it 120 to 155, keeping "wireless earbuds"/);
  assert.match(problems[1], /"40 hours" \(in short_description\) is not supported/);
  assert.match(problems[2], /cliché "whether you"/);
});

test('a fix that solves the problems is kept, and its tokens are counted', async () => {
  const sent = stub(reply(flawed), reply({ long_description: good.long_description, meta_description: good.meta_description }));
  const { output, quality, meta } = await generateForProduct(product, options);

  assert.equal(sent.length, 2);
  assert.equal(sent[1].reasoning_effort, 'low');
  assert.match(sent[1].messages[1].content, /Problems to fix:/);
  assert.equal(output.meta_description, good.meta_description);
  assert.equal(quality.refine.accepted, true);
  assert.deepEqual(quality.refine.remaining, []);
  assert.equal(quality.seo.meta_length_ok, true);
  assert.equal(meta.input_tokens, 200);
});

test('a fix that invents a fact is thrown away', async () => {
  stub(reply(flawed), reply({ meta_description: 'Voltix wireless earbuds with 40 hours of battery.', long_description: good.long_description }));
  const { output, quality } = await generateForProduct(product, options);
  assert.equal(quality.refine.accepted, false);
  assert.equal(output.meta_description, flawed.meta_description);
});

test('clean copy needs no second request, and a failed fix keeps the first draft', async () => {
  let sent = stub(reply(good));
  assert.equal((await generateForProduct(product, options)).quality.refine, undefined);
  assert.equal(sent.length, 1);

  sent = stub(reply(flawed), new Response(JSON.stringify({ error: { message: 'bad request' } }), { status: 400 }));
  const { output, quality } = await generateForProduct(product, options);
  assert.equal(output.long_description, flawed.long_description);
  assert.match(quality.refine.error, /bad request/);
});

test('a reply cut off at the token cap is retried at low effort', async () => {
  const sent = stub(reply('{"title": "cut', 'length'), reply(good));
  const { meta } = await generateDescription(product, options);
  assert.deepEqual(sent.map((body) => body.reasoning_effort), ['medium', 'low']);
  assert.equal(meta.effort, 'low');
  assert.equal(meta.attempts, 2);
});

test('a request too large for the tier is retried with a smaller token cap', async () => {
  const sent = stub(new Response(JSON.stringify({ error: { message: 'Request too large: Limit 8000, Requested 8208' } }), { status: 413 }), reply(good));
  await generateDescription(product, options);
  assert.equal(sent[0].max_completion_tokens, 4000);
  assert.equal(sent[1].max_completion_tokens, 3000);
  assert.equal(sent[1].reasoning_effort, 'low');
});
