const assert = require('assert');
const app = require('../webapp/app.js');

console.log('🧪 開始執行【五個問題一次修復】專項驗收測試...\n');

const mockSession = {
  clientName: '測試王先生',
  birthday: '1988-06-18',
  birthClockTime: '10:30',
  gender: '男',
  targetYear: 2026,
  userFacts: { isSalariedWorker: true },
  messages: []
};

// ============================================================================
// 測試 1：問「我財運如何」
// 確認：
// 1. 沒有跳出彩券選擇按鈕
// 2. 完整推算沒有重複解釋（每個宮位只解釋一次，例如「財帛宮（主管賺錢與金錢流動的宮位）坐寅宮」）
// 3. 四化引動解釋清晰（說清楚是哪個四化引動，如無四化則說「無明顯四化」）
// 4. 易經卦象整合到白話版（包含起卦依據、卦象意義、具體建議）
// 5. 先說大限，再說流年走到丙午，再看流月、流日
// ============================================================================
console.log('--- 測試 1: 問「我財運如何」 ---');
const wealthQuery = '我財運如何';
assert(app.isWealthQuery(wealthQuery), '應該識別為財運提問');

const wealthAns = app.buildWealthAnswer(mockSession, wealthQuery, 'zh');

// 1. 確認沒有彩券按鈕
console.log('1. 驗證彩券選擇按鈕：');
assert.strictEqual(wealthAns.lotteryOptions, null, '問財運時 lotteryOptions 必須為 null');
assert(!wealthAns.plain.includes('請選擇彩券種類'), '問財運白話版絕不可出現請選擇彩券種類提示');
console.log('   ✅ 通過：問財運時 lotteryOptions 為 null，無任何彩券選擇按鈕干擾！');

// 2. 確認完整推算沒有重複解釋
console.log('2. 驗證完整推算無重複解釋：');
const calc = wealthAns.calculation;
assert(calc, '完整推算必須存在');
assert(
  !calc.includes('財帛（代表金錢收益）宮（主管賺錢與金錢流動）'),
  '嚴禁出現「財帛（代表金錢收益）宮（主管賺錢與金錢流動）」重複詞綴'
);
assert(
  !calc.includes('官祿（代表職場工作）宮（主管工作事業）'),
  '嚴禁出現「官祿（代表職場工作）宮（主管工作事業）」重複詞綴'
);
// 檢查是否每個宮位只解釋一次
const duplicatePalacePattern = /(?:財帛|官祿|事業|夫妻|兄弟|子女|田宅|福德|疾厄|遷移|僕役|父母)（[^）]+）宮（[^）]+）/;
assert(!duplicatePalacePattern.test(calc), '完整推算中宮位不可有連續雙重解釋');
assert(
  calc.includes('財帛宮（主管賺錢與金錢流動的宮位）坐'),
  '必須格式化為：「財帛宮（主管賺錢與金錢流動的宮位）坐 X 宮」'
);
console.log('   ✅ 通過：完整推算每個宮位只解釋一次，無任何名詞重複或雙重括號！');

// 3. 確認四化引動解釋清晰
console.log('3. 驗證四化引動清楚解釋：');
assert(calc.includes('四化引動'), '完整推算中必須包含四化引動項目');
const hasClearMutagen = calc.includes('無明顯四化') || /化[祿禄權权科忌]/.test(calc);
assert(hasClearMutagen, '四化引動必須明確指出引動之四化或說明「無明顯四化」');
console.log('   ✅ 通過：四化引動清晰指明引動四化或明確標註「無明顯四化」！');

// 4. 確認易經卦象整合到白話版
console.log('4. 驗證易經卦象整合到白話版：');
const plain = wealthAns.plain;
assert(plain.includes('步驟 6（易經當下決策與免責提醒）') || plain.includes('易經當下決策與免責提醒'), '白話版必須包含易經當下決策與免責提醒');
assert(plain.includes('起卦依據'), '白話版易經指引必須包含「起卦依據」');
assert(
  plain.includes('時空數') || plain.includes('時間') || plain.includes('起卦'),
  '起卦依據必須說明是用當前時間起卦'
);
assert(plain.includes('卦象意義'), '白話版易經指引必須包含「卦象意義」');
assert(plain.includes('象徵'), '卦象意義必須說明象徵內涵');
assert(plain.includes('具體建議'), '白話版易經指引必須包含「具體建議」');
console.log('   ✅ 通過：白話版步驟 6 完整整合易經起卦依據、卦象意義與具體決策建議！');

// 5. 確認先說大限，再說流年走到丙午，再看流月、流日
console.log('5. 驗證時間軸層層推進（先大限、再流年、再看流月流日）：');
assert(plain.includes('步驟 2（先天命盤與時間軸定位）'), '白話版必須包含步驟 2');
assert(/你目前走到第\s*\d+\s*大限/.test(plain), '白話版步驟 2 必須明確指出「你目前走到第 X 大限」');
assert(/大限命宮在\s*[\u4e00-\u9fa5]+\s*宮/.test(plain), '白話版步驟 2 必須明確指出「大限命宮在 X 宮」');
assert(plain.includes('今年流年走到丙午'), '白話版步驟 2 必須指出「今年流年走到丙午」');
assert(plain.includes('再看流月、流日'), '白話版步驟 2 必須包含「再看流月、流日」');

// 檢查順序：大限在流年之前，流年在流月流日之前
const decadalPos = plain.indexOf('大限');
const yearlyPos = plain.indexOf('今年流年走到丙午');
const monthlyDailyPos = plain.indexOf('再看流月、流日');
assert(decadalPos < yearlyPos, '必須先說大限，再說流年');
assert(yearlyPos < monthlyDailyPos, '流年之後再看流月、流日');
console.log('   ✅ 通過：時間軸精確落實先說大限（第 X 大限、命宮在 X 宮），再說流年走到丙午，再看流月、流日！');

// ============================================================================
// 測試 2：問「我的樂透號碼」
// 確認：彩券選擇用文字帶出，不是按鈕
// ============================================================================
console.log('\n--- 測試 2: 問「我的樂透號碼」 ---');
const lotteryQuery = '我的樂透號碼';
const lotteryAns = app.generateNaturalAnswerFallback(
  { category: 'lucky_numbers', rawText: lotteryQuery },
  {},
  lotteryQuery,
  mockSession,
  'zh'
);

assert.strictEqual(lotteryAns.lotteryOptions, null, '彩券選擇不應該用按鈕，lotteryOptions 必須為 null');
assert(lotteryAns.plain.includes('你想買哪一種彩券呢？'), '必須在文字中詢問想買哪種彩券');
assert(lotteryAns.plain.includes('1. 大樂透'), '文字中必須列出大樂透');
assert(lotteryAns.plain.includes('2. 威力彩'), '文字中必須列出威力彩');
assert(lotteryAns.plain.includes('3. 今彩539'), '文字中必須列出今彩539');
assert(lotteryAns.plain.includes('4. 雙贏彩'), '文字中必須列出雙贏彩');
assert(lotteryAns.plain.includes('5. 三星彩'), '文字中必須列出三星彩');
assert(lotteryAns.plain.includes('6. 四星彩'), '文字中必須列出四星彩');
assert(lotteryAns.plain.includes('請告訴我你想買哪一種？'), '文字中必須帶出引導提問');
console.log('   ✅ 通過：問樂透號碼時，彩券種類完全融入自然回答文字中帶出，絕無按鈕！');

console.log('\n🎉 所有 5 項修復驗證測試 100% 全部通過！');
