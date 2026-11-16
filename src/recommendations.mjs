import { productName } from '../public/js/locale.js';

const exclusiveCategories = [
  ['coffee', /커피\s*만\s*추천|\b(?:only\s+coffee|coffee\s+only)\b(?!\s*(?:and\b|or\b|with\b|[&,]))|コーヒーだけ(?:を)?おすすめ|只推荐咖啡(?!和|或|、)/i],
  ['tea', /(?:^|\s)(?:차|차 메뉴|티 메뉴)\s*만\s*추천|\b(?:only\s+tea|tea\s+only)\b(?!\s*(?:and\b|or\b|with\b|[&,]))|お茶だけ(?:を)?おすすめ|只推荐茶(?!和|或|、)/i],
  ['dessert', /디저트\s*만\s*추천|\b(?:only\s+desserts?|desserts?\s+only)\b(?!\s*(?:and\b|or\b|with\b|[&,]))|デザートだけ(?:を)?おすすめ|只推荐甜点(?!和|或|、)/i],
  ['brunch', /브런치\s*만\s*추천|\b(?:only\s+brunch|brunch\s+only)\b(?!\s*(?:and\b|or\b|with\b|[&,]))|ブランチだけ(?:を)?おすすめ|只推荐早午餐(?!和|或|、)/i],
];

export function recommendationBudget(input) {
  const han = { 一: '1', 二: '2', 三: '3', 四: '4', 五: '5', 六: '6', 七: '7', 八: '8', 九: '9', 十: '십', 百: '백' };
  const text = String(input).replace(/,/g, '').replace(/ウォン|韩元|韓元|\bwon\b/gi, '원').replace(/万|萬/g, '만').replace(/千/g, '천').replace(/[一二三四五六七八九十百]/g, (c) => han[c]);
  const amount = text.match(/([\d일이삼사오육칠팔구십백천만.]+(?:\s*[\d일이삼사오육칠팔구십백천만.]+)*)\s*원/);
  if (!amount) { const direct = text.match(/(?:₩|KRW)\s*(\d+)/i); return direct ? Number(direct[1]) : null; }
  const digits = { 일:1, 이:2, 삼:3, 사:4, 오:5, 육:6, 칠:7, 팔:8, 구:9 }; const units = { 십:10, 백:100, 천:1000 };
  let total = 0, section = 0, number = 0;
  for (const token of amount[1].match(/\d+(?:\.\d+)?|[일이삼사오육칠팔구십백천만]/g) || []) {
    if (token in digits) number = number * 10 + digits[token];
    else if (token in units) { section += (number || 1) * units[token]; number = 0; }
    else if (token === '만') { total += (section + number || 1) * 10000; section = 0; number = 0; }
    else number = Number(token);
  }
  const budget = Math.round(total + section + number);
  return Number.isSafeInteger(budget) && budget >= 0 ? budget : null;
}

export function validateRecommendations(proposals, products, { text = '', language = 'ko' } = {}) {
  if (!Array.isArray(proposals)) return [];
  if (/알레르|알러지|allerg|アレルギ|过敏|당뇨|diabet/i.test(text)) return [];
  const budget = recommendationBudget(text);
  const categories = exclusiveCategories.filter(([, pattern]) => pattern.test(text)).map(([category]) => category);
  const seen = new Set();
  const results = [];
  for (const proposal of proposals.slice(0, 6)) {
    const ids = proposal?.product_ids;
    if (!Array.isArray(ids) || !ids.length || ids.length > 3 || new Set(ids).size !== ids.length) continue;
    const selected = ids.map((id) => products.find((p) => p.id === id && p.available));
    if (selected.some((p) => !p)) continue;
    if (categories.length === 1 && selected.some((p) => p.category !== categories[0])) continue;
    const key = [...ids].sort().join(','); if (seen.has(key)) continue;
    const total = selected.reduce((sum, p) => sum + p.price, 0);
    if (budget !== null && total > budget) continue;
    const reason = typeof proposal.reason === 'string' ? proposal.reason.trim().slice(0, 160) : '';
    if (!reason) continue;
    seen.add(key);
    results.push({
      product_ids: ids,
      title: typeof proposal.title === 'string' ? proposal.title.slice(0, 60) : selected.map((p) => productName(p, language)).join(' + '),
      reason, total, budget,
      store_recommended: selected.some((p) => p.recommended === true),
    });
  }
  return results.sort((a, b) => Number(b.store_recommended) - Number(a.store_recommended)).slice(0, 2);
}
