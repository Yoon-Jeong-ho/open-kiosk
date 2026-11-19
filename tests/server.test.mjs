import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { issueRecommendations } from '../src/recommendation-events.mjs';

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
  const oldDb = new DatabaseSync(join(tempDir, 'open-kiosk.sqlite'));
  oldDb.exec(`
    CREATE TABLE menu_overrides(store_id TEXT NOT NULL, product_id TEXT NOT NULL, available INTEGER NOT NULL DEFAULT 1, price INTEGER NOT NULL, PRIMARY KEY(store_id, product_id));
    INSERT INTO menu_overrides(store_id,product_id,available,price) VALUES ('demo','lemon',0,4700);
  `);
  oldDb.close();
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
test('a spoken menu replacement removes the old selection atomically and keeps unrelated items', async () => {
  const call = client(); const initial = await bootstrap(call);
  const { data: before } = await call('/api/kiosk/action', 'POST', { revision: initial.revision, operations: [
    { type: 'add', product_id: 'matcha', temperature: 'hot', quantity: 2 },
    { type: 'add', product_id: 'scone', quantity: 1 },
  ] });
  const interpret = (state, text) => call('/api/kiosk/interpret', 'POST', { revision: state.revision, text, language: 'ko' });
  const soldOut = await interpret(before, '말차 대신 레몬에이드');
  assert.equal(soldOut.status, 200);
  assert.match(soldOut.data.reply, /품절/);
  assert.equal(soldOut.data.revision, before.revision);
  assert.deepEqual(soldOut.data.cart, before.cart);

  const partial = await interpret(before, '아니, 말차 한 잔만 아이스티로 바꿔 주세요.');
  assert.equal(partial.status, 200);
  assert.deepEqual(partial.data.cart.map(({ product_id, quantity }) => [product_id, quantity]), [['matcha', 1], ['scone', 1], ['peach', 1]]);
  const replaced = await interpret(partial.data, '말차말고 아이스티');
  assert.equal(replaced.status, 200);
  assert.equal(replaced.data.revision, partial.data.revision + 1);
  assert.deepEqual(replaced.data.cart.map(({ product_id, quantity }) => [product_id, quantity]), [['scone', 1], ['peach', 2]]);
  assert.equal(replaced.data.cart[1].temperature, 'iced');
  assert.deepEqual(replaced.data.cart[0], before.cart[1]);
  assert.equal((await interpret(partial.data, '말차말고 아이스티')).status, 409);
  assert.deepEqual((await call('/api/kiosk/state')).data.cart, replaced.data.cart);

  const withShot = await interpret(replaced.data, '아이스티 한 잔을 빼고 초코라떼에 샷을 추가해 주세요');
  assert.equal(withShot.status, 200);
  assert.match(withShot.data.reply, /샷/);
  assert.deepEqual(withShot.data.cart.map(({ product_id, quantity, addons }) => [product_id, quantity, addons]), [
    ['scone', 1, []], ['peach', 1, []], ['chocolate', 1, ['shot']],
  ]);
});
test('an entire-menu order adds every available item and respects the order limit as a batch', async () => {
  const call = client(); let state = await bootstrap(call);
  const request = (text) => call('/api/kiosk/interpret', 'POST', { revision: state.revision, text });
  const items = state.products.filter((p) => p.available);
  assert.ok(items.length > 8);
  const added = await request('전체 메뉴 넣어줘');
  assert.equal(added.status, 200);
  assert.equal(added.data.navigation, 'all');
  assert.equal(added.data.count, items.length);
  assert.deepEqual(added.data.cart.map((line) => line.product_id), items.map((p) => p.id));
  for (const [i, line] of added.data.cart.entries()) {
    assert.equal(line.quantity, 1);
    assert.equal(line.temperature, items[i].temperatures[0] ?? null);
    assert.deepEqual(line.addons, []);
  }
  state = added.data;
  const oversized = await request('모든 메뉴를 한 개씩 장바구니에 다 담아 주세요');
  assert.equal(oversized.status, 200);
  assert.match(oversized.data.reply, /20개/);
  assert.equal(oversized.data.revision, state.revision);
  assert.deepEqual(oversized.data.cart, state.cart);
});
test('shots work on iced tea and chocolate latte, including partial quantities and touch orders', async () => {
  const call = client(); let state = await bootstrap(call);
  const request = (text) => call('/api/kiosk/interpret', 'POST', { revision: state.revision, text, language: 'ko' });
  const tea = await request('아이스티에 샷 추가');
  assert.equal(tea.status, 200);
  assert.equal(tea.data.total, 4300);
  assert.deepEqual(tea.data.cart[0].addons, ['shot']);
  state = tea.data;
  const repeated = await request('아이스티에 샷 추가');
  assert.equal(repeated.data.changed, false);
  assert.equal(repeated.data.revision, state.revision);

  const chocolate = await call('/api/kiosk/action', 'POST', { revision: state.revision, operation: { type: 'add', product_id: 'chocolate', temperature: 'hot', quantity: 2 } });
  assert.equal(chocolate.status, 200);
  state = chocolate.data;
  const partial = await request('따뜻한 초코라떼 한 잔에 샷 추가');
  assert.equal(partial.status, 200);
  assert.equal(partial.data.total - state.total, 500);
  assert.deepEqual(partial.data.cart.filter((l) => l.product_id === 'chocolate').map((l) => [l.quantity, l.addons]), [[1, []], [1, ['shot']]]);
  state = partial.data;
  const touch = await call('/api/kiosk/action', 'POST', { revision: state.revision, operation: { type: 'add', product_id: 'chocolate', temperature: 'iced', quantity: 1, addons: ['shot'] } });
  assert.equal(touch.status, 200);
  assert.equal(touch.data.total - state.total, 5000);
  assert.deepEqual(touch.data.cart.at(-1).addon_names, ['에스프레소 샷']);
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
test('existing price and stock overrides survive the recommendation settings migration', async () => {
  const { products } = await bootstrap(client());
  const lemon = products.find((p) => p.id === 'lemon');
  assert.deepEqual([lemon.price, lemon.available, lemon.recommended], [4700, false, false]);
});
test('merchant recommendation preferences are validated, editable, and isolated by store', async () => {
  const owner = client();
  const other = client();
  const customer = client();
  const { store_id } = await signup(owner);
  await signup(other);
  const setMenu = (call, fields) => call('/api/merchant/menu', 'PATCH', { product_id: 'toast', available: true, ...fields });
  const toast = (data) => data.products.find((p) => p.id === 'toast');
  await bootstrap(customer, store_id);

  assert.equal((await setMenu(customer, { recommended: true })).status, 401);
  assert.equal((await setMenu(owner, { recommended: 'true' })).status, 400);
  assert.equal(toast((await setMenu(owner, { recommended: true })).data).recommended, true);
  assert.equal(toast((await owner('/api/merchant/dashboard')).data).recommended, true);
  assert.equal(toast((await customer('/api/kiosk/state')).data).recommended, true);
  assert.equal(toast((await other('/api/merchant/dashboard')).data).recommended, false);

  const hidden = toast((await setMenu(owner, { available: false, price: 7000 })).data);
  assert.deepEqual([hidden.price, hidden.available, hidden.recommended], [7000, false, true]);
  assert.equal(toast((await setMenu(owner, { recommended: false })).data).recommended, false);
  assert.equal(toast((await customer('/api/kiosk/state')).data).recommended, false);
});
test('merchant analytics attributes a recommendation only when all of its added units survive confirmation', async () => {
  const owner = client();
  const customer = client();
  const other = client();
  const a = await signup(owner);
  await signup(other);
  const start = await customer('/api/kiosk/bootstrap', 'POST', { store: a.store_id });
  assert.equal(start.status, 201);
  const token = /ok_kiosk=([a-f0-9]{64})/.exec(start.headers.get('set-cookie'))[1];
  const kiosk = { store_id: a.store_id, token_hash: createHash('sha256').update(token).digest('hex') };
  const event = () => {
    const db = new DatabaseSync(join(tempDir, 'open-kiosk.sqlite'));
    const [data] = issueRecommendations(db, kiosk, [{ product_ids: ['toast', 'americano'], store_recommended: true, budget: 10000 }], Date.now());
    db.close();
    return data.recommendation_id;
  };
  const report = () => owner('/api/merchant/analytics?period=week');
  const shown = (ids) => customer('/api/kiosk/recommendations/shown', 'POST', { ids });
  const coffee = { type: 'add', product_id: 'americano', quantity: 1, temperature: 'iced' };
  const toast = { type: 'add', product_id: 'toast', quantity: 1 };
  const change = (revision, operations, recommendation_id) => customer('/api/kiosk/action', 'POST', { revision, operations, recommendation_id });
  const confirm = (state) => customer('/api/kiosk/confirm', 'POST', { revision: state.revision, total: state.total, confirmed: true });
  assert.equal((await owner('/api/merchant/analytics/report', 'POST', { period: 'week' })).data.code, 'report_no_data');

  const first = event();
  assert.deepEqual((await report()).data.analytics.funnel, { shown: 0, added: 0, confirmed: 0 });
  assert.equal((await shown([first, first])).status, 200);
  assert.equal((await shown([first])).status, 200);
  assert.equal((await change(0, [coffee], first)).status, 409);
  const add = await change(0, [coffee, toast], first);
  assert.equal(add.status, 200);
  assert.equal(add.data.cart.some((line) => 'recommendation_ids' in line), false);
  const merged = await change(add.data.revision, [coffee]);
  const cup = merged.data.cart.find((line) => line.product_id === 'americano');
  const split = await change(merged.data.revision, [{ type: 'split_temperature', line_id: cup.id, quantity: 1, temperature: 'hot' }]);
  assert.equal((await confirm(split.data)).status, 201);
  assert.equal((await confirm(split.data)).status, 200);

  const second = event();
  const withSecond = await change(split.data.revision + 1, [coffee, toast], second);
  const toastLine = withSecond.data.cart.find((line) => line.product_id === 'toast');
  const manual = await change(withSecond.data.revision, [{ type: 'remove', line_id: toastLine.id }, toast]);
  assert.equal((await confirm(manual.data)).status, 201);
  const live = (await report()).data.analytics;
  assert.deepEqual(live.funnel, { shown: 2, added: 2, confirmed: 1 });
  assert.deepEqual(live.totals, { orders: 2, amount: 22500, average: 11250 });
  assert.equal(live.combos[0].name, '아메리카노 + 에그 토스트');
  assert.equal((await other('/api/merchant/analytics')).data.analytics.funnel.shown, 0);
  assert.equal((await owner('/api/merchant/analytics/report', 'POST', { period: 'week' })).data.code, 'ai_not_configured');
});
test('three report examples have reproducible counts and do not change store analytics', async () => {
  const owner = client();
  assert.equal((await owner('/api/merchant/analytics')).status, 401);
  await signup(owner);
  const checks = [['brunch', 80, 20, 12], ['dessert', 60, 24, 6], ['new-menu', 6, 2, 1]];
  for (const [id, shown, added, confirmed] of checks) {
    const sample = await owner(`/api/merchant/analytics?period=week&example=${id}`);
    assert.equal(sample.status, 200);
    assert.equal(sample.data.example, id);
    assert.equal(sample.data.analytics.timeline.length, 7);
    assert.equal(sample.data.analytics.timeline.reduce((n, day) => n + day.amount, 0), sample.data.analytics.totals.amount);
    assert.deepEqual(sample.data.analytics.funnel, { shown, added, confirmed });
    assert.match(sample.data.report.evidence, new RegExp(`안내 ${shown}회 · 담기 ${added}회 · 주문 포함 ${confirmed}회`));
    assert.ok(sample.data.report.action.length > 10);
  }
  const monthly = (await owner('/api/merchant/analytics?period=month&example=brunch')).data.analytics;
  assert.equal(monthly.timeline.length, 30);
  assert.ok(monthly.previous && monthly.funnel.shown > 80);
  assert.equal((await owner('/api/merchant/analytics?period=month')).data.analytics.totals.orders, 0);
});
test('unavailable AI is explicitly reported without changing the cart', async () => {
  const call = client(); const state = (await add(call, await bootstrap(call))).data;
  const result = await call('/api/kiosk/interpret', 'POST', { text: '한 잔만 차갑게', revision: state.revision });
  assert.equal(result.status, 503); assert.equal(result.data.code, 'ai_not_configured');
  assert.equal((await call('/api/kiosk/speak','POST',{text:'Welcome.',language:'en'})).status,503);
  for(const body of [{text:'',language:'en'},{text:'x'.repeat(1201),language:'en'},{text:'Welcome.',language:'unsupported'}]) assert.equal((await call('/api/kiosk/speak','POST',body)).status,400);
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

test('syrup pricing and options persist through final confirmation into the merchant order', async (t) => {
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

  await t.test('preparation notes follow the selected units into the merchant order without changing prices', async () => {
    state = (await customer('/api/kiosk/state')).data;
    const change = (operation) => customer('/api/kiosk/action', 'POST', { revision: state.revision, operation });
    const added = await change({ type: 'add', product_id: 'latte', temperature: 'hot', quantity: 2, addons: ['hazelnut'] });
    assert.equal(added.status, 200);
    state = added.data;
    const marked = await change({ type: 'note', line_id: state.cart[0].id, quantity: 1, note: '  조금 덜 뜨겁게\n 준비  ' });
    assert.equal(marked.status, 200);
    assert.equal(marked.data.total, state.total);
    assert.deepEqual(marked.data.cart.map((line) => [line.quantity, line.note]), [[1, undefined], [1, '조금 덜 뜨겁게 준비']]);
    assert.ok(marked.data.cart.every((line) => line.temperature === 'hot' && line.addons.includes('hazelnut')));
    state = marked.data;

    const noteLine = state.cart.find((line) => line.note);
    assert.equal((await change({ type: 'note', line_id: noteLine.id, note: '가'.repeat(121) })).status, 400);
    assert.equal((await change({ type: 'note', line_id: noteLine.id, note: '조리 요청', quantity: 2 })).status, 400);
    assert.deepEqual((await customer('/api/kiosk/state')).data.cart, state.cart);
    const removed = await change({ type: 'note', line_id: noteLine.id, note: null });
    assert.equal(removed.status, 200);
    assert.deepEqual(removed.data.cart.map((line) => [line.quantity, line.note]), [[2, undefined]]);
    state = removed.data;

    const cold = await change({ type: 'add', product_id: 'peach', temperature: 'iced', quantity: 1, note: '얼음 반만' });
    assert.equal(cold.status, 200);
    state = cold.data;
    const adjusted = await change({ type: 'note', line_id: state.cart[0].id, quantity: 1, note: '조금 덜 뜨겁게' });
    assert.equal(adjusted.status, 200);
    state = adjusted.data;
    const receipt = await customer('/api/kiosk/confirm', 'POST', { revision: state.revision, total: state.total, confirmed: true });
    assert.equal(receipt.status, 201);
    const ticket = (await owner('/api/merchant/dashboard')).data.orders.find((order) => order.id === receipt.data.order.id);
    assert.equal(ticket.total, 13200);
    assert.deepEqual(ticket.lines.map((line) => [line.product_id, line.quantity, line.note ?? null]), [
      ['latte', 1, null], ['peach', 1, '얼음 반만'], ['latte', 1, '조금 덜 뜨겁게'],
    ]);
  });
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
