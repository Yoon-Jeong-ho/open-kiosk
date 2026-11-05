export const menuCategories = ['all', 'coffee', 'tea', 'dessert', 'brunch'];
export const isRecommendationRequest = (input) => /추천|recommend|suggest|おすすめ|オススメ|推荐/i.test(String(input));

// These unambiguous browsing requests never place an order or change the display preferences.
export function parseMenuNavigation(input) {
  const text = String(input).trim().toLowerCase();
  if (!text || isRecommendationRequest(text) || /(?:\d+|한|두|세|네)\s*(?:잔|개|컵|인분|杯|個|份)|담아|담기|추가|주문해|\b(?:add|order)\b|注文して|加一/.test(text)) return null;
  if (/아메리카노|라떼|라테|스콘|브라우니|치즈케이크|샌드위치|토스트|요거트|americano|latte|scone|brownie|cheesecake|sandwich|toast|yogurt|アメリカーノ|ラテ|サンド|トースト|美式|拿铁|三明治|吐司/.test(text)) return null;
  if (/크게|작게|키워|확대|축소|\b(?:bigger|larger|smaller|zoom)\b|大き|小さ|放大|缩小/.test(text)) return null;
  if (/전체|모든\s*메뉴|처음\s*메뉴|\ball\s*(?:menu|items)|すべて|全メニュー|全部|所有菜单/.test(text)) return 'all';
  if (/브런치|식사|배고|출출|허기|\b(?:brunch|hungry|meal)\b|お腹|おなか|ブランチ|饿|早午餐/.test(text)) {
    if (/배고프지\s*않|안\s*배고|not\s*hungry/.test(text)) return null;
    return 'brunch';
  }
  if (/디저트|간식|케이크\s*메뉴|\bdesserts?\b|デザート|甜点/.test(text)) return 'dessert';
  if (/달달|달콤|단\s*거|단\s*것|sweet\s*(?:food|treat|something)|something\s*sweet|甘いもの|甜的/.test(text) && !/달지\s*않|안\s*단|not\s*sweet/.test(text) && !/음료|커피|drink|coffee/.test(text)) return 'dessert';
  if (/커피\s*(?:메뉴|보여|쪽|로)|커피\s*종류|\bcoffee\s*(?:menu|please)|コーヒー.*(?:メニュー|見せ)|咖啡菜单/.test(text)) return 'coffee';
  if (/차\s*(?:메뉴|종류)|음료\s*(?:메뉴|보여)|\b(?:tea|drinks?)\s*menu|お茶.*メニュー|饮料菜单/.test(text)) return 'tea';
  return null;
}

export function navigationForRequest(input, proposed) {
  const direct = parseMenuNavigation(input);
  if (direct) return direct;
  if (isRecommendationRequest(input)) {
    const text = String(input).toLowerCase();
    if (/브런치|식사|\b(?:brunch|meal)\b|ブランチ|早午餐/.test(text) && !/브런치\s*(?:말고|빼고|제외)|\b(?:no|not|without)\s+brunch/.test(text)) return 'brunch';
    if (/디저트|\bdesserts?\b|デザート|甜点/.test(text)) return 'dessert';
    if (/커피|\bcoffee\b|コーヒー|咖啡/.test(text)) return 'coffee';
  }
  const explicit = isRecommendationRequest(input) || /메뉴.*(?:보여|이동|돌아|열어)|메뉴판|\b(?:show|browse|menu|go to)\b|メニュー.*(?:見せ|表示)|显示.*菜单/.test(String(input));
  return explicit && menuCategories.includes(proposed) ? proposed : null;
}
