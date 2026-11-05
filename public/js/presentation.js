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
export function parsePresentationCommand(input) {
  const text = String(input).trim().toLowerCase();
  if (!text || /(?:[0-9一二三四五六七八九十한두세네])\s*(?:잔|컵|杯)|\b(?:add|order|cups?|hot|iced)\b|주문해|추가해|따뜻|차갑|注文して|点一/.test(text)) return null;
  if (/아메리카노|라[테떼]|말차|초콜릿|아이스티|레몬에이드|americano|latte|coffee|matcha|chocolate|lemonade|アメリカーノ|コーヒー|ラテ|チョコ|ティー|美式|拿铁|咖啡|抹茶|巧克力|冰茶|柠檬/.test(text)) return null;
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
  return sanitizePresentation({
    language, reset,
    text_delta: (textTarget || both) && !maximum && !minimum ? direction : 0,
    image_delta: (imageTarget || both) && !maximum && !minimum ? direction : 0,
    text_size: (textTarget || both) && (maximum || minimum) ? maximum ? 1.6 : .9 : null,
    image_size: (imageTarget || both) && (maximum || minimum) ? maximum ? 1.5 : .75 : null,
  });
}
