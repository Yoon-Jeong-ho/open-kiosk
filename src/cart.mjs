import { randomBytes } from 'node:crypto';

export class AppError extends Error {
  constructor(status, message, code = 'invalid_request') { super(message); this.status = status; this.code = code; }
}
const fail = (message) => { throw new AppError(400, message); };
const quantity = (n, min = 1) => Number.isInteger(n) && n >= min && n <= 20;
function checkedAddons(value, product) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 3 || new Set(value).size !== value.length || value.some((id) => typeof id !== 'string' || !product.addons?.some((a) => a.id === id))) fail('이 메뉴에서 선택할 수 없는 추가 옵션이에요.');
  return [...value].sort();
}

// The model and the browser use the same constrained operations. Neither supplies prices.
export function applyOperations(previous, operations, products) {
  if (!Array.isArray(operations) || operations.length > 8) fail('한 번에 8개 이하의 변경을 요청해 주세요.');
  let cart = structuredClone(previous);
  const findProduct = (id) => {
    const p = products.find((p) => p.id === id);
    if (!p) fail('등록되지 않은 메뉴예요. 메뉴판에서 다시 선택해 주세요.');
    return p;
  };
  const findLine = (id) => {
    const line = cart.find((l) => l.id === id);
    if (!line) fail('변경할 메뉴를 찾지 못했어요. 현재 주문을 확인해 주세요.');
    return line;
  };
  for (const op of operations) {
    if (!op || typeof op !== 'object') fail('주문 변경 내용을 확인해 주세요.');
    if (op.type === 'clear') { cart = []; continue; }
    if (op.type === 'add') {
      const p = findProduct(op.product_id);
      if (!p.available) fail(`${p.name}은 지금 품절이에요. 다른 메뉴를 골라 주세요.`);
      const q = op.quantity ?? 1;
      if (!quantity(q)) fail('수량은 1잔부터 20잔까지 선택할 수 있어요.');
      const temperature = op.temperature ?? p.temperatures[0];
      if (!p.temperatures.includes(temperature)) fail('이 메뉴에서 선택할 수 없는 온도예요.');
      cart.push({ id: randomBytes(6).toString('hex'), product_id: p.id, temperature, quantity: q, addons: checkedAddons(op.addons, p) });
    } else if (op.type === 'remove') {
      findLine(op.line_id);
      cart = cart.filter((line) => line.id !== op.line_id);
    } else if (op.type === 'quantity') {
      const line = findLine(op.line_id);
      if (!quantity(op.quantity, 0)) fail('수량은 0잔부터 20잔까지 선택할 수 있어요.');
      line.quantity = op.quantity;
      cart = cart.filter((line) => line.quantity > 0);
    } else if (op.type === 'temperature' || op.type === 'split_temperature') {
      const line = findLine(op.line_id);
      const p = findProduct(line.product_id);
      if (!p.temperatures.includes(op.temperature)) fail('이 메뉴에서 선택할 수 없는 온도예요.');
      if (op.type === 'temperature') line.temperature = op.temperature;
      else {
        if (!quantity(op.quantity) || op.quantity > line.quantity) fail('바꾸려는 잔 수를 확인해 주세요.');
        if (op.quantity === line.quantity) line.temperature = op.temperature;
        else {
          line.quantity -= op.quantity;
          cart.push({ ...line, id: randomBytes(6).toString('hex'), quantity: op.quantity, temperature: op.temperature });
        }
      }
    } else if (op.type === 'addons') {
      const line = findLine(op.line_id); const p = findProduct(line.product_id);
      const addons = checkedAddons(op.addons, p); const q = op.quantity ?? line.quantity;
      if (!quantity(q) || q > line.quantity) fail('옵션을 바꾸려는 잔 수를 확인해 주세요.');
      if (q === line.quantity) line.addons = addons;
      else { line.quantity -= q; cart.push({ ...line, id: randomBytes(6).toString('hex'), quantity: q, addons }); }
    } else fail('지원하지 않는 주문 변경이에요.');
  }
  const merged = [];
  for (const line of cart) {
    line.addons = checkedAddons(line.addons, findProduct(line.product_id));
    const same = merged.find((l) => l.product_id === line.product_id && l.temperature === line.temperature && JSON.stringify(l.addons) === JSON.stringify(line.addons));
    if (same) same.quantity += line.quantity; else merged.push(line);
  }
  if (merged.reduce((n, l) => n + l.quantity, 0) > 20) fail('한 주문에서는 최대 20잔까지 선택할 수 있어요.');
  return merged;
}

export function pricedCart(cart, products) {
  return cart.map((line) => {
    const product = products.find((p) => p.id === line.product_id);
    if (!product) throw new AppError(409, '메뉴가 변경됐어요. 주문을 다시 확인해 주세요.');
    const addons = checkedAddons(line.addons, product);
    const selected = addons.map((id) => product.addons.find((a) => a.id === id));
    const addon_total = selected.reduce((n, a) => n + a.price, 0); const price = product.price + addon_total;
    return { ...line, addons, addon_names: selected.map((a) => a.name), addon_total, base_price: product.price, name: product.name, price, subtotal: price * line.quantity, available: product.available };
  });
}
