import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

// Product photos: upload to Supabase Storage, pick a Pexels photo, auto-photos for a catalog.
process.env.SUPABASE_URL = 'https://fakeproj.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
process.env.PEXELS_API_KEY = 'pexels_test';
process.env.LLM_PROVIDER = 'mock';

const realFetch = globalThis.fetch;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const retailer = { id: 'r1', owner_id: 'u1', business_name: 'Voltix Audio' };
const products = {
  p1: { id: 'p1', retailer_id: 'r1', name: 'AirFlow Pro', category: 'Electronics', subcategory: 'Wireless Earbuds', image_url: 'https://placehold.co/600x600' },
  p2: { id: 'p2', retailer_id: 'r1', name: 'Pulse Buds', category: 'Electronics', subcategory: 'Wireless Earbuds', image_url: null },
  p3: { id: 'p3', retailer_id: 'r1', name: 'CrispAir', category: 'Home & Kitchen', subcategory: 'Air Fryer', image_url: 'https://cdn.example.com/real.jpg' },
};
const calls = { uploads: [], pexels: [], updates: [] };

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  const method = (init.method ?? input.method ?? 'GET').toUpperCase();
  if (url.startsWith('https://api.pexels.com/')) {
    const query = new URL(url).searchParams.get('query');
    calls.pexels.push(query);
    return json({ photos: [1, 2].map((n) => ({ id: n, avg_color: '#ccc', alt: `${query} ${n}`, photographer: `Ana ${n}`, url: `https://www.pexels.com/photo/${n}/`, src: { medium: `https://images.pexels.com/photos/${n}/m.jpeg`, large: `https://images.pexels.com/photos/${n}/l.jpeg` } })) });
  }
  if (url.includes('fakeproj.supabase.co')) {
    if (url.includes('/auth/v1/user')) return json({ id: 'u1', email: 'v@x.com', aud: 'authenticated' });
    if (url.includes('/storage/v1/object/')) {
      calls.uploads.push({ url, type: new Headers(init.headers).get('content-type') });
      return json({ Key: 'product-images/x' });
    }
    if (url.includes('/retailers')) return json(retailer);
    if (url.includes('/products')) {
      const id = new URL(url).searchParams.get('id')?.replace(/^eq\./, '');
      if (method === 'PATCH') {
        const changes = JSON.parse(init.body);
        calls.updates.push({ id, ...changes });
        Object.assign(products[id], changes);
        return json(products[id]);
      }
      return json(id ? products[id] ?? null : Object.values(products));
    }
  }
  return realFetch(input, init);
};

const { createApp } = await import('../src/app.js');
let server;
let base;
before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://localhost:${server.address().port}/api`;
});
after(() => server.close());

const call = (method, path, body) => realFetch(`${base}${path}`, {
  method,
  headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
  body: body && JSON.stringify(body),
});

test('photo search returns Pexels photos with credit', async () => {
  const res = await call('GET', '/photos?query=wireless%20earbuds');
  assert.equal(res.status, 200);
  const { photos } = await res.json();
  assert.equal(photos[0].url, 'https://images.pexels.com/photos/1/l.jpeg');
  assert.equal(photos[0].credit, 'Ana 1 on Pexels');
});

test('an uploaded photo goes to Supabase Storage and its public URL is saved', async () => {
  const tinyJpeg = `data:image/jpeg;base64,${Buffer.from('fake-jpeg-bytes').toString('base64')}`;
  const res = await call('POST', '/products/p1/image', { upload: tinyJpeg });
  assert.equal(res.status, 200);
  const { product } = await res.json();
  assert.equal(calls.uploads.length, 1);
  assert.match(calls.uploads[0].url, /\/storage\/v1\/object\/product-images\/r1\/p1-\d+\.jpg/);
  assert.match(product.image_url, /\/storage\/v1\/object\/public\/product-images\/r1\/p1-\d+\.jpg$/);
  assert.equal(product.image_credit, null);
});

test('a picked photo must come from Pexels', async () => {
  const bad = await call('POST', '/products/p1/image', { photo: { url: 'https://evil.example.com/x.jpg', credit: 'x' } });
  assert.equal(bad.status, 400);
  const good = await call('POST', '/products/p1/image', { photo: { url: 'https://images.pexels.com/photos/9/l.jpeg', credit: 'Ana on Pexels', credit_url: 'https://www.pexels.com/photo/9/' } });
  assert.equal(good.status, 200);
  assert.equal((await good.json()).product.image_credit, 'Ana on Pexels');
});

test('auto-photos fills products without a real photo, one search per product type', async () => {
  products.p1.image_url = 'https://placehold.co/600x600';
  calls.pexels.length = 0;
  calls.updates.length = 0;
  const res = await call('POST', '/products/auto-photos');
  const body = await res.json();
  assert.deepEqual(body, { updated: 2, types: 1, configured: true });
  assert.deepEqual(calls.pexels, ['Wireless Earbuds']);
  assert.deepEqual(calls.updates.map((update) => update.id).sort(), ['p1', 'p2']);
  assert.notEqual(products.p1.image_url, products.p2.image_url, 'products of one type get different photos');
  assert.equal(products.p3.image_url, 'https://cdn.example.com/real.jpg', 'real photos are kept');
});

test('removing a photo clears it and its credit', async () => {
  const res = await call('DELETE', '/products/p1/image');
  const { product } = await res.json();
  assert.equal(product.image_url, null);
  assert.equal(product.image_credit, null);
});
