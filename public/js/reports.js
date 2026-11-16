import { $, $$, api, e, icon, won } from './ui.js';

const decimal = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 });
const percentage = (part, total) => total ? `${decimal.format(100 * part / total)}%` : '—';
const dateLabel = (date) => date.slice(5).replace('-', '.');
const reportTime = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' });

function orderChart(timeline) {
  if (!timeline.some((day) => day.orders)) return '<p class="report-empty">이 기간에 확정한 체험 주문이 없어요.</p>';
  const max = Math.max(...timeline.map((day) => day.amount));
  const spacing = timeline.length > 10 ? 5 : 1;
  return `<div class="report-chart">
    <p class="report-chart-scale">최고 일 주문액 <b>${won(max)}원</b></p>
    <ol class="report-bars" aria-label="날짜별 체험 주문액">${timeline.map((day, index) => {
      const label = `${dateLabel(day.date)} · ${won(day.amount)}원 · 주문 ${day.orders}건${day.partial ? ' · 일부 시간 집계' : ''}`;
      return `<li title="${e(label)}">
        <span class="sr-only">${e(label)}</span>
        <div class="report-bar-track" aria-hidden="true"><i style="--bar:${day.amount / max * 100}%"></i></div>
        <span class="report-bar-date" aria-hidden="true">${index % spacing === 0 || index === timeline.length - 1 ? e(dateLabel(day.date)) : '&nbsp;'}</span>
      </li>`;
    }).join('')}</ol>
  </div>`;
}

function funnelPanel(funnel, budgets) {
  const steps = [['안내', funnel.shown], ['담기', funnel.added], ['주문 포함', funnel.confirmed]];
  return `<section class="report-panel">
    <h2>추천 흐름</h2>
    <p class="report-caption">추천 조합 카드 기준 · 안내 날짜로 집계</p>
    <ol class="report-funnel">${steps.map(([label, count]) => `<li>
      <span>${e(label)}</span><strong>${won(count)}회</strong>
      <span class="report-funnel-track" aria-hidden="true"><i style="--bar:${funnel.shown ? count / funnel.shown * 100 : 0}%"></i></span>
    </li>`).join('')}</ol>
    ${budgets.length ? `<p class="report-caption">가장 많이 안내한 예산대 <b>${e(budgets[0].label)}</b> · ${won(budgets[0].count)}회</p>` : ''}
  </section>`;
}

function comboPanel(combos) {
  if (!combos.length) return '';
  return `<section class="report-panel">
    <h2>조합별 추천 결과</h2>
    <div class="report-table-wrap"><table class="report-table">
      <thead><tr><th scope="col">추천 조합</th><th scope="col">안내</th><th scope="col">담기</th><th scope="col">주문 포함</th><th scope="col">포함률</th></tr></thead>
      <tbody>${combos.map((row) => `<tr>
        <th scope="row">${e(row.name)}${row.store_picks ? `<small>매장 추천으로 ${won(row.store_picks)}회 안내</small>` : ''}</th>
        <td>${won(row.shown)}</td><td>${won(row.added)}</td><td>${won(row.confirmed)}</td><td>${percentage(row.confirmed, row.shown)}</td>
      </tr>`).join('')}</tbody>
    </table></div>
    <p class="report-caption">포함률은 안내한 조합이 모두 담겨 최종 주문에 남은 비율이에요. 같은 요청에서 카드 두 장을 안내하면 두 번으로 셉니다.</p>
  </section>`;
}

function reportArticle(report, example) {
  return `<article class="report-narrative" aria-label="운영 보고서">
    ${example ? '<span class="report-tag">미리 작성한 예시</span>' : `<time datetime="${new Date(report.created).toISOString()}">${e(reportTime.format(report.created))} 생성</time>`}
    <h3 id="report-narrative-title" tabindex="-1">${e(report.headline)}</h3>
    <p>${e(report.observation)}</p>
    <p class="report-evidence"><strong>집계 근거</strong> ${e(report.evidence)}</p>
    <dl><div><dt>다음에 해볼 일</dt><dd>${e(report.action)}</dd></div>
      <div><dt>다음에 확인할 지표</dt><dd>${e(report.followup)}</dd></div></dl>
  </article>`;
}

function dashboardView(data) {
  const { analytics: a, example, report, can_generate } = data;
  const amount = (n) => n == null ? '—' : `${won(n)}원`;
  const stats = [
    ['확정 주문', `${won(a.totals.orders)}건`, a.previous && `${won(a.previous.orders)}건`],
    ['체험 주문액', amount(a.totals.amount), a.previous && amount(a.previous.amount)],
    ['평균 주문액', amount(a.totals.average), a.previous && amount(a.previous.average)],
    ['추천 주문 포함률', percentage(a.funnel.confirmed, a.funnel.shown), a.funnel.shown ? `안내 ${won(a.funnel.shown)}회 중 ${won(a.funnel.confirmed)}회` : '추천 안내 기록 없음', true],
  ];
  return `
    <p class="report-period">${example ? '<span class="report-tag">가상 데이터</span>' : '<span class="report-tag">내 매장 체험 기록</span>'}
      ${e(a.range.from)} ~ ${e(a.range.to)} · 한국시간
      ${a.range.coverage > a.range.from ? `<small>${e(a.range.coverage)}부터 기록이 있어요.</small>` : ''}
    </p>
    <div class="report-kpis">${stats.map(([label, value, context, raw]) => `<div>
      <span>${e(label)}</span><strong>${e(value)}</strong><small>${context ? e(raw ? context : '직전 기간 ' + context) : '직전 기간 기록 없음'}</small>
    </div>`).join('')}</div>
    <div class="report-grid">
      <section class="report-panel">
        <h2>일별 주문액</h2>
        ${orderChart(a.timeline)}
        ${!example && a.totals.orders ? '<p class="report-caption">오늘은 조회 시점까지 집계했어요.</p>' : ''}
      </section>
      ${funnelPanel(a.funnel, a.budgets)}
    </div>
    <section class="report-panel report-writing">
      <div class="report-panel-heading">
        <h2>${example ? '보고서 예시' : 'AI 운영 보고서'}</h2>
        ${example ? '' : `<button type="button" class="btn btn-dark btn-sm" id="report-generate" ${!can_generate || !(a.totals.orders || a.funnel.shown) ? 'disabled' : ''}>AI 보고서 생성</button>`}
      </div>
      ${!example && !can_generate ? '<p class="report-caption">AI 보고서 생성 연결을 사용할 수 없어요.</p>' : ''}
      <div id="report-article">${report ? reportArticle(report, example) : `<p class="report-empty">${a.totals.orders || a.funnel.shown ? '이 기간에 아직 생성한 보고서가 없어요.' : '체험 기록이 생기면 이 기간의 AI 보고서를 생성할 수 있어요.'}</p>`}</div>
      <p class="report-generation-status" id="report-generation-status" role="status"></p>
    </section>
    ${comboPanel(a.combos)}
    ${a.menus.length ? `<section class="report-panel report-menu-ranking">
      <h2>주문 수량 상위 메뉴</h2>
      <ol>${a.menus.map((menu) => `<li><span>${e(menu.name)}</span><b>${won(menu.quantity)}</b></li>`).join('')}</ol>
    </section>` : ''}`;
}

export function bindReports(container, kioskPath) {
  const controller = new AbortController();
  const params = new URLSearchParams(location.search);
  let period = params.get('period') === 'month' ? 'month' : 'week';
  let example = params.get('example') || '';
  let request = 0;
  container.innerHTML = `
    <section class="report-test-panel" aria-labelledby="report-test-title">
      <div><h2 id="report-test-title">점주 테스트</h2>
      <ol><li><a href="/dashboard?tab=menu">메뉴 관리</a>에서 에그 토스트의 ‘추천 우선’을 켜고 저장해요.</li>
      <li>테스트 키오스크에서 만 원 이내 브런치를 추천받고, 조합을 담아 주문을 확정해요.</li>
      <li>여기로 돌아와 집계를 새로고침하고 보고서를 생성해요.</li></ol></div>
      <a class="btn btn-outline btn-sm" href="${e(kioskPath)}&amp;report-test=1" target="_blank" rel="noopener">테스트 키오스크 열기 ${icon('diagonal')}</a>
    </section>
    <div class="report-controls">
      <div class="report-period-switch" role="group" aria-label="집계 기간">
        <button type="button" data-report-period="week" aria-pressed="false">주간 · 최근 7일</button>
        <button type="button" data-report-period="month" aria-pressed="false">월간 · 최근 30일</button>
      </div>
      <label>데이터 보기 <select id="report-source"><option value="">내 매장 체험 기록</option></select></label>
      <button type="button" class="btn btn-outline btn-sm" id="report-refresh">${icon('refresh')} 집계 새로고침</button>
    </div>
    <p id="report-load-status" class="report-load-status" role="status"></p>
    <div class="report-results" id="report-results"></div>`;

  const apiPath = () => '/api/merchant/analytics?' + new URLSearchParams({ period, ...(example && { example }) });
  const source = $('#report-source', container);
  const result = $('#report-results', container);
  const loadStatus = $('#report-load-status', container);
  async function load() {
    const revision = ++request;
    $$('[data-report-period]', container).forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.reportPeriod === period)));
    result.setAttribute('aria-busy', 'true');
    result.innerHTML = '';
    loadStatus.textContent = '집계를 불러오고 있어요.';
    try {
      const data = await api(apiPath(), { signal: controller.signal });
      if (revision !== request || controller.signal.aborted) return;
      source.innerHTML = `<option value="">내 매장 체험 기록</option><optgroup label="가상 보고서 예시">${data.examples.map((opt) => `<option value="${e(opt.id)}">${e(opt.label)}</option>`).join('')}</optgroup>`;
      source.value = example;
      result.innerHTML = dashboardView(data);
      loadStatus.textContent = '';
    } catch (err) {
      if (revision === request && !controller.signal.aborted) loadStatus.textContent = err.message;
    } finally {
      if (revision === request) result.removeAttribute('aria-busy');
    }
  }

  const syncLocation = () => {
    const query = new URLSearchParams({ tab: 'reports', ...(period === 'month' && { period }), ...(example && { example }) });
    history.replaceState({}, '', '/dashboard?' + query);
  };
  source.onchange = () => { example = source.value; syncLocation(); load(); };
  $('#report-refresh', container).onclick = load;
  $$('[data-report-period]', container).forEach((button) => button.onclick = () => {
    if (period === button.dataset.reportPeriod) return;
    period = button.dataset.reportPeriod;
    syncLocation();
    load();
  });
  result.onclick = async (event) => {
    const button = event.target.closest('#report-generate');
    if (!button || button.disabled) return;
    const revision = request;
    const status = $('#report-generation-status', container);
    button.disabled = true;
    status.textContent = '집계값을 바탕으로 보고서를 작성하고 있어요.';
    try {
      const { report } = await api('/api/merchant/analytics/report', { method: 'POST', body: { period }, signal: controller.signal });
      if (revision !== request || controller.signal.aborted) return;
      $('#report-article', container).innerHTML = reportArticle(report, false);
      status.textContent = '보고서를 생성했어요.';
      $('#report-narrative-title', container).focus({ preventScroll: true });
    } catch (err) {
      if (revision === request && !controller.signal.aborted) status.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  };
  load();
  return () => controller.abort();
}
