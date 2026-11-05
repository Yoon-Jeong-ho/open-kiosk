import { $, $$, api, e, icon, drinkArt, dialog, errorPanel } from './ui.js';
import { languages, tr, productName, priceText, addonName } from './locale.js';
import { normalizePreferences, applyPresentation, parsePresentationCommand } from './presentation.js';

export async function kioskPage(main) {
  let alive = true, busy = false, state, category = 'all', recording, recordTimer, micPending = false, audioConsent = false, uiRevision = 0;
  const controller = new AbortController();
  let prefs = normalizePreferences();
  try { prefs = normalizePreferences(JSON.parse(localStorage.getItem('ok_preferences') || '{}')); } catch {}
  const t = (key, values) => tr(prefs.language, key, values);
  const name = (p) => productName(p, prefs.language);
  const money = (n) => priceText(n, prefs.language);
  const temperature = (n) => t(n === 'hot' ? 'hot' : 'iced');
  let lastReply = t('initial');
  const speak = (text, force = false) => {
    if ((!prefs.read && !force) || !('speechSynthesis' in window) || recording) return;
    speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = languages.find((l) => l.id === prefs.language).speech; utterance.rate = .92;
    const voice = speechSynthesis.getVoices().find((v) => v.lang.startsWith(prefs.language));
    if (voice) utterance.voice = voice;
    speechSynthesis.speak(utterance);
  };
  const status = (text, error = false) => {
    lastReply = text;
    if (!alive || !$('#assistant-message')) return;
    $('#assistant-message').textContent = text;
    $('#assistant-box').classList.toggle('assistant-error', error);
    speak(text);
  };
  const positionDialog = (d) => {
    const screen = $('.device-screen'); if (!screen) return;
    const r = screen.getBoundingClientRect();
    Object.assign(d.style, { left: `${r.left + r.width / 2}px`, top: `${r.top + r.height / 2}px`, margin: '0', transform: 'translate(-50%,-50%)', maxHeight: `${r.height - 28}px`, width: `${Math.min(440, r.width - 28)}px` });
    d.style.setProperty('--text-scale', prefs.textScale);
    d.style.setProperty('--image-scale', prefs.imageScale);
  };
  const modal = (content, cls = '') => {
    const d = dialog(content, `kiosk-modal ${cls}`); d.lang = prefs.language;
    $('.modal-close', d).setAttribute('aria-label', t('close')); positionDialog(d); return d;
  };
  const paintMenu = () => {
    $('#kiosk-menu').innerHTML = state.products.filter((p) => category === 'all' || p.category === category).map((p) => `<button class="product-card ${p.available ? '' : 'sold-out'}" data-product="${e(p.id)}" ${p.available ? '' : 'disabled'} aria-label="${e(name(p))}, ${e(money(p.price))}${p.available ? '' : ', ' + e(t('unavailable'))}"><span class="product-art" style="--product-bg:${e(p.color)}" aria-hidden="true">${drinkArt(p)}<span class="product-add">${icon('plus')}</span>${p.available ? '' : `<b class="sold-out-label">${e(t('unavailable'))}</b>`}</span><span class="product-name">${e(name(p))}</span><span class="product-price">${e(money(p.price))}</span></button>`).join('');
  };
  const addonText = (line) => (line.addons || []).map((id) => addonName(id, prefs.language)).join(' · ');
  const addonControls = (product, selected = []) => (product.addons || []).length ? `<fieldset class="addon-options"><legend>${e(t('addons'))}</legend>${product.addons.map((a) => `<label><input type="checkbox" name="addon" value="${e(a.id)}" ${selected.includes(a.id) ? 'checked' : ''}><span>${e(addonName(a.id, prefs.language))}<small>+${e(money(a.price))} ${e(t('perCup'))}</small></span></label>`).join('')}</fieldset>` : '';
  const paintCart = () => {
    const focused = document.activeElement?.closest('[data-cart-action]');
    const focusKey = focused ? { id: focused.dataset.line, action: focused.dataset.cartAction } : null;
    $('#cart-count').textContent = state.count;
    $('#cart-lines').innerHTML = state.cart.length ? state.cart.map((l) => `<article class="cart-line"><div class="cart-line-head"><h3>${e(name(l))}</h3><button class="icon-btn" data-cart-action="remove" data-line="${e(l.id)}" aria-label="${e(name(l))} ${e(temperature(l.temperature))} ${e(t('remove'))}">${icon('close')}</button></div><div class="cart-line-options"><span class="temp-pill ${l.temperature}">${e(temperature(l.temperature))}</span>${(state.products.find((p) => p.id === l.product_id)?.temperatures.length || 0) > 1 ? `<button class="small-text-btn" data-cart-action="temperature" data-line="${e(l.id)}" aria-label="${e(name(l))} ${e(t('changeTemp'))}">${e(t('changeTemp'))} ${icon('refresh')}</button>` : ''}${l.available ? '' : `<span class="form-error">${e(t('unavailable'))}</span>`}</div>${(state.products.find((p) => p.id === l.product_id)?.addons?.length || 0) ? `<div class="cart-line-addons">${l.addons?.length ? `<span class="addon-pill">${e(addonText(l))} · +${e(money(l.addon_total))}</span>` : ''}<button class="small-text-btn" data-cart-action="addons" data-line="${e(l.id)}" aria-label="${e(name(l))} ${e(temperature(l.temperature))} ${e(t('editAddons'))}">${e(t('editAddons'))}</button></div>` : ''}<div class="cart-line-bottom"><div class="quantity-control"><button data-cart-action="minus" data-line="${e(l.id)}" aria-label="${e(name(l))} ${e(temperature(l.temperature))} ${e(t('less'))}">${icon('minus')}</button><span>${l.quantity}</span><button data-cart-action="plus" data-line="${e(l.id)}" aria-label="${e(name(l))} ${e(temperature(l.temperature))} ${e(t('more'))}">${icon('plus')}</button></div><strong>${e(money(l.subtotal))}</strong></div></article>`).join('') : `<div class="cart-empty">${icon('bag')}<b>${e(t('empty'))}</b></div>`;
    $('#cart-total').textContent = money(state.total);
    $('#review-order').disabled = !state.cart.length || busy || state.cart.some((l) => !l.available);
    $('#clear-cart').disabled = !state.cart.length || busy;
    if (focusKey) ($$('[data-cart-action]').find((b) => b.dataset.line === focusKey.id && b.dataset.cartAction === focusKey.action) || $('#cart-heading')).focus({ preventScroll: true });
  };
  const paintLanguage = () => {
    $$('[data-i18n]', main).forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$('[data-label]', main).forEach((el) => { el.setAttribute('aria-label', t(el.dataset.label)); });
    $('#order-text').placeholder = t('placeholder'); $('#language-select').value = prefs.language;
    document.documentElement.lang = prefs.language; document.title = `Open Kiosk — ${t('experience')}`;
    $('.skip-link').textContent = t('skip');
    $('#voice-order').innerHTML = `${icon('mic')}<span>${e(t(recording ? 'stopRecord' : 'voice'))}</span>`;
    $('#voice-order').setAttribute('aria-label', t(recording ? 'stopRecord' : 'voice'));
    $('#view-settings').setAttribute('aria-label', t('view'));
    $('.category-tabs').setAttribute('aria-label', t('menuTitle'));
    $$('[data-size]').forEach((button) => button.setAttribute('aria-label', `${t(button.dataset.size === 'text' ? 'textSize' : 'imageSize')} ${t(button.dataset.delta === '1' ? 'larger' : 'smaller')}`));
    paintMenu(); paintCart();
  };
  const preferences = () => {
    const page = $('.kiosk-app'); if (!page) return;
    page.style.setProperty('--text-scale', prefs.textScale); page.style.setProperty('--image-scale', prefs.imageScale);
    page.classList.toggle('contrast-mode', prefs.contrast); page.classList.toggle('spacious-menu', prefs.textScale > 1.3 || prefs.imageScale > 1.25);
    $$('[data-pref]').forEach((b) => b.setAttribute('aria-pressed', String(prefs[b.dataset.pref])));
    for (const [field, value] of [['text', prefs.textScale], ['image', prefs.imageScale]]) {
      $(`#${field}-scale-input`).value = value;
      $(`#${field}-scale-value`).textContent = `${Math.round(value * 100)}%`;
      $(`#${field}-scale-input`).setAttribute('aria-valuetext', `${Math.round(value * 100)}%`);
    }
    try { localStorage.setItem('ok_preferences', JSON.stringify(prefs)); } catch {}
    $$('.kiosk-modal').forEach(positionDialog);
  };
  const applyUI = (patch, announce = true) => {
    const previous = prefs; prefs = applyPresentation(prefs, patch); uiRevision++;
    if (previous.language !== prefs.language) paintLanguage();
    preferences();
    if (!announce) return;
    const changes = [];
    if (previous.language !== prefs.language) changes.push(t('languageChanged'));
    if (patch.reset) changes.push(t('sizesReset'));
    else {
      if (previous.textScale !== prefs.textScale || patch.text_delta || patch.text_size) changes.push(t('textChanged', { percent: Math.round(prefs.textScale * 100) }));
      if (previous.imageScale !== prefs.imageScale || patch.image_delta || patch.image_size) changes.push(t('imageChanged', { percent: Math.round(prefs.imageScale * 100) }));
    }
    if (changes.length) status(changes.join(' · '));
  };
  const acceptState = (next) => { const changed = JSON.stringify(state.products) !== JSON.stringify(next.products); state = next; if (changed) paintMenu(); paintCart(); };
  const setBusy = (value) => {
    busy = value; $('#send-order').disabled = value || !!recording || micPending; $('#voice-order').disabled = value || micPending;
    $('#composer').setAttribute('aria-busy', String(value));
    $('#send-order').innerHTML = value ? `<span class="button-spinner"></span><span class="sr-only">${e(t('busy'))}</span>` : icon('arrow'); paintCart();
  };
  const fail = async (err) => {
    if (!alive) return;
    if (err.status === 409) { try { acceptState(await api('/api/kiosk/state')); } catch {} }
    const key = err.status === 409 ? 'errorStale' : err.status === 429 ? 'errorLimit' : String(err.code || '').startsWith('ai_') ? 'errorAI' : 'errorGeneral';
    status(prefs.language === 'ko' ? err.message : t(key), true);
  };
  const change = async (operation) => {
    if (busy) return; setBusy(true);
    try { const next = await api('/api/kiosk/action', { method: 'POST', body: { revision: state.revision, operation } }); if (alive) { acceptState(next); status(t(state.cart.length ? 'cartChanged' : 'cartCleared')); } }
    catch (err) { await fail(err); } finally { if (alive) setBusy(false); }
  };
  const chooseAddons = (line) => {
    const product = state.products.find((p) => p.id === line.product_id);
    const d = modal(`<div class="modal-heading"><h2>${e(name(line))}</h2><p>${e(temperature(line.temperature))} · ${line.quantity}</p></div>${addonControls(product, line.addons)}<button id="save-addons" class="btn btn-dark full-width">${e(t('saveAddons'))}</button>`);
    $('#save-addons', d).onclick = () => { const addons = $$('input[name=addon]:checked', d).map((el) => el.value); d.close(); change({ type: 'addons', line_id: line.id, addons }); };
  };
  const chooseProduct = (product) => {
    let selected = product.temperatures.length === 1 ? product.temperatures[0] : null; let q = 1; let selectedAddons = [];
    const d = modal(`<div class="product-modal-art" style="--product-bg:${e(product.color)}" aria-hidden="true">${drinkArt(product)}</div><div class="product-modal-title"><h2>${e(name(product))}</h2><b>${e(money(product.price))}</b></div><fieldset class="temperature-options"><legend>${e(t('chooseTemp'))}</legend>${product.temperatures.map((v) => `<label><input type="radio" name="temperature" value="${v}" ${selected === v ? 'checked' : ''}><span>${v === 'hot' ? '☀' : '❄'} ${e(temperature(v))}</span></label>`).join('')}</fieldset>${addonControls(product)}<div class="product-quantity"><b>${e(t('quantity'))}</b><div class="quantity-control"><button id="quantity-minus" aria-label="${e(t('less'))}">${icon('minus')}</button><span id="quantity-value">1</span><button id="quantity-plus" aria-label="${e(t('more'))}">${icon('plus')}</button></div></div><button id="add-to-cart" class="btn btn-dark full-width" disabled></button>`, 'product-modal');
    const update = () => { $('#quantity-value', d).textContent = q; $('#quantity-minus', d).disabled = q === 1; $('#quantity-plus', d).disabled = q === 20; $('#add-to-cart', d).disabled = !selected; $('#add-to-cart', d).textContent = selected ? t('add', { count: q, price: money(q * (product.price + (product.addons || []).filter((a) => selectedAddons.includes(a.id)).reduce((n, a) => n + a.price, 0))) }) : t('chooseTemp'); };
    $$('input[name=temperature]', d).forEach((r) => r.onchange = () => { selected = r.value; update(); });
    $$('input[name=addon]', d).forEach((c) => c.onchange = () => { selectedAddons = $$('input[name=addon]:checked', d).map((el) => el.value); update(); });
    $('#quantity-minus', d).onclick = () => { q = Math.max(1, q - 1); update(); };
    $('#quantity-plus', d).onclick = () => { q = Math.min(20, q + 1); update(); };
    $('#add-to-cart', d).onclick = () => { d.close(); change({ type: 'add', product_id: product.id, quantity: q, temperature: selected, addons: selectedAddons }); }; update();
  };
  const reviewOrder = () => {
    if (!state.cart.length || busy) return;
    const review = structuredClone(state);
    const d = modal(`<div class="modal-heading"><h2>${e(t('confirmTitle'))}</h2></div><div class="review-lines">${review.cart.map((l) => `<div><span><b>${e(name(l))}</b><small>${e(temperature(l.temperature))} × ${l.quantity}${l.addons?.length ? `<br>${e(addonText(l))}` : ''}</small></span><strong>${e(money(l.subtotal))}</strong></div>`).join('')}</div><div class="review-total"><b>${e(t('total'))}</b><strong>${e(money(review.total))}</strong></div><p class="form-footnote">${e(t('demo'))}</p><p id="confirm-error" class="form-error" role="alert"></p><button id="confirm-order" class="btn btn-dark full-width">${e(t('confirm'))} ${icon('arrow')}</button><button id="return-to-order" class="btn btn-plain full-width">${e(t('back'))}</button>`);
    $('#return-to-order', d).onclick = () => d.close();
    $('#confirm-order', d).onclick = async () => {
      const btn = $('#confirm-order', d); btn.disabled = true;
      try {
        const result = await api('/api/kiosk/confirm', { method: 'POST', body: { revision: review.revision, total: review.total, confirmed: true } });
        if (!alive) { d.close(); return; }
        acceptState(await api('/api/kiosk/state')); d.close();
        const success = modal(`<div class="success-order"><span class="success-seal">${icon('check')}</span><h2>${e(t('doneTitle'))}</h2><span class="order-ticket"><small>${e(t('orderNumber'))}</small><strong>${String(result.order.number).padStart(3, '0')}</strong><span>${e(review.store.name)}</span></span><p class="form-footnote">${e(money(result.order.total))} · ${e(t('demo'))}</p><button class="btn btn-dark full-width" id="new-order">${e(t('newOrder'))} ${icon('arrow')}</button></div>`);
        $('#new-order', success).onclick = () => success.close(); status(t('orderReceived', { number: result.order.number }));
      } catch (err) {
        if (d.isConnected) { $('#confirm-error', d).textContent = prefs.language === 'ko' ? err.message : t('errorStale'); btn.disabled = false; }
        await fail(err); if (err.status === 409 && d.isConnected) { btn.disabled = true; $('#return-to-order', d).focus(); }
      }
    };
  };
  const submitText = async () => {
    const input = $('#order-text'); const text = input.value.trim(); if (!text || busy || recording || micPending) return;
    const display = parsePresentationCommand(text);
    if (display) { applyUI(display); input.value = ''; return; }
    const version = uiRevision; const language = prefs.language;
    setBusy(true); status(t('busy'));
    try {
      const next = await api('/api/kiosk/interpret', { method: 'POST', body: { text, language, revision: state.revision } });
      if (alive) {
        acceptState(next);
        if (uiRevision === version) applyUI(next.presentation || {}, false);
        status(language === prefs.language || next.presentation?.language === prefs.language ? next.reply : t('cartChanged'));
        input.value = ''; if (next.review) { setBusy(false); reviewOrder(); }
      }
    } catch (err) { await fail(err); } finally { if (alive) { setBusy(false); if (!$('dialog[open]')) input.focus({ preventScroll: true }); } }
  };
  const stopRecording = () => { if (recording?.recorder.state === 'recording') recording.recorder.stop(); };
  const recordingButton = () => { const b = $('#voice-order'); b.classList.remove('recording'); b.innerHTML = `${icon('mic')}<span>${e(t('voice'))}</span>`; b.setAttribute('aria-label', t('voice')); };
  const startRecording = async () => {
    if (micPending || recording) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder || !window.isSecureContext) return status(t('micUnavailable'), true);
    micPending = true; $('#voice-order').disabled = true;
    try {
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive) { stream.getTracks().forEach((v) => v.stop()); return; }
      const type = ['audio/webm', 'audio/mp4'].find((v) => MediaRecorder.isTypeSupported(v));
      if (!type) { stream.getTracks().forEach((v) => v.stop()); return status(t('micUnavailable'), true); }
      const recorder = new MediaRecorder(stream, { mimeType: type }); const chunks = []; const session = { recorder, stream, aborted: false }; recording = session;
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = async () => {
        clearTimeout(recordTimer); stream.getTracks().forEach((v) => v.stop()); recording = null;
        if (!alive || session.aborted) return;
        recordingButton(); setBusy(true); status(t('transcribing'));
        try {
          const result = await api('/api/kiosk/transcribe', { method: 'POST', body: new Blob(chunks, { type }), headers: { 'Content-Type': type, 'X-Audio-Consent': '1', 'X-Kiosk-Language': prefs.language } });
          if (alive) {
            const display = parsePresentationCommand(result.text);
            if (display) applyUI(display);
            else { $('#order-text').value = result.text; status(t('verifyTranscript')); $('#order-text').focus(); }
          }
        } catch (err) { await fail(err); } finally { if (alive) setBusy(false); }
      };
      recorder.onerror = () => { session.aborted = true; clearTimeout(recordTimer); stream.getTracks().forEach((v) => v.stop()); recording = null; if (alive) { recordingButton(); setBusy(false); status(t('micDenied'), true); } };
      recorder.start(); $('#send-order').disabled = true;
      $('#voice-order').classList.add('recording'); $('#voice-order').innerHTML = `<span class="record-dot"></span><span>${e(t('stopRecord'))}</span>`; $('#voice-order').setAttribute('aria-label', t('stopRecord'));
      $('#assistant-message').textContent = t('recording'); recordTimer = setTimeout(stopRecording, 20000);
    } catch { status(t('micDenied'), true); }
    finally { micPending = false; if (alive) { $('#voice-order').disabled = busy; $('#send-order').disabled = busy || !!recording; } }
  };
  const voice = () => {
    if (recording) return stopRecording(); if (busy) return; if (audioConsent) return startRecording();
    const d = modal(`<div class="modal-heading">${icon('mic')}<h2>${e(t('audioTitle'))}</h2><p>${e(t('audioNotice'))}</p></div><p class="form-footnote">${e(t('audioDuration'))}</p><button class="btn btn-dark full-width" id="agree-recording">${e(t('agreeRecord'))} ${icon('mic')}</button><button class="btn btn-plain full-width" id="use-keyboard">${e(t('keyboardInstead'))}</button>`);
    $('#agree-recording', d).onclick = () => { audioConsent = true; d.close(); startRecording(); };
    $('#use-keyboard', d).onclick = () => { d.close(); $('#order-text').focus(); };
  };

  try {
    state = await api('/api/kiosk/bootstrap', { method: 'POST', body: { store: new URLSearchParams(location.search).get('store') || 'demo' } });
    if (location.pathname !== '/kiosk') return;
    const sizeControl = (kind, min, max) => `<div class="size-control"><label for="${kind}-scale-input" data-i18n="${kind === 'text' ? 'textSize' : 'imageSize'}"></label><output id="${kind}-scale-value" for="${kind}-scale-input"></output><div><button data-size="${kind}" data-delta="-1" aria-label="${e(t(kind === 'text' ? 'textSize' : 'imageSize'))} ${e(t('smaller'))}">${icon('minus')}</button><input id="${kind}-scale-input" type="range" min="${min}" max="${max}" step=".05"><button data-size="${kind}" data-delta="1" aria-label="${e(t(kind === 'text' ? 'textSize' : 'imageSize'))} ${e(t('larger'))}">${icon('plus')}</button></div></div>`;
    main.innerHTML = `<section class="kiosk-experience"><header class="experience-bar"><a class="experience-back" href="/">${icon('arrow')}<span data-i18n="siteBack"></span></a><span class="experience-title" data-i18n="experience"></span><span class="experience-demo" data-i18n="demo"></span><a href="/privacy" target="_blank" rel="noopener" class="experience-data" data-i18n="dataNotice"></a></header><div class="device-shell"><span class="device-camera" aria-hidden="true"></span><div class="device-screen"><div class="kiosk-app"><header class="kiosk-header"><span class="kiosk-store-name">${e(state.store.name)}</span><div class="kiosk-tools"><label class="language-picker"><span class="sr-only" data-i18n="language"></span><select id="language-select">${languages.map((v) => `<option value="${v.id}">${v.label}</option>`).join('')}</select></label><button id="view-settings-toggle" aria-expanded="false" aria-controls="view-settings">${icon('type')}<span data-i18n="view"></span></button><button data-pref="read" aria-pressed="false">${icon('volume')}<span data-i18n="read"></span></button></div></header><section class="kiosk-view-settings" id="view-settings" hidden aria-label="${e(t('view'))}"><div class="view-settings-heading"><strong data-i18n="view"></strong><button class="icon-btn" id="close-settings" data-label="close">${icon('close')}</button></div>${sizeControl('text', .9, 1.6)}${sizeControl('image', .75, 1.5)}<div class="view-settings-bottom"><button id="reset-sizes" data-i18n="reset"></button><button data-pref="contrast" aria-pressed="false" data-i18n="contrast"></button></div></section><div class="kiosk-layout"><section class="kiosk-selection"><h1 class="kiosk-menu-title" data-i18n="menuTitle"></h1><div class="assistant-box" id="assistant-box"><span class="assistant-avatar" aria-hidden="true">✳</span><p id="assistant-message" aria-live="polite" aria-atomic="true"></p><button id="repeat-message" class="icon-btn" data-label="repeat">${icon('volume')}</button></div><div class="category-tabs" role="group" aria-label="${e(t('all'))}"><button class="active" data-category="all" aria-pressed="true" data-i18n="all"></button><button data-category="coffee" aria-pressed="false" data-i18n="coffee"></button><button data-category="tea" aria-pressed="false" data-i18n="tea"></button></div><div class="kiosk-menu" id="kiosk-menu"></div><form class="composer" id="composer"><div class="composer-input-row"><button type="button" class="voice-btn" id="voice-order" data-label="voice"></button><label class="sr-only" for="order-text" data-i18n="inputLabel"></label><input id="order-text" maxlength="500" autocomplete="off" enterkeyhint="send"><button type="submit" id="send-order" class="send-btn" data-label="send">${icon('arrow')}</button></div><p class="composer-note" data-i18n="aiNote"></p></form></section><aside class="cart-panel"><div class="cart-panel-head"><h2 id="cart-heading" tabindex="-1"><span data-i18n="cart"></span><span id="cart-count">0</span></h2><button id="clear-cart" class="small-text-btn" data-i18n="clear"></button></div><div class="cart-lines" id="cart-lines"></div><div class="cart-summary"><div><span data-i18n="total"></span><strong id="cart-total"></strong></div><button id="review-order" class="btn btn-dark full-width" disabled><span data-i18n="review"></span>${icon('arrow')}</button><button id="request-help" class="help-button">${icon('help')}<span data-i18n="help"></span></button></div></aside></div></div></div><span class="device-brand" aria-hidden="true">OPEN KIOSK</span></div></section>`;
    paintLanguage(); preferences(); status(lastReply);
    const toggleSettings = (open) => { $('#view-settings').hidden = !open; $('#view-settings-toggle').setAttribute('aria-expanded', String(open)); };
    $('#view-settings-toggle').onclick = () => toggleSettings($('#view-settings').hidden);
    $('#close-settings').onclick = () => { toggleSettings(false); $('#view-settings-toggle').focus(); };
    $('#reset-sizes').onclick = () => applyUI({ reset: true });
    $('#language-select').onchange = (event) => applyUI({ language: event.target.value });
    for (const kind of ['text', 'image']) $(`#${kind}-scale-input`).oninput = (event) => applyUI({ [`${kind}_size`]: Number(event.target.value) }, false);
    main.addEventListener('click', (event) => {
      const pref = event.target.closest('[data-pref]');
      if (pref) { prefs[pref.dataset.pref] = !prefs[pref.dataset.pref]; uiRevision++; preferences(); if (pref.dataset.pref === 'read') { if (prefs.read) speak(lastReply); else if ('speechSynthesis' in window) speechSynthesis.cancel(); } return; }
      const size = event.target.closest('[data-size]');
      if (size) return applyUI({ [`${size.dataset.size}_delta`]: Number(size.dataset.delta) });
      const cat = event.target.closest('[data-category]');
      if (cat) { category = cat.dataset.category; $$('[data-category]').forEach((b) => { b.classList.toggle('active', b === cat); b.setAttribute('aria-pressed', String(b === cat)); }); paintMenu(); return; }
      const product = event.target.closest('[data-product]'); if (product && !busy) return chooseProduct(state.products.find((v) => v.id === product.dataset.product));
      const button = event.target.closest('[data-cart-action]');
      if (button) {
        const line = state.cart.find((v) => v.id === button.dataset.line); if (!line) return;
        const a = button.dataset.cartAction;
        if (a === 'addons' && !busy) return chooseAddons(line);
        change(a === 'remove' ? { type: 'remove', line_id: line.id } : a === 'temperature' ? { type: 'temperature', line_id: line.id, temperature: line.temperature === 'hot' ? 'iced' : 'hot' } : { type: 'quantity', line_id: line.id, quantity: line.quantity + (a === 'plus' ? 1 : -1) });
      }
    }, { signal: controller.signal });
    main.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('#view-settings').hidden) { toggleSettings(false); $('#view-settings-toggle').focus(); } }, { signal: controller.signal });
    window.addEventListener('resize', () => $$('.kiosk-modal').forEach(positionDialog), { signal: controller.signal });
    $('#composer').onsubmit = (event) => { event.preventDefault(); submitText(); };
    $('#voice-order').onclick = voice; $('#repeat-message').onclick = () => speak(lastReply, true); $('#review-order').onclick = reviewOrder;
    $('#clear-cart').onclick = () => { if (!state.cart.length || busy) return; const d = modal(`<div class="modal-heading"><h2>${e(t('clearTitle'))}</h2></div><button class="btn btn-dark full-width" id="clear-confirm">${e(t('clearConfirm'))}</button>`); $('#clear-confirm', d).onclick = () => { d.close(); change({ type: 'clear' }); }; };
    $('#request-help').onclick = async (event) => { const button = event.currentTarget; button.disabled = true; try { await api('/api/kiosk/help', { method: 'POST', body: {} }); if (alive) status(t('helpDemo')); } catch (err) { await fail(err); } finally { if (alive) button.disabled = false; } };
  } catch (err) { main.innerHTML = errorPanel(err.message); }
  return () => { alive = false; controller.abort(); clearTimeout(recordTimer); if (recording) { recording.aborted = true; stopRecording(); recording.stream.getTracks().forEach((v) => v.stop()); } if ('speechSynthesis' in window) speechSynthesis.cancel(); $$('.kiosk-modal').forEach((d) => d.close()); };
}
