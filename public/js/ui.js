export const $ = (selector, scope = document) => scope.querySelector(selector);
export const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
export const e = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const won = (v) => new Intl.NumberFormat('ko-KR').format(v);
export const temp = (v) => v === 'hot' ? '따뜻하게' : '차갑게';
const paths = {
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  diagonal: '<path d="M6 18 18 6M6 6h12v12"/>',
  mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  volume: '<path d="m11 5-6 4H2v6h3l6 4V5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h.01M14 13h.01M18 13h.01M8 16h8"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  type: '<path d="M4 19 10 5l6 14M6 14h8M17 10h5m-2.5 0v9"/>',
  bag: '<path d="M5 7h14l2 14H3L5 7Z"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  store: '<path d="M3 9 5 3h14l2 6M4 11v10h16V11M9 21v-7h6v7"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
  card: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 10h20M6 15h4"/>',
  shield: '<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Z"/><path d="m8 12 3 3 5-6"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.2 6A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.8 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4m.1 3h.01"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
  coffee: '<path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8Zm14 1h2a3 3 0 0 1 0 6h-2M7 2v3m5-3v3"/>',
  play: '<path d="m9 5 11 7-11 7V5Z"/>',
  logout: '<path d="M10 3H4v18h6m4-14 5 5-5 5m-7-5h12"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9 21h6"/>',
};
export function icon(name, cls = '') { return `<svg class="icon ${e(cls)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`; }
export function logo(light = false) { return `<a class="brand ${light ? 'brand-light' : ''}" href="/" aria-label="Open Kiosk 홈"><span class="brand-mark" aria-hidden="true"><i></i><b></b><i></i></span><span>open<span class="brand-weight">kiosk</span><sup aria-hidden="true">✳</sup></span></a>`; }
export function drinkArt(p, cls = '') {
  const fills = { coffee: '#4c2b20', latte: '#c89667', matcha: '#91a568', chocolate: '#785140', tea: '#d88f47', lemon: '#dbce6c' };
  const fill = fills[p.art] || fills.coffee;
  return `<svg class="drink-art ${e(cls)}" viewBox="0 0 200 180" role="img" aria-label="${e(p.name || '커피')} 일러스트"><ellipse cx="103" cy="158" rx="54" ry="9" fill="#202722" opacity=".07"/><path d="M59 52h85l-9 91c-1 11-64 11-65 0Z" fill="#fff" opacity=".9"/><path d="M65 63h73l-8 76c-1 8-54 8-55 0Z" fill="${fill}"/><path d="M65 63h73l-2 15c-21 9-48 7-69 0Z" fill="#f4e9d7" opacity="${p.art === 'coffee' ? '.22' : '.8'}"/><ellipse cx="101" cy="51" rx="43" ry="9" fill="#faf7f0"/><ellipse cx="101" cy="51" rx="34" ry="5" fill="${fill}"/><path d="M143 69h7c27 0 23 38-10 36" stroke="#fff" stroke-width="9" fill="none"/><path d="M84 33c-9-10 9-12 0-23m20 23c-9-10 9-12 0-23m20 23c-9-10 9-12 0-23" stroke="#7a8173" opacity=".3" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M78 88h46v28H78Z" fill="#fff" opacity=".86"/><path d="M94 96h-5v12h5m13-12h5v12h-5" stroke="#586b38" stroke-width="2.8" fill="none"/></svg>`;
}
export async function api(path, options = {}) {
  const headers = { ...(options.body instanceof Blob ? {} : { 'Content-Type': 'application/json' }), 'X-Open-Kiosk': '1', ...options.headers };
  const res = await fetch(path, { ...options, headers, body: options.body instanceof Blob ? options.body : options.body === undefined ? undefined : JSON.stringify(options.body) });
  const data = await res.json();
  if (!res.ok) { const error = new Error(data.error || '연결을 확인해 주세요.'); error.status = res.status; error.code = data.code; throw error; }
  return data;
}
let toastTimer;
export function toast(text) { const el = $('#toast'); el.textContent = text; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 4200); }
export function errorPanel(message) { return `<div class="error-panel" role="alert">${icon('help')}<p>${e(message)}</p><button class="btn" data-reload>다시 시도하기</button></div>`; }
export function dialog(content, cls = '') {
  const el = document.createElement('dialog'); el.className = `modal ${cls}`;
  el.innerHTML = `<button class="modal-close icon-btn" aria-label="닫기">${icon('close')}</button>${content}`;
  const heading = el.querySelector('h2');
  if (heading) { heading.id ||= `dialog-${crypto.randomUUID()}`; el.setAttribute('aria-labelledby', heading.id); }
  document.body.append(el); el.showModal();
  $('.modal-close', el).onclick = () => el.close();
  el.addEventListener('close', () => el.remove(), { once: true });
  return el;
}
