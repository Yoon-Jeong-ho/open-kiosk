// Language follows the utterance, never a model's unsolicited display reset.
export function utteranceLanguage(input, current = 'ko') {
  const text = String(input).trim();
  if (/[가-힣]/.test(text)) return 'ko';
  if (/[ぁ-ゖァ-ヺ]/.test(text)) return 'ja';
  if (/[\u3400-\u9fff]/.test(text)) return current === 'ja' ? 'ja' : 'zh';
  const words = text.match(/[a-z]+(?:'[a-z]+)?/gi) || [];
  if (words.length >= 2 || /^(?:hello|hi|english|hot|iced|yes|no|cancel|confirm|brunch|dessert)[.!?\s]*$/i.test(text)) return 'en';
  return current;
}

export function speechVoice(voices, language) {
  const matching = voices.filter((voice) => String(voice.lang).toLowerCase().startsWith(language));
  const local = matching.filter((voice) => voice.localService);
  return local.find((voice) => /Samantha|Yuna|Kyoko|Tingting|유나|쿄코|팅팅/.test(voice.name)) || local.find((voice) => voice.default) || local[0] || matching[0];
}

export function conversationCommand(input) {
  const text = String(input).trim().toLowerCase().replace(/[.!?。！？]/g, '');
  if (/^(?:잠깐만|잠시만|음성\s*(?:멈춰|중지)|대화\s*(?:멈춰|중지)|pause(?: listening)?|stop listening|一時停止|暂停聆听)$/.test(text)) return { type: 'pause' };
  if (/^(?:읽어주기\s*(?:켜|켜줘)|안내\s*읽어줘|turn on (?:speech|read aloud)|読み上げて|开启朗读)$/.test(text)) return { type: 'read_on' };
  if (/^(?:읽어주기\s*(?:꺼|꺼줘)|음성\s*안내\s*(?:꺼|꺼줘)|turn off (?:speech|read aloud)|読み上げをオフ|关闭朗读)$/.test(text)) return { type: 'read_off' };
  if (/^(?:도와줘|직원\s*(?:불러줘|호출)|도움\s*요청|help(?: me)?|call staff|スタッフを呼んで|请帮忙|叫店员)$/.test(text)) return { type: 'help' };
  if (/다시\s*(?:말해|읽어|들려)|repeat|say that again|もう一度|再说一遍/.test(text)) return { type: 'repeat' };
  if (/내\s*주문.*(?:읽어|알려)|장바구니.*읽어|read.*(?:order|cart)|what.*(?:my order|in my cart)|注文.*読|读.*订单/.test(text)) return { type: 'cart' };
  if (/메뉴.*(?:읽어|뭐|알려)|뭐.*(?:있어|먹을)|read.*menu|what.*(?:menu|available|order)|メニュー.*(?:読|教)|读.*菜单|有什么/.test(text)) return { type: 'menu' };
  return null;
}

export function dialogCommand(input) {
  const text = String(input).trim().toLowerCase().replace(/[.!?。！？]/g, '');
  if (/^(?:취소|닫아(?:줘)?|돌아가|cancel|close|go back|キャンセル|閉じて|取消|关闭)$/.test(text)) return { type: 'cancel' };
  if (/하지\s*마|빼지\s*마|don't (?:add|remove)|do not (?:add|remove)|不要添加|不要去掉/.test(text)) return null;
  if (/헤이즐넛|시럽|hazelnut|syrup|ヘーゼル|シロップ|榛果/.test(text) && !/아메리카노|라테|라떼|americano|latte/.test(text)) return { type:'addon', value:'hazelnut', enabled: !/빼|제거|없이|without|remove|なし|去掉/.test(text) };
  if (/하지\s*마|말고|아니|않|안\s*|\b(?:not|don't|no)\b|しない|不要|不确认/.test(text)) return null;
  const choice = text.match(/(?:^|\s)([12])\s*(?:번|번째|번으로|번 조합|番|个|号|$)/);
  if (choice || /첫\s*번째|첫째|\bfirst\b|一番|第一个/.test(text)) return { type: 'choice', index: choice ? Number(choice[1]) - 1 : 0 };
  if (/두\s*번째|둘째|\bsecond\b|二番|第二个/.test(text)) return { type: 'choice', index: 1 };
  if (/아메리카노|라떼|라테|스콘|브라우니|케이크|샌드위치|토스트|요거트|americano|latte|scone|brownie|cake|sandwich|toast|yogurt/.test(text)) return null;
  const count = text.match(/^(?:수량\s*)?(\d{1,2}|하나|한|둘|두|셋|세|넷|네|one|two|three|four)\s*(?:잔|개|컵|cups?|drinks?|items?|個|杯|份)?\s*(?:으로|로|주세요|please|にして|个)?$/);
  if (count && (count[1] !== '네' || /잔|개|컵/.test(text))) { const quantity = Number(count[1]) || ({하나:1,한:1,둘:2,두:2,셋:3,세:3,넷:4,네:4,one:1,two:2,three:3,four:4})[count[1]]; if (quantity >= 1 && quantity <= 20) return {type:'quantity',value:quantity}; }
  if (/(?:\d+|한|두)\s*(?:잔|개)/.test(text)) return null;
  const hot = /따뜻|뜨거|\bhot\b|ホット|温か|热/.test(text), iced = /차갑|아이스|\biced?\b|冷た|アイス|冰/.test(text);
  if (hot !== iced) return { type: 'temperature', value: hot ? 'hot' : 'iced', add: /담아|담기|추가|\badd\b|追加|添加/.test(text) };
  if (/^(?:네|예|응|담아(?:줘)?|추가해(?:줘)?|확정(?:해줘)?|주문\s*확정|yes|confirm(?: order)?|place order|add(?: it| this set)?|はい|注文確定|追加して|确认(?:下单)?|添加)$/.test(text)) return { type: 'accept' };
  return null;
}

export function canListen({ ready = true, paused = false, busy = false, speaking = false, hidden = false, dialogAllowed = true, now = Date.now(), resumeAfter = 0 } = {}) {
  return ready && !paused && !busy && !speaking && !hidden && dialogAllowed && now >= resumeAfter;
}

export function dispatchDialogCommand(input, actions) {
  if (!actions) return false;
  const command = dialogCommand(input);
  if (!command) return false;
  if (command.type === 'choice' && !actions.choice && actions.quantity && /^\s*[12]\s*[.!?]?\s*$/.test(input)) { actions.quantity(command.index + 1); return true; }
  if (command.type === 'accept' && actions.review && /담아|추가|\badd\b|追加|添加/i.test(input)) { actions.needsConfirmation?.(); return true; }
  if (typeof actions[command.type] !== 'function') return false;
  actions[command.type](command.value ?? command.index, command.type === 'addon' ? command.enabled : command.add);
  return true;
}

export function recentTurns(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-4).filter((turn) => ['user', 'assistant'].includes(turn?.role) && typeof turn.text === 'string').map((turn) => ({ role: turn.role, text: turn.text.slice(0, 500) }));
}
