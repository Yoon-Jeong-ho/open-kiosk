import { maxOrderItems } from './cart.mjs';
import { shotCommand, utteranceLanguage } from '../public/js/conversation.js';
import { isLanguage, languages, productName, quantityText, tr } from '../public/js/locale.js';
import { isWholeMenuOrder } from '../public/js/menu-intent.js';

const compact = (text) => text.normalize('NFKC').toLowerCase().replace(/\s+/gu, '');
const counts = { 한: 1, 하나: 1, 두: 2, 둘: 2, 세: 3, 셋: 3, 네: 4, 넷: 4 };
const temperatures = [
  ['hot', /^(?:따뜻(?:한|하게)|따듯(?:한|하게)|뜨거운|핫|hot\s+|ホット|热)\s*/u],
  ['iced', /^(?:차가운|차갑게|시원한|아이스|iced?\s+|アイス|冰)\s*/u],
];

function productReference(phrase, products) {
  const text = phrase.trim().replace(/^(?:the|an?)\s+/i, '');
  const count = text.match(/(?:(\d{1,2}|한|두|세|네|하나|둘|셋|넷)\s*(?:잔|개|컵|杯|個|份)|(하나|둘|셋|넷))(?:만|을|를)?$/u);
  const name = (count ? text.slice(0, count.index) : text).trim();
  const amount = count?.[1] ?? count?.[2];
  const quantity = amount === undefined ? null : counts[amount] ?? Number(amount);
  const find = (value) => products.find((p) => [p.name, p.en, ...(p.aliases || []), ...languages.map(({ id }) => productName(p, id))].some((alias) => alias && compact(alias) === compact(value)));
  const exact = find(name);
  if (exact) return { product: exact, temperature: null, quantity };
  for (const [temperature, prefix] of temperatures) {
    const product = find(name.replace(prefix, ''));
    if (product) return { product, temperature, quantity };
  }
  return null;
}

function replacementPhrases(text) {
  const korean = text.replace(/^(?:아니|아|그럼)(?:\s*[,，]\s*|\s+)/u, '');
  const contrast = korean.match(/^(.+?)\s*(?:말고|빼고|대신(?:에)?)\s*(.+)$/u);
  const change = korean.match(/^(.+?(?:잔만|개만|하나만)|.+?)[을를]?\s+(.+?)(?:으?로)\s*(?:바꿔|변경해)(?:\s*(?:줘요?|주세요))?$/u);
  const english = text.match(/^(?:please\s+)?(?:replace|swap|change)\s+(.+?)\s+(?:with|for|to)\s+(.+?)(?:\s+please)?$/i);
  if (contrast) return [contrast[1].trim().replace(/[을를]$/u, ''), contrast[2].trim()];
  if (change || english) return [change?.[1] ?? english[1], change?.[2] ?? english[2]];
  return null;
}

export function resolveOrderRequest({ text, cart, products, language }) {
  language = utteranceLanguage(text, isLanguage(language) ? language : 'ko');
  text = text.trim().toLowerCase().replace(/[.!?。！？]+$/u, '').trim();
  const result = (message, values, operations = [], navigation = null) => ({
    reply: tr(language, message, values), operations, navigation, review: false,
  });
  const label = (product) => productName(product, language);
  const linesFor = ({ product, temperature }) => cart.filter((line) => line.product_id === product.id && (!temperature || line.temperature === temperature));
  const supportsShot = (product) => product?.addons.some(({ id }) => id === 'shot');
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const fits = (added, removed = 0) => count - removed + added <= maxOrderItems;
  const tooMany = () => result('wholeMenuLimit', { limit: maxOrderItems });

  if (isWholeMenuOrder(text)) {
    const available = products.filter((p) => p.available);
    if (!available.length) return result('wholeMenuEmpty', {}, [], 'all');
    if (!fits(available.length)) return tooMany();
    const operations = available.map((p) => ({ type: 'add', product_id: p.id, quantity: 1, temperature: p.temperatures[0] ?? null }));
    return result('wholeMenuAdded', { count: available.length }, operations, 'all');
  }

  const phrases = replacementPhrases(text);
  if (phrases) {
    const [sourcePhrase, targetPhrase] = phrases;
    const shot = shotCommand(targetPhrase);
    const plainTarget = targetPhrase.replace(/(?:으?로)?\s*(?:바꿔|변경해|담아|넣어|해|주세요|줘)(?:\s*(?:줘요?|주세요))?$/u, '').replace(/으?로$/u, '');
    const from = productReference(sourcePhrase, products);
    const to = productReference(shot?.product ?? plainTarget, products);
    if (!from || !to || from.product.id === to.product.id) return null;
    const source = label(from.product), target = label(to.product);
    const lines = linesFor(from);
    if (!lines.length) return result('orderItemMissing', { product: source });
    if (!to.product.available) return result('orderItemUnavailable', { product: target });
    if (shot?.enabled && !supportsShot(to.product)) return result('orderShotUnavailable', { product: target });
    const total = lines.reduce((sum, line) => sum + line.quantity, 0);
    const removed = from.quantity ?? total;
    const added = to.quantity ?? removed;
    if (removed < 1 || removed > total || added < 1) return result('orderQuantityCheck', { product: source });
    if (!fits(added, removed)) return tooMany();
    if (lines.length > 1 && (removed !== total || added !== removed)) return result('orderLineChoice', { product: source });
    const options = to.product.temperatures;
    if (to.temperature && !options.includes(to.temperature)) return result('orderTemperatureUnavailable', { product: target });
    const changes = lines.map((line) => {
      const addons = (line.addons ?? []).filter((id) => to.product.addons.some((option) => option.id === id) && (id !== 'shot' || !shot));
      if (shot?.enabled) addons.push('shot');
      return {
        line, addons,
        quantity: lines.length === 1 ? added : line.quantity,
        temperature: to.temperature ?? (options.includes(line.temperature) ? line.temperature : options.length <= 1 ? options[0] ?? null : undefined),
      };
    });
    if (changes.some((change) => change.temperature === undefined)) return result('orderTemperatureChoice', { product: target });
    const operations = changes.flatMap(({ line, quantity, temperature, addons }) => [
      removed < line.quantity ? { type: 'quantity', line_id: line.id, quantity: line.quantity - removed } : { type: 'remove', line_id: line.id },
      { type: 'add', product_id: to.product.id, quantity, temperature, addons },
    ]);
    return result(shot?.enabled ? 'orderReplacedWithShot' : 'orderReplaced', { source, target, quantity: quantityText(added, to.product, language) }, operations);
  }

  const shot = shotCommand(text);
  if (!shot) return null;
  const target = shot.product ? productReference(shot.product, products) : null;
  if (shot.product && !target) return null;
  const product = target?.product;
  if (product && !supportsShot(product)) return result('orderShotUnavailable', { product: label(product) });
  const lines = target ? linesFor(target) : cart.filter((line) => supportsShot(products.find(({ id }) => id === line.product_id)));
  if (lines.length > 1) return product ? result('orderLineChoice', { product: label(product) }) : result('orderShotChoice');
  const [line] = lines;
  if (!line) {
    if (!product) return result('orderShotChoice');
    if (!shot.enabled) return result('orderItemMissing', { product: label(product) });
    if (!product.available) return result('orderItemUnavailable', { product: label(product) });
    const options = product.temperatures;
    if (target.temperature && !options.includes(target.temperature)) return result('orderTemperatureUnavailable', { product: label(product) });
    if (!target.temperature && options.length > 1) return result('orderTemperatureChoice', { product: label(product) });
    const quantity = target.quantity ?? 1;
    if (quantity < 1) return result('orderQuantityCheck', { product: label(product) });
    if (!fits(quantity)) return tooMany();
    return result('orderShotDrinkAdded', { product: label(product), quantity: quantityText(quantity, product, language) }, [
      { type: 'add', product_id: product.id, temperature: target.temperature ?? options[0], quantity, addons: ['shot'] },
    ]);
  }
  const name = label(product || products.find(({ id }) => id === line.product_id));
  const quantity = target?.quantity ?? line.quantity;
  if (quantity < 1 || quantity > line.quantity) return result('orderQuantityCheck', { product: name });
  const previousAddons = line.addons ?? [];
  if (previousAddons.includes('shot') === shot.enabled) return result(shot.enabled ? 'orderShotAlreadyAdded' : 'orderShotAlreadyRemoved', { product: name });
  const addons = shot.enabled ? [...previousAddons, 'shot'] : previousAddons.filter((id) => id !== 'shot');
  return result(shot.enabled ? 'orderShotAdded' : 'orderShotRemoved', { product: name }, [{ type: 'addons', line_id: line.id, quantity, addons }]);
}
