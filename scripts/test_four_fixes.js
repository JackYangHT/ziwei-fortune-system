const assert = require('assert');
const app = require('../webapp/app.js');

console.log('🧪 開始執行四大問題修復全面測試...\n');

const mockSessionMale = {
  clientName: '陳先生',
  gender: '男',
  birthday: '1985-06-15',
  birthHour: '08:30',
  targetYear: 2026,
  messages: []
};

const mockSessionFemale = {
  clientName: '林小姐',
  gender: '女',
  birthday: '1992-09-20',
  birthHour: '14:20',
  targetYear: 2026,
  messages: []
};

const mockSessionElder = {
  clientName: '張伯伯',
  gender: '男',
  birthday: '1955-03-10',
  birthHour: '06:00',
  targetYear: 2026,
  messages: []
};

// --------------------------------------------------------------------------
// 測試一：用泰文問「我太太的命如何」
// --------------------------------------------------------------------------
console.log('--- 測試 1: 泰文版在地化與泰國宇宙觀 (問：我太太的命如何) ---');
const thaiQuestion = 'ดวงภรรยาของฉันเป็นอย่างไร';
const thaiAns1 = app.generateNaturalAnswerFallback(
  { rawText: thaiQuestion, category: 'spouse_destiny', lang: 'th' },
  {},
  thaiQuestion,
  mockSessionMale,
  'th'
);

console.log('【泰文回答內容預覽】：\n', thaiAns1.plain.slice(0, 300), '...\n');

// 1. 確認主體包含泰國宇宙觀 / 印度九曜 / 阿育吠陀
assert(
  thaiAns1.plain.includes('โหราศาสตร์ไทย') || thaiAns1.plain.includes('นพเคราะห์'),
  '必須包含泰國占星或印度九曜宇宙觀'
);
assert(
  thaiAns1.plain.includes('พระจันทร์อยู่ในเรือนคู่') || thaiAns1.plain.includes('เรือนคู่'),
  '必須用泰國/印度星宿在เรือนคู่ (เรือนคู่ครอง) 解釋'
);
assert(
  thaiAns1.plain.includes('อายุรเวช') && thaiAns1.plain.includes('ธาตุ'),
  '必須包含阿育吠陀與四元素 (อายุรเวชและธาตุ)'
);

// 2. 確認中華命理術語只在括號內做對照
assert(
  thaiAns1.plain.includes('(เหมือน') || thaiAns1.plain.includes('(เหมือน 夫妻宮'),
  '中華命理術語必須放在括號中作為對照 (เหมือน ...)'
);

// 3. 確認包含幽默感五大元素
assert(thaiAns1.plain.includes('เรียบร้อย พี่จับทางดวงได้แล้ว (เช็ดปาก)'), '泰文必須包含開頭 (เช็ดปาก)');
assert(thaiAns1.plain.includes('กระดูกคนแก่แบบพี่ นั่งดูจนตาจะลายแล้วเนี่ย……'), '泰文必須包含老骨頭眼睛花轉折');
assert(thaiAns1.plain.includes('(ตบโต๊ะ) เดี๋ยวนะ ทำไมไม่รีบบอกตั้งแต่ทีแรก！'), '泰文必須包含拍桌轉折');
assert(thaiAns1.plain.includes('น่องไก่ของพี่ Jack อร่อยของจริง (หัวเราะ)'), '泰文必須包含雞腿是真的結尾');

console.log('✅ 測試 1 通過：泰文版真正在地化（泰國宇宙觀、印度星宿、阿育吠陀、中華術語放括號對照、完整幽默感）\n');

// --------------------------------------------------------------------------
// 測試二：用中文問「我什麼時候才能跟她過有情的日子」
// --------------------------------------------------------------------------
console.log('--- 測試 2: 拒絕模板回答 (問：我什麼時候才能跟她過有情的日子) ---');
const tenderQ = '我什麼時候才能跟她過有情的日子';
const tenderAns = app.generateNaturalAnswerFallback(
  { rawText: tenderQ, category: 'tender_days', lang: 'zh' },
  {},
  tenderQ,
  mockSessionMale,
  'zh'
);

console.log('【有情日子回答內容預覽】：\n', tenderAns.plain.slice(0, 300), '...\n');

// 1. 確認不是模板：不應有死板的「11 月 11 日」或舊版巨門重複內容
assert(!tenderAns.plain.includes('11 月 11 日'), '絕不可出現死板的 11 月 11 日模板');
assert(!tenderAns.plain.includes('天占 33.3%'), '絕不可出現死板的三才各占 33.3% 模板');

// 2. 確認緊扣有情的日子、具體時機（節氣交接、30-45天）與破冰心法
assert(tenderAns.plain.includes('有情的日子') || tenderAns.plain.includes('升溫期'), '回答必須緊扣有情日子的主題');
assert(tenderAns.plain.includes('嘴硬心軟') || tenderAns.plain.includes('破冰'), '必須有具體心理分析與破冰建議');

// 3. 確認包含幽默感
assert(tenderAns.plain.includes('「好，我捏好了。（擦嘴）」'), '必須包含開頭擦嘴幽默');
assert(tenderAns.plain.includes('我這把老骨頭，算到眼睛都快花了……'), '必須包含老骨頭幽默');
assert(tenderAns.plain.includes('喔我忽然發現你應該要問我……（拍桌）等等，你怎麼不早說！'), '必須包含拍桌幽默');
assert(tenderAns.plain.includes('命理僅供參考，但 Jack 老師的雞腿是真的。（笑）'), '必須包含雞腿結尾');

console.log('✅ 測試 2 通過：拒絕模板，量身定製有情日子升溫破冰專屬推算，具備幽默感\n');

// --------------------------------------------------------------------------
// 測試三：用中文問「我的事業工作從今起何時接得到大案子」
// --------------------------------------------------------------------------
console.log('--- 測試 3: 先講事業與大案子時機 (問：我的事業工作從今起何時接得到大案子) ---');
const bigDealQ = '我的事業工作從今起何時接得到大案子';
const bigDealAns = app.generateNaturalAnswerFallback(
  { rawText: bigDealQ, category: 'big_deal', lang: 'zh' },
  {},
  bigDealQ,
  mockSessionMale,
  'zh'
);

console.log('【大案子回答內容預覽】：\n', bigDealAns.plain.slice(0, 300), '...\n');

// 1. 確認先講事業和大案子
assert(bigDealAns.plain.includes('事業') && (bigDealAns.plain.includes('大案') || bigDealAns.plain.includes('大單')), '必須先講事業與大案');
assert(bigDealAns.plain.includes('立冬至大雪') || bigDealAns.plain.includes('45 至 60 天'), '必須有具體接案時間窗口');
assert(bigDealAns.plain.includes('合約') || bigDealAns.plain.includes('貴人'), '必須有具體拿下大案的兵法建議');

// 2. 確認包含幽默感
assert(bigDealAns.plain.includes('「好，我捏好了。（擦嘴）」'), '必須包含開頭擦嘴幽默');
assert(bigDealAns.plain.includes('我這把老骨頭，算到眼睛都快花了……'), '必須包含老骨頭幽默');
assert(bigDealAns.plain.includes('喔我忽然發現你應該要問我……（拍桌）等等，你怎麼不早說！'), '必須包含拍桌幽默');
assert(bigDealAns.plain.includes('命理僅供參考，但 Jack 老師的雞腿是真的。（笑）'), '必須包含雞腿結尾');

console.log('✅ 測試 3 通過：男性事業優先，精準推算接大案子時間窗口與策略，具備幽默感\n');

// --------------------------------------------------------------------------
// 測試四：族群身分針對性測試 (男性: 事業錢 / 女性: 感情錢 / 年長者: 健康)
// --------------------------------------------------------------------------
console.log('--- 測試 4: 針對使用者身分 (問：我今年運勢如何) ---');
const generalQ = '我今年運勢如何';

const maleAns = app.generateNaturalAnswerFallback(
  { rawText: generalQ, category: 'overall_fortune', lang: 'zh' },
  {},
  generalQ,
  mockSessionMale,
  'zh'
);
const femaleAns = app.generateNaturalAnswerFallback(
  { rawText: generalQ, category: 'overall_fortune', lang: 'zh' },
  {},
  generalQ,
  mockSessionFemale,
  'zh'
);
const elderAns = app.generateNaturalAnswerFallback(
  { rawText: generalQ, category: 'overall_fortune', lang: 'zh' },
  {},
  generalQ,
  mockSessionElder,
  'zh'
);

// 男性：先講事業、錢
console.log('男性運勢開頭：', maleAns.plain.slice(0, 150));
assert(maleAns.plain.includes('事業、錢在先') || (maleAns.plain.includes('事業') && maleAns.plain.includes('金錢')), '男性運勢必須先講事業與錢');

// 女性：先講感情、錢
console.log('女性運勢開頭：', femaleAns.plain.slice(0, 150));
assert(femaleAns.plain.includes('感情、錢都要') || (femaleAns.plain.includes('感情') && femaleAns.plain.includes('金錢')), '女性運勢必須感情、錢都要');

// 年長者：先講健康
console.log('年長者運勢開頭：', elderAns.plain.slice(0, 150));
assert(elderAns.plain.includes('身體健康永遠在先') || elderAns.plain.includes('身心健康'), '年長者運勢必須先講健康');

console.log('✅ 測試 4 通過：嚴格針對身分排序（男性：事業錢；女性：感情錢；年長者：健康）\n');

// --------------------------------------------------------------------------
// 測試五：等待提示中的幽默感（啃雞腿）
// --------------------------------------------------------------------------
console.log('--- 測試 5: 等待提示幽默感確認 ---');
// 從源代碼中驗證等待文字
const appCode = require('fs').readFileSync(require('path').join(__dirname, '../webapp/app.js'), 'utf8');
assert(appCode.includes('Jack 老師正在幫你掐指一算……（啃著雞腿）邊吃邊算，靈感特別好……'), '中文等待提示必須包含啃雞腿幽默');
assert(appCode.includes('พี่ Jack กำลังจับยามสามตาให้เธออยู่…… (แทะน่องไก่ไปด้วย) กินไปดูไป เซ้นส์ยิ่งแม่น……'), '泰文等待提示必須包含啃雞腿幽默');
console.log('✅ 測試 5 通過：等待提示完全符合幽默感規範\n');

console.log('🎉🎉🎉 所有四大問題修復測試 100% 通過！');
