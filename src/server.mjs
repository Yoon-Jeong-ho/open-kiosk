import http from 'node:http';
import { readFile, mkdir, chmod, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { resolve, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { catalog, plans, presets } from './catalog.mjs';
import { AppError, applyOperations, pricedCart } from './cart.mjs';
import { interpret, transcribe } from './ai.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...(existsSync(join(root, '.env')) ? parseEnv(readFileSync(join(root, '.env'), 'utf8')) : {}), ...process.env };
const host = env.OPEN_KIOSK_HOST || '127.0.0.1';
const port = Number(env.PORT || 4188);
const dataDir = resolve(root, env.OPEN_KIOSK_DATA_DIR || '.data');
await mkdir(dataDir, { recursive: true, mode: 0o700 });
await chmod(dataDir, 0o700);
const dbPath = join(dataDir, 'open-kiosk.sqlite');
const db = new DatabaseSync(dbPath);
await chmod(dbPath, 0o600);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS stores(id TEXT PRIMARY KEY, name TEXT NOT NULL, plan TEXT NOT NULL DEFAULT 'trial', created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS operators(token_hash TEXT PRIMARY KEY, store_id TEXT NOT NULL, expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS kiosks(token_hash TEXT PRIMARY KEY, store_id TEXT NOT NULL, cart TEXT NOT NULL DEFAULT '[]', revision INTEGER NOT NULL DEFAULT 0, expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS menu_overrides(store_id TEXT NOT NULL, product_id TEXT NOT NULL, available INTEGER NOT NULL DEFAULT 1, price INTEGER NOT NULL, PRIMARY KEY(store_id, product_id));
  CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, store_id TEXT NOT NULL, number INTEGER NOT NULL, lines TEXT NOT NULL, total INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'received', kiosk_hash TEXT NOT NULL, revision INTEGER NOT NULL, created INTEGER NOT NULL, UNIQUE(kiosk_hash,revision));
  CREATE TABLE IF NOT EXISTS help_requests(id TEXT PRIMARY KEY, store_id TEXT NOT NULL, kiosk_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'waiting', created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY, store_id TEXT NOT NULL, plan TEXT NOT NULL, amount INTEGER NOT NULL, created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS usage(day TEXT PRIMARY KEY, requests INTEGER NOT NULL DEFAULT 0, tokens INTEGER NOT NULL DEFAULT 0);
`);
db.prepare("INSERT OR IGNORE INTO stores(id,name,plan,created) VALUES ('demo','OPEN GARDEN','demo',?)").run(Date.now());

const now = () => Date.now();
const uid = () => randomBytes(12).toString('hex');
const hash = (s) => createHash('sha256').update(s).digest('hex');
const day = () => new Date().toISOString().slice(0, 10);
const key = env.OPEN_KIOSK_AI_DISABLED === '1' ? '' : (env.OPENAI_API_KEY || '').trim();
const aiModel = env.OPENAI_MODEL || 'gpt-4.1-mini';
const audioModel = env.OPENAI_TRANSCRIBE_MODEL || 'gpt-transcribe';
const secureCookie = env.OPEN_KIOSK_SECURE_COOKIES === '1' ? '; Secure' : '';
const publicDir = join(root, 'public');
const buckets = new Map();

function limit(id, max, ms) {
  const t = now();
  let b = buckets.get(id);
  if (!b || b.until < t) { b = { count: 0, until: t + ms }; buckets.set(id, b); }
  if (++b.count > max) throw new AppError(429, '잠시 쉬었다가 다시 시도해 주세요.', 'rate_limit');
  if (buckets.size > 3000) for (const [k, v] of buckets) if (v.until < t) buckets.delete(k);
}
function cookieValue(req, name) {
  const found = (req.headers.cookie || '').split(';').map((s) => s.trim()).find((s) => s.startsWith(name + '='));
  const v = found?.slice(name.length + 1);
  return v && /^[a-f0-9]{64}$/.test(v) ? v : null;
}
function setCookie(res, name, token, age) {
  res.setHeader('Set-Cookie', `${name}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secureCookie}`);
}
function headers(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(self)');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; media-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
}
function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}
async function readBody(req, max = 12000, raw = false) {
  if (Number(req.headers['content-length'] || 0) > max) throw new AppError(413, '입력 크기가 너무 커요. 짧게 입력해 주세요.');
  if (!raw && !req.headers['content-type']?.startsWith('application/json')) throw new AppError(415, '지원하지 않는 요청 형식이에요.');
  const parts = []; let size = 0;
  for await (const part of req) { size += part.length; if (size > max) throw new AppError(413, '입력 크기가 너무 커요.'); parts.push(part); }
  const bytes = Buffer.concat(parts);
  if (raw) return bytes;
  try { const v = JSON.parse(bytes.toString()); if (!v || Array.isArray(v) || typeof v !== 'object') throw new Error(); return v; } catch { throw new AppError(400, '요청 내용을 확인해 주세요.'); }
}
function productsFor(storeId) {
  const overrides = db.prepare('SELECT * FROM menu_overrides WHERE store_id=?').all(storeId);
  return catalog.map((p) => { const o = overrides.find((o) => o.product_id === p.id); return { ...p, available: o ? !!o.available : true, price: o?.price ?? p.price }; });
}
function merchant(req) {
  const token = cookieValue(req, 'ok_merchant');
  const row = token && db.prepare('SELECT stores.* FROM operators JOIN stores ON stores.id=operators.store_id WHERE operators.token_hash=? AND operators.expires>?').get(hash(token), now());
  if (!row) throw new AppError(401, '체험 계정을 먼저 만들어 주세요.', 'unauthorized');
  return row;
}
function kiosk(req) {
  const token = cookieValue(req, 'ok_kiosk');
  const row = token && db.prepare('SELECT * FROM kiosks WHERE token_hash=? AND expires>?').get(hash(token), now());
  if (!row) throw new AppError(401, '주문 세션이 만료됐어요. 다시 시작해 주세요.', 'session_expired');
  return row;
}
function state(row) {
  const store = db.prepare('SELECT id,name,plan FROM stores WHERE id=?').get(row.store_id);
  if (!store) throw new AppError(404, '체험 매장이 종료됐어요.');
  const products = productsFor(row.store_id);
  const cart = pricedCart(JSON.parse(row.cart), products);
  return { store, products, cart, revision: row.revision, total: cart.reduce((n, l) => n + l.subtotal, 0), count: cart.reduce((n, l) => n + l.quantity, 0), ai_available: !!key };
}
function checkRevision(row, revision) {
  if (!Number.isInteger(revision) || row.revision !== revision) throw new AppError(409, '주문 내용이 바뀌었어요. 최신 내용을 확인하고 다시 선택해 주세요.', 'stale_revision');
}
function updateCart(row, next, revision) {
  const result = db.prepare('UPDATE kiosks SET cart=?, revision=revision+1 WHERE token_hash=? AND revision=?').run(JSON.stringify(next), row.token_hash, revision);
  if (!result.changes) throw new AppError(409, '다른 입력으로 주문이 바뀌었어요. 최신 내용을 확인해 주세요.', 'stale_revision');
  return db.prepare('SELECT * FROM kiosks WHERE token_hash=?').get(row.token_hash);
}
function reserveAI(req, row) {
  if (!key) throw new AppError(503, 'AI 연결이 준비 중이에요. 화면·키보드로 주문할 수 있어요.', 'ai_not_configured');
  limit(`ai-session:${row.token_hash}`, 30, 3600000);
  limit(`ai-ip:${req.socket.remoteAddress}`, 80, 3600000);
  const date = day();
  db.prepare('INSERT OR IGNORE INTO usage(day) VALUES (?)').run(date);
  const limitPerDay = Math.max(1, Math.min(5000, Number(env.OPEN_KIOSK_DAILY_AI_LIMIT || 200)));
  const result = db.prepare('UPDATE usage SET requests=requests+1 WHERE day=? AND requests<?').run(date, limitPerDay);
  if (!result.changes) throw new AppError(429, '오늘의 AI 체험 한도에 도달했어요. 화면 주문을 이용해 주세요.', 'daily_limit');
}
function parseOrder(o) { return { ...o, lines: JSON.parse(o.lines) }; }

async function handle(req, res) {
  headers(res);
  let url;
  try { url = new URL(req.url, `http://${req.headers.host}`); } catch { return json(res, 400, { error: '잘못된 주소예요.' }); }
  const path = url.pathname;
  const method = req.method;
  try {
    // Loopback deployments only accept loopback Host names (DNS rebinding protection).
    if (['127.0.0.1', '::1', 'localhost'].includes(host) && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new AppError(403, '허용되지 않은 서비스 주소예요.');
    if (path.startsWith('/api/')) {
      limit(`all:${req.socket.remoteAddress}`, 400, 60000);
      if (!['GET', 'POST', 'PATCH'].includes(method)) throw new AppError(405, '지원하지 않는 요청이에요.');
      if (method !== 'GET') {
        const origin = req.headers.origin;
        if (req.headers['x-open-kiosk'] !== '1' || (origin && new URL(origin).host !== req.headers.host)) throw new AppError(403, '이 사이트에서 다시 시도해 주세요.', 'origin_rejected');
      }
      if (method === 'GET' && path === '/api/health') return json(res, 200, { ok: true, demo: true, ai_configured: !!key, version: '0.1.0' });
      if (method === 'GET' && path === '/api/config') return json(res, 200, { plans, presets, ai_available: !!key });
      if (method === 'POST' && path === '/api/auth/demo') {
        limit(`signup:${req.socket.remoteAddress}`, 15, 3600000);
        const body = await readBody(req);
        const preset = presets.find((p) => p.id === body.preset);
        if (!preset || body.demo_acknowledged !== true) throw new AppError(400, '가상 매장을 고르고 체험 안내를 확인해 주세요.');
        const storeId = uid(); const token = randomBytes(32).toString('hex');
        db.exec('BEGIN IMMEDIATE');
        try {
          db.prepare('INSERT INTO stores(id,name,created) VALUES (?,?,?)').run(storeId, preset.name, now());
          db.prepare('INSERT INTO operators(token_hash,store_id,expires) VALUES (?,?,?)').run(hash(token), storeId, now() + 7 * 86400000);
          db.exec('COMMIT');
        } catch (e) { db.exec('ROLLBACK'); throw e; }
        setCookie(res, 'ok_merchant', token, 7 * 86400);
        return json(res, 201, { store_id: storeId, name: preset.name, demo: true });
      }
      if (method === 'GET' && path === '/api/merchant/me') return json(res, 200, { store: merchant(req) });
      if (method === 'POST' && path === '/api/auth/logout') {
        const token = cookieValue(req, 'ok_merchant');
        if (token) db.prepare('DELETE FROM operators WHERE token_hash=?').run(hash(token));
        setCookie(res, 'ok_merchant', '', 0); return json(res, 200, { ok: true });
      }
      if (method === 'POST' && path === '/api/subscription/demo') {
        const store = merchant(req); const body = await readBody(req);
        const plan = ['essential', 'plus'].includes(body.plan) ? plans[body.plan] : null;
        if (!plan || body.demo_acknowledged !== true || !/^[a-zA-Z0-9-]{16,80}$/.test(body.idempotency_key || '')) throw new AppError(400, '체험 요금제와 결제 안내를 확인해 주세요.');
        const id = `${store.id}:${body.idempotency_key}`;
        const existing = db.prepare('SELECT * FROM receipts WHERE id=?').get(id);
        if (existing) return json(res, 200, { ...existing, demo: true, charged: false });
        db.exec('BEGIN IMMEDIATE');
        try {
          db.prepare('UPDATE stores SET plan=? WHERE id=?').run(plan.id, store.id);
          db.prepare('INSERT INTO receipts(id,store_id,plan,amount,created) VALUES (?,?,?,?,?)').run(id, store.id, plan.id, plan.price, now());
          db.exec('COMMIT');
        } catch (e) { db.exec('ROLLBACK'); throw e; }
        return json(res, 201, { plan: plan.id, amount: plan.price, demo: true, charged: false });
      }
      if (method === 'POST' && path === '/api/subscription/cancel') {
        const store = merchant(req); await readBody(req);
        db.prepare("UPDATE stores SET plan='trial' WHERE id=?").run(store.id);
        return json(res, 200, { ok: true, charged: false });
      }
      if (method === 'GET' && path === '/api/merchant/dashboard') {
        const store = merchant(req);
        const orders = db.prepare('SELECT id,number,lines,total,status,created FROM orders WHERE store_id=? ORDER BY created DESC LIMIT 30').all(store.id).map(parseOrder);
        const help = db.prepare("SELECT id,status,created FROM help_requests WHERE store_id=? AND status='waiting' ORDER BY created DESC LIMIT 20").all(store.id);
        return json(res, 200, { store, orders, help, products: productsFor(store.id), kiosk_path: `/kiosk?store=${store.id}`, demo: true });
      }
      if (method === 'PATCH' && path === '/api/merchant/menu') {
        const store = merchant(req); const body = await readBody(req);
        const p = catalog.find((p) => p.id === body.product_id);
        if (!p || typeof body.available !== 'boolean') throw new AppError(400, '메뉴와 판매 상태를 확인해 주세요.');
        const price = body.price ?? productsFor(store.id).find((x) => x.id === p.id).price;
        if (!Number.isInteger(price) || price < 1000 || price > 50000) throw new AppError(400, '가격은 1,000원부터 50,000원 사이 정수로 입력해 주세요.');
        db.prepare('INSERT INTO menu_overrides(store_id,product_id,available,price) VALUES (?,?,?,?) ON CONFLICT(store_id,product_id) DO UPDATE SET available=excluded.available,price=excluded.price').run(store.id, p.id, body.available ? 1 : 0, price);
        return json(res, 200, { products: productsFor(store.id) });
      }
      if (method === 'PATCH' && path === '/api/merchant/order') {
        const store = merchant(req); const body = await readBody(req);
        const stages = ['received', 'preparing', 'ready', 'completed'];
        const order = db.prepare('SELECT * FROM orders WHERE id=? AND store_id=?').get(body.id || '', store.id);
        if (!order) throw new AppError(404, '주문을 찾지 못했어요.');
        if (stages.indexOf(body.status) !== stages.indexOf(order.status) + 1) throw new AppError(400, '다음 주문 단계로만 변경할 수 있어요.');
        db.prepare('UPDATE orders SET status=? WHERE id=? AND store_id=?').run(body.status, order.id, store.id);
        return json(res, 200, { ok: true });
      }
      if (method === 'PATCH' && path === '/api/merchant/help') {
        const store = merchant(req); const body = await readBody(req);
        db.prepare("UPDATE help_requests SET status='resolved' WHERE id=? AND store_id=?").run(body.id || '', store.id);
        return json(res, 200, { ok: true });
      }
      if (method === 'POST' && path === '/api/account/delete') {
        const store = merchant(req); const body = await readBody(req);
        if (body.confirm !== 'DELETE_DEMO') throw new AppError(400, '체험 데이터 삭제를 확인해 주세요.');
        db.exec('BEGIN IMMEDIATE');
        try {
          for (const table of ['operators', 'kiosks', 'menu_overrides', 'orders', 'help_requests', 'receipts']) db.prepare(`DELETE FROM ${table} WHERE store_id=?`).run(store.id);
          db.prepare('DELETE FROM stores WHERE id=?').run(store.id); db.exec('COMMIT');
        } catch (e) { db.exec('ROLLBACK'); throw e; }
        setCookie(res, 'ok_merchant', '', 0); return json(res, 200, { ok: true });
      }
      if (method === 'POST' && path === '/api/kiosk/bootstrap') {
        const body = await readBody(req);
        const storeId = typeof body.store === 'string' && /^[a-z0-9]{1,30}$/.test(body.store) ? body.store : 'demo';
        if (!db.prepare('SELECT id FROM stores WHERE id=?').get(storeId)) throw new AppError(404, '이 체험 매장은 종료됐어요. 기본 데모 매장을 이용해 주세요.');
        const current = cookieValue(req, 'ok_kiosk');
        const found = current && db.prepare('SELECT * FROM kiosks WHERE token_hash=? AND store_id=? AND expires>?').get(hash(current), storeId, now());
        if (found) return json(res, 200, state(found));
        limit(`bootstrap:${req.socket.remoteAddress}`, 60, 3600000);
        const token = randomBytes(32).toString('hex');
        db.prepare('INSERT INTO kiosks(token_hash,store_id,expires) VALUES (?,?,?)').run(hash(token), storeId, now() + 86400000);
        setCookie(res, 'ok_kiosk', token, 86400);
        return json(res, 201, state(db.prepare('SELECT * FROM kiosks WHERE token_hash=?').get(hash(token))));
      }
      if (method === 'GET' && path === '/api/kiosk/state') return json(res, 200, state(kiosk(req)));
      if (method === 'POST' && path === '/api/kiosk/action') {
        const row = kiosk(req); const body = await readBody(req); checkRevision(row, body.revision);
        const next = applyOperations(JSON.parse(row.cart), [body.operation], productsFor(row.store_id));
        const updated = updateCart(row, next, body.revision);
        return json(res, 200, { ...state(updated), reply: next.length ? '주문 내용을 바꿨어요. 아래에서 확인해 주세요.' : '장바구니가 비었어요. 원하는 메뉴를 골라 주세요.' });
      }
      if (method === 'POST' && path === '/api/kiosk/interpret') {
        const row = kiosk(req); const body = await readBody(req); checkRevision(row, body.revision);
        if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 500) throw new AppError(400, '주문을 500자 이내로 입력해 주세요.');
        reserveAI(req, row);
        const result = await interpret({ key, model: aiModel, text: body.text, cart: JSON.parse(row.cart), products: productsFor(row.store_id) });
        const fresh = kiosk(req); checkRevision(fresh, body.revision);
        const next = applyOperations(JSON.parse(fresh.cart), result.operations, productsFor(fresh.store_id));
        const updated = result.operations.length ? updateCart(fresh, next, body.revision) : fresh;
        db.prepare('UPDATE usage SET tokens=tokens+? WHERE day=?').run(result.usage, day());
        return json(res, 200, { ...state(updated), reply: result.reply, review: result.review && next.length > 0, changed: result.operations.length > 0, source: 'openai' });
      }
      if (method === 'POST' && path === '/api/kiosk/transcribe') {
        const row = kiosk(req);
        if (req.headers['x-audio-consent'] !== '1') throw new AppError(400, '음성 전송 안내에 동의한 뒤 녹음해 주세요.');
        const bytes = await readBody(req, 4 * 1024 * 1024, true);
        if (bytes.length < 100) throw new AppError(400, '녹음이 너무 짧아요. 다시 녹음해 주세요.');
        reserveAI(req, row);
        const text = await transcribe({ key, model: audioModel, bytes, type: req.headers['content-type'] || '' });
        return json(res, 200, { text, source: 'openai' });
      }
      if (method === 'POST' && path === '/api/kiosk/confirm') {
        const row = kiosk(req); const body = await readBody(req);
        if (!Number.isInteger(body.revision)) throw new AppError(400, '주문 내용을 다시 확인해 주세요.');
        const previous = db.prepare('SELECT id,number,total,status FROM orders WHERE kiosk_hash=? AND revision=?').get(row.token_hash, body.revision);
        if (previous) return json(res, 200, { order: previous, duplicate: true });
        checkRevision(row, body.revision);
        const s = state(row);
        if (!s.cart.length) throw new AppError(400, '먼저 메뉴를 골라 주세요.');
        if (s.cart.some((l) => !l.available)) throw new AppError(409, '품절된 메뉴가 있어요. 해당 메뉴를 빼고 다시 확인해 주세요.');
        if (body.confirmed !== true || body.total !== s.total) throw new AppError(409, '금액 또는 메뉴가 바뀌었어요. 최신 내용을 확인해 주세요.', 'review_required');
        const order = { id: uid(), number: 1 + db.prepare('SELECT COUNT(*) AS n FROM orders WHERE store_id=?').get(row.store_id).n, total: s.total, status: 'received' };
        db.exec('BEGIN IMMEDIATE');
        try {
          db.prepare('INSERT INTO orders(id,store_id,number,lines,total,kiosk_hash,revision,created) VALUES (?,?,?,?,?,?,?,?)').run(order.id, row.store_id, order.number, JSON.stringify(s.cart), s.total, row.token_hash, row.revision, now());
          updateCart(row, [], body.revision); db.exec('COMMIT');
        } catch (e) { db.exec('ROLLBACK'); throw e; }
        return json(res, 201, { order, demo: true, charged: false });
      }
      if (method === 'POST' && path === '/api/kiosk/help') {
        const row = kiosk(req); await readBody(req); limit(`help:${row.token_hash}`, 3, 60000);
        const existing = db.prepare("SELECT id FROM help_requests WHERE kiosk_hash=? AND status='waiting'").get(row.token_hash);
        if (!existing) db.prepare('INSERT INTO help_requests(id,store_id,kiosk_hash,created) VALUES (?,?,?,?)').run(uid(), row.store_id, row.token_hash, now());
        return json(res, 201, { ok: true, demo: true, message: row.store_id === 'demo' ? '도움 요청을 기록했어요. 공개 데모에는 실제 매장 직원이 연결되어 있지 않아요.' : '운영 화면으로 도움 요청을 보냈어요. 체험 매장이므로 실제 직원 방문은 보장되지 않아요.' });
      }
      throw new AppError(404, '요청한 기능을 찾지 못했어요.');
    }
    if (!['GET', 'HEAD'].includes(method)) throw new AppError(405, '지원하지 않는 요청이에요.');
    const pages = ['/', '/pricing', '/signup', '/checkout', '/dashboard', '/kiosk', '/tour', '/privacy', '/accessibility'];
    let relative = pages.includes(path) ? 'index.html' : decodeURIComponent(path).replace(/^\//, '');
    if (!/^(index\.html|favicon\.svg|style\.css|js\/[a-z-]+\.js)$/.test(relative)) throw new AppError(404, '페이지를 찾지 못했어요.');
    const file = join(publicDir, relative);
    const content = await readFile(file);
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
    res.writeHead(200, { 'Content-Type': types[extname(file)], 'Cache-Control': 'no-cache' });
    res.end(method === 'HEAD' ? undefined : content);
  } catch (e) {
    if (!e.status) console.error(JSON.stringify({ event: 'request_error', code: e.code || 'internal' }));
    if (!res.headersSent) json(res, e.status || (e.code === 'ENOENT' ? 404 : 500), { error: e.status ? e.message : '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.', code: e.code || 'internal' });
    else res.end();
  }
}

// Expire abandoned demo stores after seven days; never keep raw audio or transcripts.
const cleanup = setInterval(() => {
  db.prepare('DELETE FROM kiosks WHERE expires<?').run(now());
  db.prepare('DELETE FROM operators WHERE expires<?').run(now());
  const old = db.prepare("SELECT id FROM stores WHERE id!='demo' AND created<? AND id NOT IN (SELECT store_id FROM operators)").all(now() - 7 * 86400000);
  for (const { id } of old) {
    for (const table of ['kiosks', 'menu_overrides', 'orders', 'help_requests', 'receipts']) db.prepare(`DELETE FROM ${table} WHERE store_id=?`).run(id);
    db.prepare('DELETE FROM stores WHERE id=?').run(id);
  }
  db.prepare("DELETE FROM orders WHERE store_id='demo' AND created<?").run(now() - 86400000);
  db.prepare("DELETE FROM help_requests WHERE store_id='demo' AND created<?").run(now() - 86400000);
}, 3600000);
cleanup.unref();
const server = http.createServer(handle);
server.requestTimeout = 45000; server.headersTimeout = 10000; server.keepAliveTimeout = 5000;
server.listen(port, host, () => console.log(`Open Kiosk running at http://${host}:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { clearInterval(cleanup); server.close(() => { db.close(); process.exit(0); }); });
