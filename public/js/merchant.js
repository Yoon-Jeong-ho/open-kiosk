import { $, $$, api, e, won, icon, logo, toast, dialog, errorPanel, temp } from './ui.js';

const chosenPlan = (config) => config.plans[new URLSearchParams(location.search).get('plan')] || config.plans.essential;
const statusNames = { received: '접수됨', preparing: '준비 중', ready: '준비 완료', completed: '전달 완료' };
const nextStatus = { received: 'preparing', preparing: 'ready', ready: 'completed' };
const actionNames = { preparing: '준비 시작하기', ready: '준비 완료로 변경', completed: '전달 완료로 변경' };

export function signup(config) {
  const plan = chosenPlan(config);
  return `<section class="onboarding section-width"><div class="onboarding-story"><div class="eyebrow">HELLO, YOUR OPEN STORE</div><h1>열린 매장의 시작,<br>직접 경험해 보세요.</h1><p>가상 매장을 고르면 체험 계정이 만들어져요.<br>개인정보를 입력할 필요가 없습니다.</p><div class="onboarding-art"><div class="store-front"><div class="store-awning"><i></i><i></i><i></i><i></i><i></i></div><div class="store-front-label">YOUR NEXT<br>OPEN STORE<span>✳</span></div><div class="store-door"></div></div><div class="onboarding-sticker">READY WHEN<br>YOU ARE ↗</div></div></div><form id="signup-form" class="form-card"><span class="step-overline">STEP 01 OF 02</span><h2>나의 체험 매장 고르기</h2><p class="muted">준비된 가상 매장 중 하나를 선택해 주세요.</p><fieldset class="preset-options"><legend class="sr-only">가상 매장</legend>${config.presets.map((p, i) => `<label class="preset-option"><input type="radio" name="preset" value="${e(p.id)}" ${i ? '' : 'checked'} required><span class="preset-avatar preset-${i}">${icon('coffee')}</span><span><strong>${e(p.name)}</strong><small>${e(p.subtitle)}</small></span><span class="radio-indicator"></span></label>`).join('')}</fieldset><div class="selected-plan"><div>${icon('card')} 선택한 체험 요금제</div><strong>${e(plan.name)} <span>${won(plan.price)}원 / 월</span></strong><a href="/pricing">변경하기</a></div><label class="check-field"><input type="checkbox" name="acknowledged" required><span>교육용 가상 계정이며 실제 개인정보를 등록하지 않는 체험임을 확인했습니다.</span></label><p id="signup-error" class="form-error" role="alert"></p><button class="btn btn-dark full-width" type="submit">체험 계정 만들기 ${icon('arrow')}</button><p class="form-footnote">실명·이메일·전화번호·비밀번호를 받지 않아요.<br>계정은 이 브라우저에 연결되고 7일 후 만료됩니다.</p><a class="subtle-link" href="/privacy">체험 데이터 안내</a></form></section>`;
}
export function bindSignup(config, navigate) {
  let alive = true;
  $('#signup-form').onsubmit = async (event) => {
    event.preventDefault(); const form = event.currentTarget; const button = $('button[type=submit]', form); button.disabled = true; $('#signup-error').textContent = '';
    try {
      const data = new FormData(form);
      await api('/api/auth/demo', { method: 'POST', body: { preset: data.get('preset'), demo_acknowledged: data.has('acknowledged') } });
      if (alive) navigate(`/checkout?plan=${chosenPlan(config).id}`);
    } catch (err) { if (alive) { $('#signup-error').textContent = err.message; button.disabled = false; } }
  };
  return () => { alive = false; };
}

export async function checkout(config, navigate, main) {
  let alive = true;
  try {
    const { store } = await api('/api/merchant/me');
    if (location.pathname !== '/checkout') return;
    const plan = chosenPlan(config); const nonce = crypto.randomUUID();
    main.innerHTML = `<section class="checkout-page section-width"><a href="/pricing" class="back-link">← 요금제로 돌아가기</a><div class="checkout-grid"><div><span class="step-overline">STEP 02 OF 02</span><h1>우리 매장의<br>가능성을 열어 볼까요?</h1><p class="prose-lead">${e(store.name)}의 서비스 구독 체험입니다.</p><div class="demo-notice">${icon('shield')}<div><strong>실제 결제는 일어나지 않아요.</strong><p>카드번호·계좌정보를 받지 않고 결제 완료 흐름만 보여드려요. 자동 갱신이나 실제 청구는 없습니다.</p></div></div><div class="checkout-method"><span class="virtual-card">${icon('card')}</span><div><b>프로젝트 체험 결제</b><small>DEMO PAYMENT · 결제수단 입력 없음</small></div><span class="round-check">${icon('check')}</span></div><p class="muted small">이 금액은 손님의 음료값이 아닌, 매장 운영자의 서비스 월 구독료를 가정한 값입니다.</p></div><form class="form-card checkout-summary" id="checkout-form"><div class="summary-heading"><span>구독 내용</span><span class="demo-tag">DEMO</span></div><h2>${e(plan.name)}</h2><p>${e(plan.description)}</p><dl><div><dt>체험 매장</dt><dd>${e(store.name)}</dd></div><div><dt>구독 주기</dt><dd>월간 · 가상 구독</dd></div><div><dt>가정한 월 이용료</dt><dd>${won(plan.price)}원</dd></div></dl><div class="summary-total"><span>지금 실제로 청구되는 금액</span><strong>0<span>원</span></strong></div><label class="check-field"><input type="checkbox" name="acknowledged" required><span>가상 구독 결제 데모이며, 실제 청구나 자동 결제가 없음을 확인했습니다.</span></label><p id="checkout-error" class="form-error" role="alert"></p><button class="btn btn-dark full-width" type="submit">구독 결제 데모 완료하기 ${icon('arrow')}</button><p class="form-footnote">완료하면 내 매장 운영 화면으로 이동합니다.</p></form></div></section>`;
    $('#checkout-form').onsubmit = async (event) => {
      event.preventDefault(); const btn = $('button[type=submit]', event.currentTarget); btn.disabled = true;
      try { await api('/api/subscription/demo', { method: 'POST', body: { plan: plan.id, idempotency_key: nonce, demo_acknowledged: new FormData(event.currentTarget).has('acknowledged') } }); if (alive) { toast('구독 체험을 완료했어요. 실제 청구는 없습니다.'); navigate('/dashboard'); } }
      catch (err) { if (alive) { $('#checkout-error').textContent = err.message; btn.disabled = false; } }
    };
  } catch (err) { if (err.status === 401) navigate(`/signup?plan=${chosenPlan(config).id}`); else main.innerHTML = errorPanel(err.message); }
  return () => { alive = false; };
}

export async function dashboard(config, navigate, main) {
  let alive = true; let current; let timer;
  const tab = ['orders', 'menu', 'subscription', 'settings'].includes(new URLSearchParams(location.search).get('tab')) ? new URLSearchParams(location.search).get('tab') : 'orders';
  const title = { orders: '주문 관리', menu: '메뉴 관리', subscription: '구독 관리', settings: '체험 설정' }[tab];
  const renderOrders = (data) => {
    const orders = data.orders; const pending = orders.filter((o) => o.status !== 'completed');
    $('#dashboard-stats').innerHTML = `<article><span>표시된 체험 주문</span><strong>${orders.length}<small>건</small></strong><p>최근 최대 30건</p></article><article><span>준비 중인 주문</span><strong>${pending.length}<small>건</small></strong><p>전달 완료 전 주문</p></article><article><span>표시된 주문 금액</span><strong>${won(orders.reduce((n, o) => n + o.total, 0))}<small>원</small></strong><p>실제 결제·매출 아님</p></article>`;
    $('#help-list').innerHTML = data.help.length ? `<div class="help-banner">${icon('bell')}<div><b>도움 요청 ${data.help.length}건</b><span>키오스크에서 도움이 필요하다고 알려왔어요.</span></div>${data.help.map((h) => `<button class="btn btn-outline btn-sm" data-help="${e(h.id)}">도움 요청 확인</button>`).join('')}</div>` : '';
    $('#order-list').innerHTML = orders.length ? orders.map((o) => `<article class="order-card"><div class="order-card-head"><div><span class="order-number">#${String(o.number).padStart(3, '0')}</span><time>${new Date(o.created).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</time></div><span class="order-status status-${o.status}">${statusNames[o.status]}</span></div><div class="order-lines">${o.lines.map((l) => `<div><span>${e(l.name)} <small>${temp(l.temperature)}</small></span><b>${l.quantity}잔</b></div>`).join('')}</div><div class="order-card-bottom"><strong>${won(o.total)}원 <small>체험 금액</small></strong>${nextStatus[o.status] ? `<button class="btn btn-dark btn-sm" data-order="${e(o.id)}" data-next="${nextStatus[o.status]}">${actionNames[nextStatus[o.status]]} ${icon('arrow')}</button>` : `<span class="muted">${icon('check')} 전달했어요</span>`}</div></article>`).join('') : `<div class="empty-state">${icon('bag')}<h3>첫 주문을 기다리고 있어요.</h3><p>‘내 매장 키오스크’를 열어 주문해 보세요.<br>확정한 주문이 여기에 나타납니다.</p><a class="btn btn-dark" href="${e(data.kiosk_path)}" target="_blank" rel="noopener">내 매장 키오스크 ${icon('diagonal')}</a></div>`;
  };
  const load = async () => { const data = await api('/api/merchant/dashboard'); if (!alive) return; current = data; if (tab === 'orders') renderOrders(data); };
  try {
    current = await api('/api/merchant/dashboard');
    if (location.pathname !== '/dashboard') return;
    const data = current;
    main.innerHTML = `<div class="dashboard-layout"><aside class="dashboard-sidebar">${logo(true)}<div class="workspace-label">MY DEMO WORKSPACE</div><div class="workspace-store">${icon('store')}<div><b>${e(data.store.name)}</b><small>가상 매장 · 체험 계정</small></div></div><nav aria-label="운영 화면 메뉴">${[['orders', 'grid', '주문 관리'], ['menu', 'coffee', '메뉴 관리'], ['subscription', 'card', '구독 관리'], ['settings', 'settings', '체험 설정']].map(([t, i, label]) => `<a class="${tab === t ? 'active' : ''}" href="/dashboard?tab=${t}" ${tab === t ? 'aria-current="page"' : ''}>${icon(i)}${label}</a>`).join('')}</nav><div class="sidebar-bottom"><a href="/">${icon('arrow')} 서비스 사이트</a><button id="logout-btn">${icon('logout')} 체험 로그아웃</button><p>실제 매장과 연결되지 않은<br>프로젝트 운영 데모입니다.</p></div></aside><div class="dashboard-main"><header class="dashboard-topbar"><span>${icon('store')} ${e(data.store.name)}</span><span class="demo-tag">DEMO WORKSPACE</span></header><section class="dashboard-content"><div class="dashboard-heading"><div><div class="eyebrow">YOUR STORE, AT A GLANCE</div><h1>${title}</h1><p>${tab === 'orders' ? '내 매장의 주문과 도움 요청을 확인해요.' : tab === 'menu' ? '내 매장 키오스크의 가격과 판매 상태를 바꿔요.' : tab === 'subscription' ? '가상 구독 상태를 확인하고 요금제를 체험해요.' : '이 브라우저에 연결된 가상 매장을 관리해요.'}</p></div><a class="btn btn-dark" href="${e(data.kiosk_path)}" target="_blank" rel="noopener">내 매장 키오스크 ${icon('diagonal')}</a></div><div id="dashboard-body"></div></section></div></div>`;
    $('#logout-btn').onclick = async () => { await api('/api/auth/logout', { method: 'POST', body: {} }); navigate('/'); };
    if (tab === 'orders') {
      $('#dashboard-body').innerHTML = `<div class="dashboard-stats" id="dashboard-stats"></div><div id="help-list"></div><div class="orders-heading"><h2>최근 주문</h2><div><span class="muted small">5초마다 자동 갱신</span><button id="refresh-orders" class="icon-btn" aria-label="주문 새로고침">${icon('refresh')}</button></div></div><div id="order-list" class="order-grid"></div>`;
      renderOrders(data);
      $('#refresh-orders').onclick = () => load().then(() => toast('주문 내역을 새로 불러왔어요.')).catch((err) => toast(err.message));
      $('#dashboard-body').onclick = async (event) => {
        const button = event.target.closest('[data-order],[data-help]'); if (!button || button.disabled) return;
        button.disabled = true;
        try {
          await api(button.dataset.order ? '/api/merchant/order' : '/api/merchant/help', { method: 'PATCH', body: button.dataset.order ? { id: button.dataset.order, status: button.dataset.next } : { id: button.dataset.help } });
          await load(); toast('상태를 변경했어요.');
        } catch (err) { toast(err.message); if (alive && button.isConnected) button.disabled = false; }
      };
      timer = setInterval(() => { if (!document.hidden && !$('#order-list')?.contains(document.activeElement) && !$('#help-list')?.contains(document.activeElement)) load().catch(() => {}); }, 5000);
    } else if (tab === 'menu') {
      $('#dashboard-body').innerHTML = `<div class="info-callout">${icon('refresh')} 저장한 가격과 판매 상태는 내 매장 키오스크의 다음 요청부터 반영됩니다. 이미 확정된 주문 금액은 유지됩니다.</div><div class="menu-management">${data.products.map((p) => `<form class="menu-management-row" data-menu-form="${e(p.id)}"><div class="menu-management-name"><span class="menu-initial">${e(p.name[0])}</span><div><b>${e(p.name)}</b><small>${e(p.en)}</small></div></div><label>가격 <span><input type="number" name="price" min="1000" max="50000" step="100" value="${p.price}" aria-label="${e(p.name)} 가격" required> 원</span></label><label class="availability-control"><input name="available" type="checkbox" ${p.available ? 'checked' : ''}><span>판매 중</span></label><button class="btn btn-outline btn-sm" type="submit">저장</button></form>`).join('')}</div>`;
      $$('[data-menu-form]').forEach((form) => { form.onsubmit = async (event) => { event.preventDefault(); const button = $('button', form); button.disabled = true; const values = new FormData(form); try { await api('/api/merchant/menu', { method: 'PATCH', body: { product_id: form.dataset.menuForm, price: Number(values.get('price')), available: values.has('available') } }); toast('메뉴 설정을 저장했어요.'); } catch (err) { toast(err.message); } finally { button.disabled = false; } }; });
    } else if (tab === 'subscription') {
      const plan = config.plans[data.store.plan];
      $('#dashboard-body').innerHTML = `<article class="subscription-panel"><div class="subscription-icon">${icon('card')}</div><span class="demo-tag">가상 구독</span><h2>${plan ? e(plan.name) : '무료 체험 상태'}</h2><p>${plan ? `${won(plan.price)}원 / 월을 가정한 구독 데모입니다.` : '요금제를 선택하고 구독 과정을 체험해 보세요.'}</p><div class="subscription-zero"><span>실제 청구 금액</span><b>0원</b></div><div class="button-row"><a class="btn btn-dark" href="/pricing">${plan ? '요금제 변경 체험' : '요금제 체험하기'} ${icon('arrow')}</a>${plan ? '<button class="btn btn-outline" id="cancel-plan">가상 구독 해지</button>' : ''}</div><small>자동 갱신·실제 청구·환불 거래는 발생하지 않습니다.</small></article>`;
      if ($('#cancel-plan')) $('#cancel-plan').onclick = async () => { try { await api('/api/subscription/cancel', { method: 'POST', body: {} }); toast('가상 구독을 해지했어요.'); navigate('/dashboard?tab=subscription', true); } catch (err) { toast(err.message); } };
    } else {
      $('#dashboard-body').innerHTML = `<article class="settings-panel"><h2>체험 계정 안내</h2><dl><div><dt>매장 이름</dt><dd>${e(data.store.name)}</dd></div><div><dt>연결 방식</dt><dd>이 브라우저의 세션 쿠키</dd></div><div><dt>개인정보 입력</dt><dd>이름·이메일·전화번호·비밀번호 없음</dd></div><div><dt>만료</dt><dd>생성 후 7일, 이후 주기적으로 정리</dd></div></dl><a href="/privacy" class="under-link">데이터 안내 보기 ${icon('diagonal')}</a></article><article class="settings-panel danger-panel"><h2>체험 데이터 삭제</h2><p>내 가상 매장의 주문·메뉴 설정·구독 데모 내역과 계정이 삭제됩니다.</p><button class="btn btn-outline" id="delete-account">내 체험 매장 삭제하기</button></article>`;
      $('#delete-account').onclick = () => {
        const d = dialog(`<div class="modal-heading">${icon('store')}<h2>체험 매장을 삭제할까요?</h2><p>이 가상 매장의 주문과 설정이 함께 삭제돼요.<br>다시 체험하려면 새 계정을 만들 수 있어요.</p></div><button class="btn btn-dark full-width" id="delete-confirm">체험 데이터 삭제</button><p class="form-error" role="alert" id="delete-error"></p>`);
        $('#delete-confirm', d).onclick = async (event) => { event.currentTarget.disabled = true; try { await api('/api/account/delete', { method: 'POST', body: { confirm: 'DELETE_DEMO' } }); d.close(); navigate('/'); toast('체험 데이터를 삭제했어요.'); } catch (err) { $('#delete-error', d).textContent = err.message; $('#delete-confirm', d).disabled = false; } };
      };
    }
  } catch (err) {
    if (err.status === 401) { main.innerHTML = `<section class="section-width account-empty"><span class="empty-symbol">${icon('store')}</span><h1>나의 매장을<br>만나볼 시간이에요.</h1><p>이 브라우저에 연결된 체험 계정이 없어요.<br>가상 매장을 골라 개인정보 없이 시작해 보세요.</p><a href="/signup" class="btn btn-dark btn-lg">체험 계정 만들기 ${icon('arrow')}</a></section>`; }
    else main.innerHTML = errorPanel(err.message);
  }
  return () => { alive = false; clearInterval(timer); };
}
