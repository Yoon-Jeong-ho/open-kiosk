export const plans = {
  essential: { id: 'essential', name: 'Essential', price: 29000, description: '작은 매장의 첫 접근성 주문' },
  plus: { id: 'plus', name: 'Plus', price: 59000, description: '운영 흐름까지 한곳에서' },
};

export const presets = [
  { id: 'garden', name: '가든 커피', subtitle: '초록빛 동네 카페' },
  { id: 'campus', name: '캠퍼스 브루', subtitle: '함께 쉬어가는 학교 카페' },
  { id: 'slow', name: '슬로우 모닝', subtitle: '내 속도로 시작하는 하루' },
];

export const catalog = [
  { id: 'americano', name: '아메리카노', en: 'Americano', category: 'coffee', price: 3500, temperatures: ['hot', 'iced'], description: '깔끔하고 깊은 에스프레소와 물', art: 'coffee', color: '#e2c9a8' },
  { id: 'latte', name: '카페라테', en: 'Caffè latte', category: 'coffee', price: 4200, temperatures: ['hot', 'iced'], description: '고소한 우유가 더해진 부드러운 커피', art: 'latte', color: '#eedcc4' },
  { id: 'vanilla', name: '바닐라라테', en: 'Vanilla latte', category: 'coffee', price: 4700, temperatures: ['hot', 'iced'], description: '은은한 바닐라 향과 우유의 달콤함', art: 'latte', color: '#f0e4cb' },
  { id: 'decaf', name: '디카페인 아메리카노', en: 'Decaf americano', category: 'coffee', price: 4000, temperatures: ['hot', 'iced'], description: '디카페인 원두로 즐기는 깔끔한 커피', art: 'coffee', color: '#d4c6b2' },
  { id: 'matcha', name: '말차라테', en: 'Matcha latte', category: 'tea', price: 4800, temperatures: ['hot', 'iced'], description: '쌉싸름한 말차와 부드러운 우유', art: 'matcha', color: '#dce7c7' },
  { id: 'chocolate', name: '초콜릿', en: 'Chocolate', category: 'tea', price: 4500, temperatures: ['hot', 'iced'], description: '진한 코코아의 달콤한 한 잔', art: 'chocolate', color: '#e4d0c7' },
  { id: 'peach', name: '복숭아 아이스티', en: 'Peach iced tea', category: 'tea', price: 3800, temperatures: ['iced'], description: '산뜻한 복숭아 향의 차가운 차', art: 'tea', color: '#f0d6c7' },
  { id: 'lemon', name: '레몬에이드', en: 'Lemon ade', category: 'tea', price: 4500, temperatures: ['iced'], description: '레몬과 탄산수의 상큼한 만남', art: 'lemon', color: '#f2eac0' },
  { id: 'scone', name: '버터 스콘', en: 'Butter scone', category: 'dessert', price: 3500, temperatures: [], description: '버터 풍미의 스콘 한 개', art: 'scone', color: '#efe0bd', tags: ['bakery', 'mild'] },
  { id: 'brownie', name: '초콜릿 브라우니', en: 'Chocolate brownie', category: 'dessert', price: 4200, temperatures: [], description: '진한 초콜릿 브라우니 한 조각', art: 'brownie', color: '#e8d1c4', tags: ['chocolate', 'sweet'] },
  { id: 'cheesecake', name: '딸기 치즈케이크', en: 'Strawberry cheesecake', category: 'dessert', price: 5500, temperatures: [], description: '딸기를 올린 치즈케이크 한 조각', art: 'cake', color: '#efd6d9', tags: ['cake', 'sweet'] },
  { id: 'sandwich', name: '햄치즈 샌드위치', en: 'Ham & cheese sandwich', category: 'brunch', price: 6500, temperatures: [], description: '햄과 치즈, 채소를 넣은 샌드위치', art: 'sandwich', color: '#dfebd3', tags: ['meal', 'savory'] },
  { id: 'toast', name: '에그 토스트', en: 'Egg toast', category: 'brunch', price: 6000, temperatures: [], description: '달걀과 채소를 곁들인 토스트', art: 'toast', color: '#f1e5c7', tags: ['meal', 'savory'] },
  { id: 'yogurt', name: '과일 요거트볼', en: 'Fruit yogurt bowl', category: 'brunch', price: 6800, temperatures: [], description: '과일과 그래놀라를 곁들인 요거트볼', art: 'yogurt', color: '#deddeb', tags: ['meal', 'fruit', 'mild'] },
].map((p) => ({ ...p, unit: p.temperatures.length ? 'cup' : 'item', tags: p.tags || (['americano', 'decaf'].includes(p.id) ? ['coffee', 'not_sweet'] : p.id === 'latte' ? ['coffee', 'mild'] : ['sweet']), addons: p.category === 'coffee' ? [{ id: 'hazelnut', name: '헤이즐넛 시럽', price: 500 }] : [] }));

export const temperatureName = (value) => value === 'hot' ? '따뜻하게' : value === 'iced' ? '차갑게' : '';
export const money = (value) => new Intl.NumberFormat('ko-KR').format(value);
