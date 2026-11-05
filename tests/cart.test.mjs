import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyOperations, pricedCart } from '../src/cart.mjs';
import { catalog } from '../src/catalog.mjs';
const menu = catalog.map((p) => ({ ...p, available: true }));

test('split one of two hot drinks without losing quantity or the original line', () => {
  const before = [{ id: 'line-a', product_id: 'americano', temperature: 'hot', quantity: 2 }];
  const next = applyOperations(before, [{ type: 'split_temperature', line_id: 'line-a', quantity: 1, temperature: 'iced' }], menu);
  assert.equal(next.length, 2); assert.equal(next[0].id, 'line-a');
  assert.deepEqual(next.map((l) => [l.temperature, l.quantity]), [['hot', 1], ['iced', 1]]);
  assert.equal(before[0].quantity, 2);
  assert.equal(pricedCart(next, menu).reduce((n, l) => n + l.subtotal, 0), 7000);
});
test('adding through another channel merges identical options', () => {
  const before = [{ id: 'line-a', product_id: 'americano', temperature: 'hot', quantity: 1 }];
  const next = applyOperations(before, [{ type: 'add', product_id: 'americano', temperature: 'hot', quantity: 1, price: 1 }], menu);
  assert.equal(next.length, 1); assert.equal(next[0].quantity, 2); assert.equal(next[0].id, 'line-a');
  assert.equal(pricedCart(next, menu)[0].subtotal, 7000);
});
test('rejects unknown products, unavailable products and invalid options', () => {
  assert.throws(() => applyOperations([], [{ type: 'add', product_id: 'invented', quantity: 1 }], menu));
  assert.throws(() => applyOperations([], [{ type: 'add', product_id: 'lemon', temperature: 'hot', quantity: 1 }], menu));
  assert.throws(() => applyOperations([], [{ type: 'add', product_id: 'americano', quantity: 1 }], menu.map((p) => ({ ...p, available: false }))));
});
test('atomic validation preserves the previous cart when a later operation is invalid', () => {
  const previous = [{ id: 'a', product_id: 'latte', temperature: 'iced', quantity: 1 }];
  assert.throws(() => applyOperations(previous, [{ type: 'quantity', line_id: 'a', quantity: 2 }, { type: 'remove', line_id: 'unknown' }], menu));
  assert.equal(previous[0].quantity, 1);
  assert.throws(() => applyOperations(previous, [{ type: 'quantity', line_id: 'a', quantity: 1.5 }], menu));
  assert.throws(() => applyOperations(previous, [{ type: 'add', product_id: 'latte', temperature: 'hot', quantity: 20 }], menu));
});
