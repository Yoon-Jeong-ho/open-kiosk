import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';

let child; let tempDir; const port = 24000 + Math.floor(Math.random() * 12000); const base = `http://127.0.0.1:${port}`;
function client() {
  const cookies = new Map();
  return async (path, method = 'GET', body, moreHeaders = {}) => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Open-Kiosk': '1', Origin: base, Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '), ...moreHeaders }, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(';')[0]; const i = pair.indexOf('='); cookies.set(pair.slice(0, i), pair.slice(i + 1)); }
    const data = response.headers.get('content-type')?.includes('json') ? await response.json() : await response.text();
    return { status: response.status, data, headers: response.headers };
  };
}
const signup = async (call, preset = 'garden') => (await call('/api/auth/demo', 'POST', { preset, demo_acknowledged: true })).data;
const bootstrap = async (call, store = 'demo') => (await call('/api/kiosk/bootstrap', 'POST', { store })).data;
const add = async (call, state) => call('/api/kiosk/action', 'POST', { revision: state.revision, operation: { type: 'add', product_id: 'americano', temperature: 'hot', quantity: 2, price: 1 } });

before(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'open-kiosk-test-'));
  child = spawn(process.execPath, ['src/server.mjs'], { env: { ...process.env, PORT: String(port), OPEN_KIOSK_AI_DISABLED: '1', OPEN_KIOSK_HOST: '127.0.0.1', OPEN_KIOSK_DATA_DIR: tempDir }, stdio: ['ignore', 'ignore', 'ignore'] });
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) return; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  throw new Error('Test server did not start');
});
after(async () => { if (child && child.exitCode === null) { const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited; } if (tempDir) await rm(tempDir, { recursive: true, force: true }); });

test('serves pages and never serves environment, git or runtime files', async () => {
  const call = client();
  for (const path of ['/', '/pricing', '/signup', '/checkout', '/dashboard', '/kiosk', '/privacy', '/accessibility', '/js/app.js']) assert.equal((await call(path)).status, 200, path);
  for (const path of ['/.env', '/.git/config', '/.data/open-kiosk.sqlite', '/src/server.mjs']) assert.equal((await call(path)).status, 404, path);
  assert.equal((await call('/api/health')).data.ai_configured, false);
});
test('rejects cross-origin mutations and unauthorized merchant actions', async () => {
  const call = client();
  assert.equal((await call('/api/auth/demo', 'POST', { preset: 'garden', demo_acknowledged: true }, { Origin: 'https://untrusted.example' })).status, 403);
  assert.equal((await call('/api/merchant/dashboard')).status, 401);
  assert.equal((await call('/api/subscription/demo', 'POST', { plan: 'essential' })).status, 401);
});
test('merchant signup accepts only synthetic store presets and creates an HttpOnly session', async () => {
  const call = client();
  assert.equal((await call('/api/auth/demo', 'POST', { preset: 'someone@example.com', demo_acknowledged: true })).status, 400);
  const result = await call('/api/auth/demo', 'POST', { preset: 'garden', demo_acknowledged: true });
  assert.equal(result.status, 201); assert.match(result.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  assert.equal((await call('/api/merchant/me')).data.store.name, '가든 커피');
});
test('subscription changes only the virtual merchant plan and is idempotent', async () => {
  const call = client(); await signup(call);
  const body = { plan: 'plus', demo_acknowledged: true, idempotency_key: randomUUID() };
  const a = await call('/api/subscription/demo', 'POST', body); const b = await call('/api/subscription/demo', 'POST', body);
  assert.equal(a.status, 201); assert.equal(b.status, 200); assert.equal(a.data.charged, false);
  assert.equal(a.data.amount, 59000); assert.equal((await call('/api/merchant/me')).data.store.plan, 'plus');
});
test('cart revisions prevent stale updates and all prices come from the menu', async () => {
  const call = client(); const initial = await bootstrap(call); const added = await add(call, initial);
  assert.equal(added.data.total, 7000); assert.equal(added.data.count, 2);
  assert.equal((await add(call, initial)).status, 409);
  const line = added.data.cart[0];
  const split = await call('/api/kiosk/action', 'POST', { revision: added.data.revision, operation: { type: 'split_temperature', line_id: line.id, quantity: 1, temperature: 'iced' } });
  assert.equal(split.data.count, 2); assert.equal(split.data.cart.length, 2); assert.equal(split.data.total, 7000);
  assert.deepEqual((await call('/api/kiosk/state')).data.cart, split.data.cart);
});
test('final confirmation rejects altered totals, prevents duplicates, and isolates merchant orders', async () => {
  const owner = client(); const other = client(); const customer = client(); const a = await signup(owner); await signup(other, 'campus');
  const cart = (await add(customer, await bootstrap(customer, a.store_id))).data;
  assert.equal((await customer('/api/kiosk/confirm', 'POST', { revision: cart.revision, confirmed: true, total: 1 })).status, 409);
  const payload = { revision: cart.revision, confirmed: true, total: cart.total };
  const first = await customer('/api/kiosk/confirm', 'POST', payload); const duplicate = await customer('/api/kiosk/confirm', 'POST', payload);
  assert.equal(first.status, 201); assert.equal(duplicate.status, 200); assert.equal(first.data.order.id, duplicate.data.order.id);
  assert.equal((await owner('/api/merchant/dashboard')).data.orders.length, 1);
  assert.equal((await other('/api/merchant/dashboard')).data.orders.length, 0);
  assert.equal((await other('/api/merchant/order', 'PATCH', { id: first.data.order.id, status: 'preparing' })).status, 404);
  assert.equal((await owner('/api/merchant/order', 'PATCH', { id: first.data.order.id, status: 'completed' })).status, 400);
  assert.equal((await owner('/api/merchant/order', 'PATCH', { id: first.data.order.id, status: 'preparing' })).status, 200);
});
test('price and stock changes are rechecked at confirmation', async () => {
  const owner = client(); const customer = client(); const store = await signup(owner);
  const cart = (await add(customer, await bootstrap(customer, store.store_id))).data;
  await owner('/api/merchant/menu', 'PATCH', { product_id: 'americano', available: true, price: 3900 });
  assert.equal((await customer('/api/kiosk/state')).data.total, 7800);
  assert.equal((await customer('/api/kiosk/confirm', 'POST', { revision: cart.revision, confirmed: true, total: cart.total })).status, 409);
  await owner('/api/merchant/menu', 'PATCH', { product_id: 'americano', available: false, price: 3900 });
  assert.equal((await customer('/api/kiosk/confirm', 'POST', { revision: cart.revision, confirmed: true, total: 7800 })).status, 409);
});
test('unavailable AI is explicitly reported without changing the cart', async () => {
  const call = client(); const state = (await add(call, await bootstrap(call))).data;
  const result = await call('/api/kiosk/interpret', 'POST', { text: '한 잔만 차갑게', revision: state.revision });
  assert.equal(result.status, 503); assert.equal(result.data.code, 'ai_not_configured');
  assert.deepEqual((await call('/api/kiosk/state')).data.cart, state.cart);
});
test('help requests are delivered to the correct virtual merchant', async () => {
  const owner = client(); const customer = client(); const store = await signup(owner);
  await bootstrap(customer, store.store_id); await customer('/api/kiosk/help', 'POST', {});
  const data = (await owner('/api/merchant/dashboard')).data;
  assert.equal(data.help.length, 1);
  await owner('/api/merchant/help', 'PATCH', { id: data.help[0].id });
  assert.equal((await owner('/api/merchant/dashboard')).data.help.length, 0);
});
test('deleting a synthetic account removes its session and linked kiosk access', async () => {
  const owner = client(); const customer = client(); const store = await signup(owner);
  await bootstrap(customer, store.store_id);
  assert.equal((await owner('/api/account/delete', 'POST', { confirm: 'DELETE_DEMO' })).status, 200);
  assert.equal((await owner('/api/merchant/dashboard')).status, 401);
  assert.equal((await customer('/api/kiosk/state')).status, 401);
  assert.equal((await customer('/api/kiosk/bootstrap', 'POST', { store: store.store_id })).status, 404);
});

test('syrup pricing and options persist through final confirmation into the merchant order', async () => {
  const owner = client(), customer = client(); const store = await signup(owner);
  let state = await bootstrap(customer, store.store_id);
  state = (await customer('/api/kiosk/action', 'POST', { revision: state.revision, operation: { type: 'add', product_id: 'americano', temperature: 'iced', quantity: 2 } })).data;
  state = (await customer('/api/kiosk/action', 'POST', { revision: state.revision, operation: { type: 'split_temperature', line_id: state.cart[0].id, temperature: 'hot', quantity: 1 } })).data;
  const iced = state.cart.find((l) => l.temperature === 'iced');
  state = (await customer('/api/kiosk/action', 'POST', { revision: state.revision, operation: { type: 'addons', line_id: iced.id, addons: ['hazelnut'], price: 0, addon_total: 0 } })).data;
  assert.equal(state.total, 7500);
  assert.equal((await customer('/api/kiosk/confirm', 'POST', { revision: state.revision, total: 7000, confirmed: true })).status, 409);
  assert.equal((await customer('/api/kiosk/confirm', 'POST', { revision: state.revision, total: 7500, confirmed: true })).status, 201);
  const order = (await owner('/api/merchant/dashboard')).data.orders[0];
  assert.equal(order.total, 7500);
  assert.deepEqual(order.lines.find((l) => l.temperature === 'iced').addon_names, ['헤이즐넛 시럽']);
  assert.deepEqual(order.lines.find((l) => l.temperature === 'hot').addons, []);
});
test('demo video supports playback, byte ranges, seeking and captions without exposing other files', async () => {
  const path = base + '/media/voice-order-demo.mp4';
  const head = await fetch(path, { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal(head.headers.get('content-type'), 'video/mp4'); assert.equal(head.headers.get('accept-ranges'), 'bytes');
  const size = Number(head.headers.get('content-length')); assert.ok(size > 10000);
  const partial = await fetch(path, { headers: { Range: 'bytes=0-31' } });
  assert.equal(partial.status, 206); assert.equal(partial.headers.get('content-range'), `bytes 0-31/${size}`);
  const bytes = Buffer.from(await partial.arrayBuffer()); assert.equal(bytes.length, 32); assert.equal(bytes.subarray(4,8).toString(), 'ftyp');
  const suffix = await fetch(path, { headers: { Range: 'bytes=-16' } }); assert.equal(suffix.status, 206); assert.equal((await suffix.arrayBuffer()).byteLength, 16);
  for (const range of [`bytes=${size}-`, 'bytes=32-10', 'bytes=-0', 'bytes=0-1,4-5']) assert.equal((await fetch(path, { headers: { Range: range } })).status, 416);
  assert.match(await (await fetch(base + '/media/voice-order-demo.vtt')).text(), /^WEBVTT/);
  assert.equal((await fetch(base + '/media/voice-order-demo.jpg')).headers.get('content-type'), 'image/jpeg');
  for (let i = 1; i <= 4; i++) {
    const sample = await fetch(base + `/media/voice-sample-0${i}.mp3`);
    assert.equal(sample.status, 200); assert.equal(sample.headers.get('content-type'), 'audio/mpeg'); assert.ok((await sample.arrayBuffer()).byteLength > 1000);
  }
  for (let i = 1; i <= 3; i++) {
    const sample = await fetch(base + `/media/menu-sample-0${i}.mp3`);
    assert.equal(sample.status, 200); assert.equal(sample.headers.get('content-type'), 'audio/mpeg'); assert.ok((await sample.arrayBuffer()).byteLength > 1000);
  }
  assert.equal((await fetch(base + '/media/menu-sample-04.mp3')).status, 404);
  assert.equal((await fetch(base + '/media/voice-sample-05.mp3')).status, 404);
  assert.equal((await fetch(base + '/media/transcripts.json')).status, 404);
});

test('a selected coffee and brunch set is added atomically at server prices and appears in the merchant order', async () => {
  const owner=client(), customer=client(); const store=await signup(owner); let state=await bootstrap(customer,store.store_id);
  const operations=[{type:'add',product_id:'americano',temperature:'iced',quantity:1,price:1},{type:'add',product_id:'sandwich',temperature:null,quantity:1,price:1}];
  const added=await customer('/api/kiosk/action','POST',{revision:state.revision,operations});
  assert.equal(added.status,200); state=added.data; assert.equal(state.total,10000); assert.equal(state.count,2);
  assert.equal(state.cart.find((l)=>l.product_id==='sandwich').temperature,null);
  const bad=await customer('/api/kiosk/action','POST',{revision:state.revision,operations:[{type:'add',product_id:'scone',quantity:1},{type:'add',product_id:'unknown',quantity:1}]});
  assert.equal(bad.status,400); assert.deepEqual((await customer('/api/kiosk/state')).data.cart,state.cart);
  assert.equal((await customer('/api/kiosk/confirm','POST',{revision:state.revision,total:10000,confirmed:true})).status,201);
  const order=(await owner('/api/merchant/dashboard')).data.orders[0]; assert.equal(order.total,10000); assert.equal(order.lines.find((l)=>l.product_id==='sandwich').unit,'item');
});
