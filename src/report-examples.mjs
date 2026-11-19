import { aggregateMerchantAnalytics, evidenceFor } from './merchant-analytics.mjs';
import { catalog } from './catalog.mjs';
import { buildMonthlyReport } from './monthly-report.mjs';

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

const monthlyExamples = {
  brunch: {
    headline: '점심 브런치 추천 순서를 비교하고 오전 주문도 챙기세요',
    sales: '주문 건수는 직전 기간과 거의 같아 평균 주문액이 올라간 점이 눈에 띄어요. 오전 주문이 많은 시간대에는 기본 음료 주문이 얼마나 몰리는지 먼저 확인해 보세요.',
    menus: '아메리카노는 주문 수량이 가장 많아요. 오전 음료 주문과 점심 브런치 주문을 각각 확인하면 같은 아메리카노가 단품으로 잘 팔리는지, 식사와 함께 선택되는지 구분하는 데 도움이 돼요.',
    recommendation: '아메리카노와 에그 토스트는 만 원 이하 예산에서 시험하기 좋은 조합이에요. 담은 카드 중 절반 정도만 최종 주문에 남았으니, 안내 순서와 장바구니 이후 흐름을 각각 살펴보세요.',
    first_step: '평일 점심에 같은 예산과 조건을 만족하는 주문을 골라 기본 순서를 운영해 보세요. 추천 카드 안내, 조합 담기, 주문 확정 수치를 남겨 비교 기준을 정해요.',
    first_metric: '안내 대비 조합 담기 비율과 확정 주문 건수',
    next_step: '비슷한 평일 점심에 에그 토스트의 추천 우선 설정만 바꿔 보세요. 가격과 조합 구성을 유지하고 같은 시간대의 결과를 비교하세요.',
    next_metric: '토스트 판매 수량, 추천 주문 포함률, 전체 확정 주문 건수',
  },
  dessert: {
    headline: '오후 디저트 조합을 담은 뒤 무엇을 다시 확인하는지 살펴보세요',
    sales: '직전 비교 기간보다 주문 건수가 줄었고 평균 주문액은 비슷해요. 오후에 주문이 몰리는 운영일을 골라 주문 시간대와 디저트 선택 흐름을 함께 살펴보세요.',
    menus: '카페라테와 브라우니는 판매 수량이 많은 메뉴예요. 카페라테와 버터 스콘을 함께 추천했을 때 음료만 주문하는 경우가 있는지 현장에서 확인해 보세요.',
    recommendation: '담긴 카드 62회 중 32회가 조합 전체로 확정됐어요. 나머지 30회는 조합이 온전히 남지 않았거나 주문이 확정되지 않은 경우를 함께 담고 있어요. 손님이 어느 화면에서 무엇을 확인했는지는 직접 관찰해 보세요.',
    first_step: '오후에 카페라테와 버터 스콘을 담는 흐름을 지켜보세요. 온도를 고를 때와 합계를 확인할 때 중 어느 쪽에서 질문이 반복되는지 기록해요.',
    first_metric: '담기 이후 자주 되묻는 화면과 담기 대비 주문 포함률',
    next_step: '합계를 확인하기 어렵다는 관찰이 반복되면 조합 가격 안내 위치만 바꿔 보세요. 온도 선택이 문제라면 가격 위치를 유지하고 온도 안내 문구만 조정해요.',
    next_metric: '담기 대비 조합 주문 포함률과 평균 주문액',
  },
  'new-menu': {
    headline: '말차 조합은 안내 사례를 더 모은 뒤 추천 순서를 조정하세요',
    sales: '전체 체험 주문액은 직전 기간보다 줄었어요. 전체 주문과 말차 조합 추천 기록의 규모가 달라, 두 결과는 각각 살펴보는 편이 좋아요.',
    menus: '아메리카노와 브라우니처럼 주문이 많이 들어온 메뉴는 현재 판매 수량을 기준으로 점검해 보세요. 말차와 스콘 조합은 실제 안내 상황을 더 관찰할 필요가 있어요.',
    recommendation: '카드 안내가 6회여서 주문 한 건에도 포함률이 크게 달라져요. 어떤 예산과 시간대에서 같은 조합을 보는지 기록을 먼저 쌓아 보세요.',
    first_step: '비슷한 오후 시간대에 만 원 이하 조합을 찾는 손님에게 말차라테와 버터 스콘을 안내해 보세요. 메뉴 선택 화면과 가격은 그대로 유지해요.',
    first_metric: '여러 운영일에 걸친 카드 안내 건수와 조합 주문 포함 건수',
    next_step: '비슷한 조건의 안내 기록이 여러 날에 쌓이면 기존 디저트 조합과 비교해 보세요. 사례가 여전히 적으면 같은 조건에서 관찰을 이어가요.',
    next_metric: '두 조합의 안내 분모, 주문 포함률, 확정 주문 건수',
  },
};

export function reportExample(id, period) {
  const example = examples.find((item) => item.id === id);
  if (!example) return null;
  const orders = [];
  const recommendations = [];
  const addOrder = (products, created) => {
    const lines = products.map((id) => ({ product_id: id, name: byId.get(id).name, quantity: 1, subtotal: byId.get(id).price }));
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
    report: period === 'month' ? { ...buildMonthlyReport(analytics, monthlyExamples[id], { example: true }), created: sampleEnd } : {
      headline: example.headline, observation: example.observation, action: example.action, followup: example.followup,
      evidence: evidenceFor(analytics).find((entry) => entry.id === comboId).detail,
      created: sampleEnd,
    },
  };
}
