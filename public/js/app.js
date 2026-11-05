import { $, api, icon, logo, errorPanel } from './ui.js';
import { landing, bindLanding, pricing, tour, information } from './pages.js';
import { signup, bindSignup, checkout, dashboard } from './merchant.js';
import { kioskPage } from './kiosk.js';

const main = $('#main'); let cleanup = () => {}; let config; let renderId = 0;
const titles = { '/': 'Your pace. Your way.', '/pricing': '요금제', '/signup': '체험 계정 만들기', '/checkout': '구독 결제 데모', '/dashboard': '매장 운영', '/kiosk': '내 방식으로 주문하기', '/tour': '서비스 둘러보기', '/privacy': '체험 데이터 안내', '/accessibility': '접근성 안내' };

function chrome() {
  const immersive = ['/kiosk', '/dashboard'].includes(location.pathname);
  document.body.classList.toggle('immersive', immersive);
  $('#site-header').innerHTML = immersive ? '' : `<header class="site-header section-width">${logo()}<nav class="desktop-nav" aria-label="주요 메뉴"><a href="/#features">서비스 소개</a><a href="/accessibility" ${location.pathname === '/accessibility' ? 'aria-current="page"' : ''}>접근성</a><a href="/pricing" ${location.pathname === '/pricing' ? 'aria-current="page"' : ''}>요금제</a></nav><div class="header-actions"><a class="header-login" href="/dashboard">내 매장</a><a href="/signup" class="btn btn-dark btn-sm">체험 시작하기 ${icon('diagonal')}</a><button class="mobile-menu icon-btn" aria-label="메뉴 열기" aria-expanded="false">${icon('grid')}</button></div></header>`;
  if ($('.mobile-menu')) $('.mobile-menu').onclick = (event) => { const open = event.currentTarget.getAttribute('aria-expanded') !== 'true'; event.currentTarget.setAttribute('aria-expanded', String(open)); $('.desktop-nav').classList.toggle('nav-open', open); };
  $('#site-footer').innerHTML = immersive ? '' : `<footer class="site-footer"><div class="section-width footer-top"><div>${logo()}<p>내 속도로, 내 방식으로.<br>누구에게나 열린 주문의 시작.</p></div><div class="footer-links"><a href="/tour">서비스 둘러보기</a><a href="/pricing">요금제</a><a href="/accessibility">접근성 안내</a><a href="/privacy">체험 데이터 안내</a><a href="https://github.com/Yoon-Jeong-ho/open-kiosk" target="_blank" rel="noopener noreferrer">GitHub ${icon('diagonal')}</a></div></div><div class="section-width footer-bottom"><span>© ${new Date().getFullYear()} Open Kiosk · University project</span><span>교육용 데모 · 실제 결제·매장 운영·접근성 인증 아님</span></div></footer>`;
}

export async function render() {
  const id = ++renderId; cleanup(); cleanup = () => {};
  $$closeDialogs(); chrome(); document.title = `Open Kiosk — ${titles[location.pathname] || '페이지'}`;
  document.documentElement.lang = 'ko';
  $('.skip-link').textContent = '본문으로 건너뛰기';
  try {
    config ||= await api('/api/config');
    if (id !== renderId) return;
    const path = location.pathname;
    if (path === '/') { main.innerHTML = landing(); bindLanding(); }
    else if (path === '/pricing') main.innerHTML = pricing(config);
    else if (path === '/tour') main.innerHTML = tour();
    else if (path === '/privacy' || path === '/accessibility') main.innerHTML = information(path.slice(1));
    else if (path === '/signup') { main.innerHTML = signup(config); cleanup = bindSignup(config, navigate); }
    else {
      main.innerHTML = '<div class="loading"><span class="button-spinner"></span> 화면을 준비하고 있어요.</div>';
      const cb = path === '/checkout' ? await checkout(config, navigate, main) : path === '/dashboard' ? await dashboard(config, navigate, main) : path === '/kiosk' ? await kioskPage(main) : null;
      if (id !== renderId) { cb?.(); return; } cleanup = cb || (() => {});
      if (!titles[path]) main.innerHTML = errorPanel('페이지를 찾지 못했어요.');
    }
    if (location.hash) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'instant' }));
  } catch (err) { if (id === renderId) main.innerHTML = errorPanel(err.message); }
}
function $$closeDialogs() { document.querySelectorAll('dialog').forEach((d) => d.close()); }
export function navigate(url, replace = false) {
  history[replace ? 'replaceState' : 'pushState']({}, '', url); window.scrollTo(0, 0); render().then(() => { const h = $('h1'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } });
}
document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (event.target.closest('[data-reload]')) return render();
  const a = event.target.closest('a'); if (!a || a.target || a.hasAttribute('download')) return;
  const url = new URL(a.href, location.origin);
  if (url.origin !== location.origin) return;
  if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
  event.preventDefault(); navigate(url.pathname + url.search + url.hash);
});
window.addEventListener('popstate', render);
render();
