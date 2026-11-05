import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePreferences, applyPresentation, parsePresentationCommand } from '../public/js/presentation.js';
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
  for (const { id } of languages) for (const key of ['review', 'confirm', 'language', 'chooseTemp', 'textSize', 'imageSize', 'audioNotice', 'help']) assert.notEqual(tr(id, key), key);
  for (const { id } of languages) assert.ok(productName('americano', id).length > 2);
});

test('a complaint about tiny text selects readable text without shrinking an already larger view', () => {
  const text = '글씨가 왜 이리 작아, 글씨 좀 키워줘!';
  const next = applyPresentation(normalizePreferences(), parsePresentationCommand(text));
  assert.equal(next.textScale, 1.4); assert.equal(next.imageScale, 1);
  const large = normalizePreferences({ textScale: 1.6 });
  assert.equal(applyPresentation(large, parsePresentationCommand(text, large)).textScale, 1.6);
});
