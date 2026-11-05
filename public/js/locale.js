export const languages = [
  { id: 'ko', label: '한국어', speech: 'ko-KR' },
  { id: 'en', label: 'English', speech: 'en-US' },
  { id: 'ja', label: '日本語', speech: 'ja-JP' },
  { id: 'zh', label: '中文', speech: 'zh-CN' },
];
const messages = {
  skip: ['본문으로 건너뛰기', 'Skip to content', '本文へ移動', '跳至主要内容'],
  experience: ['키오스크 체험', 'Try the kiosk', 'キオスク体験', '体验自助点单'],
  siteBack: ['사이트로', 'Back to site', 'サイトへ', '返回网站'],
  demo: ['체험 · 실제 결제 없음', 'Demo · no charges', '体験版・請求なし', '演示版 · 不会扣款'],
  menuTitle: ['메뉴', 'Menu', 'メニュー', '菜单'],
  language: ['언어', 'Language', '言語', '语言'],
  view: ['글자·사진', 'Text & images', '文字・写真', '文字与图片'],
  read: ['읽어주기', 'Read aloud', '読み上げ', '朗读'],
  all: ['전체', 'All', 'すべて', '全部'], coffee: ['커피', 'Coffee', 'コーヒー', '咖啡'], tea: ['차·음료', 'Tea & more', 'お茶・その他', '茶与其他'],
  textSize: ['글자 크기', 'Text size', '文字サイズ', '文字大小'], imageSize: ['사진 크기', 'Image size', '写真サイズ', '图片大小'],
  smaller: ['작게', 'Smaller', '小さく', '缩小'], larger: ['크게', 'Larger', '大きく', '放大'],
  reset: ['기본 크기로', 'Reset sizes', '標準サイズ', '恢复默认大小'], contrast: ['고대비', 'High contrast', '高コントラスト', '高对比度'],
  close: ['닫기', 'Close', '閉じる', '关闭'], empty: ['메뉴를 담아 주세요', 'Choose a drink', 'メニューを追加してください', '请选择饮品'],
  cart: ['내 주문', 'Your order', 'ご注文', '您的订单'], total: ['합계', 'Total', '合計', '合计'], clear: ['비우기', 'Clear', 'クリア', '清空'],
  hot: ['따뜻하게', 'Hot', 'ホット', '热饮'], iced: ['차갑게', 'Iced', 'アイス', '冰饮'],
  changeTemp: ['온도 변경', 'Change temperature', '温度を変更', '更改温度'], remove: ['삭제', 'Remove', '削除', '删除'],
  less: ['수량 줄이기', 'Decrease quantity', '数量を減らす', '减少数量'], more: ['수량 늘리기', 'Increase quantity', '数量を増やす', '增加数量'],
  quantity: ['수량', 'Quantity', '数量', '数量'], chooseTemp: ['온도를 골라 주세요', 'Choose a temperature', '温度をお選びください', '请选择温度'],
  addons: ['추가 옵션', 'Add-ons', '追加オプション', '附加选项'], editAddons: ['옵션 변경', 'Edit add-ons', 'オプション変更', '更改选项'], saveAddons: ['옵션 적용', 'Apply add-ons', 'オプションを適用', '应用选项'], hazelnut: ['헤이즐넛 시럽', 'Hazelnut syrup', 'ヘーゼルナッツシロップ', '榛果糖浆'], perCup: ['잔당', 'per drink', '1杯あたり', '每杯'],
  add: ['{count}잔 담기 · {price}', 'Add {count} · {price}', '{count}杯追加 · {price}', '添加{count}杯 · {price}'],
  review: ['주문 확인', 'Review order', '注文を確認', '确认订单'], help: ['도움 요청', 'Get help', 'サポート', '寻求帮助'],
  confirmTitle: ['이대로 주문할까요?', 'Ready to order?', 'この内容で注文しますか？', '确认下单吗？'],
  confirm: ['주문 확정', 'Place order', '注文する', '确认下单'], back: ['수정하기', 'Edit order', '修正する', '修改订单'],
  doneTitle: ['주문이 접수됐어요', 'Order received', '注文を受け付けました', '订单已接收'],
  orderNumber: ['주문번호', 'Order number', '注文番号', '订单号'], newOrder: ['새 주문', 'New order', '新しい注文', '重新点单'],
  voice: ['말하기', 'Speak', '話す', '语音输入'], stopRecord: ['녹음 끝내기', 'Stop recording', '録音を終了', '结束录音'],
  inputLabel: ['주문 또는 화면 설정 요청', 'Order or display request', '注文・表示設定の入力', '输入订单或显示设置'],
  placeholder: ['메뉴 주문 또는 “글씨 크게 보여줘”', 'Order, or say “make the text bigger”', '注文、または「文字を大きくして」', '点单，或输入“放大文字”'],
  send: ['보내기', 'Send', '送信', '发送'], repeat: ['안내 다시 듣기', 'Repeat guidance', '案内をもう一度聞く', '重听提示'],
  aiNote: ['주문 문장은 AI로 전송돼요. 개인정보는 입력하지 마세요.', 'Order text is sent to AI. Do not enter personal information.', '注文文はAIに送信されます。個人情報は入力しないでください。', '点单文字将发送给AI，请勿输入个人信息。'],
  initial: ['메뉴를 고르거나 말해 주세요.', 'Choose a drink, or tell us your order.', 'メニューを選ぶか、ご注文を話してください。', '请选择饮品，或说出您的订单。'],
  busy: ['확인하고 있어요…', 'Checking…', '確認中…', '正在确认…'],
  cartChanged: ['주문을 바꿨어요.', 'Your order is updated.', '注文を変更しました。', '订单已更新。'],
  cartCleared: ['장바구니를 비웠어요.', 'Your order is cleared.', '注文をクリアしました。', '订单已清空。'],
  transcribing: ['말씀을 글자로 바꾸고 있어요…', 'Transcribing…', '音声を文字に変換中…', '正在将语音转为文字…'],
  verifyTranscript: ['인식한 내용을 확인한 뒤 보내 주세요.', 'Check the text, then send it.', '認識した内容を確認して送信してください。', '请确认识别的文字后发送。'],
  recording: ['말씀해 주세요. 끝나면 녹음 종료를 눌러 주세요.', 'Speak, then press stop.', 'お話しください。終わったら録音を終了してください。', '请说话，结束后点击结束录音。'],
  micUnavailable: ['마이크를 사용할 수 없어요. 글자로 입력해 주세요.', 'Microphone unavailable. Please type instead.', 'マイクを使用できません。文字で入力してください。', '麦克风不可用，请输入文字。'],
  micDenied: ['마이크 권한을 확인하거나 글자로 입력해 주세요.', 'Check microphone access or type instead.', 'マイクの許可を確認するか、文字で入力してください。', '请检查麦克风权限，或输入文字。'],
  audioTitle: ['음성으로 입력할까요?', 'Use voice input?', '音声で入力しますか？', '使用语音输入吗？'],
  audioNotice: ['음성은 OpenAI로 전송돼요. 앱 서버는 녹음 원본을 보관하지 않아요. 이름·연락처는 말하지 마세요.', 'Audio is sent to OpenAI. This app does not save the recording. Do not say names or contact details.', '音声はOpenAIに送信されます。アプリは録音を保存しません。氏名・連絡先は話さないでください。', '语音将发送至OpenAI，本应用不保存录音。请勿说出姓名或联系方式。'],
  audioDuration: ['최대 20초 · 주문 문장은 전송 전 확인', 'Up to 20 seconds · review order text before sending', '最大20秒・注文文は送信前に確認', '最多20秒 · 发送订单文字前可确认'],
  agreeRecord: ['동의하고 녹음', 'Agree and record', '同意して録音', '同意并录音'], keyboardInstead: ['글자로 입력', 'Type instead', '文字で入力', '改用文字'],
  dataNotice: ['데이터 안내', 'Data information', 'データについて', '数据说明'],
  clearTitle: ['주문을 비울까요?', 'Clear your order?', '注文をクリアしますか？', '清空订单吗？'], clearConfirm: ['비우기', 'Clear order', 'クリアする', '清空订单'],
  languageChanged: ['한국어로 바꿨어요.', 'Switched to English.', '日本語に切り替えました。', '已切换为中文。'],
  textChanged: ['글자 {percent}%', 'Text {percent}%', '文字 {percent}%', '文字 {percent}%'],
  imageChanged: ['사진 {percent}%', 'Images {percent}%', '写真 {percent}%', '图片 {percent}%'],
  sizesReset: ['기본 크기로 바꿨어요.', 'Sizes reset.', '標準サイズに戻しました。', '已恢复默认大小。'],
  errorGeneral: ['요청을 확인해 주세요.', 'Please check your request.', '入力内容を確認してください。', '请检查您的输入。'],
  errorAI: ['AI 연결이 지연돼요. 메뉴판으로 계속 주문할 수 있어요.', 'AI is unavailable. You can still use the menu.', 'AIに接続できません。メニューから注文できます。', 'AI暂不可用，您仍可通过菜单点单。'],
  errorStale: ['주문이 바뀌었어요. 최신 내용을 확인해 주세요.', 'Your order changed. Check the latest items.', '注文が変更されました。最新の内容を確認してください。', '订单已更改，请确认最新内容。'],
  errorLimit: ['잠시 후 다시 시도해 주세요.', 'Please try again in a moment.', 'しばらくしてから再度お試しください。', '请稍后重试。'],
  helpDemo: ['도움 요청을 보냈어요. 체험 매장에는 실제 직원이 연결되지 않아요.', 'Help requested. No real staff are connected to this demo.', 'サポートを依頼しました。体験版に実際のスタッフは接続していません。', '已发送求助请求，演示版未连接真实店员。'],
  orderReceived: ['{number}번으로 접수됐어요.', 'Order {number} received.', '注文番号{number}で受け付けました。', '已接收订单{number}。'],
  unavailable: ['품절', 'Unavailable', '売り切れ', '售罄'],
};
const labels = {
  americano: ['아메리카노', 'Americano', 'アメリカーノ', '美式咖啡'],
  latte: ['카페라테', 'Caffè latte', 'カフェラテ', '拿铁咖啡'],
  vanilla: ['바닐라라테', 'Vanilla latte', 'バニララテ', '香草拿铁'],
  decaf: ['디카페인 아메리카노', 'Decaf americano', 'デカフェアメリカーノ', '低因美式咖啡'],
  matcha: ['말차라테', 'Matcha latte', '抹茶ラテ', '抹茶拿铁'],
  chocolate: ['초콜릿', 'Chocolate', 'チョコレート', '巧克力饮品'],
  peach: ['복숭아 아이스티', 'Peach iced tea', 'ピーチアイスティー', '桃子冰茶'],
  lemon: ['레몬에이드', 'Lemon ade', 'レモネード', '柠檬气泡饮'],
};
export const isLanguage = (value) => languages.some((l) => l.id === value);
export const addonName = (id, language = 'ko') => tr(language, id);
export function tr(language, key, values = {}) {
  const index = Math.max(0, languages.findIndex((l) => l.id === language));
  return (messages[key]?.[index] || messages[key]?.[0] || key).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}
export function productName(product, language = 'ko') {
  const index = Math.max(0, languages.findIndex((l) => l.id === language));
  const id = typeof product === 'string' ? product : product.product_id || product.id;
  return labels[id]?.[index] || product.name || id;
}
export function priceText(amount, language) {
  const value = new Intl.NumberFormat('ko-KR').format(amount);
  return language === 'ko' ? `${value}원` : `₩${value}`;
}
