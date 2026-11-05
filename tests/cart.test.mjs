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

test('two iced americanos can become one hot and one iced with syrup only on the iced drink', () => {
  let cart = applyOperations([], [{ type: 'add', product_id: 'americano', temperature: 'iced', quantity: 2 }], menu);
  cart = applyOperations(cart, [{ type: 'split_temperature', line_id: cart[0].id, quantity: 1, temperature: 'hot' }], menu);
  const iced = cart.find((l) => l.temperature === 'iced');
  cart = applyOperations(cart, [{ type: 'addons', line_id: iced.id, addons: ['hazelnut'], price: 1 }], menu);
  const priced = pricedCart(cart, menu);
  assert.equal(priced.reduce((n, l) => n + l.quantity, 0), 2);
  assert.equal(priced.reduce((n, l) => n + l.subtotal, 0), 7500);
  assert.deepEqual(priced.find((l) => l.temperature === 'hot').addons, []);
  assert.deepEqual(priced.find((l) => l.temperature === 'iced').addon_names, ['헤이즐넛 시럽']);
});
test('different add-ons stay separate and removing an add-on merges matching drinks', () => {
  let cart = applyOperations([], [{ type: 'add', product_id: 'americano', temperature: 'iced', quantity: 2 }], menu);
  cart = applyOperations(cart, [{ type: 'addons', line_id: cart[0].id, quantity: 1, addons: ['hazelnut'] }], menu);
  assert.equal(cart.length, 2);
  const syrup = cart.find((l) => l.addons.length);
  cart = applyOperations(cart, [{ type: 'temperature', line_id: syrup.id, temperature: 'hot' }], menu);
  assert.deepEqual(cart.find((l) => l.id === syrup.id).addons, ['hazelnut']);
  cart = applyOperations(cart, [{ type: 'temperature', line_id: syrup.id, temperature: 'iced' }, { type: 'addons', line_id: syrup.id, addons: [] }], menu);
  assert.equal(cart.length, 1); assert.equal(cart[0].quantity, 2);
});
test('rejects invented, repeated, unavailable add-ons and invalid partial quantities atomically', () => {
  const before = [{ id: 'a', product_id: 'americano', temperature: 'iced', quantity: 2 }];
  for (const patch of [{ addons: ['free'] }, { addons: ['hazelnut', 'hazelnut'] }, { addons: ['hazelnut'], quantity: 3 }, { addons: ['hazelnut'], quantity: .5 }]) assert.throws(() => applyOperations(before, [{ type: 'addons', line_id: 'a', ...patch }], menu));
  assert.throws(() => applyOperations([], [{ type: 'add', product_id: 'lemon', temperature: 'iced', quantity: 1, addons: ['hazelnut'] }], menu));
  assert.equal(before[0].quantity, 2); assert.equal(before[0].addons, undefined);
});
