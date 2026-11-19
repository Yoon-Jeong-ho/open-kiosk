import { AppError } from './cart.mjs';
import { catalog } from './catalog.mjs';

const day = 86_400_000;
const korea = 9 * 3_600_000;
export const kstDate = (time) => new Date(time + korea).toISOString().slice(0, 10);
const startOfDay = (time) => Math.floor((time + korea) / day) * day - korea;
const productById = new Map(catalog.map((p) => [p.id, p]));
const name = (id) => productById.get(id)?.name ?? id;
const won = (n) => new Intl.NumberFormat('ko-KR').format(n) + '원';

export function analyticsRange(period, at) {
  const days = { week: 7, month: 30 }[period];
  if (!Number.isInteger(days)) throw new AppError(400, '주간 또는 월간으로 조회해 주세요.');
  const end = startOfDay(at) + day;
  const start = end - days * day;
  return { start, end, previousStart: start - days * day };
}

function rollup(rows) {
  const amount = rows.reduce((n, order) => n + order.total, 0);
  return { orders: rows.length, amount, average: rows.length ? Math.round(amount / rows.length) : null };
}

const emptyFunnel = () => ({ shown: 0, added: 0, confirmed: 0 });
function countEvent(funnel, event) {
  funnel.shown++;
  if (event.added_at !== null) funnel.added++;
  if (event.order_id) funnel.confirmed++;
}

export function aggregateMerchantAnalytics({ period, at, coverageStart, orders, recommendations }) {
  const { start, end, previousStart } = analyticsRange(period, at);
  const cutoff = Math.min(end, at + 1);
  const previousCutoff = period === 'month' ? cutoff - (end - start) : start;
  const currentOrders = orders.filter((order) => order.created >= Math.max(start, coverageStart) && order.created < cutoff);
  const timeline = new Map();
  for (let date = Math.max(start, startOfDay(coverageStart)); date < end; date += day) {
    timeline.set(kstDate(date), { date: kstDate(date), orders: 0, amount: 0, partial: startOfDay(at) === date || coverageStart > date });
  }
  const menus = new Map();
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0 }));
  for (const order of currentOrders) {
    const entry = timeline.get(kstDate(order.created));
    if (entry) { entry.orders++; entry.amount += order.total; }
    hours[new Date(order.created + korea).getUTCHours()].orders++;
    for (const line of order.lines) {
      if (!menus.has(line.product_id)) menus.set(line.product_id, { name: line.name || name(line.product_id), quantity: 0, amount: 0 });
      const menu = menus.get(line.product_id);
      menu.quantity += line.quantity;
      menu.amount = menu.amount === null || !Number.isSafeInteger(line.subtotal) ? null : menu.amount + line.subtotal;
    }
  }

  const combos = new Map();
  const budgetGroups = new Map();
  const funnel = emptyFunnel();
  for (const event of recommendations) {
    if (event.shown_at == null || event.shown_at < Math.max(start, coverageStart) || event.shown_at >= cutoff) continue;
    if (!combos.has(event.products)) {
      combos.set(event.products, {
        id: event.products, name: event.products.split(',').map(name).join(' + '), ...emptyFunnel(), store_picks: 0,
      });
    }
    const combo = combos.get(event.products);
    countEvent(funnel, event);
    countEvent(combo, event);
    combo.store_picks += Number(event.store_pick);
    if (event.budget !== null) {
      const group = event.budget <= 10000 ? '1만 원 이하' : event.budget <= 15000 ? '1만 원 초과~1만 5천 원' : '1만 5천 원 초과';
      budgetGroups.set(group, (budgetGroups.get(group) || 0) + 1);
    }
  }
  return {
    period,
    range: {
      from: kstDate(start), to: kstDate(end - 1), coverage: kstDate(Math.max(start, coverageStart)),
      ...(period === 'month' && { previous_from: kstDate(previousStart), previous_to: kstDate(previousCutoff - 1) }),
    },
    totals: rollup(currentOrders),
    previous: coverageStart <= previousStart
      ? rollup(orders.filter((order) => order.created >= previousStart && order.created < previousCutoff))
      : null,
    timeline: [...timeline.values()],
    peak: hours.sort((a, b) => b.orders - a.orders)[0],
    menus: [...menus.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
    funnel,
    combos: [...combos.values()].sort((a, b) => b.shown - a.shown || b.confirmed - a.confirmed),
    budgets: [...budgetGroups].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
  };
}

export function evidenceFor(analytics) {
  const evidence = [];
  if (analytics.totals.orders) {
    evidence.push({ id: 'orders', detail: `확정 주문 ${analytics.totals.orders}건 · 주문액 ${won(analytics.totals.amount)} · 평균 주문액 ${won(analytics.totals.average)}`, small: analytics.totals.orders < 5 });
    const { hour, orders } = analytics.peak;
    evidence.push({ id: 'peak', detail: `${hour}~${hour + 1}시 확정 주문 ${orders}건 · 기간 전체 ${analytics.totals.orders}건`, small: orders < 5 });
  }
  if (analytics.previous) {
    evidence.push({ id: 'previous-period', detail: `직전 같은 기간 주문 ${analytics.previous.orders}건 · 이번 조회 기간 주문 ${analytics.totals.orders}건`, small: Math.min(analytics.previous.orders, analytics.totals.orders) < 5 });
  }
  for (const combo of analytics.combos.slice(0, 8)) {
    const rate = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(100 * combo.confirmed / combo.shown);
    evidence.push({
      id: combo.id,
      detail: `${combo.name} · 안내 ${combo.shown}회 · 담기 ${combo.added}회 · 주문 포함 ${combo.confirmed}회 (${rate}%)`,
      small: combo.shown < 10,
    });
  }
  return evidence;
}
