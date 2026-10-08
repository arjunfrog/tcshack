import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';

process.env.LLM_PROVIDER = 'groq';
process.env.GROQ_API_KEY = 'test-key';
const { generateDescription } = await import('../src/lib/llm.js');

const product = { name: 'Pulse Buds', category: 'Electronics', features: ['ANC'], specifications: {}, attributes: {}, seed_keywords: [] };
const options = { tone: 'friendly', length: 'short' };
const copy = {
  title: 'Pulse Buds Wireless Earbuds',
  short_description: 'Quiet when you need it.',
  long_description: 'One.\n\nTwo.',
  bullet_points: ['a', 'b', 'c'],
  seo_keywords: ['wireless earbuds'],
  meta_description: 'Shop Pulse Buds wireless earbuds.',
};

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const reply = (content) =>
  new Response(JSON.stringify({
    model: 'llama-3.3-70b-versatile',
    choices: [{ finish_reason: 'stop', message: { content } }],
    usage: { prompt_tokens: 10, completion_tokens: 20 },
  }));

test('parses and validates the JSON reply', async () => {
  let sent;
  globalThis.fetch = async (url, init) => { sent = JSON.parse(init.body); return reply(JSON.stringify(copy)); };

  const { output, meta } = await generateDescription(product, options);
  assert.deepEqual(output, copy);
  assert.equal(meta.provider, 'groq');
  assert.equal(meta.output_tokens, 20);
  assert.equal(sent.response_format.type, 'json_object');
  assert.equal(sent.model, 'openai/gpt-oss-120b');
  assert.equal(sent.reasoning_effort, 'medium');
});

test('retries once when the reply is missing fields', async () => {
  const replies = [JSON.stringify({ title: 'only a title' }), JSON.stringify(copy)];
  globalThis.fetch = async () => reply(replies.shift());

  const { output } = await generateDescription(product, options);
  assert.equal(output.title, copy.title);
});

test('reports a bad API key clearly', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'Invalid API Key' } }), { status: 401 });
  await assert.rejects(generateDescription(product, options), /GROQ_API_KEY/);
});
