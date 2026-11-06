import { $, $$, e, won, icon, drinkArt } from './ui.js';
import { demoMedia } from './demo-media.js';

const coffee = { name: '아메리카노', art: 'coffee' };
const latte = { name: '카페라테', art: 'latte' };
const ticks = (items) => items.map((v) => `<li>${icon('check')}<span>${e(v)}</span></li>`).join('');

export function landing() {
  return `<div class="landing-wrap">
    <section class="hero section-width">
      <div class="hero-copy">
        <div class="eyebrow"><span class="status-dot"></span> EVERY WAY IS WELCOME</div>
        <h1>주문에도,<br>모두의 방식이<br>있으니까<span class="lime-dot">.</span></h1>
        <p class="hero-description">말로, 화면으로, 키보드로.<br>방법을 바꿔도 자연스럽게 이어지는 주문.<br>누구에게나 열린 매장을 시작해 보세요.</p>
        <div class="button-row"><a class="btn btn-dark btn-lg" href="/kiosk">키오스크 체험하기 ${icon('diagonal')}</a><a class="text-link" href="/tour">서비스 둘러보기 ${icon('arrow')}</a></div>
        <div class="hero-footnote">${icon('shield')} 설치 없이 체험 · 개인정보 입력 없이 시작</div>
      </div>
      <div class="hero-visual" aria-label="음성으로 담은 주문을 화면에서 수정하는 기능 미리보기">
        <div class="visual-orbit orbit-one"></div><div class="visual-orbit orbit-two"></div>
        <span class="visual-caption">YOUR PACE. YOUR WAY.</span>
        <div class="mini-kiosk">
          <div class="mini-top"><span class="mini-logo">[o]</span><span>OPEN GARDEN</span><span class="mini-dot"></span></div>
          <div class="mini-body"><div class="mini-greeting">반가워요!<br>무엇을 마실까요?</div><div class="mini-menu"><div class="mini-product peach">${drinkArt(coffee)}<b>아메리카노</b><small>3,500원</small></div><div class="mini-product cream">${drinkArt(latte)}<b>카페라테</b><small>4,200원</small></div></div><div class="mini-basket"><span>선택한 메뉴</span><b>아메리카노 × 2</b><span>따뜻하게 · 7,000원</span></div><div class="mini-confirm">주문 내용 확인하기 ${icon('arrow')}</div></div>
        </div>
        <div class="floating-bubble bubble-voice"><span class="bubble-icon">${icon('mic')}</span><div><small>말로 담고</small><b>“아메리카노 두 잔 주세요.”</b></div><span class="wave-bars"><i></i><i></i><i></i><i></i><i></i></span></div>
        <div class="floating-bubble bubble-touch"><span class="bubble-icon">${icon('keyboard')}</span><div><small>화면으로 바꿔도</small><b>주문은 그대로 이어져요.</b></div><span class="round-check">${icon('check')}</span></div>
        <span class="preview-label">기능 미리보기 · 실제 주문은 체험에서</span>
      </div>
    </section>
    <div class="ways-strip"><div class="section-width"><span>한 가지 방식에 맞출 필요 없이</span><b>${icon('mic')} 말하기</b><i>+</i><b>${icon('grid')} 화면 선택</b><i>+</i><b>${icon('keyboard')} 키보드</b><span class="ways-last">선택은 자유롭게, 주문은 하나로.</span></div></div>
    <section class="section-width voice-demo-section" id="voice-demo" aria-labelledby="voice-demo-heading">
      <div class="voice-demo-heading"><div><div class="section-kicker">WATCH IT WORK</div><h2 id="voice-demo-heading">말 한마디로,<br>주문도 화면도.</h2></div><p>“글씨랑 그림을 크게 키워줘!”<br>커진 상태 그대로, 주문을 끝까지 이어가세요.</p></div>
      <figure class="voice-demo-player"><video id="voice-demo-video" controls playsinline preload="metadata" poster="/media/voice-order-demo.jpg?v=${demoMedia.version}" aria-label="글자와 그림을 키운 뒤 끝까지 이어지는 ${demoMedia.duration}초 음성 시연"><source src="/media/voice-order-demo.mp4?v=${demoMedia.version}" type="video/mp4"><track kind="captions" src="/media/voice-order-demo.vtt?v=${demoMedia.version}" srclang="ko" label="한국어">브라우저가 영상을 지원하지 않아요. <a href="/media/voice-order-demo.mp4">시연 영상 보기</a></video><figcaption><span>합성 음성 · 같은 화면 연속 시연 · ${demoMedia.duration}초</span><a href="/kiosk">직접 주문해 보기 ${icon('arrow')}</a></figcaption></figure>
      <div class="voice-demo-chapters" role="group" aria-label="시연 장면 바로가기">${demoMedia.chapters.map((chapter, i) => `<button data-demo-time="${chapter.time}"><span>0${i + 1}</span> ${e(chapter.title)}</button>`).join('')}</div>
    </section>
    <section class="section-width story-section" id="why"><div class="section-kicker">01 / WHY WE OPEN</div><div class="story-heading"><h2>작은 선택 앞에서<br>멈추는 사람이 없도록.</h2><p>작은 글씨, 낯선 메뉴, 잘못 누른 선택.<br>주문 과정의 작은 어려움이 누군가에게는<br>매장 이용의 큰 장벽이 될 수 있습니다.<br><strong>우리는 주문을 이어갈 수 있는 선택지를 만듭니다.</strong></p></div><div class="situation-grid"><article><span class="situation-number">01</span><h3>잘 안 보일 때도</h3><p>크게 보고, 선명하게 보고,<br>필요한 안내를 들을 수 있게.</p><span class="situation-symbol">Aa<span>+</span></span></article><article><span class="situation-number">02</span><h3>말하기 어려울 때도</h3><p>화면과 키보드로 같은 주문을<br>그대로 이어갈 수 있게.</p><div class="situation-symbol">${icon('keyboard')}</div></article><article><span class="situation-number">03</span><h3>마음이 바뀔 때도</h3><p>온도나 수량을 바꾸고<br>바뀐 내용을 다시 확인할 수 있게.</p><div class="situation-symbol">${icon('refresh')}</div></article></div><a class="under-link" href="/accessibility">접근성 설계와 검증 범위 보기 ${icon('diagonal')}</a></section>
    <section class="feature-section" id="features"><div class="section-width"><div class="section-kicker">02 / ONE ORDER, MANY WAYS</div><div class="section-heading"><h2>방식이 달라져도,<br>이어지는 경험.</h2><p>말을 이해하는 AI와 주문을 확인하는 서버.<br>선택한 내용은 언제나 직접 확인하고 바꿀 수 있어요.</p></div><div class="feature-showcase"><div class="feature-tabs" role="tablist" aria-label="주요 기능"><button role="tab" aria-selected="true" aria-controls="feature-panel" id="feature-tab-0" data-feature="0"><span>01</span><div><h3>자유롭게 오가는 입력</h3><p>말로 담고, 화면으로 고쳐도<br>같은 장바구니를 사용해요.</p></div>${icon('arrow')}</button><button role="tab" aria-selected="false" aria-controls="feature-panel" id="feature-tab-1" data-feature="1" tabindex="-1"><span>02</span><div><h3>필요한 부분만 수정</h3><p>“그중 하나만 차갑게.”<br>변경할 항목을 찾아 바꿔요.</p></div>${icon('arrow')}</button><button role="tab" aria-selected="false" aria-controls="feature-panel" id="feature-tab-2" data-feature="2" tabindex="-1"><span>03</span><div><h3>확인한 뒤에 확정</h3><p>메뉴와 금액을 확인하고<br>마지막 선택은 직접 해요.</p></div>${icon('arrow')}</button></div><div id="feature-panel" class="feature-panel" role="tabpanel" aria-labelledby="feature-tab-0"></div></div></div></section>
    <section class="section-width merchant-section"><div class="section-kicker">03 / OPEN FOR YOUR STORE</div><div class="section-heading"><h2>손님의 주문부터<br>사장님의 운영까지.</h2><a href="/signup" class="btn btn-outline">가상 매장 만들어 보기 ${icon('arrow')}</a></div><div class="merchant-steps"><article><div class="step-illustration step-lime">${icon('store')}<span>MY FIRST STORE</span></div><h3><span>01</span> 가상 매장으로 시작</h3><p>실명·이메일 없이 체험 계정을 만들고<br>나만의 매장 화면을 열어 보세요.</p></article><article><div class="step-illustration step-lavender">${icon('card')}<span>SUBSCRIPTION DEMO</span></div><h3><span>02</span> 구독 과정을 체험</h3><p>요금제를 고르고 월 구독을 경험하세요.<br>카드정보 입력이나 실제 청구는 없어요.</p></article><article><div class="step-illustration step-peach">${icon('grid')}<span>CONNECTED EXPERIENCE</span></div><h3><span>03</span> 주문과 운영을 연결</h3><p>내 매장의 키오스크에서 주문하고<br>운영 화면에서 접수 내역을 확인하세요.</p></article></div></section>
    <section class="section-width faq-section"><div><div class="section-kicker">A FEW THINGS TO KNOW</div><h2>시작하기 전에<br>궁금한 이야기.</h2></div><div class="faq-list"><details><summary>실제 매장에서도 바로 쓸 수 있나요?</summary><p>현재는 수업 프로젝트용 데모예요. 가상 매장의 주문과 운영 흐름을 체험할 수 있고, 실제 카드 결제·POS·매장 직원과는 연결되어 있지 않습니다.</p></details><details><summary>서비스 이용료와 음료값은 어떻게 다른가요?</summary><p>사이트의 월 요금은 매장 운영자가 서비스를 구독하는 비용을 가정한 금액이에요. 이번 데모에서는 서비스 구독료와 음료값 모두 실제로 결제하지 않습니다.</p></details><details><summary>음성 없이도 주문할 수 있나요?</summary><p>메뉴판과 키보드만으로 주문하고 수정할 수 있어요. 음성으로 시작한 주문을 화면으로 이어가도 선택한 내용이 유지됩니다.</p></details><details><summary>누구나 사용할 수 있다고 검증됐나요?</summary><p>키보드 조작, 읽어주기, 글자 확대 등을 구현했어요. 장애 당사자 테스트와 실제 단말기 환경 검증은 아직 수행하지 않았고 공인 접근성 인증도 받지 않았습니다.</p></details></div></section>
    <section class="section-width closing-cta"><span class="closing-spark" aria-hidden="true">✳</span><div><div class="section-kicker">LET'S OPEN THE POSSIBILITIES</div><h2>우리 매장의 다음 주문,<br>더 많은 방식으로.</h2></div><a class="btn btn-dark btn-lg" href="/kiosk">지금 체험하기 ${icon('diagonal')}</a></section>
  </div>`;
}

export function bindLanding() {
  $$('[data-demo-time]').forEach((button) => button.onclick = () => {
    const video = $('#voice-demo-video'); video.currentTime = Number(button.dataset.demoTime); video.play().catch(() => {});
  });
  const scenes = [
    `<div class="scene-label">INPUT CONTINUITY</div><div class="demo-chat"><span>${icon('mic')} 말로 선택</span><p>“따뜻한 아메리카노 두 잔 주세요.”</p></div><div class="scene-arrow">↓</div><div class="demo-order">${drinkArt(coffee)}<div><b>아메리카노</b><small>따뜻하게 · 2잔</small></div><span>7,000원</span></div><div class="demo-status">${icon('keyboard')} 화면·키보드에서도 같은 주문</div>`,
    `<div class="scene-label">CHANGE JUST WHAT YOU NEED</div><div class="demo-chat"><span>${icon('refresh')} 필요한 부분만</span><p>“그중 하나만 차갑게 바꿔 주세요.”</p></div><div class="split-order"><div><span class="temp-hot">HOT</span><b>아메리카노</b><small>따뜻하게 · 1잔</small></div><div><span class="temp-iced">ICED</span><b>아메리카노</b><small>차갑게 · 1잔</small></div></div><div class="demo-status">${icon('check')} 메뉴와 수량을 유지하며 온도만 변경</div>`,
    `<div class="scene-label">YOU HAVE THE FINAL SAY</div><div class="review-preview"><span class="round-check">${icon('check')}</span><h3>이대로 주문할까요?</h3><p>아메리카노 · 따뜻하게 · 1잔<br>아메리카노 · 차갑게 · 1잔</p><div><span>합계</span><strong>7,000원</strong></div><span class="fake-button">확인하고 주문하기 ${icon('arrow')}</span></div><div class="demo-status">${icon('shield')} 사용자 확인 후 주문 확정</div>`,
  ];
  const show = (i) => {
    $$('#features [role=tab]').forEach((b, n) => { b.setAttribute('aria-selected', String(i === n)); b.tabIndex = i === n ? 0 : -1; });
    $('#feature-panel').innerHTML = scenes[i] + '<small class="scene-note">설명을 위한 예시 화면입니다.</small>';
    $('#feature-panel').setAttribute('aria-labelledby', `feature-tab-${i}`);
  };
  $$('[data-feature]').forEach((b, i) => {
    b.onclick = () => show(i);
    b.onkeydown = (event) => { if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const n = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (i + (['ArrowUp', 'ArrowLeft'].includes(event.key) ? 2 : 1)) % 3; show(n); $(`#feature-tab-${n}`).focus(); };
  });
  show(0);
}

export function pricing(config) {
  return `<section class="section-width pricing-page"><div class="page-intro"><div class="eyebrow">SIMPLE PLANS, OPEN POSSIBILITIES</div><h1>우리 매장에 맞게,<br>가볍게 시작하세요.</h1><p>매장 운영자가 구독하는 서비스 요금제예요.<br>프로젝트용 가상 요금이며 실제 청구는 없습니다.</p><span class="demo-tag">${icon('card')} 월 구독 결제 데모</span></div><div class="pricing-grid">${Object.values(config.plans).map((p, i) => `<article class="pricing-card ${i ? 'featured' : ''}">${i ? '<span class="plan-label">운영까지 함께 체험</span>' : ''}<span class="plan-index">0${i + 1}</span><h2>${p.name}</h2><p>${p.description}</p><div class="plan-price">${won(p.price)}<span>원 / 월</span></div><a href="/signup?plan=${p.id}" class="btn ${i ? 'btn-dark' : 'btn-outline'}">이 요금제 체험하기 ${icon('arrow')}</a><ul class="tick-list">${ticks(i ? ['음성·화면·키보드 주문', '큰 글씨·고대비·읽어주기', '주문 접수와 진행 상태 관리', '메뉴 가격·품절 상태 관리', '도움 요청 확인'] : ['음성·화면·키보드 주문', '큰 글씨·고대비·읽어주기', '메뉴에 근거한 주문 검증', '개인 매장 키오스크 연결'])}</ul></article>`).join('')}</div><div class="pricing-note">${icon('help')} <p>요금과 상품 구성은 사업 모델을 설명하기 위한 가정입니다. 데모에서는 두 요금제 모두 구현된 기능을 체험할 수 있으며, 자동 갱신·실제 과금·결제대행 연동은 없습니다.</p></div><div class="pricing-bottom"><h2>구독 전에, 주문부터 해볼까요?</h2><a href="/kiosk" class="under-link">가입 없이 키오스크 체험 ${icon('diagonal')}</a></div></section>`;
}

export function tour() {
  return `<section class="section-width tour-page"><div class="page-intro"><div class="eyebrow">FROM FIRST HELLO TO FIRST ORDER</div><h1>하나의 서비스,<br>두 가지 경험.</h1><p>매장 운영자의 시작과 손님의 주문이<br>어떻게 연결되는지 직접 살펴보세요.</p></div><div class="tour-path"><article><span class="tour-number">01</span><div>${icon('store')}<h2>운영자 체험 계정 만들기</h2><p>준비된 가상 매장을 골라 시작해요.<br>실명, 이메일, 비밀번호는 받지 않아요.</p><a href="/signup" class="btn btn-dark">매장 만들기 ${icon('arrow')}</a></div></article><article><span class="tour-number">02</span><div>${icon('card')}<h2>월 구독 결제 체험하기</h2><p>서비스 이용료를 내는 사람은 매장 운영자예요.<br>요금제 선택과 결제 완료 흐름을 체험해요.</p><a href="/pricing" class="btn btn-outline">요금제 보기 ${icon('arrow')}</a></div></article><article><span class="tour-number">03</span><div>${icon('mic')}<h2>손님의 방식으로 주문하기</h2><p>“따뜻한 아메리카노 두 잔.” 다음에는<br>“그중 하나만 차갑게”라고 바꿔 보세요.</p><a href="/kiosk" class="btn btn-outline">공개 키오스크 체험 ${icon('arrow')}</a></div></article><article><span class="tour-number">04</span><div>${icon('grid')}<h2>내 매장에서 주문 확인하기</h2><p>대시보드의 ‘내 매장 키오스크’를 열어 주문하면<br>같은 매장의 운영 화면에서 접수 내역이 보여요.</p><a href="/dashboard" class="btn btn-outline">운영 화면 열기 ${icon('arrow')}</a></div></article></div><div class="info-callout">${icon('help')} 이 페이지는 직접 조작하는 서비스 안내입니다. 녹화 영상이나 실제 매장 운영 실적을 표시한 것은 아닙니다.</div></section>`;
}

export function information(kind) {
  const privacy = kind === 'privacy';
  return `<section class="section-width prose-page"><div class="eyebrow">${privacy ? 'DEMO DATA & PRIVACY' : 'DESIGNED WITH CHOICE'}</div><h1>${privacy ? '체험 데이터 안내' : '접근성과 선택권'}</h1><p class="prose-lead">${privacy ? '데모에서 어떤 정보가 오가는지 설명합니다.' : '필요한 기능을 직접 고르고, 편한 방식으로 주문할 수 있도록 설계했습니다.'}</p>${privacy ? `
    <h2>실제 개인정보 없이 시작</h2><p>가입은 준비된 가상 매장을 고르는 체험 과정입니다. 실명·이메일·전화번호·비밀번호·카드번호 입력란을 제공하지 않습니다. 임의의 매장 식별자와 세션 쿠키로 체험 매장을 연결합니다.</p>
    <h2>서버와 브라우저에 남는 정보</h2><p>서버에는 가상 매장, 선택한 요금제, 메뉴 설정, 장바구니, 체험 주문, 도움 요청과 가상 구독 내역이 저장됩니다. 브라우저에는 세션 쿠키와 언어·글자 크기·이미지 크기·대비·읽어주기 설정을 저장합니다.</p>
    <h2>음성·텍스트의 AI 전송</h2><p>키오스크에 들어가면 브라우저가 마이크 권한을 요청하며, 허용하면 버튼 없이 발화 후보를 감지합니다. 로컬에서 감지한 최대 20초 구간을 OpenAI API로 보내 글자로 변환하며 조용한 대기 구간은 보내지 않습니다. 대화 쉬기로 감지를 멈출 수 있고, 안내 재생·요청 처리·숨겨진 탭에서는 감지를 쉽니다. 화면을 떠나면 마이크 연결을 해제합니다. 인식한 문장은 화면에 표시되고 주문 해석으로 자동 전달되어 메뉴나 보기 설정을 바꿉니다. 주문 확정은 확인 화면에서 버튼을 누르거나 별도의 확인 발화를 한 뒤 이뤄집니다. 원하면 글자 입력을 열어 직접 수정 요청을 입력할 수 있습니다. 주문 해석에는 입력한 문장, 메뉴와 현재 장바구니, 브라우저 메모리의 최근 네 발화가 OpenAI로 전송됩니다. 읽어주기를 켜면 안내 문장도 OpenAI로 전송해 AI 합성 음성을 만듭니다. 합성 음성은 서버 메모리에서 최대 16개·5분 동안 재사용하며 파일에 저장하지 않습니다. 최근 대화는 수동 주문 변경·체험 종료 시 비우며 파일이나 브라우저 저장소에 저장하지 않습니다. 이름·연락처 등 개인정보는 입력하거나 말하지 마세요.</p><p>앱 서버는 음성 원본과 대화 원문을 파일·데이터베이스·요청 로그에 보관하지 않습니다. 외부 API 제공업체의 처리·보관 정책은 별도로 적용됩니다. <a href="https://developers.openai.com/api/docs/guides/your-data" target="_blank" rel="noopener noreferrer">OpenAI 데이터 관리 문서</a>에서 확인할 수 있습니다.</p>
    <h2>보관과 삭제</h2><p>운영자 체험 세션은 7일 후 만료되며, 만료된 가상 매장과 관련 정보는 이후 주기적 정리 시 삭제됩니다. 공개 데모 매장의 주문과 도움 요청은 24시간 경과 후 주기적으로 삭제됩니다. 운영 화면의 설정에서 본인의 체험 매장 데이터를 직접 삭제할 수 있습니다. 개인을 식별하지 않는 일별 API 요청 수와 토큰 합계는 사용 한도 관리에 이용됩니다.</p>
    <h2>실제 결제와 정식 서비스</h2><p>월 구독 결제와 주문 금액은 교육용 시연이며 실제 청구, 자동 결제, 실제 매장 전달은 없습니다. 정식 서비스 출시나 법률 준수 인증을 의미하지 않습니다.</p>` : `
    <h2>하나의 주문, 여러 입력 방식</h2><p>음성, 화면 선택, 키보드 입력이 서버의 같은 장바구니를 사용합니다. 입력 방식을 바꿀 때 선택한 메뉴와 옵션을 유지합니다. 음성을 사용하지 않아도 메뉴 선택부터 최종 확인까지 진행할 수 있습니다.</p>
    <h2>보기와 듣기를 조절</h2><p>국기와 언어명으로 한국어·영어·일본어·중국어를 선택할 수 있고, 지원 언어의 발화 문자에 따라 메뉴와 안내 언어를 자동 전환합니다. 글자는 90–160%, 메뉴 이미지는 75–150%에서 각각 조절할 수 있고, “글씨 크게 보여줘”처럼 입력하거나 말할 수도 있습니다. 고대비를 함께 사용할 수 있습니다. 읽어주기는 켜거나 끌 수 있고, 다시 듣기로 안내를 반복할 수 있습니다. 메뉴 읽어줘·내 주문 읽어줘·다시 말해줘와 추천 순번·온도·수량·시럽·최종 확인의 음성 응답을 지원합니다. 읽어주기는 OpenAI로 생성한 AI 합성 음성이며, 연결 실패 시 기기에 설치된 음성을 대안으로 사용합니다. 스크린리더를 위한 컨트롤 이름·상태 안내·대화상자 제목 포커스를 제공하고, Alt+M 대화 쉬기·계속, Alt+R 다시 듣기, Alt+O 주문 확인을 지원합니다.</p>
    <h2>수정과 최종 확인</h2><p>장바구니에서 수량·온도를 바꾸거나 메뉴를 삭제할 수 있습니다. AI는 변경 의도를 해석하고 서버가 유효한 메뉴·옵션·수량을 검증합니다. 주문 확정은 확인 화면에서 사용자가 버튼을 누르거나 별도의 확인 발화를 한 뒤 이뤄집니다. 추천이나 단순 담기 요청만으로 확정하지 않습니다.</p>
    <h2>검증 범위와 남은 과제</h2><p>이 프로젝트의 소프트웨어 점검 결과는 저장소 문서에 기록합니다. 장애 당사자 사용자 테스트, 실제 단말기 설치 높이·촉각 조작부·결제기 접근성, 소음 환경의 음성 성능은 별도 검증이 필요합니다. 모든 장애 유형의 이용 가능성을 검증했거나 공인 접근성 인증을 받았다고 주장하지 않습니다.</p>
    <h2>참고 기준과 연구</h2><ul><li><a href="https://www.w3.org/TR/WCAG22/" target="_blank" rel="noopener noreferrer">W3C WCAG 2.2</a> — 키보드 조작, 대비, 상태 안내 등의 웹 접근성 기준</li><li><a href="https://speechaccessibilityproject.beckman.illinois.edu/" target="_blank" rel="noopener noreferrer">Speech Accessibility Project</a> — 다양한 발화 특성과 음성인식 접근성</li><li><a href="https://guide.tossplace.com/operate/accessibility-mode" target="_blank" rel="noopener noreferrer">토스플레이스 접근성 안내</a> — 지원 모델과 기능별 동작</li></ul>`}<div class="button-row"><a class="btn btn-dark" href="/kiosk">키오스크 체험하기 ${icon('arrow')}</a><a class="text-link" href="${privacy ? '/accessibility' : '/privacy'}">${privacy ? '접근성 안내' : '체험 데이터 안내'}</a></div></section>`;
}
