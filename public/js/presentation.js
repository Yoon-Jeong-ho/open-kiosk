import { isLanguage } from './locale.js';

export const defaultPreferences = { language: 'ko', textScale: 1, imageScale: 1, contrast: false, read: false };
const clamp = (value, min, max) => Math.round(Math.max(min, Math.min(max, value)) * 100) / 100;
export function normalizePreferences(value = {}) {
  if (!value || typeof value !== 'object') value = {};
  return {
    language: isLanguage(value.language) ? value.language : 'ko',
    textScale: Number.isFinite(value.textScale) ? clamp(value.textScale, .9, 1.6) : value.large === true ? 1.35 : 1,
    imageScale: Number.isFinite(value.imageScale) ? clamp(value.imageScale, .75, 1.5) : 1,
    contrast: value.contrast === true, read: value.read === true,
  };
}
export function sanitizePresentation(value = {}) {
  if (!value || typeof value !== 'object') value = {};
  return {
    language: isLanguage(value.language) ? value.language : null,
    text_delta: [-1, 0, 1].includes(value.text_delta) ? value.text_delta : 0,
    image_delta: [-1, 0, 1].includes(value.image_delta) ? value.image_delta : 0,
    text_size: Number.isFinite(value.text_size) ? clamp(value.text_size, .9, 1.6) : null,
    image_size: Number.isFinite(value.image_size) ? clamp(value.image_size, .75, 1.5) : null,
    reset: value.reset === true,
  };
}
export function applyPresentation(current, change) {
  const next = normalizePreferences(current); const patch = sanitizePresentation(change);
  if (patch.language) next.language = patch.language;
  if (patch.reset) { next.textScale = 1; next.imageScale = 1; }
  next.textScale = clamp((patch.text_size ?? next.textScale) + patch.text_delta * .15, .9, 1.6);
  next.imageScale = clamp((patch.image_size ?? next.imageScale) + patch.image_delta * .15, .75, 1.5);
  return next;
}

// Only handle unambiguous display-only requests locally. Mixed orders go to the model.
export function parsePresentationCommand(input, current = defaultPreferences) {
  const text = String(input).trim().toLowerCase();
  if (/추천|recommend|suggest|おすすめ|推荐|브런치|디저트/i.test(text)) return null;
  if (!text || /(?:[0-9一二三四五六七八九十한두세네])\s*(?:잔|개|컵|杯|個|份)|\b(?:add|order|cups?|hot|iced)\b|주문해|추가해|따뜻|차갑|注文して|点一/.test(text)) return null;
  if (/스콘|브라우니|치즈케이크|샌드위치|토스트|요거트|scone|brownie|cheesecake|sandwich|toast|yogurt|スコーン|ブラウニー|チーズケーキ|サンド|トースト|ヨーグルト|司康|布朗尼|芝士蛋糕|三明治|吐司|酸奶|시럽|헤이즐넛|syrup|シロップ|ヘーゼル|糖浆|아메리카노|라[테떼]|말차|초콜릿|아이스티|레몬에이드|americano|latte|coffee|matcha|chocolate|lemonade|アメリカーノ|コーヒー|ラテ|チョコ|ティー|美式|拿铁|咖啡|抹茶|巧克力|冰茶|柠檬/.test(text)) return null;
  let language = null;
  let languageCount = 0;
  for (const [id, pattern] of [
    ['ko', /한국어|한국말|\bkorean\b|韓国語|韩语|韓語/],
    ['en', /영어|\benglish\b|英語|英语/],
    ['ja', /일본어|日本語|日语|\bjapanese\b/],
    ['zh', /중국어|中文|中国語|汉语|\bchinese\b/],
  ]) if (pattern.test(text)) { language = id; languageCount++; }
  if (languageCount > 1) return null;
  const bigger = /크게|키워|확대|더\s*큰|bigger|larger|increase|zoom\s*in|大きく|拡大|放大|大一点|更大/.test(text);
  const smaller = /작게|줄여|축소|더\s*작은|smaller|decrease|zoom\s*out|小さく|縮小|缩小|小一点|更小/.test(text);
  if (bigger && smaller) return null;
  const reset = /기본\s*(?:크기|으로)|원래대로|원래\s*크기|\breset\b|\bdefault\b|標準|元のサイズ|默认|恢复/.test(text);
  const textTarget = /글씨|글자|텍스트|\btext\b|\bfont\b|文字|字体/.test(text);
  const imageTarget = /사진|이미지|그림|\bimages?\b|\bphotos?\b|\bpictures?\b|写真|画像|图片|图像/.test(text);
  if (!language && !bigger && !smaller && !reset) return null;
  // Language names in menu questions are not commands to change the interface.
  if (language && !bigger && !smaller && !reset && /메뉴|설명|뜻|meaning|mean\b|what|説明|介绍|介绍/.test(text)) return null;
  const direction = bigger ? 1 : smaller ? -1 : 0;
  const both = !textTarget && !imageTarget;
  const maximum = bigger && /최대|아주|가장|largest|maximum|最大/.test(text);
  const minimum = smaller && /최소|가장|smallest|minimum|最小/.test(text);
  const readable = bigger && textTarget && /작아|작네|너무\s*작|too\s*small|文字.*小さ|字.*太小/.test(text);
  const readableImages = readable && imageTarget;
  return sanitizePresentation({
    language, reset,
    text_delta: (textTarget || both) && !maximum && !minimum && !readable ? direction : 0,
    image_delta: (imageTarget || both) && !maximum && !minimum && !readableImages ? direction : 0,
    text_size: readable ? Math.max(normalizePreferences(current).textScale + .15, 1.4) : (textTarget || both) && (maximum || minimum) ? maximum ? 1.6 : .9 : null,
    image_size: readableImages ? Math.max(normalizePreferences(current).imageScale + .15, 1.4) : (imageTarget || both) && (maximum || minimum) ? maximum ? 1.5 : .75 : null,
  });
}

// Order-only requests cannot reset the user's view, even if the model invents display values.
export function presentationForRequest(input, value) {
  const text = String(input).toLowerCase();
  const visualTarget = /글씨|글자|텍스트|사진|이미지|그림|화면|\b(?:text|font|images?|photos?|pictures?|screen|display|zoom)\b|文字|字体|画像|写真|画面|表示|图片|图像|屏幕/.test(text);
  const visualChange = /크게|키워|확대|작게|줄여|축소|작아|너무\s*작|기본|원래|초기화|\b(?:bigger|larger|smaller|increase|decrease|reset|default|zoom)\b|too\s*small|大き|小さ|拡大|縮小|標準|放大|缩小|太小|更大|更小|默认|\d+\s*%/.test(text);
  const languageTarget = /한국어|영어|일본어|중국어|\b(?:korean|english|japanese|chinese|language)\b|韓国語|英語|日本語|中国語|中文|韩语|日语|英语/.test(text);
  const languageChange = /바꿔|변경|전환|보여|로\s*|\b(?:switch|change|use|in)\b|切り替|表示|にして|改|切换|用/.test(text);
  const requested = parsePresentationCommand(text) !== null || (visualTarget && visualChange) || (languageTarget && languageChange);
  return sanitizePresentation(requested ? value : {});
}
