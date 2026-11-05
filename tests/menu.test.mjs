import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../src/catalog.mjs';
import { applyOperations, pricedCart } from '../src/cart.mjs';
import { parseMenuNavigation, navigationForRequest } from '../public/js/menu-intent.js';
import { recommendationBudget, validateRecommendations } from '../src/recommendations.mjs';
import { quantityText, productName, languages } from '../public/js/locale.js';
import { parsePresentationCommand } from '../public/js/presentation.js';
const menu = catalog.map((p) => ({ ...p, available: true }));

test('hunger and sweet-food phrases navigate to the requested menu without implying an order', () => {
  for (const text of ['나 배고픈데', '출출해요', 'I am hungry', 'お腹が空いた', '我饿了']) assert.equal(parseMenuNavigation(text), 'brunch', text);
  for (const text of ['달달한거 먹고 싶은데', '달콤한 간식 먹고 싶어', 'I want something sweet', 'デザートメニュー', '甜点菜单']) assert.equal(parseMenuNavigation(text), 'dessert', text);
  assert.equal(parseMenuNavigation('커피 메뉴 보여줘'), 'coffee'); assert.equal(parseMenuNavigation('전체 메뉴로 돌아가'), 'all');
});
test('mixed food orders, recommendations, and display requests are not swallowed as browsing commands', () => {
  for (const text of ['배고픈데 샌드위치 하나 주세요', '브런치 두 개 주문해줘', '커피와 브런치 추천해줘', '브런치 메뉴 보여주고 글씨 크게']) assert.equal(parseMenuNavigation(text), null, text);
  for (const text of ['치즈케이크 한 개 담고 사진 크게', '샌드위치 하나 추가하고 글씨 키워', '브런치 추천하고 글씨 크게']) assert.equal(parsePresentationCommand(text), null, text);
  assert.equal(navigationForRequest('아메리카노 두 잔 주세요', 'brunch'), null);
  assert.equal(navigationForRequest('커피랑 브런치 추천해줘', 'brunch'), 'brunch');
  assert.equal(navigationForRequest('달지 않은 커피와 브런치를 만 원 안에서 추천해줘', null), 'brunch');
});
test('food has no drink temperature, keeps its own unit and merges correctly with mixed orders', () => {
  let cart = applyOperations([], [{ type:'add', product_id:'sandwich', quantity:1, temperature:null }, { type:'add', product_id:'americano', quantity:1, temperature:'iced' }], menu);
  cart = applyOperations(cart, [{ type:'add', product_id:'sandwich', quantity:1 }], menu);
  const priced = pricedCart(cart, menu), food=priced.find((l)=>l.product_id==='sandwich');
  assert.equal(food.temperature,null); assert.equal(food.quantity,2); assert.equal(food.unit,'item'); assert.equal(priced.reduce((s,l)=>s+l.subtotal,0),16500);
  assert.equal(quantityText(2,food),'2개'); assert.equal(quantityText(1,priced.find((l)=>l.product_id==='americano')),'1잔');
  assert.throws(()=>applyOperations(cart,[{type:'temperature',line_id:food.id,temperature:'hot'}],menu));
  assert.throws(()=>applyOperations([],[{type:'add',product_id:'scone',quantity:1,temperature:'iced'}],menu));
});
test('recommendations reject invented or sold-out products and ignore model-supplied prices', () => {
  const proposals=[{product_ids:['invented'],reason:'x'}, {product_ids:['americano','sandwich'],title:'Coffee and brunch',reason:'커피와 식사',total:1}, {product_ids:['americano','sandwich'],reason:'duplicate'}, {product_ids:['brownie','brownie'],reason:'duplicate item'}];
  const results=validateRecommendations(proposals,menu,{text:'1만원 안에서 추천'});
  assert.equal(results.length,1); assert.equal(results[0].total,10000);
  assert.equal(validateRecommendations(proposals,menu.map((p)=>({...p,available:p.id!=='sandwich'}))).length,0);
});
test('budgets are checked against real menu prices and allergy safety is not inferred', () => {
  for(const [text,budget] of [['만원 안에서',10000],['1만 5천원',15000],['10,000원 이하',10000],['5천원',5000],['오천원',5000],['이만 원',20000],['칠천오백원',7500],['1만 오천원',15000],['within 10000 won',10000],['10000ウォン以内',10000],['一万韩元以内',10000]]) assert.equal(recommendationBudget(text),budget,text);
  const set=[{product_ids:['americano','sandwich'],reason:'커피와 브런치'}];
  assert.equal(validateRecommendations(set,menu,{text:'9000원 안에서 추천'}).length,0);
  assert.equal(validateRecommendations(set,menu,{text:'견과 알레르기 안전한 메뉴 추천'}).length,0);
});
test('all new food names and quantity units work in every supported language', () => {
  for(const language of languages) for(const food of menu.filter((p)=>p.unit==='item')) { assert.notEqual(productName(food,language.id),food.id); assert.ok(quantityText(1,food,language.id).length>1); }
});
