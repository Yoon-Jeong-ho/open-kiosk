import { $, $$, api, e, won, icon, logo, drinkArt, temp, toast, dialog, errorPanel } from './ui.js';

export async function kioskPage(main) {
  let alive = true; let busy = false; let state; let category = 'all'; let recording; let recordTimer; let audioConsent = false; let micPending = false;
  const controller = new AbortController();
  let prefs = { large: false, contrast: false, read: false };
  try { const stored = JSON.parse(localStorage.getItem('ok_preferences') || '{}'); for (const k of Object.keys(prefs)) prefs[k] = stored[k] === true; } catch {}
  const speak = (text, force = false) => {
    if ((!prefs.read && !force) || !('speechSynthesis' in window) || recording) return;
    speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'ko-KR'; utterance.rate = .92;
    const voice = speechSynthesis.getVoices().find((v) => v.lang.startsWith('ko')); if (voice) utterance.voice = voice;
    speechSynthesis.speak(utterance);
  };
  let lastReply = '반가워요. 메뉴를 고르거나 원하는 주문을 말과 글자로 알려 주세요.';
  const status = (text, isError = false) => {
    lastReply = text;
    if (!alive || !$('#assistant-message')) return;
    $('#assistant-message').textContent = text;
    $('#assistant-box').classList.toggle('assistant-error', isError);
    speak(text);
  };
  const preferences = () => {
    const page = $('.kiosk-app'); page?.classList.toggle('large-mode', prefs.large); page?.classList.toggle('contrast-mode', prefs.contrast);
    $$('[data-pref]').forEach((b) => b.setAttribute('aria-pressed', String(prefs[b.dataset.pref])));
    try { localStorage.setItem('ok_preferences', JSON.stringify(prefs)); } catch {}
  };
  const paintMenu = () => {
    $('#kiosk-menu').innerHTML = state.products.filter((p) => category === 'all' || p.category === category).map((p) => `<button class="product-card ${!p.available ? 'sold-out' : ''}" data-product="${e(p.id)}" ${p.available ? '' : 'disabled'} aria-label="${e(p.name)} ${won(p.price)}원, ${p.available ? '옵션 선택' : '품절'}"><span class="product-art" style="--product-bg:${e(p.color)}">${drinkArt(p)}<span class="product-add">${icon('plus')}</span>${!p.available ? '<b class="sold-out-label">품절</b>' : ''}</span><span class="product-name">${e(p.name)}</span><span class="product-description">${e(p.description)}</span><span class="product-price">${won(p.price)}<small>원</small></span></button>`).join('');
  };
  const paintCart = () => {
    const focused = document.activeElement?.closest('[data-cart-action]');
    const focusKey = focused ? { id: focused.dataset.line, action: focused.dataset.cartAction } : null;
    $('#cart-count').textContent = state.count;
    $('#cart-lines').innerHTML = state.cart.length ? state.cart.map((l) => `<article class="cart-line"><div class="cart-line-head"><h3>${e(l.name)}</h3><button class="icon-btn" data-cart-action="remove" data-line="${e(l.id)}" aria-label="${e(l.name)} ${temp(l.temperature)} 삭제">${icon('close')}</button></div><div class="cart-line-options"><span class="temp-pill ${l.temperature}">${temp(l.temperature)}</span>${(state.products.find((p) => p.id === l.product_id)?.temperatures.length || 0) > 1 ? `<button class="small-text-btn" data-cart-action="temperature" data-line="${e(l.id)}" aria-label="${e(l.name)} ${l.temperature === 'hot' ? '차갑게' : '따뜻하게'}로 변경">온도 바꾸기 ${icon('refresh')}</button>` : ''}${!l.available ? '<span class="form-error">현재 품절</span>' : ''}</div><div class="cart-line-bottom"><div class="quantity-control"><button data-cart-action="minus" data-line="${e(l.id)}" aria-label="${e(l.name)} ${temp(l.temperature)} 한 잔 줄이기">${icon('minus')}</button><span aria-label="${l.quantity}잔">${l.quantity}</span><button data-cart-action="plus" data-line="${e(l.id)}" aria-label="${e(l.name)} ${temp(l.temperature)} 한 잔 늘리기">${icon('plus')}</button></div><strong>${won(l.subtotal)}원</strong></div></article>`).join('') : `<div class="cart-empty">${icon('bag')}<b>메뉴를 담아 주세요.</b><p>화면과 말하기로 고른 메뉴가<br>함께 여기에 모여요.</p></div>`;
    $('#cart-total').textContent = won(state.total);
    $('#review-order').disabled = !state.cart.length || busy || state.cart.some((l) => !l.available);
    $('#clear-cart').disabled = !state.cart.length || busy;
    if (focusKey) {
      const button = $$('[data-cart-action]').find((b) => b.dataset.line === focusKey.id && b.dataset.cartAction === focusKey.action);
      (button || $('#cart-heading')).focus({ preventScroll: true });
    }
  };
  const acceptState = (next) => { const changed = JSON.stringify(state.products) !== JSON.stringify(next.products); state = next; if (changed) paintMenu(); paintCart(); };
  const setBusy = (value) => {
    busy = value;
    $('#send-order').disabled = value;
    $('#voice-order').disabled = value;
    $('#composer').setAttribute('aria-busy', String(value));
    $('#send-order').innerHTML = value ? '<span class="button-spinner"></span><span class="sr-only">주문 확인 중</span>' : icon('arrow');
    paintCart();
  };
  const fail = async (err) => {
    if (!alive) return;
    if (err.status === 409) { try { acceptState(await api('/api/kiosk/state')); } catch {} }
    status(err.message, true);
  };
  const change = async (operation) => {
    if (busy) return; setBusy(true);
    try { const next = await api('/api/kiosk/action', { method: 'POST', body: { revision: state.revision, operation } }); if (alive) { acceptState(next); status(next.reply); } }
    catch (err) { await fail(err); } finally { if (alive) setBusy(false); }
  };
  const chooseProduct = (product) => {
    let temperature = product.temperatures.length === 1 ? product.temperatures[0] : null;
    let q = 1;
    const d = dialog(`<div class="product-modal-art" style="--product-bg:${e(product.color)}">${drinkArt(product)}</div><div class="product-modal-title"><h2>${e(product.name)}</h2><b>${won(product.price)}원</b></div><p class="muted">${e(product.description)}</p><fieldset class="temperature-options"><legend>어떻게 드릴까요?</legend>${product.temperatures.map((t) => `<label><input type="radio" name="temperature" value="${t}" ${temperature === t ? 'checked' : ''}><span>${t === 'hot' ? '☀' : '❄'} ${temp(t)}</span></label>`).join('')}</fieldset><div class="product-quantity"><b>수량</b><div class="quantity-control"><button id="quantity-minus" aria-label="한 잔 줄이기">${icon('minus')}</button><span id="quantity-value">1</span><button id="quantity-plus" aria-label="한 잔 늘리기">${icon('plus')}</button></div></div><button id="add-to-cart" class="btn btn-dark full-width" ${temperature ? '' : 'disabled'}>온도를 선택해 주세요</button>`, 'product-modal');
    const update = () => { $('#quantity-value', d).textContent = q; $('#quantity-minus', d).disabled = q === 1; $('#quantity-plus', d).disabled = q === 20; $('#add-to-cart', d).disabled = !temperature; $('#add-to-cart', d).textContent = temperature ? `${q}잔 담기 · ${won(q * product.price)}원` : '온도를 선택해 주세요'; };
    $$('input[name=temperature]', d).forEach((r) => r.onchange = () => { temperature = r.value; update(); });
    $('#quantity-minus', d).onclick = () => { q = Math.max(1, q - 1); update(); };
    $('#quantity-plus', d).onclick = () => { q = Math.min(20, q + 1); update(); };
    $('#add-to-cart', d).onclick = () => { d.close(); change({ type: 'add', product_id: product.id, quantity: q, temperature }); };
    update();
  };
  const reviewOrder = () => {
    if (!state.cart.length || busy) return;
    const review = structuredClone(state);
    const d = dialog(`<div class="modal-heading"><span class="review-icon">${icon('check')}</span><span class="step-overline">마지막으로 확인해 주세요</span><h2>이대로 주문할까요?</h2><p>메뉴와 수량, 온도를 확인해 주세요.</p></div><div class="review-lines">${review.cart.map((l) => `<div><span><b>${e(l.name)}</b><small>${temp(l.temperature)} · ${l.quantity}잔</small></span><strong>${won(l.subtotal)}원</strong></div>`).join('')}</div><div class="review-total"><b>합계</b><strong>${won(review.total)}원</strong></div><p class="form-footnote">교육용 체험 주문입니다. 음료값은 실제 결제되지 않아요.</p><p id="confirm-error" class="form-error" role="alert"></p><button id="confirm-order" class="btn btn-dark full-width">확인하고 주문 확정 ${icon('arrow')}</button><button id="return-to-order" class="btn btn-plain full-width">돌아가서 수정하기</button>`);
    $('#return-to-order', d).onclick = () => d.close();
    $('#confirm-order', d).onclick = async () => {
      const btn = $('#confirm-order', d); btn.disabled = true;
      try {
        const result = await api('/api/kiosk/confirm', { method: 'POST', body: { revision: review.revision, total: review.total, confirmed: true } });
        if (!alive) { d.close(); return; }
        acceptState(await api('/api/kiosk/state')); d.close();
        const success = dialog(`<div class="success-order"><span class="success-seal">${icon('check')}</span><div class="eyebrow">YOUR ORDER IS IN</div><h2>주문이 접수됐어요.</h2><p>나만의 방식으로, 잘 주문하셨어요.</p><span class="order-ticket"><small>체험 주문번호</small><strong>${String(result.order.number).padStart(3, '0')}</strong><span>${e(review.store.name)}</span></span><p class="form-footnote">${won(result.order.total)}원 · 실제 청구 없음<br>가상 매장 운영 화면에서 접수 내용을 확인할 수 있어요.</p><button class="btn btn-dark full-width" id="new-order">새 주문 시작하기 ${icon('arrow')}</button></div>`);
        $('#new-order', success).onclick = () => success.close();
        status(`주문번호 ${result.order.number}번으로 접수됐어요. 새 주문을 시작할 수 있어요.`);
      } catch (err) {
        if (d.isConnected) { $('#confirm-error', d).textContent = err.message; btn.disabled = false; }
        await fail(err);
        if (err.status === 409 && d.isConnected) { btn.disabled = true; $('#return-to-order', d).focus(); }
      }
    };
  };
  const submitText = async () => {
    const input = $('#order-text'); const text = input.value.trim(); if (!text || busy || recording || micPending) return;
    setBusy(true); status('주문 내용을 확인하고 있어요. 잠시만 기다려 주세요.');
    $('#your-message').textContent = `“${text}”`; $('#your-message').hidden = false;
    try {
      const next = await api('/api/kiosk/interpret', { method: 'POST', body: { text, revision: state.revision } });
      if (alive) { acceptState(next); status(next.reply); input.value = ''; if (next.review) { setBusy(false); reviewOrder(); } }
    } catch (err) { await fail(err); } finally { if (alive) { setBusy(false); input.focus({ preventScroll: true }); } }
  };
  const stopRecording = () => { if (recording?.recorder.state === 'recording') recording.recorder.stop(); };
  const startRecording = async () => {
    if (micPending || recording) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder || !window.isSecureContext) return status('이 환경에서는 마이크를 사용할 수 없어요. localhost 또는 HTTPS에서 열거나 글자로 입력해 주세요.', true);
    micPending = true; $('#voice-order').disabled = true;
    try {
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
      const type = ['audio/webm', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t));
      if (!type) { stream.getTracks().forEach((t) => t.stop()); return status('브라우저의 녹음 형식을 지원하지 않아요. 글자로 입력해 주세요.', true); }
      const recorder = new MediaRecorder(stream, { mimeType: type }); const chunks = [];
      const session = { recorder, stream, aborted: false }; recording = session;
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = async () => {
        clearTimeout(recordTimer); stream.getTracks().forEach((t) => t.stop()); recording = null;
        if (!alive || session.aborted) return;
        $('#voice-order').classList.remove('recording'); $('#voice-order').innerHTML = `${icon('mic')} <span>말하기</span>`; $('#voice-order').setAttribute('aria-label', '음성으로 주문 입력');
        setBusy(true); status('녹음한 말을 글자로 바꾸고 있어요.');
        try {
          const blob = new Blob(chunks, { type });
          const result = await api('/api/kiosk/transcribe', { method: 'POST', body: blob, headers: { 'Content-Type': type, 'X-Audio-Consent': '1' } });
          if (alive) { $('#order-text').value = result.text; status('인식한 내용을 확인하고, 필요하면 고친 뒤 보내 주세요.'); $('#order-text').focus(); }
        } catch (err) { await fail(err); } finally { if (alive) setBusy(false); }
      };
      recorder.onerror = () => { stream.getTracks().forEach((t) => t.stop()); if (alive) status('녹음을 계속하지 못했어요. 다시 시도하거나 글자로 입력해 주세요.', true); };
      recorder.start();
      $('#send-order').disabled = true;
      $('#voice-order').classList.add('recording'); $('#voice-order').innerHTML = '<span class="record-dot"></span><span>녹음 끝내기</span>'; $('#voice-order').setAttribute('aria-label', '녹음 끝내기');
      // Do not speak through the speakers while the microphone is recording.
      $('#assistant-message').textContent = '듣고 있어요. 다 말했으면 ‘녹음 끝내기’를 눌러 주세요. 최대 20초 뒤 자동으로 끝나요.';
      recordTimer = setTimeout(stopRecording, 20000);
    } catch { status('마이크 권한 또는 연결을 확인해 주세요. 화면·키보드로도 주문할 수 있어요.', true); }
    finally { micPending = false; if (alive) $('#voice-order').disabled = busy; }
  };
  const voice = () => {
    if (recording) return stopRecording();
    if (busy) return;
    if (audioConsent) return startRecording();
    const d = dialog(`<div class="modal-heading">${icon('mic')}<h2>음성으로 주문해 볼까요?</h2><p>녹음한 주문 음성은 OpenAI로 전송해 글자로 바꿔요. 앱 서버에는 음성 원본을 보관하지 않습니다.</p></div><div class="info-callout"><p>이름·전화번호 같은 개인정보는 말하지 마세요. 녹음은 최대 20초이며, 변환된 문장을 확인하고 수정한 뒤 보낼 수 있어요.</p></div><p class="form-footnote"><a href="/privacy">체험 데이터 안내</a>에서 전송·보관 범위를 확인할 수 있습니다.</p><button class="btn btn-dark full-width" id="agree-recording">동의하고 녹음 시작 ${icon('mic')}</button><button class="btn btn-plain full-width" id="use-keyboard">글자로 입력할게요</button>`);
    $('#agree-recording', d).onclick = () => { audioConsent = true; d.close(); startRecording(); };
    $('#use-keyboard', d).onclick = () => { d.close(); $('#order-text').focus(); };
  };

  try {
    state = await api('/api/kiosk/bootstrap', { method: 'POST', body: { store: new URLSearchParams(location.search).get('store') || 'demo' } });
    if (location.pathname !== '/kiosk') return;
    main.innerHTML = `<div class="kiosk-app"><header class="kiosk-header"><div class="kiosk-store">${logo()}<span class="kiosk-store-divider"></span><span>${e(state.store.name)}<small>체험 매장</small></span></div><div class="accessibility-toolbar" role="group" aria-label="보기와 듣기 설정"><button data-pref="large" aria-pressed="false">${icon('type')}<span>크게 보기</span></button><button data-pref="contrast" aria-pressed="false">${icon('sun')}<span>선명하게</span></button><button data-pref="read" aria-pressed="false">${icon('volume')}<span>읽어주기</span></button><a href="/tour" class="exit-kiosk">나가기 ${icon('logout')}</a></div></header><div class="kiosk-layout"><section class="kiosk-selection" aria-label="메뉴 선택"><div class="kiosk-welcome"><div><div class="eyebrow">TAKE YOUR TIME, MAKE IT YOURS</div><h1>무엇을 마실까요<span>?</span></h1><p>메뉴를 고르거나, 원하는 주문을 알려 주세요.</p></div><span class="kiosk-step"><b>01</b> 메뉴 고르기</span></div><div class="assistant-box" id="assistant-box"><span class="assistant-avatar">✳</span><div><span class="assistant-name">OPEN KIOSK</span><p id="assistant-message" aria-live="polite" aria-atomic="true">${lastReply}</p></div><button id="repeat-message" class="icon-btn" aria-label="현재 안내 다시 듣기">${icon('volume')}</button></div><div class="category-tabs" role="group" aria-label="메뉴 종류"><button class="active" data-category="all" aria-pressed="true">전체 메뉴 <small>08</small></button><button data-category="coffee" aria-pressed="false">커피</button><button data-category="tea" aria-pressed="false">차 & 음료</button></div><div class="kiosk-menu" id="kiosk-menu"></div><form class="composer" id="composer"><div class="composer-top"><span>${icon('mic')} 내 방식으로 주문하기</span><small>글자로 입력해도 괜찮아요</small></div><p id="your-message" class="your-message" hidden></p><div class="composer-input-row"><button type="button" class="voice-btn" id="voice-order" aria-label="음성으로 주문 입력">${icon('mic')}<span>말하기</span></button><label class="sr-only" for="order-text">원하는 메뉴 또는 주문 수정 내용</label><input id="order-text" maxlength="500" autocomplete="off" placeholder="예: 따뜻한 아메리카노 두 잔 주세요" enterkeyhint="send"><button type="submit" id="send-order" class="send-btn" aria-label="입력한 주문 보내기">${icon('arrow')}</button></div><p class="composer-note">${state.ai_available ? '입력한 주문 문장은 AI 해석을 위해 OpenAI로 전송돼요.' : 'AI 연결이 준비 중이에요. 메뉴판으로 계속 주문할 수 있어요.'} 개인정보는 입력하지 마세요.</p></form></section><aside class="cart-panel" aria-label="선택한 주문"><div class="cart-panel-head"><h2 id="cart-heading" tabindex="-1">내 주문 <span id="cart-count">0</span></h2><button id="clear-cart" class="small-text-btn">비우기</button></div><div class="cart-lines" id="cart-lines"></div><div class="cart-summary"><div><span>합계</span><strong><span id="cart-total">0</span><small>원</small></strong></div><p>음료값은 실제 결제되지 않는 체험 주문이에요.</p><button id="review-order" class="btn btn-dark full-width" disabled>주문 내용 확인 ${icon('arrow')}</button><button id="request-help" class="help-button">${icon('help')} 도움이 필요해요</button></div><div class="cart-reassurance">${icon('shield')} 마지막 확인 후 주문이 확정돼요.</div></aside></div><footer class="kiosk-footer"><span>YOUR PACE. YOUR WAY.</span><a href="/accessibility">접근성 안내</a><a href="/privacy">체험 데이터 안내</a><span>교육용 데모 · 실제 매장·결제 연결 없음</span></footer></div>`;
    preferences(); paintMenu(); paintCart();
    main.addEventListener('click', (event) => {
      const pref = event.target.closest('[data-pref]');
      if (pref) { prefs[pref.dataset.pref] = !prefs[pref.dataset.pref]; preferences(); if (pref.dataset.pref === 'read') { if (prefs.read) speak(lastReply); else if ('speechSynthesis' in window) speechSynthesis.cancel(); } return; }
      const cat = event.target.closest('[data-category]');
      if (cat) { category = cat.dataset.category; $$('[data-category]').forEach((b) => { b.classList.toggle('active', b === cat); b.setAttribute('aria-pressed', String(b === cat)); }); paintMenu(); return; }
      const product = event.target.closest('[data-product]');
      if (product && !busy) return chooseProduct(state.products.find((p) => p.id === product.dataset.product));
      const button = event.target.closest('[data-cart-action]');
      if (button) {
        const l = state.cart.find((l) => l.id === button.dataset.line); if (!l) return;
        const action = button.dataset.cartAction;
        const operation = action === 'remove' ? { type: 'remove', line_id: l.id } : action === 'temperature' ? { type: 'temperature', line_id: l.id, temperature: l.temperature === 'hot' ? 'iced' : 'hot' } : { type: 'quantity', line_id: l.id, quantity: l.quantity + (action === 'plus' ? 1 : -1) };
        change(operation);
      }
    }, { signal: controller.signal });
    $('#composer').onsubmit = (event) => { event.preventDefault(); submitText(); };
    $('#voice-order').onclick = voice;
    $('#repeat-message').onclick = () => speak(lastReply, true);
    $('#review-order').onclick = reviewOrder;
    $('#clear-cart').onclick = () => {
      if (!state.cart.length || busy) return;
      const d = dialog('<div class="modal-heading"><h2>선택한 메뉴를 비울까요?</h2><p>지금 담은 메뉴만 지우고 새로 고를 수 있어요.</p></div><button class="btn btn-dark full-width" id="clear-confirm">장바구니 비우기</button>');
      $('#clear-confirm', d).onclick = () => { d.close(); change({ type: 'clear' }); };
    };
    $('#request-help').onclick = async (event) => {
      const button = event.currentTarget; button.disabled = true;
      try { const result = await api('/api/kiosk/help', { method: 'POST', body: {} }); if (alive) { status(result.message); toast('도움 요청을 보냈어요.'); } }
      catch (err) { await fail(err); } finally { if (alive) button.disabled = false; }
    };
  } catch (err) { main.innerHTML = errorPanel(err.message); }
  return () => { alive = false; controller.abort(); clearTimeout(recordTimer); if (recording) { recording.aborted = true; stopRecording(); recording.stream.getTracks().forEach((t) => t.stop()); } if ('speechSynthesis' in window) speechSynthesis.cancel(); $$('dialog').forEach((d) => d.close()); };
}
