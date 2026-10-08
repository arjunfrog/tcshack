import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

// A stand-in for OpenRouter's chat completions endpoint. Each test queues the replies it wants.
let replies = [];
let requests = [];
const fake = createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  requests.push({ headers: req.headers, body: JSON.parse(body) });
  const { status = 200, headers = {}, json } = replies.shift();
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(JSON.stringify(json));
});

const OUTPUT = {
  title: 'Voltix Pulse Buds Wireless Earbuds',
  short_description: 'Noise cancelling earbuds.',
  long_description: 'Para one.\n\nPara two.',
  bullet_points: ['Quiet: active noise cancellation', 'Tough: IPX5', 'Long: 32 hours'],
  seo_keywords: ['wireless earbuds', 'anc earbuds', 'bluetooth earbuds', 'earphones', 'voltix'],
  meta_description: 'Voltix wireless earbuds.',
};
const completion = (content, extra = {}) => ({
  json: {
    model: 'test/model:free',
    choices: [{ finish_reason: 'stop', message: { content } }],
    usage: { prompt_tokens: 1200, completion_tokens: 300, cost: 0 },
    ...extra,
  },
});

let generateDescription;
before(async () => {
  fake.listen(0);
  await new Promise((resolve) => fake.once('listening', resolve));
  // Configure before the app's config module loads (each test file runs in its own process).
  process.env.LLM_PROVIDER = 'openrouter';
  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.OPENROUTER_MODEL = 'test/model:free';
  process.env.OPENROUTER_BASE_URL = `http://localhost:${fake.address().port}`;
  ({ generateDescription } = await import('../src/lib/llm.js'));
});
after(() => fake.close());
beforeEach(() => {
  replies = [];
  requests = [];
});

const { ProductInput } = await import('../src/schemas/product.js');
const product = ProductInput.parse({ name: 'Pulse Buds', category: 'Electronics', brand: 'Voltix', features: ['ANC'] });
const options = { tone: 'friendly', length: 'short' };

test('sends the prompt with a JSON schema and parses fenced JSON replies', async () => {
  replies.push(completion(`Here you go:\n\`\`\`json\n${JSON.stringify(OUTPUT)}\n\`\`\``));
  const { output, meta } = await generateDescription(product, options);

  assert.deepEqual(output, OUTPUT);
  assert.equal(meta.provider, 'openrouter');
  assert.equal(meta.input_tokens, 1200);
  assert.equal(meta.attempts, 1);

  const [{ headers, body }] = requests;
  assert.equal(headers.authorization, 'Bearer test-key');
  assert.equal(body.model, 'test/model:free');
  assert.equal(body.response_format.json_schema.strict, true);
  assert.deepEqual(body.response_format.json_schema.schema.required.sort(), Object.keys(OUTPUT).sort());
  assert.match(body.messages[0].content, /# Output format/);
  assert.match(body.messages[1].content, /Pulse Buds/);
});

test('per-call settings override the model and reasoning effort', async () => {
  replies.push(completion(JSON.stringify(OUTPUT)));
  await generateDescription(product, options, { model: 'other/model:free', effort: 'low' });
  assert.equal(requests[0].body.model, 'other/model:free');
  assert.equal(requests[0].body.reasoning.effort, 'low');
});

test('retries when the reply is not valid JSON', async () => {
  replies.push(completion('Sorry, I cannot format that.'), completion(JSON.stringify(OUTPUT)));
  const { meta } = await generateDescription(product, options);
  assert.equal(meta.attempts, 2);
});

test('gives up with a 502 after repeated invalid replies', async () => {
  replies.push(...Array.from({ length: 3 }, () => completion('{"title": "only a title"}')));
  await assert.rejects(generateDescription(product, options), (error) => error.status === 502 && /did not return valid output/.test(error.message));
});

test('waits out a short per-minute rate limit, then retries', async () => {
  replies.push(
    { status: 429, headers: { 'x-ratelimit-reset': String(Date.now() + 50) }, json: { error: { message: 'Rate limit exceeded: free-models-per-min' } } },
    completion(JSON.stringify(OUTPUT)),
  );
  const { meta } = await generateDescription(product, options);
  assert.equal(meta.attempts, 2);
});

test('fails fast when the daily free quota is used up', async () => {
  const tomorrow = Date.now() + 12 * 3600 * 1000;
  replies.push({ status: 429, headers: { 'x-ratelimit-reset': String(tomorrow) }, json: { error: { message: 'Rate limit exceeded: free-models-per-day' } } });
  await assert.rejects(generateDescription(product, options), (error) => error.status === 429 && /free-models-per-day/.test(error.message));
  assert.equal(requests.length, 1);
});

test('reports upstream errors without retrying client errors', async () => {
  replies.push({ status: 400, json: { error: { message: 'model not found' } } });
  await assert.rejects(generateDescription(product, options), (error) => error.status === 400 && /model not found/.test(error.message));
  assert.equal(requests.length, 1);
});
