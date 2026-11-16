import { aggregateMerchantAnalytics, evidenceFor } from './merchant-analytics.mjs';
import { catalog } from './catalog.mjs';

const day = 86_400_000;
const sampleEnd = Date.parse('2026-10-31T23:59:59+09:00');
const byId = new Map(catalog.map((item) => [item.id, item]));

const examples = [
  {
    id: 'brunch', label: '점심 브런치 추천', products: ['americano', 'toast'], hour: 12, budget: 10000,
    recent: [80, 20, 12], earlier: [35, 10, 5],
    headline: '점심 브런치 추천 순서를 비교해 보세요',
    observation: '만 원 안에서 먹을 브런치를 찾는 손님에게 아메리카노와 에그 토스트 조합을 안내했고, 일부는 장바구니를 거쳐 최종 주문까지 이어졌어요.',
    action: '다음 주 점심에 같은 예산 조건을 만족하는 요청을 두 그룹으로 나눠, 에그 토스트를 먼저 추천하는 순서와 기본 순서를 비교해 보세요.',
    followup: '두 그룹의 토스트 주문 비율과 전체 주문 완료율을 함께 봐주세요. 아래 수치는 현재 추천의 전환율이에요.',
  },
  {
    id: 'dessert', label: '담았지만 주문에서 빠진 조합', products: ['latte', 'scone'], hour: 15, budget: 10000,
    recent: [60, 24, 6], earlier: [35, 12, 8],
    headline: '디저트 조합을 담은 뒤의 흐름을 확인해 보세요',
    observation: '카페라테와 버터 스콘을 담은 기록 중 일부만 최종 주문에 남았어요. 집계만으로는 어느 단계에서 망설였는지 알기 어려워요.',
    action: '오후 체험에서 이 조합을 담는 손님이 음료 온도와 합계 금액을 확인하는 과정을 관찰해 보세요. 불편한 지점이 반복되면 한 가지씩 바꿔 확인해 보세요.',
    followup: '조합을 담은 건수 중 최종 주문에 조합 전체가 남은 비율을 다음 주에 다시 확인해 보세요.',
  },
  {
    id: 'new-menu', label: '새 메뉴의 표본 부족', products: ['matcha', 'scone'], hour: 14, budget: 10000,
    recent: [6, 2, 1], earlier: [0, 0, 0],
    headline: '새 조합의 추천 기록을 더 모아 보세요',
    observation: '말차라테와 버터 스콘 조합의 안내 횟수가 적어요. 주문 한 건이 추가돼도 전환율이 크게 바뀔 수 있어요.',
    action: '다음 주에도 비슷한 오후 시간대와 만 원 예산 조건에서 같은 조합을 제안해 보세요. 준비량을 결정하기 전에 여러 날의 기록을 확인하세요.',
    followup: '전환율과 함께 안내 횟수와 최종 주문 건수를 확인해 보세요. 충분한 기록이 쌓이면 다른 조합과 비교할 수 있어요.',
  },
];

export const reportExampleOptions = examples.map(({ id, label }) => ({ id, label }));

export function reportExample(id, period) {
  const example = examples.find((item) => item.id === id);
  if (!example) return null;
  const orders = [];
  const recommendations = [];
  const addOrder = (products, created) => {
    const lines = products.map((id) => ({ product_id: id, name: byId.get(id).name, quantity: 1 }));
    const order = { id: String(orders.length + 1), created, total: products.reduce((sum, id) => sum + byId.get(id).price, 0), lines };
    orders.push(order);
    return order.id;
  };
  const comboId = example.products.join(',');
  for (let week = 0; week < 9; week++) {
    const [shown, added, confirmed] = week ? example.earlier : example.recent;
    const at = sampleEnd - (week * 7 + 6) * day - (23 - example.hour) * 3_600_000 - 1_800_000;
    for (let i = 0; i < shown; i++) {
      const shownAt = at + i % 7 * day - i * 1000;
      recommendations.push({
        shown_at: shownAt,
        added_at: i < added ? shownAt + 30_000 : null,
        order_id: i < confirmed ? addOrder(example.products, shownAt + 60_000) : null,
        products: comboId, budget: example.budget, store_pick: 1,
      });
    }
    for (let i = 0; i < 32 + week % 3; i++) {
      addOrder(i % 3 ? ['americano'] : ['brownie', 'latte'], at + i % 7 * day - (i % 5 + 1) * 3_600_000);
    }
  }
  const analytics = aggregateMerchantAnalytics({ period, at: sampleEnd, coverageStart: sampleEnd - 63 * day, orders, recommendations });
  // This historical sample ends after the last full day.
  analytics.timeline.at(-1).partial = false;
  return {
    analytics,
    report: {
      headline: example.headline, observation: example.observation, action: example.action, followup: example.followup,
      evidence: evidenceFor(analytics).find((entry) => entry.id === comboId).detail,
      created: sampleEnd,
    },
  };
}
