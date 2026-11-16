import { randomBytes } from 'node:crypto';
import { AppError } from './cart.mjs';

export function issueRecommendations(db, kiosk, recommendations, at) {
  if (!recommendations.length) return [];
  const insert = db.prepare(`
    INSERT INTO recommendation_events(id,store_id,kiosk_hash,products,store_pick,budget,issued_at)
    VALUES (?,?,?,?,?,?,?)
  `);
  return recommendations.map((recommendation) => {
    const id = randomBytes(12).toString('hex');
    const products = [...recommendation.product_ids].sort().join(',');
    insert.run(id, kiosk.store_id, kiosk.token_hash, products, Number(recommendation.store_recommended), recommendation.budget, at);
    return { ...recommendation, recommendation_id: id };
  });
}

const validId = (id) => typeof id === 'string' && /^[a-f0-9]{24}$/.test(id);

export function recordRecommendationDisplay(db, kiosk, ids, at) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 2 || !ids.every(validId)) {
    throw new AppError(400, '표시된 추천을 확인해 주세요.');
  }
  const update = db.prepare(`
    UPDATE recommendation_events SET shown_at=COALESCE(shown_at,?)
    WHERE kiosk_hash=? AND store_id=? AND id=? AND closed=0
  `);
  for (const id of new Set(ids)) update.run(at, kiosk.token_hash, kiosk.store_id, id);
}

export function checkRecommendationChoice(db, kiosk, id, operations, products) {
  const row = validId(id) && db.prepare(`
    SELECT products,budget FROM recommendation_events
    WHERE id=? AND kiosk_hash=? AND store_id=? AND closed=0 AND added_at IS NULL
  `).get(id, kiosk.token_hash, kiosk.store_id);
  const expected = row ? row.products.split(',') : [];
  const validOperations = Array.isArray(operations) && operations.length === expected.length
    && operations.every((op) => op?.type === 'add' && op.quantity === 1 && !op.addons?.length && expected.includes(op.product_id));
  if (!row || !validOperations || new Set(operations.map((op) => op.product_id)).size !== expected.length) {
    throw new AppError(409, '추천을 다시 열고 조합을 선택해 주세요.', 'recommendation_changed');
  }
  const total = operations.reduce((sum, op) => sum + products.find((p) => p.id === op.product_id).price, 0);
  if (row.budget !== null && total > row.budget) {
    throw new AppError(409, '가격이 바뀌어 추천 예산을 넘었어요. 추천을 다시 열어 주세요.', 'recommendation_changed');
  }
}

export function recordRecommendationAdd(db, id, at) {
  db.prepare('UPDATE recommendation_events SET shown_at=COALESCE(shown_at,?),added_at=? WHERE id=?').run(at, at, id);
}

export function closeRecommendations(db, kiosk, cart = [], orderId = null) {
  const retained = new Map();
  for (const line of cart) {
    for (const id of line.recommendation_ids || []) {
      if (!retained.has(id)) retained.set(id, new Set());
      retained.get(id).add(line.product_id);
    }
  }
  if (retained.size) {
    const update = db.prepare(`
      UPDATE recommendation_events SET order_id=?
      WHERE id=? AND kiosk_hash=? AND store_id=? AND products=? AND added_at IS NOT NULL AND closed=0
    `);
    for (const [id, products] of retained) {
      update.run(orderId, id, kiosk.token_hash, kiosk.store_id, [...products].sort().join(','));
    }
  }
  db.prepare('UPDATE recommendation_events SET closed=1 WHERE store_id=? AND kiosk_hash=? AND closed=0').run(kiosk.store_id, kiosk.token_hash);
}
