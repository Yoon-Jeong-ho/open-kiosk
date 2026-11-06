import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePreferences, applyPresentation, parsePresentationCommand, presentationForRequest } from '../public/js/presentation.js';
import { languages, tr, productName } from '../public/js/locale.js';

test('plain Korean enlargement changes text and images together', () => {
  const next = applyPresentation(normalizePreferences(), parsePresentationCommand('좀 크게 보여줘'));
  assert.equal(next.textScale, 1.15); assert.equal(next.imageScale, 1.15);
});
test('text and photo requests can be adjusted independently in both directions', () => {
  const initial = normalizePreferences();
  const text = applyPresentation(initial, parsePresentationCommand('글씨 좀 크게 보여줘'));
  assert.equal(text.textScale, 1.15); assert.equal(text.imageScale, 1);
  const photo = applyPresentation(text, parsePresentationCommand('사진 작게 해줘'));
  assert.equal(photo.textScale, 1.15); assert.equal(photo.imageScale, .85);
  assert.equal(initial.textScale, 1);
});
test('mixed orders and opposing display adjustments are never consumed as display-only', () => {
  for (const text of ['아메리카노 두 잔 주세요, 글씨도 크게', 'Add a latte and make text bigger', 'アメリカーノ二つ、文字も大きくして', '来杯美式，放大文字', '사진은 작게 글씨는 크게', '영어 대신 한국어로', '차가운 거에 헤이즐넛 시럽 추가하고 화면 크게']) assert.equal(parsePresentationCommand(text), null, text);
});
test('display requests work in English, Japanese and Chinese', () => {
  for (const text of ['Make the text bigger', '文字を大きくして', '放大文字']) {
    const next = applyPresentation(normalizePreferences(), parsePresentationCommand(text));
    assert.equal(next.textScale, 1.15, text); assert.equal(next.imageScale, 1, text);
  }
  assert.equal(parsePresentationCommand('영어로 바꿔줘').language, 'en');
  assert.equal(parsePresentationCommand('Switch to Japanese').language, 'ja');
});
test('scales stay bounded and reset does not lose language or reading preference', () => {
  let value = normalizePreferences({ language: 'en', read: true });
  for (let i = 0; i < 20; i++) value = applyPresentation(value, { text_delta: 1, image_delta: -1 });
  assert.equal(value.textScale, 1.6); assert.equal(value.imageScale, .75);
  value = applyPresentation(value, { reset: true });
  assert.equal(value.textScale, 1); assert.equal(value.imageScale, 1); assert.equal(value.language, 'en'); assert.equal(value.read, true);
});
test('invalid stored preferences are bounded and legacy large-mode preferences migrate', () => {
  assert.equal(normalizePreferences({ large: true }).textScale, 1.35);
  const value = normalizePreferences({ language: 'invalid', textScale: 99, imageScale: -1 });
  assert.equal(value.language, 'ko'); assert.equal(value.textScale, 1.6); assert.equal(value.imageScale, .75);
});
test('all supported locales have menu names and essential ordering labels', () => {
  for (const { id } of languages) for (const key of ['review', 'confirm', 'language', 'chooseTemp', 'textSize', 'imageSize', 'preparingMic', 'help']) assert.notEqual(tr(id, key), key);
  for (const { id } of languages) assert.ok(productName('americano', id).length > 2);
});

test('a complaint about tiny text selects readable text without shrinking an already larger view', () => {
  const text = '글씨가 왜 이리 작아, 글씨 좀 키워줘!';
  const next = applyPresentation(normalizePreferences(), parsePresentationCommand(text));
  assert.equal(next.textScale, 1.4); assert.equal(next.imageScale, 1);
  assert.equal(applyPresentation(next, parsePresentationCommand(text, next)).textScale, 1.55);
  const large = normalizePreferences({ textScale: 1.6 });
  assert.equal(applyPresentation(large, parsePresentationCommand(text, large)).textScale, 1.6);
});

test('readability requests can enlarge text and images together while preserving the chosen scale for later orders', () => {
  const text = '글씨가 왜 이리 작아? 글씨랑 그림을 좀 크게 키워줘!';
  const next = applyPresentation(normalizePreferences(), parsePresentationCommand(text));
  assert.equal(next.textScale, 1.4); assert.equal(next.imageScale, 1.4);
  assert.equal(parsePresentationCommand('아이스 아메리카노 두 잔 주세요.', next), null);
  assert.deepEqual(applyPresentation(next, {}), next);
  const large = normalizePreferences({ textScale: 1.6, imageScale: 1.5 });
  assert.deepEqual(applyPresentation(large, parsePresentationCommand(text, large)), large);
});

test('order-only model replies cannot shrink or reset the selected view, while explicit mixed requests still work', () => {
  const large = normalizePreferences({ textScale: 1.4, imageScale: 1.4, language: 'ko' });
  const unsolicited = { reset: true, text_size: 1, image_size: 1, language: 'en' };
  for (const text of ['아이스 아메리카노 두 잔 주세요.', '그중 하나만 따뜻하게', '차가운 거에 헤이즐넛 시럽 추가', 'Add one iced americano', 'アイスアメリカーノを二つ', '两杯冰美式']) {
    assert.deepEqual(applyPresentation(large, presentationForRequest(text, unsolicited)), large, text);
  }
  assert.equal(presentationForRequest('아메리카노 한 잔 추가하고 글씨랑 사진을 기본 크기로', unsolicited).reset, true);
  assert.equal(presentationForRequest('Add a latte and switch to English', { language: 'en' }).language, 'en');
});
