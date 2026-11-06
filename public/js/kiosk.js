import { $, $$, api, e, icon, drinkArt, dialog, errorPanel } from './ui.js';
import { languages, tr, productName, priceText, addonName, quantityText } from './locale.js';
import { parseMenuNavigation, isRecommendationRequest } from './menu-intent.js';
import { executeVoiceAudio } from './voice-flow.js';
import { normalizePreferences, applyPresentation, parsePresentationCommand } from './presentation.js';
import { openHandsFree } from './hands-free.js';
import { utteranceLanguage, conversationCommand, dialogCommand, recentTurns, canListen, dispatchDialogCommand, speechVoice } from './conversation.js';

export async function kioskPage(main) {
  let alive = true, busy = false, state, category = 'all', menuRevision = 0, micPending = false, uiRevision = 0;
  let handsFree, voicePaused = false, speaking = false, speechVersion = 0, speechTimer, speechStartTimer, speechUtterance, guidanceAbort, guidanceAudio, guidanceUrl, speechResumeTimer, speechDialog, resumeAfter = 0, turns = [], failures = 0, entryRead = true;
  const dialogActions = new WeakMap();
  const controller = new AbortController();
  const params = new URLSearchParams(location.search);
  const menuDemo = params.get('demo') === 'menu';
  const demoMode = ['voice', 'menu'].includes(params.get('demo')) && (!params.get('store') || params.get('store') === 'demo');
  const demoSamples = menuDemo ? [
    { url: '/media/menu-sample-01.mp3', label: '01  배고프면 브런치' },
    { url: '/media/menu-sample-02.mp3', label: '02  달달한 디저트' },
    { url: '/media/menu-sample-03.mp3', label: '03  예산에 맞는 추천' },
  ] : ['글자·그림 키우기', '아이스 두 잔 주문', '한 잔만 따뜻하게', '차가운 잔에 시럽'].map((label, i) => ({ url: `/media/voice-sample-0${i + 1}.mp3`, label: `0${i + 1}  ${label}` }));
  let voicePhase = 'idle', heardText = '', levelStop = () => {}, demoAudio, demoCancel = () => {}, demoIndex = 0, demoPlaying = false, demoRunning = false;
  let prefs = normalizePreferences();
  if (!demoMode) try { prefs = normalizePreferences(JSON.parse(localStorage.getItem('ok_preferences') || '{}')); } catch {}
  const t = (key, values) => tr(prefs.language, key, values);
  const name = (p) => productName(p, prefs.language);
  const money = (n) => priceText(n, prefs.language);
  const temperature = (n) => n === 'hot' ? t('hot') : n === 'iced' ? t('iced') : '';
  const countText = (n, product) => quantityText(n, product, prefs.language);
  let lastReply = t('initial');
  const cancelSpeech = () => { speechVersion++; clearTimeout(speechTimer); clearTimeout(speechStartTimer); clearTimeout(speechResumeTimer); speaking = false; speechUtterance = null; guidanceAbort?.abort(); guidanceAudio?.pause(); if (guidanceUrl) URL.revokeObjectURL(guidanceUrl); guidanceAbort = null; guidanceAudio = null; guidanceUrl = null; resumeAfter = Date.now() + 450; if ('speechSynthesis' in window) speechSynthesis.cancel(); speechResumeTimer = setTimeout(() => { if (alive) refreshHandsFree(); }, 450); };
  const nativeSpeak = (text, force = false) => {
    if ((!prefs.read && !force) || !('speechSynthesis' in window) || demoPlaying) return;
    cancelSpeech(); speaking = true; speechDialog = $('dialog[open]'); handsFree?.pause(); paintVoice('speaking');
    const version = speechVersion; const utterance = speechUtterance = new SpeechSynthesisUtterance(text);
    utterance.lang = languages.find((l) => l.id === prefs.language).speech; utterance.rate = .92;
    const voices = speechSynthesis.getVoices(); const voice = speechVoice(voices, prefs.language);
    const done = () => { if (version !== speechVersion) return; clearTimeout(speechTimer); clearTimeout(speechResumeTimer); speaking = false; speechUtterance = null; resumeAfter = Date.now() + 450; speechResumeTimer = setTimeout(() => { if (alive) refreshHandsFree(); }, 450); };
    utterance.onstart = () => { if (version === speechVersion) $('#voice-panel').dataset.guidanceResult = 'started'; };
    utterance.onend = () => { if (version === speechVersion) $('#voice-panel').dataset.guidanceResult = 'completed'; done(); };
    utterance.onerror = (event) => { if (version === speechVersion) { $('#voice-panel').dataset.guidanceResult = String(event.error || 'unavailable'); $('#speech-note').textContent = t('speechNotInstalled'); done(); } };
    if (voices.length && !voice) { $('#speech-note').textContent = t('speechNotInstalled'); done(); return; }
    if (voice) utterance.voice = voice;
    $('#voice-panel').dataset.guidanceLanguage = utterance.lang;
    $('#voice-panel').dataset.guidanceVoice = voice?.lang || utterance.lang;
    $('#voice-panel').dataset.guidanceVoiceName = voice?.name || '';
    $('#voice-panel').dataset.guidanceResult = 'speaking';
    $('#speech-note').textContent = '';
    speechTimer = setTimeout(() => { if (version === speechVersion) { utterance.onerror = null; speechSynthesis.cancel(); $('#voice-panel').dataset.guidanceResult = 'timeout'; $('#speech-note').textContent = t('speechNotInstalled'); done(); } }, 60000);
    // Chrome may cancel a new utterance when cancel() and speak() share a task.
    speechStartTimer = setTimeout(() => { if (alive && version === speechVersion) { speechSynthesis.resume(); speechSynthesis.speak(speechUtterance); } }, 80);
  };
  const speak = (text, force = false) => {
    if ((!prefs.read && !force) || demoPlaying) return;
    cancelSpeech(); speaking = true; speechDialog = $('dialog[open]'); handsFree?.pause(); paintVoice('speaking');
    const version = speechVersion, language = prefs.language; const abort = guidanceAbort = new AbortController();
    const panel = $('#voice-panel'); panel.dataset.guidanceLanguage = languages.find((l) => l.id === language).speech; panel.dataset.guidanceVoiceName = 'OpenAI alloy'; panel.dataset.guidanceResult = 'preparing'; $('#speech-note').textContent = '';
    const done = () => {
      if (version !== speechVersion) return;
      clearTimeout(speechTimer); speaking = false; guidanceAudio = null; guidanceAbort = null;
      if (guidanceUrl) URL.revokeObjectURL(guidanceUrl); guidanceUrl = null;
      resumeAfter = Date.now() + 450; clearTimeout(speechResumeTimer); speechResumeTimer = setTimeout(() => { if (alive) refreshHandsFree(); }, 450);
    };
    const fallback = () => { if (alive && version === speechVersion) { nativeSpeak(text, force); } };
    speechTimer = setTimeout(() => { if (version === speechVersion) { abort.abort(); fallback(); } }, 35000);
    fetch('/api/kiosk/speak', {method:'POST',headers:{'Content-Type':'application/json','X-Open-Kiosk':'1'},body:JSON.stringify({text:String(text).slice(0,1200),language}),signal:abort.signal})
      .then(async (response) => {
        if (!response.ok) throw new Error('speech_unavailable'); const blob = await response.blob();
        if (!alive || version !== speechVersion) return;
        guidanceUrl = URL.createObjectURL(blob); const audio = guidanceAudio = new Audio(guidanceUrl);
        audio.onplay = () => { if (version === speechVersion) panel.dataset.guidanceResult = 'started'; };
        audio.onended = () => { if (version === speechVersion) panel.dataset.guidanceResult = 'completed'; done(); };
        audio.onerror = fallback; await audio.play();
      }).catch(fallback);
  };
  const status = (text, error = false) => {
    lastReply = text;
    if (!alive || !$('#assistant-message')) return;
    $('#assistant-message').textContent = text;
    $('#assistant-box').classList.toggle('assistant-error', error);
    if (text !== t('busy')) speak(text);
  };
  const positionDialog = (d) => {
    const screen = $('.device-screen'); if (!screen) return;
    const r = screen.getBoundingClientRect();
    Object.assign(d.style, { left: `${r.left + r.width / 2}px`, top: `${r.top + r.height / 2}px`, margin: '0', transform: 'translate(-50%,-50%)', maxHeight: `${r.height - 28}px`, width: `${Math.min(d.classList.contains('entry-modal') ? 560 : 440, r.width - 28)}px` });
    d.style.setProperty('--text-scale', prefs.textScale);
    d.style.setProperty('--image-scale', prefs.imageScale);
  };
  const modal = (content, cls = '') => {
    const d = dialog(content, `kiosk-modal ${cls}`); d.lang = prefs.language;
    $('.modal-close', d).setAttribute('aria-label', t('close')); positionDialog(d);
    const heading = $('h2', d); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    d.addEventListener('close', () => { if (speechDialog === d) cancelSpeech(); refreshHandsFree(); if (alive && !demoMode && !$('dialog[open]')) $('#voice-order')?.focus({ preventScroll: true }); });
    handsFree?.pause(); return d;
  };
  const paintMenu = () => {
    $('.kiosk-menu-title').textContent = t(category === 'all' ? 'menuTitle' : category);
    $('#kiosk-menu').innerHTML = state.products.filter((p) => category === 'all' || p.category === category).map((p) => `<button class="product-card ${p.available ? '' : 'sold-out'}" data-product="${e(p.id)}" ${p.available ? '' : 'disabled'} aria-label="${e(name(p))}, ${e(money(p.price))}${p.available ? '' : ', ' + e(t('unavailable'))}"><span class="product-art" style="--product-bg:${e(p.color)}" aria-hidden="true">${drinkArt(p)}<span class="product-add">${icon('plus')}</span>${p.available ? '' : `<b class="sold-out-label">${e(t('unavailable'))}</b>`}</span><span class="product-name">${e(name(p))}</span><span class="product-price">${e(money(p.price))}</span></button>`).join('');
  };
  const navigateMenu = (next, announce = true) => {
    if (!['all', 'coffee', 'tea', 'dessert', 'brunch'].includes(next)) return;
    category = next; menuRevision++;
    $$('[data-category]').forEach((button) => { const selected = button.dataset.category === category; button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected)); });
    paintMenu(); $('#kiosk-menu').scrollTop = 0;
    if (announce) status(t('menuMoved', { category: t(category) }));
  };
  const addonText = (line) => (line.addons || []).map((id) => addonName(id, prefs.language)).join(' · ');
  const addonControls = (product, selected = []) => (product.addons || []).length ? `<fieldset class="addon-options"><legend>${e(t('addons'))}</legend>${product.addons.map((a) => `<label><input type="checkbox" name="addon" value="${e(a.id)}" ${selected.includes(a.id) ? 'checked' : ''}><span>${e(addonName(a.id, prefs.language))}<small>+${e(money(a.price))} ${e(t('perCup'))}</small></span></label>`).join('')}</fieldset>` : '';
  const paintCart = () => {
    const focused = document.activeElement?.closest('[data-cart-action]');
    const focusKey = focused ? { id: focused.dataset.line, action: focused.dataset.cartAction } : null;
    $('#cart-count').textContent = state.count;
    $('#cart-lines').innerHTML = state.cart.length ? state.cart.map((l) => `<article class="cart-line"><div class="cart-line-head"><h3>${e(name(l))}</h3><button class="icon-btn" data-cart-action="remove" data-line="${e(l.id)}" aria-label="${e(name(l))} ${e(temperature(l.temperature))} ${e(t('remove'))}">${icon('close')}</button></div><div class="cart-line-options">${l.temperature ? `<span class="temp-pill ${l.temperature}">${e(temperature(l.temperature))}</span>` : ''}${(state.products.find((p) => p.id === l.product_id)?.temperatures.length || 0) > 1 ? `<button class="small-text-btn" data-cart-action="temperature" data-line="${e(l.id)}" aria-label="${e(name(l))} ${e(t('changeTemp'))}">${e(t('changeTemp'))} ${icon('refresh')}</button>` : ''}${l.available ? '' : `<span class="form-error">${e(t('unavailable'))}</span>`}</div>${(state.products.find((p) => p.id === l.product_id)?.addons?.length || 0) ? `<div class="cart-line-addons">${l.addons?.length ? `<span class="addon-pill">${e(addonText(l))} · +${e(money(l.addon_total))}</span>` : ''}<button class="small-text-btn" data-cart-action="addons" data-line="${e(l.id)}" aria-label="${e(name(l))} ${e(temperature(l.temperature))} ${e(t('editAddons'))}">${e(t('editAddons'))}</button></div>` : ''}<div class="cart-line-bottom"><div class="quantity-control"><button data-cart-action="minus" data-line="${e(l.id)}" aria-label="${e(name(l))} ${e(temperature(l.temperature))} ${e(t('less'))}">${icon('minus')}</button><span>${l.quantity}</span><button data-cart-action="plus" data-line="${e(l.id)}" aria-label="${e(name(l))} ${e(temperature(l.temperature))} ${e(t('more'))}">${icon('plus')}</button></div><strong>${e(money(l.subtotal))}</strong></div></article>`).join('') : `<div class="cart-empty">${icon('bag')}<b>${e(t('empty'))}</b></div>`;
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
    paintVoice();
    $('#view-settings').setAttribute('aria-label', t('view'));
    $('#kiosk-menu').setAttribute('aria-label', t('menuTitle'));
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
    if (!demoMode) try { localStorage.setItem('ok_preferences', JSON.stringify(prefs)); } catch {}
    $$('.kiosk-modal').forEach(positionDialog);
  };
  const applyUI = (patch, announce = true) => {
    const previous = prefs; prefs = applyPresentation(prefs, patch); uiRevision++;
    if (previous.language !== prefs.language) { cancelSpeech(); paintLanguage(); }
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
    busy = value; $('#send-order').disabled = value || micPending; $('#voice-order').disabled = (!handsFree && value) || micPending || demoRunning;
    $('#order-text').disabled = value || micPending;
    if ($('#demo-voice-next')) $('#demo-voice-next').disabled = value || micPending || demoRunning || demoIndex >= demoSamples.length;
    if ($('#demo-run-all')) $('#demo-run-all').disabled = value || micPending || demoRunning;
    $('#composer').setAttribute('aria-busy', String(value));
    $('#send-order').innerHTML = value ? `<span class="button-spinner"></span><span class="sr-only">${e(t('busy'))}</span>` : icon('arrow'); paintCart(); refreshHandsFree();
  };
  const fail = async (err) => {
    if (!alive) return;
    if (err.status === 409) { try { acceptState(await api('/api/kiosk/state')); } catch {} }
    const key = err.status === 409 ? 'errorStale' : err.status === 429 ? 'errorLimit' : String(err.code || '').startsWith('ai_') ? 'errorAI' : 'errorGeneral';
    status(prefs.language === 'ko' ? err.message : t(key), true);
  };
  const change = async (operation) => {
    if (busy) return; turns = []; setBusy(true);
    try { const next = await api('/api/kiosk/action', { method: 'POST', body: { revision: state.revision, operation } }); if (alive) { acceptState(next); status(t(state.cart.length ? 'cartChanged' : 'cartCleared')); } }
    catch (err) { await fail(err); } finally { if (alive) setBusy(false); }
  };
  const chooseAddons = (line) => {
    const product = state.products.find((p) => p.id === line.product_id);
    const d = modal(`<div class="modal-heading"><h2>${e(name(line))}</h2><p>${e(temperature(line.temperature))} · ${line.quantity}</p></div>${addonControls(product, line.addons)}<button id="save-addons" class="btn btn-dark full-width">${e(t('saveAddons'))}</button>`);
    $('#save-addons', d).onclick = () => { const addons = $$('input[name=addon]:checked', d).map((el) => el.value); d.close(); change({ type: 'addons', line_id: line.id, addons }); };
    dialogActions.set(d, { addon: (id, enabled) => { const checkbox = $(`input[name=addon][value="${id}"]`, d); if (checkbox) checkbox.checked = enabled; status(t('saveAddons')); }, accept: () => $('#save-addons', d).click(), free: true }); status(`${name(line)}. ${t('addons')}. ${t('addHint')}`); refreshHandsFree();
  };
  const chooseProduct = (product) => {
    turns = [];
    const needsTemp = product.temperatures.length > 0;
    let selected = product.temperatures.length === 1 ? product.temperatures[0] : null; let q = 1; let selectedAddons = [];
    const d = modal(`<div class="product-modal-art" style="--product-bg:${e(product.color)}" aria-hidden="true">${drinkArt(product)}</div><div class="product-modal-title"><h2>${e(name(product))}</h2><b>${e(money(product.price))}</b></div>${needsTemp ? `<fieldset class="temperature-options"><legend>${e(t('chooseTemp'))}</legend>${product.temperatures.map((v) => `<label><input type="radio" name="temperature" value="${v}" ${selected === v ? 'checked' : ''}><span>${v === 'hot' ? '☀' : '❄'} ${e(temperature(v))}</span></label>`).join('')}</fieldset>` : ''}${addonControls(product)}<div class="product-quantity"><b>${e(t('quantity'))}</b><div class="quantity-control"><button id="quantity-minus" aria-label="${e(t('less'))}">${icon('minus')}</button><span id="quantity-value">1</span><button id="quantity-plus" aria-label="${e(t('more'))}">${icon('plus')}</button></div></div><button id="add-to-cart" class="btn btn-dark full-width" disabled></button>`, 'product-modal');
    const update = () => { $('#quantity-value', d).textContent = q; $('#quantity-minus', d).disabled = q === 1; $('#quantity-plus', d).disabled = q === 20; $('#add-to-cart', d).disabled = needsTemp && !selected; $('#add-to-cart', d).textContent = !needsTemp || selected ? t('add', { quantity: countText(q, product), price: money(q * (product.price + (product.addons || []).filter((a) => selectedAddons.includes(a.id)).reduce((n, a) => n + a.price, 0))) }) : t('chooseTemp'); };
    $$('input[name=temperature]', d).forEach((r) => r.onchange = () => { selected = r.value; update(); });
    $$('input[name=addon]', d).forEach((c) => c.onchange = () => { selectedAddons = $$('input[name=addon]:checked', d).map((el) => el.value); update(); });
    $('#quantity-minus', d).onclick = () => { q = Math.max(1, q - 1); update(); };
    $('#quantity-plus', d).onclick = () => { q = Math.min(20, q + 1); update(); };
    $('#add-to-cart', d).onclick = () => { d.close(); change({ type: 'add', product_id: product.id, quantity: q, temperature: selected, addons: selectedAddons }); }; update();
    dialogActions.set(d, { quantity: (value) => { q = value; update(); status(`${countText(q, product)}. ${needsTemp && !selected ? t('tempHint') : t('addHint')}`); }, addon: (id, enabled) => { const checkbox = $(`input[name=addon][value="${id}"]`, d); if (!checkbox) return status(t('unavailable')); checkbox.checked = enabled; selectedAddons = $$('input[name=addon]:checked', d).map((input) => input.value); update(); status(`${addonName(id, prefs.language)}. ${t('addHint')}`); }, accept: () => { if ($('#add-to-cart', d).disabled) status(t('tempHint')); else $('#add-to-cart', d).click(); }, temperature: (value, add) => { const radio = $(`input[name=temperature][value="${value}"]`, d); if (!radio) return status(t('chooseTemp')); radio.checked = true; selected = value; update(); if (add) $('#add-to-cart', d).click(); else status(`${temperature(value)}. ${t('addHint')}`); } });
    status(`${name(product)}. ${money(product.price)}. ${needsTemp && !selected ? t('tempHint') : t('addHint')}`); refreshHandsFree();
  };
  const addRecommendation = (suggestion) => {
    const products = suggestion.product_ids.map((id) => state.products.find((p) => p.id === id));
    if (products.some((p) => !p?.available)) return status(t('unavailable'), true);
    const d = modal(`<div class="modal-heading"><h2>${e(t('comboOptions'))}</h2></div><div class="bundle-items">${products.map((p) => `<article><div><b>${e(name(p))}</b><span>${e(countText(1, p))} · ${e(money(p.price))}</span></div>${p.temperatures.length > 1 ? `<fieldset class="temperature-options"><legend>${e(name(p))} · ${e(t('chooseTemp'))}</legend>${p.temperatures.map((temp) => `<label><input type="radio" name="bundle-${e(p.id)}" value="${temp}"><span>${e(temperature(temp))}</span></label>`).join('')}</fieldset>` : p.temperatures.length ? `<small>${e(temperature(p.temperatures[0]))}</small>` : ''}</article>`).join('')}</div><button id="add-recommendation" class="btn btn-dark full-width">${e(t('addCombo', { price: money(products.reduce((sum, p) => sum + p.price, 0)) }))}</button>`);
    const selectedTemperature = (p) => p.temperatures.length > 1 ? $(`input[name="bundle-${p.id}"]:checked`, d)?.value : p.temperatures[0] || null;
    const update = () => { $('#add-recommendation', d).disabled = products.some((p) => p.temperatures.length > 1 && !selectedTemperature(p)); };
    $$('input', d).forEach((input) => input.onchange = update); update();
    $('#add-recommendation', d).onclick = async () => {
      const operations = products.map((p) => ({ type: 'add', product_id: p.id, quantity: 1, temperature: selectedTemperature(p) }));
      d.close(); turns = []; setBusy(true);
      try { const next = await api('/api/kiosk/action', { method: 'POST', body: { revision: state.revision, operations } }); if (alive) { acceptState(next); status(t('cartChanged')); } }
      catch (err) { await fail(err); } finally { if (alive) setBusy(false); }
    };
    dialogActions.set(d, { accept: () => { if ($('#add-recommendation', d).disabled) status(t('tempHint')); else $('#add-recommendation', d).click(); }, temperature: (value, add) => { for (const radio of $$(`input[type=radio][value="${value}"]`, d)) radio.checked = true; update(); if (add && !$('#add-recommendation', d).disabled) $('#add-recommendation', d).click(); else status(`${temperature(value)}. ${t('addHint')}`); } });
    status(products.map((p) => `${name(p)} ${countText(1, p)}`).join(', ') + '. ' + (products.some((p) => p.temperatures.length > 1) ? t('tempHint') : t('addHint'))); refreshHandsFree();
  };
  const showRecommendations = (suggestions) => {
    const d = modal(`<div class="modal-heading"><h2>${e(t('recommendResults'))}</h2><p>${e(t('recommendBasis'))}</p></div><div class="recommendation-list">${suggestions.map((suggestion, i) => `<article><h3>${e(suggestion.title)}</h3><p>${e(suggestion.reason)}</p><div class="recommended-items">${suggestion.product_ids.map((id) => { const p = state.products.find((p) => p.id === id); return `<div><span class="recommend-art" style="--product-bg:${e(p.color)}" aria-hidden="true">${drinkArt(p)}</span><span><b>${e(name(p))}</b><small>${e(countText(1, p))} · ${e(money(p.price))}</small></span></div>`; }).join('')}</div><div class="recommendation-total"><strong>${e(money(suggestion.total))}</strong><button class="btn btn-outline" data-recommendation="${i}">${e(t('chooseCombo'))}</button></div></article>`).join('')}</div>`, 'recommendations-modal');
    $$('[data-recommendation]', d).forEach((button) => button.onclick = () => { d.close(); addRecommendation(suggestions[Number(button.dataset.recommendation)]); });
    dialogActions.set(d, { choice: (index) => { const button = $(`[data-recommendation="${index}"]`, d); if (button) button.click(); else status(t('choiceHint')); } });
    status(suggestions.map((s, i) => `${i + 1}. ${s.title}. ${money(s.total)}.`).join(' ') + ' ' + t('choiceHint')); refreshHandsFree();
  };
  const sendRecommendation = async (text) => {
    if (!text.trim() || busy) return; setBusy(true);
    try { await interpretRequest(text); } catch (err) { await fail(err); } finally { if (alive) setBusy(false); }
  };
  const openRecommendationPrompt = () => {
    if (busy) return;
    const d = modal(`<div class="modal-heading"><h2>${e(t('recommendTitle'))}</h2></div><div class="recommendation-choices">${[['recommendMeal', 'promptMeal'], ['recommendSweet', 'promptSweet'], ['recommendBudget', 'promptBudget']].map(([label, prompt]) => `<button class="btn btn-outline" data-recommend-prompt="${prompt}">${e(t(label))}</button>`).join('')}</div><form id="recommendation-form"><label class="form-label" for="recommendation-text">${e(t('recommendInput'))}</label><input class="form-input" id="recommendation-text" maxlength="400" placeholder="${e(t('recommendPlaceholder'))}"><button class="btn btn-dark full-width" type="submit">${e(t('recommendSubmit'))}</button></form>`);
    $$('[data-recommend-prompt]', d).forEach((button) => button.onclick = () => { d.close(); sendRecommendation(t(button.dataset.recommendPrompt)); });
    $('#recommendation-form', d).onsubmit = (event) => { event.preventDefault(); const text = $('#recommendation-text', d).value.trim(); if (!text) return; d.close(); sendRecommendation(text); };
    dialogActions.set(d, { free: true }); status(t('recommendTitle')); refreshHandsFree();
  };
  const reviewOrder = () => {
    if (!state.cart.length || busy) return;
    const review = structuredClone(state);
    const d = modal(`<div class="modal-heading"><h2>${e(t('confirmTitle'))}</h2></div><div class="review-lines">${review.cart.map((l) => `<div><span><b>${e(name(l))}</b><small>${l.temperature ? e(temperature(l.temperature)) + ' · ' : ''}${e(countText(l.quantity, l))}${l.addons?.length ? `<br>${e(addonText(l))}` : ''}</small></span><strong>${e(money(l.subtotal))}</strong></div>`).join('')}</div><div class="review-total"><b>${e(t('total'))}</b><strong>${e(money(review.total))}</strong></div><p class="form-footnote">${e(t('demo'))}</p><p id="confirm-error" class="form-error" role="alert"></p><button id="confirm-order" class="btn btn-dark full-width">${e(t('confirm'))} ${icon('arrow')}</button><button id="return-to-order" class="btn btn-plain full-width">${e(t('back'))}</button>`);
    $('#return-to-order', d).onclick = () => d.close();
    $('#confirm-order', d).onclick = async () => {
      const btn = $('#confirm-order', d); btn.disabled = true;
      try {
        const result = await api('/api/kiosk/confirm', { method: 'POST', body: { revision: review.revision, total: review.total, confirmed: true } });
        if (!alive) { d.close(); return; }
        acceptState(await api('/api/kiosk/state')); d.close();
        const success = modal(`<div class="success-order"><span class="success-seal">${icon('check')}</span><h2>${e(t('doneTitle'))}</h2><span class="order-ticket"><small>${e(t('orderNumber'))}</small><strong>${String(result.order.number).padStart(3, '0')}</strong><span>${e(review.store.name)}</span></span><p class="form-footnote">${e(money(result.order.total))} · ${e(t('demo'))}</p><button class="btn btn-dark full-width" id="new-order">${e(t('newOrder'))} ${icon('arrow')}</button></div>`);
        turns = []; voicePaused = true; handsFree?.stop(); handsFree = null;
        $('#new-order', success).onclick = () => { success.close(); openEntry(); }; status(t('orderReceived', { number: result.order.number }));
      } catch (err) {
        if (d.isConnected) { $('#confirm-error', d).textContent = prefs.language === 'ko' ? err.message : t('errorStale'); btn.disabled = false; }
        await fail(err); if (err.status === 409 && d.isConnected) { btn.disabled = true; $('#return-to-order', d).focus(); }
      }
    };
    dialogActions.set(d, { review: true, needsConfirmation: () => status(t('confirmHint')), accept: () => { if (!$('#confirm-order', d).disabled) $('#confirm-order', d).click(); } });
    status(orderDescription(review) + '. ' + t('confirmHint')); refreshHandsFree();
  };
  const interpretRequest = async (text) => {
    const detected = utteranceLanguage(text, prefs.language);
    if (detected !== prefs.language) applyUI({ language: detected }, false);
    const control = conversationCommand(text);
    if (control?.type === 'pause') { voicePaused = true; refreshHandsFree(); status(t('voicePaused')); return; }
    if (control?.type === 'read_on' || control?.type === 'read_off') { prefs.read = control.type === 'read_on'; preferences(); if (prefs.read) speak(lastReply, true); else { cancelSpeech(); refreshHandsFree(); } return; }
    if (control?.type === 'help') { if (!$('#request-help').disabled) $('#request-help').click(); return; }
    if (control?.type === 'repeat') { speak(lastReply, true); return; }
    if (control?.type === 'menu') { status(state.products.filter((p) => p.available && (category === 'all' || p.category === category)).map((p) => `${name(p)} ${money(p.price)}`).join('. ') + '. ' + t('menuReadHint')); return; }
    if (control?.type === 'cart') { status(orderDescription(state)); return; }
    const open = $('dialog[open]');
    if (open) {
      const command = dialogCommand(text), actions = dialogActions.get(open);
      if (command?.type === 'cancel') { open.close(); status(t('back')); return; }
      if (dispatchDialogCommand(text, actions)) return;
      if (actions) open.close();
      else return;
    }
    const display = parsePresentationCommand(text, prefs);
    if (display) { applyUI(display); return; }
    const navigation = parseMenuNavigation(text);
    if (navigation) { navigateMenu(navigation); return; }
    const version = uiRevision; const menuVersion = menuRevision; const language = prefs.language;
    status(t('busy'));
    const next = await api('/api/kiosk/interpret', { method: 'POST', body: { text, language, context: recentTurns(turns), revision: state.revision }, signal: controller.signal });
    if (!alive) return;
    turns = recentTurns([...turns, { role: 'user', text }, { role: 'assistant', text: next.reply }]);
    acceptState(next);
    if (next.navigation && menuRevision === menuVersion) navigateMenu(next.navigation, false);
    if (uiRevision === version) applyUI(next.presentation || {}, false);
    status(language === prefs.language || next.presentation?.language === prefs.language ? next.reply : t('cartChanged'));
    if (next.recommendations?.length) { setBusy(false); showRecommendations(next.recommendations); }
    else if (isRecommendationRequest(text) && !/알레르|알러지|allerg|アレルギ|过敏|당뇨|diabet/i.test(text)) status(t('noRecommendations'));
    else if (next.review) { setBusy(false); reviewOrder(); }
  };
  const submitText = async () => {
    const input = $('#order-text'); const text = input.value.trim(); if (!text || busy || micPending) return;
    setBusy(true);
    try { await interpretRequest(text); if (alive) input.value = ''; }
    catch (err) { await fail(err); }
    finally { if (alive) { setBusy(false); if (!$('dialog[open]')) input.focus({ preventScroll: true }); } }
  };
  const paintVoice = (phase = voicePhase) => {
    voicePhase = phase; const panel = $('#voice-panel'); if (!alive || !panel) return;
    panel.dataset.phase = phase;
    const keys = { idle: 'voiceHint', waiting: 'autoListening', paused: 'voicePaused', speaking: 'speaking', listening: 'voiceListening', sample: 'demoVoice', transcribing: 'transcribing', applying: 'voiceApplying', done: 'voiceDone', error: 'voiceError' };
    $('#voice-state').textContent = t(keys[phase] || 'voiceHint');
    $('#voice-heard').textContent = heardText; $('#voice-caption').hidden = !heardText;
    const b = $('#voice-order'); b.classList.toggle('recording', phase === 'listening');
    const label = handsFree ? voicePaused ? 'resumeVoice' : 'pauseVoice' : phase === 'listening' ? 'stopRecord' : 'voice';
    b.innerHTML = `${phase === 'listening' ? '<span class="voice-stop-square"></span>' : icon('mic')}<span>${e(t(label))}</span>`;
    b.setAttribute('aria-label', t(label)); b.setAttribute('aria-pressed', String(!!handsFree && !voicePaused));
  };
  const watchLevels = (input) => {
    levelStop();
    let context, source, frame; const bars = $$('.voice-wave i');
    try {
      const Context = window.AudioContext || window.webkitAudioContext; context = new Context();
      const analyser = context.createAnalyser(); analyser.fftSize = 256;
      source = input instanceof HTMLMediaElement ? context.createMediaElementSource(input) : context.createMediaStreamSource(input);
      source.connect(analyser); if (input instanceof HTMLMediaElement) analyser.connect(context.destination);
      context.resume().catch(() => {});
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!alive) return;
        analyser.getByteFrequencyData(data);
        bars.forEach((bar, i) => bar.style.setProperty('--level', Math.max(.12, data[3 + i * 3] / 180)));
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    } catch { /* Demo audio still plays without a level meter. */ }
    levelStop = () => { cancelAnimationFrame(frame); source?.disconnect(); if (context && context.state !== 'closed') context.close().catch(() => {}); bars.forEach((bar) => bar.style.setProperty('--level', .12)); };
  };
  const processAudio = async (audio) => {
    setBusy(true);
    try {
      await executeVoiceAudio(audio, {
        transcribe: (body) => api('/api/kiosk/transcribe', { method: 'POST', body, headers: { 'Content-Type': body.type, 'X-Audio-Consent': '1', 'X-Kiosk-Language': prefs.language }, signal: controller.signal }),
        execute: interpretRequest,
        onPhase: paintVoice,
        onTranscript: (text) => { heardText = text; },
        isActive: () => alive,
      });
      failures = 0; return true;
    } catch (err) { if (alive) { failures++; if (handsFree && (failures >= 3 || [401, 429, 503].includes(err.status))) voicePaused = true; await fail(err); } return false; }
    finally { if (alive) setBusy(false); }
  };
  const voice = () => {
    if (handsFree) { voicePaused = !voicePaused; cancelSpeech(); refreshHandsFree(); if (voicePaused) status(t('voicePaused')); return; }
    if (busy) return; openEntry();
  };
  const orderDescription = (order) => order.cart.length ? order.cart.map((line) => `${name(line)} ${temperature(line.temperature)} ${countText(line.quantity, line)}${line.addons?.length ? ', ' + addonText(line) : ''}`).join('. ') + `. ${t('total')} ${money(order.total)}` : t('empty');
  const refreshHandsFree = () => {
    if (!alive) return;
    if (!handsFree) { if (!demoMode && !busy && !speaking) paintVoice('idle'); return; }
    const open = $('dialog[open]');
    if (voicePaused || document.hidden || !handsFree.isActive()) { handsFree.pause(); paintVoice('paused'); }
    else if (!canListen({ busy: busy || micPending, speaking, dialogAllowed: !open || dialogActions.has(open), resumeAfter })) { handsFree.pause(); if (speaking) paintVoice('speaking'); }
    else { handsFree.resume(); paintVoice('waiting'); }
  };
  const openEntry = () => {
    if (!alive || demoMode || $('dialog[open]')) return;
    cancelSpeech(); handsFree?.stop(); handsFree = null; voicePaused = false;
    const d = modal(`<div class="entry-content"><div class="entry-icon" aria-hidden="true">${icon('mic')}${icon('grid')}</div><div class="modal-heading"><h2>${e(t('entryTitle'))}</h2><p>${e(t('entryHint'))}</p></div><div class="entry-languages" role="group" aria-label="${e(t('language'))}">${languages.map((language) => `<button type="button" lang="${language.id}" data-entry-language="${language.id}" aria-pressed="${language.id === prefs.language}"><span aria-hidden="true">${language.flag}</span> ${language.label}</button>`).join('')}</div><label class="entry-read"><input type="checkbox" id="entry-read" ${entryRead ? 'checked' : ''}><span>${e(t('entryRead'))}</span></label><p class="entry-reader-hint">${e(t('entryReadHint'))}</p><p class="entry-notice">${e(t('entryAudioNotice'))}</p><p id="entry-error" class="form-error" role="alert"></p></div><div class="entry-actions"><button id="entry-voice" class="btn btn-dark full-width">${e(t('startTogether'))}</button><button id="entry-touch" class="btn btn-plain full-width">${e(t('startTouch'))}</button></div><p class="entry-shortcuts sr-only">${e(t('keyboardHelp'))}</p>`, 'entry-modal');
    // This essential preparation dialog stays open until an explicit start choice.
    $('.modal-close', d).hidden = true;
    d.addEventListener('cancel', (event) => event.preventDefault());
    $$('[data-entry-language]', d).forEach((button) => button.onclick = () => { entryRead = $('#entry-read', d).checked; applyUI({ language: button.dataset.entryLanguage }, false); d.close(); openEntry(); });
    $('#entry-touch', d).onclick = () => { prefs.read = $('#entry-read', d).checked; preferences(); d.close(); status(t('initial')); };
    $('#entry-voice', d).onclick = async () => {
      if (micPending) return;
      prefs.read = $('#entry-read', d).checked; preferences(); micPending = true;
      $('#entry-voice', d).disabled = true; $('#entry-voice', d).textContent = t('preparingMic'); $('#entry-error', d).textContent = '';
      try {
        const opened = await openHandsFree({
          onStart: () => { if (alive) { heardText = ''; paintVoice('listening'); } },
          onIdle: () => { if (alive) refreshHandsFree(); },
          onAudio: (audio) => { if (alive && !voicePaused && !busy && !document.hidden) processAudio(audio); },
          onLevel: (level) => { if (alive) $$('.voice-wave i').forEach((bar, i) => bar.style.setProperty('--level', Math.max(.12, level * (i % 3 === 1 ? .7 : 1)))); },
          onError: () => { if (alive) { voicePaused = true; handsFree?.stop(); handsFree = null; status(t('micLost'), true); paintVoice('error'); } },
        });
        if (!alive || !d.isConnected) { opened.stop(); return; }
        handsFree = opened; voicePaused = false; failures = 0; micPending = false; d.close();
        status(t('voiceIntro')); refreshHandsFree();
      } catch { if (alive && d.isConnected) { $('#entry-error', d).textContent = t('micFailed'); $('#entry-voice', d).disabled = false; $('#entry-voice', d).textContent = t('startTogether'); $('#entry-touch', d).focus(); } }
      finally { micPending = false; if (alive) { $('#voice-order').disabled = busy && !handsFree; refreshHandsFree(); } }
    };
  };
  const playDemoVoice = async () => {
    if (busy || demoIndex >= demoSamples.length) return;
    $('#voice-panel').dataset.demoStep = String(demoIndex + 1);
    const url = demoSamples[demoIndex].url; heardText = ''; demoPlaying = true; setBusy(true); paintVoice('sample');
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    demoAudio = new Audio(url); watchLevels(demoAudio);
    const finished = new Promise((resolve, reject) => { demoAudio.onended = () => resolve(true); demoAudio.onerror = () => reject(new Error(t('micUnavailable'))); demoCancel = () => { demoAudio?.pause(); resolve(false); }; });
    try {
      const bytes = fetch(url, { signal: controller.signal }).then((r) => { if (!r.ok) throw new Error(t('micUnavailable')); return r.blob(); });
      await demoAudio.play();
      const [completed, audio] = await Promise.all([finished, bytes]);
      levelStop(); demoPlaying = false;
      if (!alive || !completed) return;
      if (await processAudio(audio)) demoIndex++;
    } catch (err) { demoAudio?.pause(); levelStop(); demoPlaying = false; if (alive) { paintVoice('error'); await fail(err); } }
    finally {
      demoAudio = null;
      if (alive) { setBusy(false); $('#demo-voice-next').textContent = demoSamples[demoIndex]?.label || '시연 완료'; }
    }
  };

  const runDemoSequence = async () => {
    if (!demoMode || busy || demoRunning) return;
    const wrapper = $('.voice-demo-mode'); demoRunning = true; wrapper.dataset.running = 'true';
    try {
      demoIndex = 0; heardText = ''; category = 'all';
      $$('[data-category]').forEach((button) => { const selected = button.dataset.category === 'all'; button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected)); }); paintMenu();
      applyUI({ reset: true, language: 'ko' }); paintVoice('idle');
      await change({ type: 'clear' });
      if (!alive || state.count !== 0) return;
      for (let step = 0; step < 4 && alive; step++) {
        const before = demoIndex; await playDemoVoice();
        if (!alive || demoIndex === before) return;
        await new Promise((resolve) => setTimeout(resolve, step === 3 ? 1700 : 1200));
      }
      if (alive && demoIndex === 4) { demoRunning = false; setBusy(false); reviewOrder(); }
    } finally {
      demoRunning = false;
      if (alive) { wrapper.dataset.running = 'false'; setBusy(false); }
    }
  };

  try {
    state = await api('/api/kiosk/bootstrap', { method: 'POST', body: { store: new URLSearchParams(location.search).get('store') || 'demo' } });
    if (location.pathname !== '/kiosk') return;
    const sizeControl = (kind, min, max) => `<div class="size-control"><label for="${kind}-scale-input" data-i18n="${kind === 'text' ? 'textSize' : 'imageSize'}"></label><output id="${kind}-scale-value" for="${kind}-scale-input"></output><div><button data-size="${kind}" data-delta="-1" aria-label="${e(t(kind === 'text' ? 'textSize' : 'imageSize'))} ${e(t('smaller'))}">${icon('minus')}</button><input id="${kind}-scale-input" type="range" min="${min}" max="${max}" step=".05"><button data-size="${kind}" data-delta="1" aria-label="${e(t(kind === 'text' ? 'textSize' : 'imageSize'))} ${e(t('larger'))}">${icon('plus')}</button></div></div>`;
    main.innerHTML = `<section class="kiosk-experience${demoMode ? ' voice-demo-mode' : ''}"><header class="experience-bar"><a class="experience-back" href="/">${icon('arrow')}<span data-i18n="siteBack"></span></a><span class="experience-title" data-i18n="experience"></span><span class="experience-demo" data-i18n="demo"></span><a href="/privacy" target="_blank" rel="noopener" class="experience-data" data-i18n="dataNotice"></a></header>${demoMode ? '<div class="voice-demo-toolbar"><span>합성 음성 시연 · 실제 음성 인식·주문 처리</span><div><button class="btn btn-dark btn-sm" id="demo-run-all">처음부터 연속 시연</button><button class="btn btn-outline btn-sm" id="demo-voice-next">01  글자·그림 키우기</button></div></div>' : ''}<div class="device-shell"><span class="device-camera" aria-hidden="true"></span><div class="device-screen"><div class="kiosk-app" aria-describedby="kiosk-shortcuts"><p class="sr-only" id="kiosk-shortcuts" data-i18n="keyboardHelp"></p><header class="kiosk-header"><span class="kiosk-store-name">${e(state.store.name)}</span><div class="kiosk-tools"><label class="language-picker"><span class="sr-only" data-i18n="language"></span><select id="language-select">${languages.map((v) => `<option value="${v.id}">${v.flag} ${v.label}</option>`).join('')}</select></label><button id="view-settings-toggle" aria-expanded="false" aria-controls="view-settings">${icon('type')}<span data-i18n="view"></span></button><button data-pref="read" aria-pressed="false">${icon('volume')}<span data-i18n="read"></span></button></div></header><section class="kiosk-view-settings" id="view-settings" hidden aria-label="${e(t('view'))}"><div class="view-settings-heading"><strong data-i18n="view"></strong><button class="icon-btn" id="close-settings" data-label="close">${icon('close')}</button></div>${sizeControl('text', .9, 1.6)}${sizeControl('image', .75, 1.5)}<div class="view-settings-bottom"><button id="reset-sizes" data-i18n="reset"></button><button data-pref="contrast" aria-pressed="false" data-i18n="contrast"></button></div></section><div class="kiosk-layout"><section class="kiosk-selection"><h1 class="kiosk-menu-title" data-i18n="menuTitle"></h1><div class="assistant-box" id="assistant-box"><span class="assistant-avatar" aria-hidden="true">✳</span><p id="assistant-message" aria-live="polite" aria-atomic="true"></p><button id="repeat-message" class="icon-btn" data-label="repeat">${icon('volume')}</button></div><div class="category-tabs" role="group" aria-label="${e(t('all'))}"><button class="active" data-category="all" aria-pressed="true" data-i18n="all"></button><button data-category="coffee" aria-pressed="false" data-i18n="coffee"></button><button data-category="tea" aria-pressed="false" data-i18n="tea"></button><button data-category="dessert" aria-pressed="false" data-i18n="dessert"></button><button data-category="brunch" aria-pressed="false" data-i18n="brunch"></button><button id="recommend-menu" class="recommend-trigger" data-i18n="recommend"></button></div><div class="kiosk-menu" id="kiosk-menu" role="region" aria-label="${e(t('menuTitle'))}"></div><form class="composer" id="composer"><div class="voice-panel" id="voice-panel" data-phase="idle"><button type="button" class="voice-btn" id="voice-order"></button><div class="voice-body"><p id="voice-state" role="status"></p><div class="voice-wave" aria-hidden="true">${Array.from({ length: 16 }, () => '<i></i>').join('')}</div><div class="voice-caption" id="voice-caption" hidden><small data-i18n="heard"></small><p id="voice-heard"></p></div></div><button type="button" class="voice-keyboard-toggle" id="keyboard-toggle" data-label="keyboard" aria-expanded="false" aria-controls="keyboard-entry">${icon('keyboard')}<span data-i18n="keyboard"></span></button></div><div id="keyboard-entry" hidden><div class="composer-input-row"><label class="sr-only" for="order-text" data-i18n="inputLabel"></label><input id="order-text" maxlength="500" autocomplete="off" enterkeyhint="send"><button type="submit" id="send-order" class="send-btn" data-label="send">${icon('arrow')}</button></div></div><p class="composer-note" data-i18n="aiNote"></p><p class="sr-only" id="speech-note" role="status"></p></form></section><aside class="cart-panel" aria-labelledby="cart-heading"><div class="cart-panel-head"><h2 id="cart-heading" tabindex="-1"><span data-i18n="cart"></span><span id="cart-count">0</span></h2><button id="clear-cart" class="small-text-btn" data-i18n="clear"></button></div><div class="cart-lines" id="cart-lines"></div><div class="cart-summary"><div><span data-i18n="total"></span><strong id="cart-total"></strong></div><button id="review-order" class="btn btn-dark full-width" disabled><span data-i18n="review"></span>${icon('arrow')}</button><button id="request-help" class="help-button">${icon('help')}<span data-i18n="help"></span></button></div></aside></div></div></div><span class="device-brand" aria-hidden="true">OPEN KIOSK</span></div></section>`;
    paintLanguage(); preferences(); status(lastReply);
    const toggleSettings = (open) => { $('#view-settings').hidden = !open; $('#view-settings-toggle').setAttribute('aria-expanded', String(open)); };
    $('#view-settings-toggle').onclick = () => toggleSettings($('#view-settings').hidden);
    $('#close-settings').onclick = () => { toggleSettings(false); $('#view-settings-toggle').focus(); };
    $('#reset-sizes').onclick = () => applyUI({ reset: true });
    $('#language-select').onchange = (event) => applyUI({ language: event.target.value });
    for (const kind of ['text', 'image']) $(`#${kind}-scale-input`).oninput = (event) => applyUI({ [`${kind}_size`]: Number(event.target.value) }, false);
    main.addEventListener('click', (event) => {
      const pref = event.target.closest('[data-pref]');
      if (pref) { prefs[pref.dataset.pref] = !prefs[pref.dataset.pref]; uiRevision++; preferences(); if (pref.dataset.pref === 'read') { if (prefs.read) speak(lastReply); else { cancelSpeech(); refreshHandsFree(); } } return; }
      const size = event.target.closest('[data-size]');
      if (size) return applyUI({ [`${size.dataset.size}_delta`]: Number(size.dataset.delta) });
      const cat = event.target.closest('[data-category]');
      if (cat) { navigateMenu(cat.dataset.category); return; }
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
    if (demoMode) { $('#demo-voice-next').onclick = playDemoVoice; $('#demo-voice-next').textContent = demoSamples[0].label; $('#demo-run-all').hidden = menuDemo; if (!menuDemo) $('#demo-run-all').onclick = runDemoSequence; }
    $('#keyboard-toggle').onclick = () => { const entry = $('#keyboard-entry'); entry.hidden = !entry.hidden; $('#keyboard-toggle').setAttribute('aria-expanded', String(!entry.hidden)); if (!entry.hidden) $('#order-text').focus(); };
    $('#recommend-menu').onclick = openRecommendationPrompt;
    $('#composer').onsubmit = (event) => { event.preventDefault(); submitText(); };
    $('#voice-order').onclick = voice; $('#repeat-message').onclick = () => speak(lastReply, true); $('#review-order').onclick = reviewOrder;
    $('#clear-cart').onclick = () => { if (!state.cart.length || busy) return; const d = modal(`<div class="modal-heading"><h2>${e(t('clearTitle'))}</h2></div><button class="btn btn-dark full-width" id="clear-confirm">${e(t('clearConfirm'))}</button>`); $('#clear-confirm', d).onclick = () => { d.close(); change({ type: 'clear' }); }; dialogActions.set(d, { accept: () => $('#clear-confirm', d).click() }); status(t('clearTitle')); refreshHandsFree(); };
    $('#request-help').onclick = async (event) => { const button = event.currentTarget; button.disabled = true; try { await api('/api/kiosk/help', { method: 'POST', body: {} }); if (alive) status(t('helpDemo')); } catch (err) { await fail(err); } finally { if (alive) button.disabled = false; } };
    document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelSpeech(); handsFree?.pause(); } refreshHandsFree(); }, { signal: controller.signal });
    document.addEventListener('keydown', (event) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      const key = event.key.toLowerCase(); if (!['m', 'r', 'o'].includes(key)) return; event.preventDefault();
      if (key === 'm') voice(); else if (key === 'r') speak(lastReply, true); else if (!$('dialog[open]')) reviewOrder();
    }, { signal: controller.signal });
    if (!demoMode) openEntry();
  } catch (err) { main.innerHTML = errorPanel(err.message); }
  return () => { alive = false; cancelSpeech(); handsFree?.stop(); handsFree = null; turns = []; demoCancel(); levelStop(); controller.abort(); if ('speechSynthesis' in window) speechSynthesis.cancel(); $$('.kiosk-modal').forEach((d) => d.close()); };
}
