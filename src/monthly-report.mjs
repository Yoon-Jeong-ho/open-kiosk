const integer = new Intl.NumberFormat('ko-KR');
const decimal = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 });
const won = (value) => integer.format(value) + '원';
const percentage = (part, total) => total ? decimal.format(100 * part / total) + '%' : '집계 없음';

export function monthlyReportFacts(analytics) {
  const { totals, previous, peak, menus, funnel, combos, range, timeline } = analytics;
  const metrics = [
    { id: 'amount', label: '체험 주문액', unit: '원' },
    { id: 'orders', label: '확정 주문', unit: '건' },
    { id: 'average', label: '평균 주문액', unit: '원' },
  ].map((metric) => {
    const current = totals[metric.id];
    const baseline = previous?.[metric.id] ?? null;
    const difference = current === null || baseline === null ? null : current - baseline;
    const ratio = (total) => metric.id === 'average' ? total.amount / total.orders : total[metric.id];
    const relative = difference === null || !baseline ? null : (ratio(totals) / ratio(previous) - 1) * 100;
    return { ...metric, current, previous: baseline, difference, relative };
  });

  const strongest = timeline.reduce((best, day) => day.amount > (best?.amount ?? 0) ? day : best, null);
  const sales = strongest
    ? `${strongest.date} 주문액 ${won(strongest.amount)}(${strongest.orders}건)${strongest.partial ? ' · 일부 시간 집계' : ''}. 주문이 많이 들어온 시간대는 ${peak.hour}~${peak.hour + 1}시(${peak.orders}건)였어요.`
    : '이 기간에 확정 주문이 없어요.';
  const mix = menus.length
    ? menus.slice(0, 3).map((menu) => `${menu.name} ${integer.format(menu.quantity)}개${menu.amount === null ? '' : `(${won(menu.amount)})`}`).join(' · ')
    : '판매 수량을 집계할 주문이 없어요.';
  const combo = combos[0];
  const recommendation = funnel.shown
    ? `추천 카드 안내 ${funnel.shown}회 → 담기 ${funnel.added}회(${percentage(funnel.added, funnel.shown)}) → 주문 포함 ${funnel.confirmed}회(${percentage(funnel.confirmed, funnel.shown)}).${funnel.added ? ` 담긴 카드 중 주문에 포함된 비율은 ${percentage(funnel.confirmed, funnel.added)}예요.` : ''}`
    : '이 기간에 추천 카드를 안내한 기록이 없어요.';
  const comboDetail = combo ? `${combo.name} 조합은 안내 ${combo.shown}회, 담기 ${combo.added}회, 주문 포함 ${combo.confirmed}회였어요.` : '';
  const budget = analytics.budgets[0];
  const budgetDetail = budget ? `기록된 예산대 중 가장 많은 것은 ${budget.label}(${budget.count}회)였어요.` : '';
  const coverage = previous
    ? `직전 비교 기간은 ${range.previous_from} ~ ${range.previous_to}입니다.${timeline.at(-1)?.partial ? ' 두 기간의 마지막 날은 같은 시각까지 비교했어요.' : ''}`
    : `조회 가능한 기록은 ${range.coverage}부터예요. 직전 기간 전체를 비교하기에는 기록이 부족해요.`;
  return {
    metrics,
    coverage,
    sections: [
      { id: 'sales', title: '주문 흐름과 집중 시간', evidence: sales },
      { id: 'menus', title: '많이 팔린 메뉴', evidence: mix },
      { id: 'recommendation', title: '추천에서 최종 주문까지', evidence: [recommendation, comboDetail, budgetDetail].filter(Boolean).join(' ') },
    ],
  };
}

function defaultEditorial(analytics) {
  const { totals, previous, peak, menus, combos, funnel } = analytics;
  const combo = combos[0];
  const sample = funnel.shown < 10;
  const direction = (now, before) => now === before ? '같았어요' : now > before ? '늘었어요' : '줄었어요';
  let sales = '비슷한 운영일끼리 날짜별 주문액과 시간대별 주문 건수를 모아 비교 기준을 만들어 보세요.';
  if (totals.orders >= 5 && previous?.orders >= 5) {
    sales = `직전 기간과 비교하면 주문 건수는 ${direction(totals.orders, previous.orders)}. 평균 주문액은 ${direction(totals.average, previous.average)}.`;
  }
  if (peak.orders >= 5) sales += ` ${peak.hour}시대 주문이 비슷한 운영일에도 집중되는지 확인해 보세요.`;
  const [leader, runnerUp] = menus;
  let menuRead = '';
  if (leader) {
    menuRead = leader.quantity === runnerUp?.quantity
      ? `${leader.name}과 ${runnerUp.name}의 판매 수량이 같아요. 잘 팔린 메뉴는 비슷한 운영일에도 주문이 이어지는지 확인해 보세요.`
      : `${leader.name}의 판매 수량이 가장 많았어요. 다음 달에는 이 메뉴가 단품으로 주문되는지, 다른 메뉴와 함께 주문되는지도 살펴보세요.`;
  }
  const preCartGap = funnel.shown - funnel.added, postCartGap = funnel.added - funnel.confirmed;
  let recommendation = '추천 기록을 모을 때 같은 예산과 시간대의 사례를 여러 운영일에 걸쳐 확인해 보세요.';
  if (!sample) {
    const biggestGap = preCartGap > postCartGap
      ? '안내에서 담기까지 줄어든 카드가 담기에서 주문까지 줄어든 카드보다 많았어요.'
      : preCartGap < postCartGap
        ? '담기 이후 주문에 포함되지 않은 카드가 안내 뒤 담지 않은 카드보다 많았어요.'
        : '두 단계에서 줄어든 카드 수가 같았어요.';
    recommendation = biggestGap + ' 같은 시간대에서 해당 단계를 직접 관찰해 빠진 이유를 확인해 보세요.';
  } else if (funnel.shown) {
    recommendation = '안내 횟수가 적어서 주문 한 건에도 비율이 크게 달라져요. 비슷한 조건에서 사례를 더 모아 보세요.';
  }
  return {
    headline: sample ? '주문과 추천 기록을 쌓아 다음 달 비교 기준 만들기' : '주문이 몰리는 시간과 추천이 이어지는 단계 확인하기',
    sales,
    menus: menuRead,
    recommendation,
    first_step: combo ? `${combo.name}을 비슷한 시간대와 예산 조건에서 안내하고, 손님이 선택한 뒤 확정하기까지의 흐름을 점검해 보세요.` : '운영일별로 키오스크에서 확정한 주문을 모으고, 메뉴별 수량과 시간대를 확인해 보세요.',
    first_metric: combo ? '추천 카드 안내 횟수, 담은 횟수, 주문에 포함된 횟수' : '확정 주문 건수와 주문이 집중되는 시간대',
    next_step: combo && !sample ? '가장 불편해 보인 화면 요소를 하나만 바꾼 뒤 비슷한 시간대에서 다시 관찰해 보세요.' : '같은 기준으로 기록을 한 차례 더 모아 다음 월간 리뷰에서 비교해 보세요.',
    next_metric: combo ? '담은 카드 중 주문에 포함된 비율과 전체 확정 주문 건수' : '확정 주문 건수, 평균 주문액, 판매 수량 상위 메뉴',
  };
}

export const monthlyEditorialFields = ['headline', 'first_step', 'first_metric', 'next_step', 'next_metric'];

export function buildMonthlyReport(analytics, editorial = {}, { example = false } = {}) {
  const facts = monthlyReportFacts(analytics);
  const defaults = defaultEditorial(analytics);
  const clean = (field) => {
    const value = typeof editorial[field] === 'string' ? editorial[field].trim() : '';
    const unsupported = /단골|재방문|신규\s*고객|고객\s*연령|주문\s*완료율|재고|원가|수익|마진|메뉴별\s*실적\s*화면|\d\s*(?:%|pp|원|건|회|개|잔|명)/i.test(value);
    return value && (example || !unsupported) ? value.slice(0, 360) : defaults[field];
  };
  const { totals, previous } = analytics;
  const amount = facts.metrics[0];
  const comparison = previous
    ? amount.difference === 0 ? '직전 비교 기간과 주문액이 같아요.'
      : `직전 비교 기간보다 ${won(Math.abs(amount.difference))} ${amount.difference > 0 ? '늘었어요' : '줄었어요'}.`
    : '';
  return {
    format: 'monthly',
    headline: clean('headline'),
    summary: [`이번 조회 기간에 확정된 체험 주문은 ${totals.orders}건으로, 주문액은 ${won(totals.amount)}이에요.`, comparison].filter(Boolean).join(' '),
    coverage: facts.coverage,
    metrics: facts.metrics,
    sections: facts.sections.map((section) => ({ ...section, commentary: example ? clean(section.id) : defaults[section.id] })),
    plan: [
      { when: '다음 달 초', action: clean('first_step'), measure: clean('first_metric') },
      { when: '다음 달 중·후반', action: clean('next_step'), measure: clean('next_metric') },
    ],
  };
}
